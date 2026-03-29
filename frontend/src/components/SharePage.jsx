import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { MapPin, Calendar, Music, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../api';

const MAP_LIBRARIES = ['places'];
const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8fa8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e2340' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#162032' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060b14' }] },
];

export default function SharePage() {
  const { token }  = useParams();
  const navigate   = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null);
  const polylineRef = useRef(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: MAP_LIBRARIES,
  });

  useEffect(() => {
    api.get(`/api/share/${token}`)
      .then(r => setData(r.data))
      .catch(() => setError('링크를 찾을 수 없거나 만료되었습니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  const setupMap = () => {
    if (!mapRef.current || !window.google || !data) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) clustererRef.current.clearMarkers();
    if (polylineRef.current) polylineRef.current.setMap(null);

    const valid = data.concerts.filter(c => c.venue_lat && c.venue_lng);
    if (valid.length === 0) return;

    const markers = valid.map((c, idx) => {
      const marker = new window.google.maps.Marker({
        position: { lat: c.venue_lat, lng: c.venue_lng },
        title: c.venue_name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10, fillColor: '#ffffff', fillOpacity: 1,
          strokeColor: '#f5c842', strokeWeight: 2,
        },
        zIndex: idx,
      });

      const iw = new window.google.maps.InfoWindow({
        content: `<div style="background:#111827;color:white;padding:10px 14px;border-radius:8px;min-width:160px;font-family:Inter,sans-serif;">
          <p style="font-weight:600;margin:0 0 4px;font-size:13px">${c.venue_name}</p>
          <p style="color:#f5c842;margin:0;font-size:12px">${formatDate(c.concert_date)}</p>
        </div>`,
      });
      marker.addListener('mouseover', () => iw.open({ map: mapRef.current, anchor: marker }));
      marker.addListener('mouseout', () => iw.close());
      return marker;
    });

    markersRef.current = markers;
    clustererRef.current = new MarkerClusterer({ map: mapRef.current, markers });

    polylineRef.current = new window.google.maps.Polyline({
      path: valid.map(c => ({ lat: c.venue_lat, lng: c.venue_lng })),
      geodesic: true,
      strokeColor: '#f5c842', strokeOpacity: 0.35, strokeWeight: 1.5,
      map: mapRef.current,
    });

    const bounds = new window.google.maps.LatLngBounds();
    valid.forEach(c => bounds.extend({ lat: c.venue_lat, lng: c.venue_lng }));
    mapRef.current.fitBounds(bounds, { padding: 80 });
  };

  useEffect(() => {
    if (isLoaded && mapRef.current && data) setupMap();
  }, [isLoaded, data]);

  if (loading) return (
    <div className="h-screen bg-[#0a0e1a] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-[#f5c842] animate-spin" />
    </div>
  );

  if (error) return (
    <div className="h-screen bg-[#0a0e1a] flex flex-col items-center justify-center gap-4">
      <Music className="w-12 h-12 text-white/20" />
      <p className="text-white/50">{error}</p>
      <button onClick={() => navigate('/')} className="btn-primary text-sm">
        홈으로 돌아가기
      </button>
    </div>
  );

  const { musician, concerts } = data;

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 z-20 bg-[#111827]/90 backdrop-blur border border-white/10
                   rounded-xl px-4 py-2.5 flex items-center gap-2 text-white text-sm
                   hover:border-[#f5c842]/30 hover:text-[#f5c842] transition-all"
      >
        <ArrowLeft className="w-4 h-4" /> ClassicTour
      </button>

      {/* Map */}
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: 40, lng: 20 }}
          zoom={3}
          options={{ styles: MAP_STYLES, disableDefaultUI: false, mapTypeControl: false,
                     streetViewControl: false, fullscreenControl: false }}
          onLoad={map => { mapRef.current = map; setupMap(); }}
        />
      ) : (
        <div className="w-full h-full bg-[#0a0e1a] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#f5c842] animate-spin" />
        </div>
      )}

      {/* Right Panel */}
      <div className="absolute top-0 right-0 h-full w-[340px] bg-[#111827]/95
                      backdrop-blur border-l border-white/10 flex flex-col overflow-hidden z-10">
        {/* Musician header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            {musician.photo_url && (
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                <img src={musician.photo_url} alt={musician.name}
                  className="w-full h-full object-cover"
                  onError={e => e.target.style.display='none'} />
              </div>
            )}
            <div>
              <h2 className="font-serif font-bold text-white">
                {musician.name_ko || musician.name}
              </h2>
              {musician.name_ko && <p className="text-white/40 text-xs">{musician.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="bg-[#f5c842]/10 border border-[#f5c842]/20 rounded-full px-3 py-1">
              <span className="text-[#f5c842] text-xs font-medium">{concerts.length}개 공연</span>
            </div>
            <span className="text-white/30 text-xs">향후 6개월 투어</span>
          </div>
        </div>

        {/* Concert list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {concerts.map((c, idx) => (
            <div key={c.id}
              className="bg-white/5 border border-white/8 rounded-xl p-3.5
                         hover:bg-white/10 transition-colors">
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20
                                flex items-center justify-center text-[#f5c842] text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#f5c842] text-xs">{formatDate(c.concert_date)}</p>
                  <p className="text-white font-medium text-sm mt-0.5 truncate">{c.venue_name}</p>
                  {(c.venue_city || c.venue_country) && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-white/30" />
                      <p className="text-white/40 text-xs">
                        {[c.venue_city, c.venue_country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => navigate('/')}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2"
          >
            <Music className="w-4 h-4" />
            ClassicTour 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}
