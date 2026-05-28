import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, MapPin, Music2, Heart, RefreshCw, Loader2, Navigation, X } from 'lucide-react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const FALLBACK_PHOTOS = {
  'yunchan-lim':  'https://images.unsplash.com/photo-1476287803067-f714aa78eaa7?w=600&q=80',
  'trifonov':     'https://images.unsplash.com/photo-1748597603497-2860de84bf11?w=600&q=80',
  'seongjin-cho': 'https://images.unsplash.com/photo-1652058812858-8642c4f6185e?w=600&q=80',
  'yuja-wang':    'https://images.unsplash.com/photo-1607817359832-19a6a93c5f23?w=600&q=80',
  'lang-lang':    'https://images.unsplash.com/photo-1638794159092-d6a420eedab2?w=600&q=80',
  'hilary-hahn':  'https://images.unsplash.com/photo-1692553173440-bc496a6f5e19?w=600&q=80',
};

const SUB_TABS = [
  { id: 'concerts',  label: '공연 추천' },
  { id: 'musicians', label: '연주자 추천' },
  { id: 'nearby',    label: '내 주변 공연' },
];

export default function RecommendTab() {
  const [subTab, setSubTab]         = useState('concerts');
  const [concerts, setConcerts]     = useState([]);
  const [musicians, setMusicians]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [favConcerts, setFavConcerts]   = useState(new Set());
  const [favMusicians, setFavMusicians] = useState(new Set());

  // 내 주변 공연 상태
  const [nearbyConcerts, setNearbyConcerts]   = useState([]);
  const [nearbyLoading, setNearbyLoading]     = useState(false);
  const [nearbyError, setNearbyError]         = useState('');
  const [nearbyLoaded, setNearbyLoaded]       = useState(false);

  const navigate = useNavigate();

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const [cRes, mRes, fRes] = await Promise.all([
        api.get('/api/recommendations/concerts'),
        api.get('/api/recommendations/musicians'),
        api.get('/api/favorites/all'),
      ]);
      setConcerts(cRes.data);
      setMusicians(mRes.data);
      setFavConcerts(new Set(fRes.data.concertIds));
      setFavMusicians(new Set(fRes.data.musicianIds));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecommendations(); }, []);

  // 내 주변 공연 로드
  const loadNearbyConcerts = useCallback(() => {
    if (!navigator.geolocation) {
      setNearbyError('이 브라우저는 위치 기능을 지원하지 않습니다.');
      return;
    }
    setNearbyLoading(true);
    setNearbyError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const res = await api.get('/api/concerts/nearby-user', {
            params: { lat, lng }
          });
          setNearbyConcerts(res.data);
          setNearbyLoaded(true);
          if (res.data.length === 0) {
            setNearbyError('50km 이내에 예정된 공연이 없습니다.');
          }
        } catch (err) {
          setNearbyError('공연 정보를 불러오지 못했습니다.');
        } finally {
          setNearbyLoading(false);
        }
      },
      (err) => {
        setNearbyLoading(false);
        if (err.code === 1) setNearbyError('위치 권한을 허용해주세요.');
        else setNearbyError('위치를 가져올 수 없습니다.');
      },
      { timeout: 8000 }
    );
  }, []);

  // 내 주변 탭 클릭 시 자동 로드
  const handleTabChange = (tabId) => {
    setSubTab(tabId);
    if (tabId === 'nearby' && !nearbyLoaded && !nearbyLoading) {
      loadNearbyConcerts();
    }
  };

  const toggleConcertFav = async (e, concertId) => {
    e.stopPropagation();
    const isFav = favConcerts.has(concertId);
    if (isFav) {
      await api.delete(`/api/favorites/concerts/${concertId}`);
      setFavConcerts(prev => { const s = new Set(prev); s.delete(concertId); return s; });
    } else {
      await api.post(`/api/favorites/concerts/${concertId}`);
      setFavConcerts(prev => new Set([...prev, concertId]));
    }
  };

  const toggleMusicianFav = async (e, musicianId) => {
    e.stopPropagation();
    const isFav = favMusicians.has(musicianId);
    if (isFav) {
      await api.delete(`/api/favorites/musicians/${musicianId}`);
      setFavMusicians(prev => { const s = new Set(prev); s.delete(musicianId); return s; });
    } else {
      await api.post(`/api/favorites/musicians/${musicianId}`);
      setFavMusicians(prev => new Set([...prev, musicianId]));
    }
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#f5c842]" />
          <h2 className="font-serif text-xl font-bold text-white">AI 추천</h2>
        </div>
        {subTab !== 'nearby' && (
          <button
            onClick={loadRecommendations}
            disabled={loading}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        )}
        {subTab === 'nearby' && nearbyLoaded && (
          <button
            onClick={() => { setNearbyLoaded(false); loadNearbyConcerts(); }}
            disabled={nearbyLoading}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${nearbyLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        )}
      </div>

      {subTab !== 'nearby' && (
        <p className="text-white/40 text-sm mb-6">
          나이, 성별, 국적이 비슷한 다른 사용자들의 즐겨찾기를 분석해
          좋아하실 만한 공연과 연주자를 추천해드립니다.
        </p>
      )}

      {/* Sub Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all duration-200
                        ${subTab === tab.id ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'}`}>
            {tab.id === 'nearby' && <Navigation className="w-3 h-3 inline mr-1" />}
            {tab.label}
          </button>
        ))}
      </div>

      {loading && subTab !== 'nearby' ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-10 h-10 text-[#f5c842] animate-spin" />
          <p className="text-white/40 text-sm">추천을 불러오는 중...</p>
        </div>
      ) : (
        <>
          {subTab === 'concerts' && (
            <RecommendedConcerts
              concerts={concerts}
              favConcerts={favConcerts}
              onToggleFav={toggleConcertFav}
            />
          )}
          {subTab === 'musicians' && (
            <RecommendedMusicians
              musicians={musicians}
              favMusicians={favMusicians}
              onToggleFav={toggleMusicianFav}
              onSelect={m => navigate(`/map/${m.id}`)}
            />
          )}
          {subTab === 'nearby' && (
            <NearbyConcerts
              concerts={nearbyConcerts}
              loading={nearbyLoading}
              error={nearbyError}
              loaded={nearbyLoaded}
              favConcerts={favConcerts}
              onToggleFav={toggleConcertFav}
              onRetry={loadNearbyConcerts}
              onNavigate={navigate}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── 내 주변 공연 ──────────────────────────────── */
function NearbyConcerts({ concerts, loading, error, loaded, favConcerts, onToggleFav, onRetry, onNavigate }) {
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="w-10 h-10 text-[#f5c842] animate-spin" />
      <p className="text-white/40 text-sm">내 위치를 확인하는 중...</p>
    </div>
  );

  if (error && !loaded) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <Navigation className="w-12 h-12 text-white/20" />
      <p className="text-white/40 text-sm">{error}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-[#f5c842]/10 hover:bg-[#f5c842]/20
                   border border-[#f5c842]/30 rounded-xl text-[#f5c842] text-sm transition-all"
      >
        <Navigation className="w-4 h-4" />
        다시 시도
      </button>
    </div>
  );

  if (loaded && concerts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Navigation className="w-12 h-12 text-white/20" />
      <p className="text-white/40 text-sm">내 위치 50km 이내에 예정된 공연이 없습니다.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* 안내 배너 */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#f5c842]/8 border border-[#f5c842]/20 rounded-xl mb-4">
        <Navigation className="w-4 h-4 text-[#f5c842] flex-shrink-0" />
        <p className="text-[#f5c842]/80 text-xs">내 위치에서 50km 이내 공연 {concerts.length}개</p>
      </div>

      {concerts.map((concert) => (
        <div
          key={concert.id}
          onClick={() => onNavigate(`/map/${concert.musician_id}`)}
          className="group bg-white/5 hover:bg-white/10 border border-white/10
                     hover:border-[#f5c842]/25 rounded-2xl p-4 transition-all duration-200 cursor-pointer"
        >
          <div className="flex gap-3 items-start">
            {/* 날짜 */}
            <div className="flex-shrink-0 w-11 text-center bg-[#f5c842]/10 border border-[#f5c842]/20 rounded-lg p-1.5">
              <p className="text-[#f5c842] font-bold text-lg leading-none">
                {new Date(concert.concert_date + 'T00:00:00').getDate()}
              </p>
              <p className="text-[#f5c842]/70 text-[10px] mt-0.5">
                {new Date(concert.concert_date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short' })}
              </p>
            </div>

            {/* 내용 */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate group-hover:text-[#f5c842] transition-colors">
                {concert.venue_name}
              </p>
              <p className="text-white/50 text-xs mt-0.5">
                {concert.musician_name_ko || concert.musician_name}
              </p>
              {(concert.venue_city || concert.venue_country) && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-white/30 flex-shrink-0" />
                  <p className="text-white/40 text-xs truncate">
                    {[concert.venue_city, concert.venue_country].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
              {concert.distance_km != null && (
                <div className="flex items-center gap-1 mt-1">
                  <Navigation className="w-3 h-3 text-[#f5c842]/60 flex-shrink-0" />
                  <p className="text-[#f5c842]/60 text-xs font-medium">내 위치에서 {concert.distance_km}km</p>
                </div>
              )}
            </div>

            {/* 하트 */}
            <button
              onClick={e => onToggleFav(e, concert.id)}
              className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                          transition-all duration-200
                          ${favConcerts.has(concert.id)
                            ? 'bg-red-500/90 hover:bg-red-600'
                            : 'bg-white/10 hover:bg-white/20'}`}
            >
              <Heart className={`w-4 h-4 ${favConcerts.has(concert.id) ? 'text-white fill-white' : 'text-white/60'}`} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 추천 공연 ─────────────────────────────────── */
function RecommendedConcerts({ concerts, favConcerts, onToggleFav }) {
  if (concerts.length === 0) return (
    <div className="text-center py-16">
      <Music2 className="w-12 h-12 text-white/20 mx-auto mb-3" />
      <p className="text-white/40">아직 추천할 공연이 없습니다.</p>
      <p className="text-white/25 text-sm mt-1">즐겨찾기를 추가할수록 더 정확한 추천이 가능해요.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {concerts.map((concert, idx) => (
        <div key={concert.id}
          className="group bg-white/5 hover:bg-white/10 border border-white/10
                     hover:border-[#f5c842]/25 rounded-2xl p-4 transition-all duration-200">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20
                            flex items-center justify-center text-[#f5c842] font-bold text-sm">
              {idx + 1}
            </div>
            {concert.venue_photo_url && (
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-white/10">
                <img src={concert.venue_photo_url} alt={concert.venue_name}
                  className="w-full h-full object-cover"
                  onError={e => e.target.parentElement.style.display = 'none'} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[#f5c842] text-xs font-medium">{formatDate(concert.concert_date)}</p>
              <p className="text-white font-semibold text-sm mt-0.5 leading-tight">{concert.venue_name}</p>
              <p className="text-white/50 text-xs mt-0.5">{concert.musician_name_ko || concert.musician_name}</p>
              {(concert.venue_city || concert.venue_country) && (
                <div className="flex items-center gap-1 mt-1.5">
                  <MapPin className="w-3 h-3 text-white/30" />
                  <p className="text-white/30 text-xs">
                    {[concert.venue_city, concert.venue_country].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
              {concert.reason && (
                <div className="flex items-center gap-1 mt-2">
                  <Sparkles className="w-3 h-3 text-[#f5c842]/60" />
                  <p className="text-[#f5c842]/60 text-xs">{concert.reason}</p>
                </div>
              )}
            </div>
            <button
              onClick={e => onToggleFav(e, concert.id)}
              className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                          transition-all duration-200 shadow
                          ${favConcerts.has(concert.id)
                            ? 'bg-red-500/90 hover:bg-red-600'
                            : 'bg-white/10 hover:bg-white/20'}`}
            >
              <Heart className={`w-4 h-4 ${favConcerts.has(concert.id) ? 'text-white fill-white' : 'text-white/60'}`} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 추천 연주자 ───────────────────────────────── */
function RecommendedMusicians({ musicians, favMusicians, onToggleFav, onSelect }) {
  if (musicians.length === 0) return (
    <div className="text-center py-16">
      <Music2 className="w-12 h-12 text-white/20 mx-auto mb-3" />
      <p className="text-white/40">아직 추천할 연주자가 없습니다.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {musicians.map((m, idx) => (
        <div key={m.id}
          onClick={() => onSelect(m)}
          className="group bg-white/5 hover:bg-white/10 border border-white/10
                     hover:border-[#f5c842]/25 rounded-2xl p-4 transition-all duration-200 cursor-pointer">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20
                            flex items-center justify-center text-[#f5c842] font-bold text-sm">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm group-hover:text-[#f5c842] transition-colors">
                {m.name_ko || m.name}
              </p>
              {m.name_ko && <p className="text-white/40 text-xs mt-0.5">{m.name}</p>}
              {m.instrument && <p className="text-white/30 text-xs mt-0.5">{m.instrument}</p>}
              {m.reason && (
                <div className="flex items-center gap-1 mt-2">
                  <Sparkles className="w-3 h-3 text-[#f5c842]/60" />
                  <p className="text-[#f5c842]/60 text-xs">{m.reason}</p>
                </div>
              )}
            </div>
            <button
              onClick={e => onToggleFav(e, m.id)}
              className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                          transition-all duration-200
                          ${favMusicians.has(m.id)
                            ? 'bg-red-500/90 hover:bg-red-600'
                            : 'bg-white/10 hover:bg-white/20'}`}
            >
              <Heart className={`w-4 h-4 ${favMusicians.has(m.id) ? 'text-white fill-white' : 'text-white/60'}`} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}
