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

const FALLBACK_PHOTOS = {
  'yunchan-lim':  'https://upload.wikimedia.org/wikipedia/commons/8/8e/Yunchan_Lim_at_the_2022_Van_Cliburn_Competition.jpg',
  'trifonov':     'https://upload.wikimedia.org/wikipedia/commons/c/c3/Daniil_Trifonov_2019.jpg',
  'seongjin-cho': 'https://upload.wikimedia.org/wikipedia/commons/3/32/Seong-Jin_Cho_2015.jpg',
  'yuja-wang':    'https://upload.wikimedia.org/wikipedia/commons/2/2c/Yuja_Wang_2019.jpg',
  'lang-lang':    'https://upload.wikimedia.org/wikipedia/commons/1/1e/Lang_Lang_Cannes.jpg',
  'hilary-hahn':  'https://upload.wikimedia.org/wikipedia/commons/6/63/Hilary_Hahn_Recital.jpg',
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
            <div className="w-10 h-10 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20 flex items-center justify-center">
              <Music className="w-5 h-5 text-[#f5c842]" />
            </div>
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

// 음악가 이름에서 이니셜 추출
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// 이름 기반 배경색 생성
const AVATAR_COLORS = [
  '#b45309', '#7c3aed', '#1d4ed8', '#065f46',
  '#9f1239', '#1e40af', '#6d28d9', '#92400e',
];
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function MusicianCard({ musician, isFav, onToggleFav, onClick }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);
  const showImg = musician.photo_url && !imgError;

  return (
    <div
      onClick={onClick}
      className="group relative bg-white/5 hover:bg-white/10 border border-white/10
                 hover:border-[#f5c842]/30 rounded-2xl overflow-hidden
                 transition-all duration-300 fade-in cursor-pointer"
    >
      {/* Photo / Avatar */}
      <div className="relative h-56 overflow-hidden"
           style={{ background: showImg ? '#0a0e1a' : getAvatarColor(musician.name) }}>

        {/* 이미지 */}
        {showImg && (
          <img
            src={musician.photo_url}
            alt={musician.name}
            className={`w-full h-full object-cover object-top transition-all duration-500
                        group-hover:scale-105 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}

        {/* 이니셜 아바타 (이미지 없거나 실패 시) */}
        {!showImg && (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-serif text-6xl font-bold text-white/80 select-none">
              {getInitials(musician.name_ko || musician.name)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a] via-transparent to-transparent" />

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
