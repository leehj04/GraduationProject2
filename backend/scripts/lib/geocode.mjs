/**
 * 지오코딩 (베뉴 주소 → 위도/경도)
 *
 * 핵심: 같은 베뉴를 두 번 호출하지 않도록 DB에 캐시한다.
 * Google Geocoding API는 유료 구간 진입이 쉬워서 캐시가 비용 절감의 핵심.
 *
 * 캐시 테이블: geocode_cache(query TEXT PRIMARY KEY, lat REAL, lng REAL, fetched_at TEXT)
 */

import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import { withRetry, sleep } from './retry.mjs';
import { createLogger } from './logger.mjs';

const log = createLogger('geocode');

const DB_PATH = process.env.DB_PATH || path.resolve('./concert_tracker.db');
const GOOGLE_KEY = process.env.GOOGLE_GEOCODING_API_KEY;

let db;
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS geocode_cache (
        query TEXT PRIMARY KEY,
        lat REAL,
        lng REAL,
        fetched_at TEXT NOT NULL
      );
    `);
  }
  return db;
}

function getFromCache(query) {
  const row = getDb()
    .prepare('SELECT lat, lng FROM geocode_cache WHERE query = ?')
    .get(query);
  return row || null;
}

function saveToCache(query, lat, lng) {
  getDb()
    .prepare(
      `INSERT INTO geocode_cache (query, lat, lng, fetched_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(query) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, fetched_at = excluded.fetched_at`
    )
    .run(query, lat, lng, new Date().toISOString());
}

/**
 * 베뉴/도시/국가를 받아 좌표를 반환. 캐시 우선.
 * @returns {Promise<{lat:number,lng:number}|null>}
 */
export async function geocode({ venue, city, country }) {
  const query = [venue, city, country].filter(Boolean).join(', ');
  if (!query) return null;

  // 1. 캐시 확인
  const cached = getFromCache(query);
  if (cached) {
    log.debug('캐시 히트', { query });
    return { lat: cached.lat, lng: cached.lng };
  }

  // 2. API 키 없으면 그냥 null (지오코딩 없이도 시스템은 돌아가야 함)
  if (!GOOGLE_KEY) {
    log.warn('GOOGLE_GEOCODING_API_KEY 미설정 — 지오코딩 건너뜀', { query });
    return null;
  }

  // 3. Google Geocoding API 호출
  try {
    const result = await withRetry(async () => {
      const res = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: { address: query, key: GOOGLE_KEY },
          timeout: 10000,
        }
      );
      if (res.data.status !== 'OK') {
        if (res.data.status === 'ZERO_RESULTS') return null;
        const err = new Error(`Geocoding 실패: ${res.data.status}`);
        err.response = { status: 500 };
        throw err;
      }
      const loc = res.data.results[0]?.geometry?.location;
      return loc ? { lat: loc.lat, lng: loc.lng } : null;
    });

    if (result) {
      saveToCache(query, result.lat, result.lng);
      log.debug('지오코딩 성공', { query, ...result });
    } else {
      // 결과 없어도 캐시에 저장해서 다음번에 재호출하지 않게 (null 캐시)
      saveToCache(query, null, null);
      log.debug('지오코딩 결과 없음', { query });
    }

    // Google free tier rate limit 보호: 호출 사이 약간의 텀
    await sleep(100);

    return result;
  } catch (err) {
    log.error('지오코딩 에러', { query, error: err.message });
    return null;
  }
}
