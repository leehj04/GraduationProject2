/**
 * MusicBrainz Fetcher (음악가 메타데이터 소스)
 *
 * 이미 사용 중인 MusicBrainz API를 안정성 패턴으로 감싼 버전.
 *
 *   - 클래식 음악 태그가 붙은 아티스트만 가져오기
 *   - rate limit 엄수 (1 req/sec — MusicBrainz 공식 정책)
 *   - User-Agent 헤더 필수 (이거 빼면 403 떨어짐)
 *   - 재시도 + 백오프
 */

import axios from 'axios';
import { withRetry, sleep } from '../lib/retry.mjs';
import { createLogger } from '../lib/logger.mjs';

const log = createLogger('musicbrainz');

const BASE_URL = 'https://musicbrainz.org/ws/2';
// MusicBrainz 는 User-Agent 가 식별 가능해야 함. 정책상 필수.
const USER_AGENT = 'ClassicTour/1.0 (graduation-project; contact@classictour.local)';
const RATE_LIMIT_MS = 1100; // 1 req/sec + 약간의 마진

/**
 * 클래식 태그가 있는 아티스트 검색
 * @param {number} limit - 가져올 음악가 수 (최대 100/페이지)
 * @returns {Promise<Array>}
 */
export async function fetchClassicalMusicians(limit = 150) {
  log.info('수집 시작', { 목표: limit });
  const collected = [];
  const PAGE_SIZE = 100;

  for (let offset = 0; collected.length < limit; offset += PAGE_SIZE) {
    const data = await withRetry(async () => {
      const res = await axios.get(`${BASE_URL}/artist`, {
        params: {
          query: 'tag:classical AND (type:person OR type:group)',
          limit: PAGE_SIZE,
          offset,
          fmt: 'json',
        },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000,
      });
      return res.data;
    });

    const artists = data.artists || [];
    if (artists.length === 0) break;

    for (const a of artists) {
      collected.push({
        mbid: a.id,
        name: a.name,
        type: a.type || null, // Person | Group | Orchestra ...
        country: a.country || null,
        disambiguation: a.disambiguation || null,
        tags: (a.tags || []).map((t) => t.name).join(', '),
      });
      if (collected.length >= limit) break;
    }

    log.info('페이지 수집', {
      offset,
      누적: collected.length,
      총결과: data.count,
    });

    // 1 req/sec rate limit 보호
    await sleep(RATE_LIMIT_MS);
  }

  log.info('수집 완료', { 수집수: collected.length });
  return collected;
}
