import React, { useState, useEffect } from 'react';
import { Heart, MapPin, Clock, Music2, ChevronRight, Calendar } from 'lucide-react';
import api from '../api';

const FALLBACK_PHOTOS = {
  'yunchan-lim':  'https://upload.wikimedia.org/wikipedia/commons/8/8e/Yunchan_Lim_at_the_2022_Van_Cliburn_Competition.jpg',
  'trifonov':     'https://upload.wikimedia.org/wikipedia/commons/c/c3/Daniil_Trifonov_2019.jpg',
  'seongjin-cho': 'https://upload.wikimedia.org/wikipedia/commons/3/32/Seong-Jin_Cho_2015.jpg',
  'yuja-wang':    'https://upload.wikimedia.org/wikipedia/commons/2/2c/Yuja_Wang_2019.jpg',
  'lang-lang':    'https://upload.wikimedia.org/wikipedia/commons/1/1e/Lang_Lang_Cannes.jpg',
  'hilary-hahn':  'https://upload.wikimedia.org/wikipedia/commons/6/63/Hilary_Hahn_Recital.jpg',
};

const SUB_TABS = [
  { id: 'concerts',  label: '즐겨찾기 공연' },
  { id: 'musicians', label: '즐겨찾기 연주자' },
];

export default function FavoritesTab({ onSelectMusician }) {
  const [subTab, setSubTab]           = useState('concerts');
  const [concerts, setConcerts]       = useState([]);
  const [musicians, setMusicians]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedConcert, setSelectedConcert] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/favorites/concerts'),
      api.get('/api/favorites/musicians'),
    ]).then(([cRes, mRes]) => {
      setConcerts(cRes.data);
      setMusicians(mRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const removeConcertFav = async (concertId) => {
    await api.delete(`/api/favorites/concerts/${concertId}`);
    setConcerts(prev => prev.filter(c => c.id !== concertId));
  };

  const removeMusicianFav = async (musicianId) => {
    await api.delete(`/api/favorites/musicians/${musicianId}`);
    setMusicians(prev => prev.filter(m => m.id !== musicianId));
  };

  return (
    <div className="fade-in">
      {/* Sub Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setSubTab(tab.id); setSelectedConcert(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                        ${subTab === tab.id
                          ? 'bg-white/15 text-white'
                          : 'text-white/40 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#f5c842] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {subTab === 'concerts' && (
            <FavConcerts
              concerts={concerts}
              selectedConcert={selectedConcert}
              onSelect={setSelectedConcert}
              onRemove={removeConcertFav}
            />
          )}
          {subTab === 'musicians' && (
            <FavMusicians
              musicians={musicians}
              onSelect={m => onSelectMusician(m.id)}
              onRemove={removeMusicianFav}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── 즐겨찾기 공연 목록 ───────────────────────── */
function FavConcerts({ concerts, selectedConcert, onSelect, onRemove }) {
  if (concerts.length === 0) return (
    <EmptyState icon={<Calendar className="w-12 h-12 text-white/20" />}
      message="즐겨찾기한 공연이 없습니다."
      sub="공연 정보 탭에서 하트 버튼을 눌러 추가하세요." />
  );

  // 공연 상세 뷰
  if (selectedConcert) {
    return (
      <div className="fade-in">
        <button
          onClick={() => onSelect(null)}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-5 transition-colors"
        >
          ← 목록으로 돌아가기
        </button>
        <ConcertDetailCard concert={selectedConcert} onRemove={() => { onRemove(selectedConcert.id); onSelect(null); }} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {concerts.map(concert => (
        <div
          key={concert.id}
          onClick={() => onSelect(concert)}
          className="group relative bg-white/5 hover:bg-white/10 border border-white/10
                     hover:border-[#f5c842]/30 rounded-2xl overflow-hidden
                     transition-all duration-200 cursor-pointer"
        >
          {/* Venue photo */}
          {concert.venue_photo_url && (
            <div className="h-32 overflow-hidden">
              <img src={concert.venue_photo_url} alt={concert.venue_name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={e => e.target.parentElement.style.display = 'none'} />
            </div>
          )}
          <div className="p-4">
            <p className="text-[#f5c842] text-xs font-medium mb-1">
              {formatDate(concert.concert_date)}
              {concert.concert_time && ` · ${concert.concert_time}`}
            </p>
            <p className="text-white font-semibold text-sm leading-tight">{concert.venue_name}</p>
            <p className="text-white/40 text-xs mt-1">
              {concert.musician_name_ko || concert.musician_name}
            </p>
            {(concert.venue_city || concert.venue_country) && (
              <div className="flex items-center gap-1 mt-2">
                <MapPin className="w-3 h-3 text-white/30" />
                <p className="text-white/30 text-xs">
                  {[concert.venue_city, concert.venue_country].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* Remove heart */}
          <button
            onClick={e => { e.stopPropagation(); onRemove(concert.id); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-600
                       flex items-center justify-center transition-all"
          >
            <Heart className="w-4 h-4 text-white fill-white" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ConcertDetailCard({ concert, onRemove }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {concert.venue_photo_url && (
        <div className="h-48 overflow-hidden">
          <img src={concert.venue_photo_url} alt={concert.venue_name}
            className="w-full h-full object-cover"
            onError={e => e.target.parentElement.style.display = 'none'} />
        </div>
      )}
      <div className="p-6 space-y-4">
        <div>
          <p className="text-[#f5c842] text-sm font-medium">{formatDate(concert.concert_date)}{concert.concert_time && ` · ${concert.concert_time}`}</p>
          <h3 className="font-serif text-2xl font-bold text-white mt-1">{concert.venue_name}</h3>
          <p className="text-white/50 text-sm mt-1">{concert.musician_name_ko || concert.musician_name}</p>
        </div>
        {concert.venue_address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-white/30 mt-0.5" />
            <p className="text-white/60 text-sm">{concert.venue_address}</p>
          </div>
        )}
        {concert.program?.length > 0 && (
          <div>
            <p className="text-white/30 text-xs uppercase tracking-widest mb-2">연주 곡목</p>
            {concert.program.map((p, i) => (
              <p key={i} className="text-white/60 text-sm py-1 border-b border-white/5">♩ {p}</p>
            ))}
          </div>
        )}
        <button
          onClick={onRemove}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors"
        >
          <Heart className="w-4 h-4 fill-red-400" /> 즐겨찾기 해제
        </button>
      </div>
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

/* ── 즐겨찾기 연주자 목록 ─────────────────────── */
function FavMusicians({ musicians, onSelect, onRemove }) {
  if (musicians.length === 0) return (
    <EmptyState icon={<Music2 className="w-12 h-12 text-white/20" />}
      message="즐겨찾기한 연주자가 없습니다."
      sub="연주자 카드의 하트 버튼을 눌러 추가하세요." />
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {musicians.map(m => {
        const showImg = !!m.photo_url;
        return (
          <div
            key={m.id}
            onClick={() => onSelect(m)}
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10
                       hover:border-[#f5c842]/30 rounded-2xl overflow-hidden
                       transition-all duration-200 cursor-pointer"
          >
            <div className="relative h-48 overflow-hidden"
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
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a] via-transparent to-transparent" />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold group-hover:text-[#f5c842] transition-colors">
                  {m.name_ko || m.name}
                </p>
                {m.name_ko && <p className="text-white/40 text-xs mt-0.5">{m.name}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-[#f5c842] transition-all group-hover:translate-x-1" />
            </div>
            <button
              onClick={e => { e.stopPropagation(); onRemove(m.id); }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-600
                         flex items-center justify-center transition-all"
            >
              <Heart className="w-4 h-4 text-white fill-white" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon, message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4">{icon}</div>
      <p className="text-white/50 font-medium">{message}</p>
      <p className="text-white/25 text-sm mt-1">{sub}</p>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}
