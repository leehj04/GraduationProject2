/**
 * 중복 제거 — concert_tracker.db 스키마에 맞춤
 */

import { createLogger } from './logger.mjs';

const log = createLogger('dedupe');

/**
 * 두 콘서트 중 "정보가 더 풍부한" 쪽을 선택
 */
function pickBetter(a, b) {
  const aScore =
    (a.venue_lat && a.venue_lng ? 2 : 0) +
    (a.ticket_url ? 1 : 0) +
    (a.venue_city ? 1 : 0) +
    (a.venue_country ? 1 : 0);
  const bScore =
    (b.venue_lat && b.venue_lng ? 2 : 0) +
    (b.ticket_url ? 1 : 0) +
    (b.venue_city ? 1 : 0) +
    (b.venue_country ? 1 : 0);
  return bScore > aScore ? b : a;
}

/**
 * 정규화된 콘서트 배열에서 중복 제거
 */
export function dedupeConcerts(concerts) {
  const map = new Map();
  let duplicates = 0;

  for (const c of concerts) {
    if (!c.natural_key || !c.musician_name || !c.concert_date) {
      continue;
    }
    const existing = map.get(c.natural_key);
    if (existing) {
      duplicates++;
      map.set(c.natural_key, pickBetter(existing, c));
    } else {
      map.set(c.natural_key, c);
    }
  }

  log.info(`중복 제거 완료`, {
    입력: concerts.length,
    출력: map.size,
    중복제거: duplicates,
  });

  return Array.from(map.values());
}

/**
 * 음악가 중복 제거 (이름 정규화 기준)
 */
export function dedupeMusicians(musicians) {
  const map = new Map();
  let duplicates = 0;

  for (const m of musicians) {
    if (!m.name) continue;
    const key = m.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^the\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (map.has(key)) {
      duplicates++;
      const existing = map.get(key);
      if (!existing.mbid && m.mbid) map.set(key, m);
    } else {
      map.set(key, m);
    }
  }

  log.info(`음악가 중복 제거`, {
    입력: musicians.length,
    출력: map.size,
    중복제거: duplicates,
  });

  return Array.from(map.values());
}
