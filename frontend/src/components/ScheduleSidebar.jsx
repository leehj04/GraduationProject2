import React, { useState, useCallback } from 'react';
import { MapPin, Clock, Music2, Navigation, Loader2, X } from 'lucide-react';
import api from '../api';

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const INSTRUMENT_PHOTOS = {
  'yunchan-lim':  'https://images.unsplash.com/photo-1476287803067-f714aa78eaa7?w=200&q=80',
  'trifonov':     'https://images.unsplash.com/photo-1748597603497-2860de84bf11?w=200&q=80',
  'seongjin-cho': 'https://images.unsplash.com/photo-1652058812858-8642c4f6185e?w=200&q=80',
  'yuja-wang':    'https://images.unsplash.com/photo-1607817359832-19a6a93c5f23?w=200&q=80',
  'lang-lang':    'https://images.unsplash.com/photo-1638794159092-d6a420eedab2?w=200&q=80',
  'hilary-hahn':  'https://images.unsplash.com/photo-1692553173440-bc496a6f5e19?w=200&q=80',
};

export default function ScheduleSidebar({
  musician, concerts, selectedMonth, availableMonths,
  loading, onConcertClick, onMonthFilter
}) {
  // ── 50km 필터 상태 ──────────────────────────────
  const [nearbyMode, setNearbyMode]         = useState(false);   // 필터 ON/OFF
  const [nearbyLoading, setNearbyLoading]   = useState(false);
  const [nearbyConcerts, setNearbyConcerts] = useState([]);
  const [nearbyError, setNearbyError]       = useState('');
  const [userLocation, setUserLocation]     = useState(null);    // { lat, lng }

  // 내 위치 기반 필터 토글
  const toggleNearby = useCallback(() => {
    if (nearbyMode) {
      // 필터 끄기
      setNearbyMode(false);
      setNearbyConcerts([]);
      setNearbyError('');
      return;
    }

    // 필터 켜기 → 위치 권한 요청
    if (!navigator.geolocation) {
      setNearbyError('이 브라우저는 위치 기능을 지원하지 않습니다.');
      return;
    }

    setNearbyLoading(true);
    setNearbyError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        try {
          const res = await api.get('/api/concerts/nearby-user', {
            params: { lat, lng, musicianId: musician?.id }
          });
          setNearbyConcerts(res.data);
          setNearbyMode(true);
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
        if (err.code === 1) {
          setNearbyError('위치 권한을 허용해주세요.');
        } else {
          setNearbyError('위치를 가져올 수 없습니다.');
        }
      },
      { timeout: 8000 }
    );
  }, [nearbyMode, musician?.id]);

  // 실제로 사이드바에 보여줄 공연 목록
  const displayConcerts = nearbyMode ? nearbyConcerts : concerts;

  return (
    <div className="sidebar-panel slide-in">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
        {musician ? (
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-serif font-bold text-white text-base leading-tight">
                {musician.name_ko || musician.name}
              </h2>
              <p className="text-white/40 text-xs mt-0.5">향후 6개월 공연 일정</p>
            </div>
          </div>
        ) : (
          <div className="h-10 bg-white/10 rounded-lg animate-pulse" />
        )}
      </div>

      {/* 월별 필터 + 50km 필터 */}
      <div className="px-5 py-3 border-b border-white/10 flex-shrink-0 space-y-3">

        {/* 50km 내 공연 필터 버튼 */}
        <div className="flex items-center justify-between">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">내 주변 공연</p>
          <button
            onClick={toggleNearby}
            disabled={nearbyLoading}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              transition-all duration-200 border
              ${nearbyMode
                ? 'bg-[#f5c842] text-[#0a0e1a] border-[#f5c842]'
                : 'bg-white/5 text-white/60 border-white/15 hover:bg-white/15 hover:text-white'
              }
              ${nearbyLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {nearbyLoading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Navigation className="w-3 h-3" />
            }
            {nearbyLoading ? '위치 확인 중...' : nearbyMode ? '50km 필터 ON' : '50km 이내'}
            {nearbyMode && !nearbyLoading && (
              <X className="w-3 h-3 ml-0.5 opacity-70" />
            )}
          </button>
        </div>

        {/* 에러 메시지 */}
        {nearbyError && !nearbyMode && (
          <p className="text-red-400/70 text-xs">{nearbyError}</p>
        )}

        {/* 50km 필터 ON일 때 결과 요약 */}
        {nearbyMode && nearbyConcerts.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f5c842]/8 border border-[#f5c842]/20 rounded-lg">
            <Navigation className="w-3 h-3 text-[#f5c842]" />
            <p className="text-[#f5c842]/80 text-xs">
              내 위치 50km 이내 공연 {nearbyConcerts.length}개
            </p>
          </div>
        )}

        {/* 월별 필터 (50km 모드 아닐 때만 표시) */}
        {!nearbyMode && availableMonths.length > 0 && (
          <div>
            <p className="text-white/40 text-xs mb-2 font-medium uppercase tracking-wider">월별 필터</p>
            <div className="flex flex-wrap gap-1.5">
              {availableMonths.map(({ month, count }) => {
                const [, mo] = month.split('-');
                const label = MONTH_LABELS[parseInt(mo) - 1];
                const isActive = selectedMonth === month;
                return (
                  <button
                    key={month}
                    onClick={() => onMonthFilter(month)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                      ${isActive
                        ? 'bg-[#f5c842] text-[#0a0e1a]'
                        : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                      }`}
                  >
                    {label} <span className={isActive ? 'opacity-70' : 'opacity-50'}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Concert List */}
      <div className="flex-1 overflow-y-auto">
        {loading || nearbyLoading ? (
          <div className="px-5 py-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                <div className="h-16 bg-white/10 rounded-xl" />
              </div>
            ))}
          </div>
        ) : nearbyMode && nearbyError ? (
          <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
            <Navigation className="w-12 h-12 text-white/20 mb-3" />
            <p className="text-white/40 text-sm">{nearbyError}</p>
          </div>
        ) : displayConcerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
            <Music2 className="w-12 h-12 text-white/20 mb-3" />
            <p className="text-white/40 text-sm">
              {selectedMonth ? '이 달에는 공연이 없습니다.' : '예정된 공연이 없습니다.'}
            </p>
          </div>
        ) : (
          <ConcertList
            concerts={displayConcerts}
            onConcertClick={onConcertClick}
            showDistance={nearbyMode}
          />
        )}
      </div>

      {/* Footer count */}
      {!loading && !nearbyLoading && displayConcerts.length > 0 && (
        <div className="px-5 py-3 border-t border-white/10 flex-shrink-0">
          <p className="text-white/30 text-xs text-center">
            {nearbyMode ? `50km 이내 ${displayConcerts.length}개` : `총 ${displayConcerts.length}개의 공연`}
          </p>
        </div>
      )}
    </div>
  );
}

function ConcertList({ concerts, onConcertClick, showDistance }) {
  // 50km 모드일 땐 거리순 그대로, 아닐 땐 월별 그룹핑
  if (showDistance) {
    return (
      <div className="px-4 py-4 space-y-2">
        {concerts.map(concert => (
          <ConcertCard
            key={concert.id}
            concert={concert}
            onClick={() => onConcertClick(concert)}
            showDistance
          />
        ))}
      </div>
    );
  }

  const grouped = concerts.reduce((acc, concert) => {
    const [yr, mo] = concert.concert_date.split('-');
    const key = `${yr}-${mo}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(concert);
    return acc;
  }, {});

  return (
    <div className="px-4 py-4 space-y-5">
      {Object.entries(grouped).map(([month, items]) => {
        const [yr, mo] = month.split('-');
        const label = `${yr}년 ${MONTH_LABELS[parseInt(mo) - 1]}`;
        return (
          <div key={month}>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2.5 px-1">{label}</p>
            <div className="space-y-2">
              {items.map(concert => (
                <ConcertCard key={concert.id} concert={concert} onClick={() => onConcertClick(concert)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConcertCard({ concert, onClick, showDistance }) {
  const date = new Date(concert.concert_date + 'T00:00:00');
  const dayLabel = date.toLocaleDateString('ko-KR', { weekday: 'short' });
  const dayNum = date.getDate();
  const monthLabel = MONTH_LABELS[date.getMonth()];

  return (
    <button
      onClick={onClick}
      className="w-full text-left group bg-white/5 hover:bg-white/10 border border-white/8
                 hover:border-[#f5c842]/25 rounded-xl p-3.5 transition-all duration-200
                 card-hover"
    >
      <div className="flex gap-3 items-start">
        <div className="flex-shrink-0 w-11 text-center bg-[#f5c842]/10 border border-[#f5c842]/20 rounded-lg p-1.5">
          <p className="text-[#f5c842] font-bold text-lg leading-none">{dayNum}</p>
          <p className="text-[#f5c842]/70 text-[10px] mt-0.5">{monthLabel}</p>
          <p className="text-white/30 text-[10px]">{dayLabel}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate group-hover:text-[#f5c842] transition-colors">
            {concert.venue_name}
          </p>
          {(concert.venue_city || concert.venue_country) && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-white/30 flex-shrink-0" />
              <p className="text-white/40 text-xs truncate">
                {[concert.venue_city, concert.venue_country].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
          {concert.concert_time && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-white/30 flex-shrink-0" />
              <p className="text-white/40 text-xs">{concert.concert_time}</p>
            </div>
          )}
          {/* 거리 표시 (50km 모드일 때) */}
          {showDistance && concert.distance_km != null && (
            <div className="flex items-center gap-1 mt-1.5">
              <Navigation className="w-3 h-3 text-[#f5c842]/60 flex-shrink-0" />
              <p className="text-[#f5c842]/60 text-xs font-medium">내 위치에서 {concert.distance_km}km</p>
            </div>
          )}
          {concert.program?.length > 0 && (
            <p className="text-white/30 text-xs mt-1.5 truncate">
              {concert.program[0]}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
