import React, { useState, useEffect } from 'react';
import { Sparkles, MapPin, Music2, Heart, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const FALLBACK_PHOTOS = {
  'yunchan-lim':  'https://upload.wikimedia.org/wikipedia/commons/8/8e/Yunchan_Lim_at_the_2022_Van_Cliburn_Competition.jpg',
  'trifonov':     'https://upload.wikimedia.org/wikipedia/commons/c/c3/Daniil_Trifonov_2019.jpg',
  'seongjin-cho': 'https://upload.wikimedia.org/wikipedia/commons/3/32/Seong-Jin_Cho_2015.jpg',
  'yuja-wang':    'https://upload.wikimedia.org/wikipedia/commons/2/2c/Yuja_Wang_2019.jpg',
  'lang-lang':    'https://upload.wikimedia.org/wikipedia/commons/1/1e/Lang_Lang_Cannes.jpg',
  'hilary-hahn':  'https://upload.wikimedia.org/wikipedia/commons/6/63/Hilary_Hahn_Recital.jpg',
};

const SUB_TABS = [
  { id: 'concerts',  label: '공연 추천' },
  { id: 'musicians', label: '연주자 추천' },
];

export default function RecommendTab() {
  const [subTab, setSubTab]         = useState('concerts');
  const [concerts, setConcerts]     = useState([]);
  const [musicians, setMusicians]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [favConcerts, setFavConcerts]   = useState(new Set());
  const [favMusicians, setFavMusicians] = useState(new Set());
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
        <button
          onClick={loadRecommendations}
          disabled={loading}
          className="btn-ghost flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <p className="text-white/40 text-sm mb-6">
        나이, 성별, 국적이 비슷한 다른 사용자들의 즐겨찾기를 분석해
        좋아하실 만한 공연과 연주자를 추천해드립니다.
      </p>

      {/* Sub Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                        ${subTab === tab.id ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
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
        </>
      )}
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
            {/* Rank badge */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20
                            flex items-center justify-center text-[#f5c842] font-bold text-sm">
              {idx + 1}
            </div>

            {/* Venue photo */}
            {concert.venue_photo_url && (
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-white/10">
                <img src={concert.venue_photo_url} alt={concert.venue_name}
                  className="w-full h-full object-cover"
                  onError={e => e.target.parentElement.style.display = 'none'} />
              </div>
            )}

            {/* Info */}
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
              {/* AI reason badge */}
              {concert.reason && (
                <div className="flex items-center gap-1 mt-2">
                  <Sparkles className="w-3 h-3 text-[#f5c842]/60" />
                  <p className="text-[#f5c842]/60 text-xs">{concert.reason}</p>
                </div>
              )}
            </div>

            {/* Heart */}
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

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
const AVATAR_COLORS = [
  '#b45309','#7c3aed','#1d4ed8','#065f46',
  '#9f1239','#1e40af','#6d28d9','#92400e',
];
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {musicians.map((m, idx) => {
        const showImg = !!m.photo_url;
        return (
          <div key={m.id} onClick={() => onSelect(m)}
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10
                       hover:border-[#f5c842]/30 rounded-2xl overflow-hidden
                       transition-all duration-200 cursor-pointer">
            <div className="relative h-40 overflow-hidden"
                 style={{ background: showImg ? '#0a0e1a' : getAvatarColor(m.name) }}>
              {showImg ? (
                <img src={m.photo_url} alt={m.name}
                  className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  onError={e => { e.target.parentElement.style.background = getAvatarColor(m.name); e.target.style.display='none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-serif text-5xl font-bold text-white/80 select-none">
                    {getInitials(m.name_ko || m.name)}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/20 to-transparent" />
              <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-[#f5c842] flex items-center justify-center">
                <span className="text-[#0a0e1a] font-bold text-xs">{idx + 1}</span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-white font-semibold group-hover:text-[#f5c842] transition-colors">
                    {m.name_ko || m.name}
                  </p>
                  {m.name_ko && <p className="text-white/40 text-xs mt-0.5">{m.name}</p>}
                  {m.reason && (
                    <div className="flex items-center gap-1 mt-2">
                      <Sparkles className="w-3 h-3 text-[#f5c842]/60" />
                      <p className="text-[#f5c842]/60 text-xs">{m.reason}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={e => onToggleFav(e, m.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                                ${favMusicians.has(m.id)
                                  ? 'bg-red-500/90 hover:bg-red-600'
                                  : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${favMusicians.has(m.id) ? 'text-white fill-white' : 'text-white/60'}`} />
                  </button>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-[#f5c842] transition-all group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}
