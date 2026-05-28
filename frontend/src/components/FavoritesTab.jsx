import React, { useState, useEffect } from 'react';
import { Heart, MapPin, Music2, Calendar, Star, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const SUB_TABS = [
  { id: 'concerts',  label: '즐겨찾기 공연' },
  { id: 'musicians', label: '즐겨찾기 연주자' },
];

export default function FavoritesTab({ onSelectMusician }) {
  const [subTab, setSubTab]       = useState('concerts');
  const [concerts, setConcerts]   = useState([]);
  const [musicians, setMusicians] = useState([]);
  const [loading, setLoading]     = useState(true);
  const navigate = useNavigate();

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

  const removeConcertFav = async (e, concertId) => {
    e.stopPropagation();
    await api.delete(`/api/favorites/concerts/${concertId}`);
    setConcerts(prev => prev.filter(c => c.id !== concertId));
  };

  const removeMusicianFav = async (e, musicianId) => {
    e.stopPropagation();
    await api.delete(`/api/favorites/musicians/${musicianId}`);
    setMusicians(prev => prev.filter(m => m.id !== musicianId));
  };

  return (
    <div className="fade-in">
      <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
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
              onSelect={(concert) => navigate(`/map/${concert.musician_id}`, {
                state: { selectedConcertId: concert.id }
              })}
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

function FavConcerts({ concerts, onSelect, onRemove }) {
  if (concerts.length === 0) return (
    <EmptyState icon={<Calendar className="w-12 h-12 text-white/20" />}
      message="즐겨찾기한 공연이 없습니다."
      sub="공연 정보 탭에서 하트 버튼을 눌러 추가하세요." />
  );

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
              {concert.concert_time && ` · ${concert.concert_time?.slice(0, 5)}`}
            </p>
            <p className="text-white font-semibold text-sm leading-tight">{concert.venue_name}</p>
            <p className="text-white/40 text-xs mt-1">{concert.musician_name_ko || concert.musician_name}</p>
            {(concert.venue_city || concert.venue_country) && (
              <div className="flex items-center gap-1 mt-2">
                <MapPin className="w-3 h-3 text-white/30" />
                <p className="text-white/30 text-xs">
                  {[concert.venue_city, concert.venue_country].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={e => onRemove(e, concert.id)}
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

function FavMusicians({ musicians, onSelect, onRemove }) {
  if (musicians.length === 0) return (
    <EmptyState icon={<Music2 className="w-12 h-12 text-white/20" />}
      message="즐겨찾기한 연주자가 없습니다."
      sub="연주자 카드의 하트 버튼을 눌러 추가하세요." />
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {musicians.map(m => (
        <div
          key={m.id}
          onClick={() => onSelect(m)}
          className="group relative bg-white/5 hover:bg-white/10 border border-white/10
                     hover:border-[#f5c842]/30 rounded-2xl overflow-hidden
                     transition-all duration-200 cursor-pointer"
        >
          <div className="p-4">
            <p className="text-[#f5c842] text-xs font-medium mb-1">{m.instrument || '연주자'}</p>
            <p className="text-white font-semibold text-sm leading-tight group-hover:text-[#f5c842] transition-colors">
              {m.name_ko || m.name}
            </p>
            {m.name_ko && <p className="text-white/40 text-xs mt-1">{m.name}</p>}
            {m.nationality && (
              <div className="flex items-center gap-1 mt-2">
                <MapPin className="w-3 h-3 text-white/30" />
                <p className="text-white/30 text-xs">{m.nationality}</p>
              </div>
            )}
          </div>
          <button
            onClick={e => onRemove(e, m.id)}
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
