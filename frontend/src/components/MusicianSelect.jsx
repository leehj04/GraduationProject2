import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Music, LogOut, RefreshCw, Heart, Sparkles, Bookmark,
  Search, ChevronRight, Piano, Globe
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import FavoritesTab from './FavoritesTab';
import RecommendTab from './RecommendTab';

const MAIN_TABS = [
  { id: 'select',    label: '연주자 선택', icon: Music },
  { id: 'recommend', label: '추천',        icon: Sparkles },
  { id: 'favorites', label: '즐겨찾기',    icon: Bookmark },
];

// 악기별 이모지
const INSTRUMENT_EMOJI = {
  '피아노':      '🎹',
  '바이올린':    '🎻',
  '첼로':        '🎻',
  '비올라':      '🎻',
  '플루트':      '🎵',
  '지휘':        '🎼',
  '소프라노':    '🎤',
  '메조소프라노': '🎤',
  '테너':        '🎤',
  '바리톤':      '🎤',
  '베이스':      '🎤',
  '오르간':      '🎹',
  '하프':        '🎵',
  '클라리넷':    '🎵',
  '트럼펫':      '🎺',
  '오보에':      '🎵',
  '파곳':        '🎵',
  '호른':        '🎺',
  '트롬본':      '🎺',
  '타악기':      '🥁',
  '기타':        '🎸',
};

export default function MusicianSelect() {
  const [musicians, setMusicians]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [scraping, setScraping]         = useState(false);
  const [activeTab, setActiveTab]       = useState('select');
  const [favMusicians, setFavMusicians] = useState(new Set());
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterInstrument, setFilterInstrument] = useState('전체');
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
    } catch (err) { console.error(err); }
  }, [favMusicians]);

  const handleScrape = async () => {
    if (scraping) return;
    setScraping(true);
    try { await api.post('/api/admin/scrape'); } catch {}
    setTimeout(() => setScraping(false), 5000);
  };

  // 악기 목록 추출 (중복 제거)
  const instruments = ['전체', ...new Set(
    musicians.map(m => m.instrument).filter(Boolean).sort()
  )];

  // 검색 + 필터 적용
  const filtered = musicians.filter(m => {
    const matchSearch = !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.name_ko && m.name_ko.includes(searchQuery));
    const matchFilter = filterInstrument === '전체' ||
      m.instrument === filterInstrument;
    return matchSearch && matchFilter;
  });

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
            <img src="/logo.png" alt="ClassicTour" className="w-10 h-10 object-contain" />
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
            musicians={filtered}
            allMusicians={musicians}
            instruments={instruments}
            filterInstrument={filterInstrument}
            setFilterInstrument={setFilterInstrument}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
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

/* ── 연주자 선택 탭 (리스트 형식) ─────────────── */
function SelectTab({
  musicians, allMusicians, instruments, filterInstrument, setFilterInstrument,
  searchQuery, setSearchQuery, favMusicians, onToggleFav, onSelect
}) {
  return (
    <>
      {/* 헤더 */}
      <div className="mb-6">
        <h2 className="font-serif text-3xl font-bold text-white mb-1">연주자를 선택하세요</h2>
        <p className="text-white/40 text-sm">총 {allMusicians.length}명 · 앞으로 6개월 공연 일정을 지도로 확인</p>
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          className="input-field pl-10 text-sm"
          placeholder="이름으로 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 악기 필터 */}
      <div className="flex flex-wrap gap-2 mb-5">
        {instruments.map(inst => (
          <button
            key={inst}
            onClick={() => setFilterInstrument(inst)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
              ${filterInstrument === inst
                ? 'bg-[#f5c842] text-[#0a0e1a]'
                : 'bg-white/8 text-white/60 hover:bg-white/15 hover:text-white'}`}
          >
            {inst !== '전체' && (INSTRUMENT_EMOJI[inst] || '🎵')} {inst}
          </button>
        ))}
      </div>

      {/* 결과 수 */}
      <p className="text-white/30 text-xs mb-3">{musicians.length}명 표시 중</p>

      {/* 리스트 */}
      {musicians.length === 0 ? (
        <div className="text-center py-20">
          <Music className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {musicians.map(m => (
            <MusicianRow
              key={m.id}
              musician={m}
              isFav={favMusicians.has(m.id)}
              onToggleFav={(e) => onToggleFav(e, m.id)}
              onClick={() => onSelect(m.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MusicianRow({ musician, isFav, onToggleFav, onClick }) {
  const emoji = INSTRUMENT_EMOJI[musician.instrument] || '🎵';

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 bg-white/5 hover:bg-white/10
                 border border-white/8 hover:border-[#f5c842]/30
                 rounded-xl px-4 py-3.5 cursor-pointer
                 transition-all duration-200 fade-in"
    >
      {/* 악기 이모지 아이콘 */}
      <div className="w-10 h-10 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20
                      flex items-center justify-center flex-shrink-0 text-lg">
        {emoji}
      </div>

      {/* 이름 + 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white font-semibold text-sm group-hover:text-[#f5c842] transition-colors">
            {musician.name_ko || musician.name}
          </p>
          {musician.name_ko && (
            <p className="text-white/40 text-xs">{musician.name}</p>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {musician.instrument && (
            <span className="text-white/40 text-xs">{musician.instrument}</span>
          )}
          {musician.nationality && (
            <span className="text-white/30 text-xs flex items-center gap-1">
              <Globe className="w-3 h-3" />{musician.nationality}
            </span>
          )}
          {musician.bio && (
            <span className="text-white/25 text-xs truncate max-w-[200px]">{musician.bio}</span>
          )}
        </div>
      </div>

      {/* 하트 + 화살표 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onToggleFav}
          className={`w-8 h-8 rounded-full flex items-center justify-center
                      transition-all duration-200
                      ${isFav ? 'bg-red-500/90 hover:bg-red-600' : 'bg-white/8 hover:bg-white/20'}`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'text-white fill-white' : 'text-white/50'}`} />
        </button>
        <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-[#f5c842] transition-all group-hover:translate-x-1" />
      </div>
    </div>
  );
}
