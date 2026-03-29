import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import { ArrowLeft, Music } from 'lucide-react';
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
  const [musician, setMusician] = useState(null);
  const [concerts, setConcerts] = useState([]);
  const [filteredConcerts, setFilteredConcerts] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedConcert, setSelectedConcert] = useState(null);
  const [loading, setLoading] = useState(true);

  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null);
  const polylineRef = useRef(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: MAP_LIBRARIES,
  });

  // Load musician info
  useEffect(() => {
    api.get(`/api/musicians/${musicianId}`).then(r => setMusician(r.data)).catch(console.error);
  }, [musicianId]);

  // Load concerts
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/concerts?musicianId=${musicianId}`),
      api.get(`/api/concerts/months/${musicianId}`)
    ]).then(([concertsRes, monthsRes]) => {
      setConcerts(concertsRes.data);
      setFilteredConcerts(concertsRes.data);
      setAvailableMonths(monthsRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [musicianId]);

  // Filter concerts by month
  const handleMonthFilter = useCallback(async (month) => {
    if (month === selectedMonth) {
      setSelectedMonth(null);
      setFilteredConcerts(concerts);
      return;
    }
    setSelectedMonth(month);
    if (month) {
      const res = await api.get(`/api/concerts?musicianId=${musicianId}&month=${month}`);
      setFilteredConcerts(res.data);
    } else {
      setFilteredConcerts(concerts);
    }
    setSelectedConcert(null);
  }, [selectedMonth, concerts, musicianId]);

  // Click on concert
  const handleConcertClick = useCallback((concert) => {
    setSelectedConcert(concert);
    if (mapRef.current && concert.venue_lat && concert.venue_lng) {
      mapRef.current.panTo({ lat: concert.venue_lat, lng: concert.venue_lng });
      mapRef.current.setZoom(13);
    }
  }, []);

  // Setup map markers + clustering + polyline
  const setupMapOverlays = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) clustererRef.current.clearMarkers();
    if (polylineRef.current) polylineRef.current.setMap(null);

    const validConcerts = filteredConcerts.filter(c => c.venue_lat && c.venue_lng);
    if (validConcerts.length === 0) return;

    // Create markers
    const markers = validConcerts.map((concert, idx) => {
      const isSelected = selectedConcert?.id === concert.id;
      const marker = new window.google.maps.Marker({
        position: { lat: concert.venue_lat, lng: concert.venue_lng },
        title: concert.venue_name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 14 : 10,
          fillColor: isSelected ? '#f5c842' : '#ffffff',
          fillOpacity: 1,
          strokeColor: isSelected ? '#e6b800' : '#f5c842',
          strokeWeight: 2,
        },
        zIndex: isSelected ? 1000 : idx,
      });

      // Tooltip on hover
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="background:#111827;color:white;padding:10px 14px;border-radius:8px;min-width:180px;font-family:Inter,sans-serif;">
            <p style="font-weight:600;margin:0 0 4px 0;font-size:13px">${concert.venue_name}</p>
            <p style="color:#f5c842;margin:0;font-size:12px">${formatDate(concert.concert_date)}</p>
            ${concert.concert_time ? `<p style="color:rgba(255,255,255,0.5);margin:4px 0 0 0;font-size:11px">${concert.concert_time}</p>` : ''}
          </div>`,
        disableAutoPan: true,
      });

      marker.addListener('mouseover', () => infoWindow.open({ map: mapRef.current, anchor: marker }));
      marker.addListener('mouseout', () => infoWindow.close());
      marker.addListener('click', () => handleConcertClick(concert));

      return marker;
    });

    markersRef.current = markers;

    // Marker clusterer
    clustererRef.current = new MarkerClusterer({
      map: mapRef.current,
      markers,
      renderer: {
        render: ({ count, position }) => {
          const div = document.createElement('div');
          div.className = 'cluster-marker';
          div.textContent = count;
          return new window.google.maps.marker.AdvancedMarkerElement
            ? new window.google.maps.marker.AdvancedMarkerElement({ position, content: div })
            : new window.google.maps.Marker({
                position,
                label: { text: String(count), color: '#0a0e1a', fontWeight: '700' },
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 20,
                  fillColor: '#f5c842',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }
              });
        }
      }
    });

    // Polyline connecting concerts in date order
    const path = validConcerts.map(c => ({ lat: c.venue_lat, lng: c.venue_lng }));
    polylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#f5c842',
      strokeOpacity: 0.3,
      strokeWeight: 1.5,
      map: mapRef.current,
    });

    // Fit map bounds
    if (!selectedConcert && validConcerts.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      validConcerts.forEach(c => bounds.extend({ lat: c.venue_lat, lng: c.venue_lng }));
      mapRef.current.fitBounds(bounds, { padding: 80 });
    }
  }, [filteredConcerts, selectedConcert, handleConcertClick]);

  useEffect(() => {
    if (isLoaded && mapRef.current) setupMapOverlays();
  }, [isLoaded, filteredConcerts, selectedConcert, setupMapOverlays]);

  if (loadError) return (
    <div className="h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-2">Google Maps를 불러올 수 없습니다.</p>
        <p className="text-white/40 text-sm">VITE_GOOGLE_MAPS_API_KEY를 확인해주세요.</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen relative overflow-hidden" style={{ overflow: 'hidden' }}>
      {/* Back button */}
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

      {/* Map */}
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
            setupMapOverlays();
          }}
        />
      ) : (
        <div className="w-full h-full bg-[#0a0e1a] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#f5c842] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Right Panel */}
      {selectedConcert ? (
        <ConcertDetailPanel
          concert={selectedConcert}
          musician={musician}
          onClose={() => {
            setSelectedConcert(null);
            if (mapRef.current) {
              const validConcerts = filteredConcerts.filter(c => c.venue_lat && c.venue_lng);
              if (validConcerts.length > 0) {
                const bounds = new window.google.maps.LatLngBounds();
                validConcerts.forEach(c => bounds.extend({ lat: c.venue_lat, lng: c.venue_lng }));
                mapRef.current.fitBounds(bounds, { padding: 80 });
              }
            }
          }}
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
