import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import { ArrowLeft } from 'lucide-react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import api from '../api';
import ScheduleSidebar from './ScheduleSidebar';
import ConcertDetailPanel from './ConcertDetailPanel';

const MAP_LIBRARIES = ['places', 'geometry'];

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8fa8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e2340' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9098a9' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c4c8cc' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#162032' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0d1322' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1c2d45' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060b14' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d4b5a' }] },
];

export default function MapPage() {
  const { musicianId } = useParams();
  const navigate = useNavigate();

  const [musician, setMusician]             = useState(null);
  const [concerts, setConcerts]             = useState([]);
  const [filteredConcerts, setFilteredConcerts] = useState([]);
  const [selectedMonth, setSelectedMonth]   = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedConcert, setSelectedConcert] = useState(null);
  const [loading, setLoading]               = useState(true);
  const [mapReady, setMapReady]             = useState(false);

  const mapRef        = useRef(null);
  const markersRef    = useRef([]);   // { marker, concertId }[]
  const clustererRef  = useRef(null);
  const polylineRef   = useRef(null);
  const infoWindowsRef = useRef([]);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: MAP_LIBRARIES,
  });

  // ── 데이터 로드 ──────────────────────────────
  useEffect(() => {
    api.get(`/api/musicians/${musicianId}`).then(r => setMusician(r.data)).catch(console.error);
  }, [musicianId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/concerts?musicianId=${musicianId}`),
      api.get(`/api/concerts/months/${musicianId}`)
    ]).then(([cRes, mRes]) => {
      setConcerts(cRes.data);
      setFilteredConcerts(cRes.data);
      setAvailableMonths(mRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [musicianId]);

  // ── 마커 전체 재생성 (filteredConcerts 변경 시) ──
  // selectedConcert는 마커 스타일만 바꾸고 재생성 안 함
  const buildMarkers = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    // 기존 제거
    infoWindowsRef.current.forEach(iw => iw.close());
    infoWindowsRef.current = [];
    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) { clustererRef.current.clearMarkers(); }
    if (polylineRef.current)  { polylineRef.current.setMap(null); polylineRef.current = null; }

    const valid = filteredConcerts.filter(c => c.venue_lat != null && c.venue_lng != null);
    if (valid.length === 0) return;

    const newMarkers = valid.map((concert, idx) => {
      const lat = parseFloat(concert.venue_lat);
      const lng = parseFloat(concert.venue_lng);
      if (isNaN(lat) || isNaN(lng)) return null;

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        title: concert.venue_name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeColor: '#f5c842',
          strokeWeight: 2,
        },
        zIndex: idx,
        map: mapRef.current,
      });

      const iw = new window.google.maps.InfoWindow({
        content: `
          <div style="background:#111827;color:white;padding:10px 14px;border-radius:8px;
                      min-width:180px;font-family:Inter,sans-serif;border:1px solid rgba(255,255,255,0.1)">
            <p style="font-weight:600;margin:0 0 4px;font-size:13px">${concert.venue_name}</p>
            <p style="color:#f5c842;margin:0;font-size:12px">${formatDate(concert.concert_date)}</p>
            ${concert.concert_time
              ? `<p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:11px">${concert.concert_time}</p>`
              : ''}
          </div>`,
        disableAutoPan: true,
      });
      infoWindowsRef.current.push(iw);

      marker.addListener('mouseover', () => {
        infoWindowsRef.current.forEach(w => w.close());
        iw.open({ map: mapRef.current, anchor: marker });
      });
      marker.addListener('mouseout', () => iw.close());
      marker.addListener('click', () => handleConcertClick(concert));

      return { marker, concertId: concert.id, lat, lng };
    }).filter(Boolean);

    markersRef.current = newMarkers;

    // 클러스터러
    clustererRef.current = new MarkerClusterer({
      map: mapRef.current,
      markers: newMarkers.map(m => m.marker),
      renderer: {
        render: ({ count, position }) =>
          new window.google.maps.Marker({
            position,
            label: { text: String(count), color: '#0a0e1a', fontWeight: '700', fontSize: '13px' },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 20,
              fillColor: '#f5c842',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            zIndex: 999,
          })
      }
    });

    // 폴리라인
    polylineRef.current = new window.google.maps.Polyline({
      path: newMarkers.map(m => ({ lat: m.lat, lng: m.lng })),
      geodesic: true,
      strokeColor: '#f5c842',
      strokeOpacity: 0.35,
      strokeWeight: 1.5,
      map: mapRef.current,
    });

    // 전체 보이도록 bounds 맞추기
    const bounds = new window.google.maps.LatLngBounds();
    newMarkers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
    mapRef.current.fitBounds(bounds, { padding: 100 });

  }, [filteredConcerts]); // selectedConcert 의존성 제거!

  // ── 선택된 공연 마커 스타일만 업데이트 ──────────
  const updateMarkerStyles = useCallback(() => {
    markersRef.current.forEach(({ marker, concertId }) => {
      const isSelected = selectedConcert?.id === concertId;
      marker.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: isSelected ? 15 : 10,
        fillColor: isSelected ? '#f5c842' : '#ffffff',
        fillOpacity: 1,
        strokeColor: isSelected ? '#e6b800' : '#f5c842',
        strokeWeight: isSelected ? 3 : 2,
      });
      marker.setZIndex(isSelected ? 1000 : 1);
    });
  }, [selectedConcert]);

  // ── 지도 준비되면 마커 생성 ──────────────────────
  useEffect(() => {
    if (isLoaded && mapReady) buildMarkers();
  }, [isLoaded, mapReady, filteredConcerts, buildMarkers]);

  // ── 선택 공연 변경 시 마커 스타일 + 지도 이동 ───
  useEffect(() => {
    if (!mapReady || !window.google) return;
    updateMarkerStyles();
    if (selectedConcert) {
      const lat = parseFloat(selectedConcert.venue_lat);
      const lng = parseFloat(selectedConcert.venue_lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(13);
      }
    }
  }, [selectedConcert, mapReady, updateMarkerStyles]);

  // ── 공연 클릭 핸들러 ─────────────────────────────
  const handleConcertClick = useCallback((concert) => {
    setSelectedConcert(concert);
  }, []);

  // ── 월 필터 ──────────────────────────────────────
  const handleMonthFilter = useCallback(async (month) => {
    setSelectedConcert(null);
    if (month === selectedMonth) {
      setSelectedMonth(null);
      setFilteredConcerts(concerts);
      return;
    }
    setSelectedMonth(month);
    const res = await api.get(`/api/concerts?musicianId=${musicianId}&month=${month}`);
    setFilteredConcerts(res.data);
  }, [selectedMonth, concerts, musicianId]);

  // ── 닫기 ─────────────────────────────────────────
  const handleClose = useCallback(() => {
    setSelectedConcert(null);
    if (mapReady && window.google) {
      const valid = filteredConcerts.filter(c => c.venue_lat != null && c.venue_lng != null);
      if (valid.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        valid.forEach(c => {
          const lat = parseFloat(c.venue_lat);
          const lng = parseFloat(c.venue_lng);
          if (!isNaN(lat) && !isNaN(lng)) bounds.extend({ lat, lng });
        });
        mapRef.current.fitBounds(bounds, { padding: 100 });
      }
    }
  }, [filteredConcerts, mapReady]);

  if (loadError) return (
    <div className="h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-2">Google Maps를 불러올 수 없습니다.</p>
        <p className="text-white/40 text-sm">VITE_GOOGLE_MAPS_API_KEY를 확인해주세요.</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen relative" style={{ overflow: 'hidden' }}>
      {/* 뒤로가기 버튼 */}
      <button
        onClick={() => navigate('/musicians')}
        className="absolute top-4 left-4 z-20 bg-[#111827]/90 backdrop-blur border border-white/10
                   text-white hover:text-[#f5c842] hover:border-[#f5c842]/30
                   rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-medium
                   transition-all duration-200 shadow-lg"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{musician?.name_ko || '연주자 목록'}</span>
      </button>

      {/* 지도 */}
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: 40, lng: 20 }}
          zoom={3}
          options={{
            styles: MAP_STYLES,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
          onLoad={map => {
            mapRef.current = map;
            setMapReady(true);
          }}
        />
      ) : (
        <div className="w-full h-full bg-[#0a0e1a] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#f5c842] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 오른쪽 패널 */}
      {selectedConcert ? (
        <ConcertDetailPanel
          concert={selectedConcert}
          musician={musician}
          onClose={handleClose}
        />
      ) : (
        <ScheduleSidebar
          musician={musician}
          concerts={filteredConcerts}
          allConcerts={concerts}
          selectedMonth={selectedMonth}
          availableMonths={availableMonths}
          loading={loading}
          onConcertClick={handleConcertClick}
          onMonthFilter={handleMonthFilter}
        />
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}
