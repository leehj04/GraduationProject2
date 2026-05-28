import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Globe, ChevronRight, Ticket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

// 나라 국기 이모지 매핑
const COUNTRY_FLAG = {
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'Great Britain': '🇬🇧',
  'Germany': '🇩🇪', 'France': '🇫🇷', 'Austria': '🇦🇹', 'Netherlands': '🇳🇱',
  'Italy': '🇮🇹', 'Spain': '🇪🇸', 'Switzerland': '🇨🇭', 'Belgium': '🇧🇪',
  'Australia': '🇦🇺', 'Canada': '🇨🇦', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
  'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Denmark': '🇩🇰', 'Finland': '🇫🇮',
  'Czech Republic': '🇨🇿', 'Poland': '🇵🇱', 'Ireland': '🇮🇪',
  'New Zealand': '🇳🇿', 'Mexico': '🇲🇽',
};

const INSTRUMENT_EMOJI = {
  'Piano': '🎹', 'Violin': '🎻', 'Cello': '🎻', 'Viola': '🎻',
  'Conductor': '🎼', 'Orchestra': '🎼', 'Ensemble': '🎼', 'Quartet': '🎻',
  'Soprano': '🎤', 'Tenor': '🎤', 'Baritone': '🎤', 'Choir': '🎤',
  'Composer': '✍️', 'Performer': '🎵', 'Flute': '🎵', 'Clarinet': '🎵',
  'Guitar': '🎸', 'Trumpet': '🎺', 'Horn': '🎺',
  '피아노': '🎹', '바이올린': '🎻', '첼로': '🎻', '지휘': '🎼',
};

export default function TravelSearch() {
  const navigate = useNavigate();
  const [countries, setCountries] = useState([]);
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    country: '전체',
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // 나라 목록 로드
  useEffect(() => {
    api.get('/api/travel/countries')
      .then(r => setCountries(['전체', ...r.data]))
      .catch(() => {});
  }, []);

  // 오늘 날짜 기본값
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const next = new Date();
    next.setDate(next.getDate() + 14);
    setForm(f => ({
      ...f,
      startDate: today,
      endDate: next.toISOString().slice(0, 10),
    }));
  }, []);

  const handleSearch = async () => {
    if (!form.startDate || !form.endDate) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        startDate: form.startDate,
        endDate: form.endDate,
        ...(form.country !== '전체' && { country: form.country }),
      });
      const res = await api.get(`/api/travel/search?${params}`);
      setResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6">
        <h2 className="font-serif text-3xl font-bold text-white mb-1">여행 중 공연 찾기</h2>
        <p className="text-white/40 text-sm">여행 날짜와 나라를 입력하면 그 기간의 공연을 보여드립니다</p>
      </div>

      {/* 검색 폼 */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* 시작일 */}
          <div>
            <label className="text-white/50 text-xs mb-1.5 block flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 여행 시작일
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-[#f5c842]/50
                         [color-scheme:dark]"
            />
          </div>

          {/* 종료일 */}
          <div>
            <label className="text-white/50 text-xs mb-1.5 block flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 여행 종료일
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-[#f5c842]/50
                         [color-scheme:dark]"
            />
          </div>

          {/* 나라 */}
          <div>
            <label className="text-white/50 text-xs mb-1.5 block flex items-center gap-1">
              <Globe className="w-3 h-3" /> 나라 (선택)
            </label>
            <select
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-[#f5c842]/50"
            >
              {countries.map(c => (
                <option key={c} value={c} className="bg-[#1a1f35] text-white">
                  {COUNTRY_FLAG[c] || '🌍'} {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 검색 버튼 */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="mt-4 w-full bg-[#f5c842] hover:bg-[#e6b800] text-[#0a0e1a]
                     font-bold py-3 rounded-xl flex items-center justify-center gap-2
                     transition-all duration-200 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-[#0a0e1a] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? '검색 중...' : '공연 검색'}
        </button>
      </div>

      {/* 검색 결과 */}
      {searched && !loading && results && (
        <>
          <p className="text-white/40 text-xs mb-3">
            {form.country !== '전체' ? `${COUNTRY_FLAG[form.country] || ''} ${form.country} · ` : ''}
            {form.startDate} ~ {form.endDate} · {results.total}건
          </p>

          {results.total === 0 ? (
            <div className="text-center py-16">
              <MapPin className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">해당 기간에 공연이 없습니다.</p>
              <p className="text-white/25 text-sm mt-1">기간이나 나라를 바꿔 다시 검색해보세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.concerts.map(concert => (
                <ConcertRow
                  key={concert.id}
                  concert={concert}
                  onClickMusician={() => navigate(`/map/${concert.musician_id}`)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConcertRow({ concert, onClickMusician, formatDate }) {
  const emoji = INSTRUMENT_EMOJI[concert.musician_instrument] || '🎵';
  const flag = COUNTRY_FLAG[concert.venue_country] || '🌍';

  return (
    <div className="bg-white/5 border border-white/8 hover:border-[#f5c842]/30
                    rounded-xl px-4 py-3.5 transition-all duration-200">
      <div className="flex items-start gap-3">
        {/* 날짜 */}
        <div className="flex-shrink-0 w-14 text-center">
          <p className="text-[#f5c842] font-bold text-lg leading-none">
            {new Date(concert.concert_date).getDate()}
          </p>
          <p className="text-white/40 text-xs">
            {new Date(concert.concert_date).toLocaleDateString('ko-KR', { month: 'short' })}
          </p>
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          {/* 음악가 */}
          <button
            onClick={onClickMusician}
            className="flex items-center gap-1.5 mb-1 hover:text-[#f5c842] transition-colors group"
          >
            <span className="text-sm">{emoji}</span>
            <span className="text-white font-semibold text-sm group-hover:text-[#f5c842]">
              {concert.musician_name_ko || concert.musician_name}
            </span>
            {concert.musician_name_ko && (
              <span className="text-white/30 text-xs">{concert.musician_name}</span>
            )}
          </button>

          {/* 베뉴 */}
          <p className="text-white/50 text-xs flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {concert.venue_name}
            {concert.venue_city && ` · ${concert.venue_city}`}
            <span className="ml-1">{flag}</span>
          </p>

          {/* 공연명 */}
          {concert.title && concert.title !== concert.musician_name && (
            <p className="text-white/30 text-xs mt-0.5 truncate">{concert.title}</p>
          )}
        </div>

        {/* 티켓 버튼 */}
        {concert.ticket_url && (
          <a
            href={concert.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5
                       bg-[#f5c842]/10 hover:bg-[#f5c842]/20 border border-[#f5c842]/30
                       rounded-lg text-[#f5c842] text-xs font-medium transition-all"
          >
            <Ticket className="w-3 h-3" />
            예매
          </a>
        )}
      </div>
    </div>
  );
}
