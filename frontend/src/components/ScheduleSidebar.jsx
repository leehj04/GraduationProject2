import React from 'react';
import { Calendar, MapPin, Clock, Music2 } from 'lucide-react';

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

export default function ScheduleSidebar({
  musician, concerts, selectedMonth, availableMonths,
  loading, onConcertClick, onMonthFilter
}) {
  return (
    <div className="sidebar-panel slide-in">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
        {musician ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
              <img
                src={musician.photo_url}
                alt={musician.name}
                className="w-full h-full object-cover"
                onError={e => { e.target.style.display='none'; }}
              />
            </div>
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

      {/* Month Filter */}
      {availableMonths.length > 0 && (
        <div className="px-5 py-3 border-b border-white/10 flex-shrink-0">
          <p className="text-white/40 text-xs mb-2.5 font-medium uppercase tracking-wider">월별 필터</p>
          <div className="flex flex-wrap gap-1.5">
            {availableMonths.map(({ month, count }) => {
              const [yr, mo] = month.split('-');
              const label = `${MONTH_LABELS[parseInt(mo) - 1]}`;
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

      {/* Concert List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-5 py-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                <div className="h-16 bg-white/10 rounded-xl" />
              </div>
            ))}
          </div>
        ) : concerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
            <Music2 className="w-12 h-12 text-white/20 mb-3" />
            <p className="text-white/40 text-sm">
              {selectedMonth ? '이 달에는 공연이 없습니다.' : '예정된 공연이 없습니다.'}
            </p>
          </div>
        ) : (
          <ConcertList concerts={concerts} onConcertClick={onConcertClick} />
        )}
      </div>

      {/* Footer count */}
      {!loading && concerts.length > 0 && (
        <div className="px-5 py-3 border-t border-white/10 flex-shrink-0">
          <p className="text-white/30 text-xs text-center">
            총 {concerts.length}개의 공연
          </p>
        </div>
      )}
    </div>
  );
}

function ConcertList({ concerts, onConcertClick }) {
  // Group concerts by month
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

function ConcertCard({ concert, onClick }) {
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
        {/* Date badge */}
        <div className="flex-shrink-0 w-11 text-center bg-[#f5c842]/10 border border-[#f5c842]/20 rounded-lg p-1.5">
          <p className="text-[#f5c842] font-bold text-lg leading-none">{dayNum}</p>
          <p className="text-[#f5c842]/70 text-[10px] mt-0.5">{monthLabel}</p>
          <p className="text-white/30 text-[10px]">{dayLabel}</p>
        </div>

        {/* Content */}
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