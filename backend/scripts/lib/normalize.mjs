/**
 * 데이터 정규화 — 기존 concert_tracker.db 스키마에 맞춤
 *
 * concerts 테이블 실제 컬럼:
 *   musician_id, title, venue_name, venue_address, venue_city, venue_country,
 *   venue_lat, venue_lng, concert_date, concert_time, ticket_url,
 *   external_id, source, natural_key, updated_at
 *
 * musicians 테이블 실제 컬럼:
 *   name, name_ko, bio, photo_url, official_site, scraper_key,
 *   instrument, nationality, mbid, source
 */

/**
 * 문자열 기본 정규화
 * - 소문자
 * - 다이아크리틱(악센트) 제거: "Antonín" → "Antonin"
 * - 구두점/특수문자 → 공백
 * - 연속 공백 1개로 압축
 * - 앞뒤 공백 제거
 */
export function normalizeString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 음악가명 정규화
 */
export function normalizeMusicianName(name) {
  let s = normalizeString(name);
  s = s.replace(/^the\s+/, '');
  return s;
}

/**
 * 베뉴명 정규화 — 첫 콤마 앞부분만
 */
export function normalizeVenue(venue) {
  if (!venue) return '';
  const head = String(venue).split(',')[0];
  return normalizeString(head);
}

/**
 * 날짜 정규화 (YYYY-MM-DD)
 */
export function normalizeDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * 콘서트 자연 키
 */
export function buildConcertKey({ musician, venue, date }) {
  return [
    normalizeMusicianName(musician),
    normalizeVenue(venue),
    normalizeDate(date),
  ].join('|');
}

/**
 * 소스에서 받은 raw 데이터를 기존 DB 스키마에 맞게 정규화
 * 
 * 출력 필드는 concert_tracker.db 의 concerts 테이블 컬럼명과 일치
 */
export function normalizeConcert(raw) {
  return {
    external_id: raw.externalId || null,
    source: raw.source || 'unknown',
    // musicians 매칭용 (DB 컬럼은 아님, upsert 에서 매핑에 사용)
    musician_name: raw.musician?.trim() || '',
    // concerts 테이블 실제 컬럼명
    title: raw.title?.trim() || '',
    venue_name: raw.venue?.trim() || '',
    venue_address: raw.venueAddress?.trim() || null,
    venue_city: raw.city?.trim() || '',
    venue_country: raw.country?.trim() || '',
    concert_date: normalizeDate(raw.date),
    concert_time: raw.time?.trim() || null,
    venue_lat: raw.latitude != null ? parseFloat(raw.latitude) : null,
    venue_lng: raw.longitude != null ? parseFloat(raw.longitude) : null,
    ticket_url: raw.ticketUrl || null,
    natural_key: buildConcertKey({
      musician: raw.musician,
      venue: raw.venue,
      date: raw.date,
    }),
  };
}
