import React, { useState, useEffect } from 'react';
import { Heart, MapPin, Clock, Music2, Calendar, Star, Users, MessageSquare } from 'lucide-react';
import api from '../api';

const SUB_TABS = [
  { id: 'concerts',  label: '즐겨찾기 공연' },
  { id: 'musicians', label: '즐겨찾기 연주자' },
  { id: 'activity',  label: '내 활동' },
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
            className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all duration-200
                        ${subTab === tab.id
                          ? 'bg-white/15 text-white'
                          : 'text-white/40 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && subTab !== 'activity' ? (
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
          {subTab === 'activity' && <MyActivity />}
        </>
      )}
    </div>
  );
}

/* ── 내 활동 ───────────────────────────────────── */
function MyActivity() {
  const [activityTab, setActivityTab] = useState('reviews');
  const [reviews, setReviews]         = useState([]);
  const [companions, setCompanions]   = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/reviews/my'),
      api.get('/api/companions/my'),
    ]).then(([rRes, cRes]) => {
      setReviews(rRes.data);
      setCompanions(cRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const deleteReview = async (review) => {
    await api.delete(`/api/reviews/${review.concert_id}`);
    setReviews(prev => prev.filter(r => r.id !== review.id));
  };

  const deleteCompanion = async (companionId) => {
    await api.delete(`/api/companions/${companionId}`);
    setCompanions(prev => prev.filter(c => c.id !== companionId));
  };

  return (
    <div>
      {/* 활동 서브탭 */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActivityTab('reviews')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all
            ${activityTab === 'reviews'
              ? 'bg-[#f5c842]/15 text-[#f5c842] border border-[#f5c842]/30'
              : 'bg-white/5 text-white/50 border border-white/10 hover:text-white'}`}
        >
          <Star className="w-3.5 h-3.5" />
          후기 / 별점
          {reviews.length > 0 && (
            <span className="ml-1 text-xs opacity-70">({reviews.length})</span>
          )}
        </button>
        <button
          onClick={() => setActivityTab('companions')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all
            ${activityTab === 'companions'
              ? 'bg-[#f5c842]/15 text-[#f5c842] border border-[#f5c842]/30'
              : 'bg-white/5 text-white/50 border border-white/10 hover:text-white'}`}
        >
          <Users className="w-3.5 h-3.5" />
          동행 구하기 글
          {companions.length > 0 && (
            <span className="ml-1 text-xs opacity-70">({companions.length})</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#f5c842] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activityTab === 'reviews' ? (
        <MyReviews reviews={reviews} onDelete={deleteReview} />
      ) : (
        <MyCompanions companions={companions} onDelete={deleteCompanion} />
      )}
    </div>
  );
}

function MyReviews({ reviews, onDelete }) {
  if (reviews.length === 0) return (
    <EmptyState
      icon={<Star className="w-12 h-12 text-white/20" />}
      message="작성한 후기가 없습니다."
      sub="공연 정보 탭에서 후기를 남겨보세요."
    />
  );

  return (
    <div className="space-y-3">
      {reviews.map(review => (
        <div key={review.id}
          className="bg-white/5 border border-white/8 rounded-2xl p-4">
          {/* 공연 정보 */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{review.venue_name}</p>
              <p className="text-white/40 text-xs mt-0.5">
                {review.musician_name_ko || review.musician_name} · {formatDate(review.concert_date)}
              </p>
            </div>
            {/* 별점 */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {[1,2,3,4,5].map(s => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${s <= review.rating ? 'text-[#f5c842] fill-[#f5c842]' : 'text-white/20'}`}
                />
              ))}
            </div>
          </div>

          {/* 후기 내용 */}
          {review.content && (
            <p className="text-white/60 text-sm leading-relaxed bg-white/3 rounded-xl px-3 py-2.5 mb-3">
              {review.content}
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-white/25 text-xs">{formatDateTime(review.created_at)}</p>
            <button
              onClick={() => onDelete(review.)}
              className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MyCompanions({ companions, onDelete }) {
  if (companions.length === 0) return (
    <EmptyState
      icon={<Users className="w-12 h-12 text-white/20" />}
      message="작성한 동행 구하기 글이 없습니다."
      sub="공연 상세 탭에서 동행을 구해보세요."
    />
  );

  return (
    <div className="space-y-3">
      {companions.map(post => (
        <div key={post.id}
          className="bg-white/5 border border-white/8 rounded-2xl p-4">
          {/* 공연 정보 */}
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3 h-3 text-white/30" />
            <p className="text-white/40 text-xs truncate">
              {post.venue_name} · {post.musician_name_ko || post.musician_name} · {formatDate(post.concert_date)}
            </p>
          </div>

          {/* 글 내용 */}
          <p className="text-white font-semibold text-sm mb-1">{post.title}</p>
          <p className="text-white/50 text-sm leading-relaxed line-clamp-2">{post.content}</p>

          <div className="flex items-center justify-between mt-3">
            <p className="text-white/25 text-xs">{formatDateTime(post.created_at)}</p>
            <button
              onClick={() => onDelete(post.id)}
              className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 즐겨찾기 공연 ────────────────────────────── */
function FavConcerts({ concerts, selectedConcert, onSelect, onRemove }) {
  if (concerts.length === 0) return (
    <EmptyState icon={<Calendar className="w-12 h-12 text-white/20" />}
      message="즐겨찾기한 공연이 없습니다."
      sub="공연 정보 탭에서 하트 버튼을 눌러 추가하세요." />
  );

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
        <div key={concert.id} onClick={() => onSelect(concert)}
          className="group relative bg-white/5 hover:bg-white/10 border border-white/10
                     hover:border-[#f5c842]/30 rounded-2xl overflow-hidden
                     transition-all duration-200 cursor-pointer">
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
          <button onClick={e => { e.stopPropagation(); onRemove(concert.id); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-600
                       flex items-center justify-center transition-all">
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
          <p className="text-[#f5c842] text-sm font-medium">
            {formatDate(concert.concert_date)}
            {concert.concert_time && ` · ${concert.concert_time?.slice(0, 5)}`}
          </p>
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
        <button onClick={onRemove}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors">
          <Heart className="w-4 h-4 fill-red-400" /> 즐겨찾기 해제
        </button>
      </div>
    </div>
  );
}

/* ── 즐겨찾기 연주자 ──────────────────────────── */
function FavMusicians({ musicians, onSelect, onRemove }) {
  if (musicians.length === 0) return (
    <EmptyState icon={<Music2 className="w-12 h-12 text-white/20" />}
      message="즐겨찾기한 연주자가 없습니다."
      sub="연주자 카드의 하트 버튼을 눌러 추가하세요." />
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {musicians.map(m => (
        <div key={m.id} onClick={() => onSelect(m)}
          className="group relative bg-white/5 hover:bg-white/10 border border-white/10
                     hover:border-[#f5c842]/30 rounded-2xl overflow-hidden
                     transition-all duration-200 cursor-pointer">
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
          <button onClick={e => { e.stopPropagation(); onRemove(m.id); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-600
                       flex items-center justify-center transition-all">
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

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}
