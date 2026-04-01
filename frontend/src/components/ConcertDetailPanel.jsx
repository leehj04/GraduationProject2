import React, { useState, useEffect } from 'react';
import {
  X, MapPin, Phone, Clock, Music, ExternalLink,
  UtensilsCrossed, Coffee, Landmark, Star, Navigation,
  Users, Loader2, User, Heart
} from 'lucide-react';
import api from '../api';
import CompanionTab from './CompanionTab';
import NotificationSettings from './NotificationSettings';
import ReviewSection from './ReviewSection';
import ShareCardButton from './ShareCardButton';

const TABS = [
  { id: 'info',     label: '공연 정보',  icon: Music },
  { id: 'nearby',   label: '주변 정보',  icon: MapPin },
  { id: 'companion',label: '동행 구하기', icon: Users },
];

const NEARBY_TABS = [
  { id: 'restaurant', label: '식당',  icon: UtensilsCrossed, type: 'restaurant' },
  { id: 'cafe',       label: '카페',  icon: Coffee,          type: 'cafe' },
  { id: 'attraction', label: '명소',  icon: Landmark,        type: 'attraction' },
];

export default function ConcertDetailPanel({ concert, musician, onClose }) {
  const [activeTab, setActiveTab] = useState('info');
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    api.get(`/api/favorites/concerts/check/${concert.id}`)
      .then(r => setIsFav(r.data.favorited))
      .catch(() => {});
  }, [concert.id]);

  const toggleFav = async () => {
    try {
      if (isFav) {
        await api.delete(`/api/favorites/concerts/${concert.id}`);
        setIsFav(false);
      } else {
        await api.post(`/api/favorites/concerts/${concert.id}`);
        setIsFav(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="sidebar-panel slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
        <h2 className="font-serif font-bold text-white text-base truncate pr-2">
          {concert.venue_name}
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 즐겨찾기 하트 버튼 */}
          <button
            onClick={toggleFav}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
                        ${isFav ? 'bg-red-500/90 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
            title={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'text-white fill-white' : 'text-white/70'}`} />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20
                       flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn flex items-center justify-center gap-1.5 text-xs ${activeTab === tab.id ? 'active' : ''}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'info'      && <InfoTab concert={concert} musician={musician} />}
        {activeTab === 'nearby'    && <NearbyTab concert={concert} />}
        {activeTab === 'companion' && <CompanionTab concertId={concert.id} />}
      </div>
    </div>
  );
}

/* ── INFO TAB ─────────────────────────────────── */
function InfoTab({ concert, musician }) {
  const date = new Date(concert.concert_date + 'T00:00:00');
  const dateStr = date.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Venue photo */}
      {concert.venue_photo_url && (
        <div className="relative h-44 overflow-hidden flex-shrink-0">
          <img
            src={concert.venue_photo_url}
            alt={concert.venue_name}
            className="w-full h-full object-cover"
            onError={e => e.target.parentElement.style.display='none'}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/30 to-transparent" />
        </div>
      )}

      <div className="px-5 py-5 space-y-5">
        {/* Venue info */}
        <Section title="공연장">
          <InfoRow icon={MapPin} text={concert.venue_name} bold />
          {concert.venue_address && <InfoRow icon={MapPin} text={concert.venue_address} />}
          {concert.venue_phone   && <InfoRow icon={Phone}  text={concert.venue_phone} />}
        </Section>

        {/* Date / time */}
        <Section title="일정">
          <InfoRow icon={Music}  text={dateStr} bold />
          {concert.concert_time && <InfoRow icon={Clock} text={concert.concert_time} />}
        </Section>

        {/* Performer */}
        {musician && (
          <Section title="연주자">
            <div className="flex items-center gap-3 mt-1">
              {musician.photo_url && (
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                  <img src={musician.photo_url} alt={musician.name}
                    className="w-full h-full object-cover"
                    onError={e => e.target.style.display='none'} />
                </div>
              )}
              <div>
                <p className="text-white font-semibold text-sm">
                  {musician.name_ko || musician.name}
                </p>
                {musician.name_ko && <p className="text-white/40 text-xs">{musician.name}</p>}
              </div>
            </div>
          </Section>
        )}

        {/* Program */}
        {concert.program?.length > 0 && (
          <Section title="연주 곡목">
            <div className="space-y-2 mt-1">
              {concert.program.map((piece, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#f5c842] text-xs mt-0.5">♩</span>
                  <p className="text-white/70 text-sm leading-relaxed">{piece}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Ticket link */}
        {concert.ticket_url && (
          <a
            href={concert.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full btn-primary text-sm"
          >
            티켓 구매 / 공식 사이트 <ExternalLink className="w-4 h-4" />
          </a>
        )}

        {/* 이메일 알림 설정 */}
        <div className="border-t border-white/8 pt-4">
          <NotificationSettings
            concertId={concert.id}
            concertDate={concert.concert_date}
          />
        </div>

        {/* 투어 공유 버튼 */}
        {musician && (
          <ShareCardButton
            musicianId={musician.id}
            musicianName={musician.name_ko || musician.name}
          />
        )}

        {/* 공연 후기 */}
        <div className="border-t border-white/8 pt-4">
          <ReviewSection concertId={concert.id} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2">{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, text, bold }) {
  return (
    <div className="flex items-start gap-2.5 mt-1.5">
      <Icon className="w-3.5 h-3.5 text-white/30 mt-0.5 flex-shrink-0" />
      <p className={`text-sm ${bold ? 'text-white font-medium' : 'text-white/60'}`}>{text}</p>
    </div>
  );
}

/* ── NEARBY TAB ───────────────────────────────── */
function NearbyTab({ concert }) {
  const [nearbyType, setNearbyType] = useState('restaurant');
  const [places, setPlaces]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [hasMock, setHasMock]       = useState(false);

  useEffect(() => {
    if (!concert.venue_lat || !concert.venue_lng) {
      setError('공연장 위치 정보가 없습니다.');
      return;
    }
    setLoading(true);
    setError('');
    setHasMock(false);
    api.get(`/api/nearby?lat=${concert.venue_lat}&lng=${concert.venue_lng}&type=${nearbyType}&radius=5000`)
      .then(r => {
        setPlaces(r.data);
        setHasMock(r.data.some(p => p.isMock));
      })
      .catch(err => setError(err.response?.data?.error || '주변 정보를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [nearbyType, concert.venue_lat, concert.venue_lng]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Sub-tabs */}
      <div className="flex border-b border-white/10 flex-shrink-0 bg-white/3">
        {NEARBY_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setNearbyType(tab.id)}
              className={`tab-btn flex items-center justify-center gap-1.5 text-xs ${nearbyType === tab.id ? 'active' : ''}`}
            >
              <Icon className="w-3 h-3" /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#f5c842] animate-spin" />
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-white/40 text-sm">{error}</p>
          </div>
        ) : places.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-white/40 text-sm">주변 장소를 찾지 못했습니다.</p>
            <p className="text-white/25 text-xs mt-1">Google Places API 키를 확인해주세요.</p>
          </div>
        ) : (
          <>
            {hasMock && (
              <div className="mx-4 mt-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-400/80 text-xs">
                  ⚠ Google Places API 키가 없거나 제한되어 예시 데이터를 표시합니다.
                </p>
              </div>
            )}
            <div className="px-4 py-4 space-y-3">
              {places.map(place => (
                <PlaceCard key={place.place_id} place={place} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlaceCard({ place }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden hover:bg-white/10 transition-colors">
      <div className="flex gap-3 p-3">
        {place.photo_url ? (
          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
            <img
              src={place.photo_url}
              alt={place.name}
              className="w-full h-full object-cover"
              onError={e => { e.target.parentElement.style.display = 'none'; }}
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-white/20" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{place.name}</p>
          {place.address && (
            <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{place.address}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {place.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-[#f5c842] fill-[#f5c842]" />
                <span className="text-white/70 text-xs font-medium">{place.rating}</span>
                {place.user_ratings_total && (
                  <span className="text-white/30 text-xs">({place.user_ratings_total.toLocaleString()})</span>
                )}
              </div>
            )}
            {place.distance != null && (
              <div className="flex items-center gap-1">
                <Navigation className="w-3 h-3 text-white/30" />
                <span className="text-white/40 text-xs">
                  {place.distance < 1000
                    ? `${place.distance}m`
                    : `${(place.distance / 1000).toFixed(1)}km`}
                </span>
              </div>
            )}
          </div>
          {place.open_now !== undefined && (
            <span className={`text-xs mt-1 inline-block ${place.open_now ? 'text-green-400' : 'text-red-400/70'}`}>
              {place.open_now ? '영업 중' : '영업 종료'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}