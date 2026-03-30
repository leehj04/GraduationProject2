import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Music, LogOut, ChevronRight, RefreshCw,
  Heart, Sparkles, Bookmark
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import FavoritesTab from './FavoritesTab';
import RecommendTab from './RecommendTab';

// 악기별 Unsplash 무료 이미지 (저작권 없음 - Unsplash License)
// 피아니스트: 피아노 사진, 바이올리니스트: 바이올린 사진
const INSTRUMENT_PHOTOS = {
  'yunchan-lim':  'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&q=80', // 피아노
  'trifonov':     'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80', // 피아노 건반
  'seongjin-cho': 'https://images.unsplash.com/photo-1552422535-c45813c61732?w=600&q=80', // 그랜드 피아노
  'yuja-wang':    'https://images.unsplash.com/photo-1619961602105-16fa2a5465c7?w=600&q=80', // 피아노 연주
  'lang-lang':    'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&q=80', // 피아노 클로즈업
  'hilary-hahn':  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', // 바이올린
};

const MAIN_TABS = [
  { id: 'select',    label: '연주자 선택', icon: Music },
  { id: 'recommend', label: '추천',        icon: Sparkles },
  { id: 'favorites', label: '즐겨찾기',    icon: Bookmark },
];

export default function MusicianSelect() {
  const [musicians, setMusicians]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [scraping, setScraping]         = useState(false);
  const [activeTab, setActiveTab]       = useState('select');
  const [favMusicians, setFavMusicians] = useState(new Set());
  const { user, logout }                = useAuth();
  const navigate                        = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/api/musicians'),
      api.get('/api/favorites/all'),
    ]).then(([mRes, fRes]) => {
      setMusicians(mRes.data);
      setFavMusicians(new Set(fRes.data.musicianIds));
    }).finally(() => setLoading(false));
  }, []);

  const toggleMusicianFav = useCallback(async (e, musicianId) => {
    e.stopPropagation();
    const isFav = favMusicians.has(musicianId);
    try {
      if (isFav) {
        await api.delete(`/api/favorites/musicians/${musicianId}`);
        setFavMusicians(prev => { const s = new Set(prev); s.delete(musicianId); return s; });
      } else {
        await api.post(`/api/favorites/musicians/${musicianId}`);
        setFavMusicians(prev => new Set([...prev, musicianId]));
      }
    } catch (err) {
      console.error('Favorite toggle error:', err);
    }
  }, [favMusicians]);

  const handleScrape = async () => {
    if (scraping) return;
    setScraping(true);
    try { await api.post('/api/admin/scrape'); } catch {}
    setTimeout(() => setScraping(false), 5000);
  };

  if (loading) return (
    <div className="h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#f5c842] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0e1a] overflow-auto">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[#f5c842]/4 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-500/4 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="ClassicTour"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="font-serif text-xl font-bold text-white">ClassicTour</h1>
              <p className="text-white/40 text-xs">안녕하세요, {user?.name}님</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'select' && (
              <button onClick={handleScrape} disabled={scraping}
                className="btn-ghost flex items-center gap-2 text-sm">
                <RefreshCw className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} />
                {scraping ? '업데이트 중...' : '업데이트'}
              </button>
            )}
            <button onClick={logout} className="btn-ghost flex items-center gap-2 text-sm">
              <LogOut className="w-4 h-4" /> 로그아웃
            </button>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex bg-white/5 rounded-2xl p-1 mb-8 border border-white/10">
          {MAIN_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                            text-sm font-medium transition-all duration-200
                            ${activeTab === tab.id
                              ? 'bg-[#f5c842] text-[#0a0e1a] shadow-lg'
                              : 'text-white/50 hover:text-white'}`}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === 'select' && (
          <SelectTab
            musicians={musicians}
            favMusicians={favMusicians}
            onToggleFav={toggleMusicianFav}
            onSelect={id => navigate(`/map/${id}`)}
          />
        )}
        {activeTab === 'recommend' && <RecommendTab />}
        {activeTab === 'favorites' && (
          <FavoritesTab onSelectMusician={id => navigate(`/map/${id}`)} />
        )}
      </div>
    </div>
  );
}

/* ── 연주자 선택 탭 ───────────────────────────── */
function SelectTab({ musicians, favMusicians, onToggleFav, onSelect }) {
  return (
    <>
      <div className="text-center mb-8">
        <h2 className="font-serif text-3xl font-bold text-white mb-2">연주자를 선택하세요</h2>
        <p className="text-white/40 text-sm">앞으로 6개월간의 공연 일정을 지도로 확인하세요</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {musicians.map(m => (
          <MusicianCard
            key={m.id}
            musician={m}
            isFav={favMusicians.has(m.id)}
            onToggleFav={(e) => onToggleFav(e, m.id)}
            onClick={() => onSelect(m.id)}
          />
        ))}
      </div>
    </>
  );
}

function MusicianCard({ musician, isFav, onToggleFav, onClick }) {
  const [imgError, setImgError] = useState(false);

  // photo_url(실제 사진) 있으면 우선, 없으면 악기 사진
  const photo = (!imgError && musician.photo_url)
    ? musician.photo_url
    : INSTRUMENT_PHOTOS[musician.scraper_key];

  return (
    <div
      onClick={onClick}
      className="group relative bg-white/5 hover:bg-white/10 border border-white/10
                 hover:border-[#f5c842]/30 rounded-2xl overflow-hidden
                 transition-all duration-300 fade-in cursor-pointer"
    >
      {/* Photo */}
      <div className="relative h-56 overflow-hidden bg-[#0a0e1a]">
        <img
          src={photo}
          alt={musician.name}
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
        {/* 어두운 그라데이션 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/30 to-transparent" />

        {/* 하트 버튼 */}
        <button
          onClick={onToggleFav}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center
                      backdrop-blur-sm transition-all duration-200 z-10 shadow-lg
                      ${isFav ? 'bg-red-500/90 hover:bg-red-600' : 'bg-black/50 hover:bg-black/70'}`}
        >
          <Heart className={`w-4 h-4 transition-all ${isFav ? 'text-white fill-white' : 'text-white/80'}`} />
        </button>
      </div>

      {/* Info */}
      <div className="p-5 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-serif text-xl font-bold text-white group-hover:text-[#f5c842] transition-colors">
              {musician.name_ko || musician.name}
            </h3>
            {musician.name_ko && (
              <p className="text-white/40 text-sm mt-0.5">{musician.name}</p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-[#f5c842] transition-all duration-200 group-hover:translate-x-1 mt-1 flex-shrink-0" />
        </div>
        {musician.bio && (
          <p className="text-white/50 text-xs mt-3 line-clamp-2 leading-relaxed">{musician.bio}</p>
        )}
      </div>

      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#f5c842]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
}
