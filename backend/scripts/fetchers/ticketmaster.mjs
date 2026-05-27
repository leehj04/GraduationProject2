/**
 * Ticketmaster Discovery API Fetcher (메인 데이터 소스)
 *
 * 왜 Ticketmaster 인가:
 *   1. 공식 무료 API (HTML 스크래핑 X) — 사이트 구조 변경에 영향 없음
 *   2. 클래식 음악(Classical) genre 필터 지원
 *   3. 전 세계 베뉴, 좌표, 티켓 URL 까지 제공
 *   4. 한 번 호출에 200건씩 페이지네이션
 *
 * 사용 엔드포인트:
 *   GET https://app.ticketmaster.com/discovery/v2/events.json
 *   params:
 *     - apikey
 *     - classificationName=Classical
 *     - keyword=<musician name>  (없으면 장르 전체)
 *     - size=200 (max)
 *     - page=0,1,2...
 *     - startDateTime / endDateTime (ISO 8601, ex: 2026-01-01T00:00:00Z)
 *
 * Rate limit: 5,000 calls/day, 5 calls/sec — 우리 사용량으로는 충분
 */

import axios from 'axios';
import pLimit from 'p-limit';
import { withRetry, sleep } from '../lib/retry.mjs';
import { createLogger } from '../lib/logger.mjs';

const log = createLogger('ticketmaster');

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';
const API_KEY = null; // 함수 안에서 읽음
const PAGE_SIZE = 200;
const MAX_PAGES = 5; // 음악가당 최대 1000건 (현실적으로 절대 안 채움)
const CONCURRENCY = 3; // 동시 요청 수 (rate limit 보호)

/**
 * Ticketmaster event 객체 → 우리 raw 콘서트 객체로 변환
 */
function transformEvent(event, musicianName) {
  const venue = event._embedded?.venues?.[0];
  return {
    externalId: `tm_${event.id}`,
    source: 'ticketmaster',
    musician: musicianName,
    venue: venue?.name || '',
    city: venue?.city?.name || '',
    country: venue?.country?.name || '',
    date: event.dates?.start?.dateTime || event.dates?.start?.localDate || '',
    latitude: venue?.location?.latitude ? parseFloat(venue.location.latitude) : null,
    longitude: venue?.location?.longitude ? parseFloat(venue.location.longitude) : null,
    ticketUrl: event.url || null,
  };
}

/**
 * 한 음악가에 대해 모든 페이지를 다 긁어오기
 */
async function fetchEventsForMusician(musicianName, startDate, endDate) {
  const allEvents = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await withRetry(async () => {
      const res = await axios.get(BASE_URL, {
        params: {
          apikey: process.env.TICKETMASTER_API_KEY,
          classificationName: 'Classical',
          keyword: musicianName,
          size: PAGE_SIZE,
          page,
          startDateTime: startDate,
          endDateTime: endDate,
          sort: 'date,asc',
        },
        timeout: 15000,
      });
      return res.data;
    });

    const events = data._embedded?.events || [];
    allEvents.push(...events);

    const totalPages = data.page?.totalPages || 0;
    if (page + 1 >= totalPages) break;

    // 페이지 사이 약간 텀 (5 req/sec 제한 보호)
    await sleep(250);
  }

  return allEvents.map((ev) => transformEvent(ev, musicianName));
}

/**
 * 메인 export: 음악가 리스트를 받아 콘서트 raw 데이터 배열 반환
 *
 * @param {Array<{name:string}>} musicians
 * @param {object} opts - { startDate, endDate }
 * @returns {Promise<Array>} normalize.js 의 normalizeConcert 에 넣을 raw 객체들
 */
export async function fetchTicketmasterConcerts(musicians, opts = {}) {
  const apiKey = process.env.TICKETMASTER_API_KEY; if (!apiKey) {
    log.error('TICKETMASTER_API_KEY 미설정 — Ticketmaster fetcher 비활성화');
    return [];
  }

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(now.getFullYear() + 1);

  const startDate = opts.startDate || now.toISOString().slice(0, 19) + 'Z';
  const endDate = opts.endDate || oneYearLater.toISOString().slice(0, 19) + 'Z';

  log.info('수집 시작', {
    음악가수: musicians.length,
    기간: `${startDate} ~ ${endDate}`,
  });

  const limit = pLimit(CONCURRENCY);
  const all = [];
  let processed = 0;
  let failed = 0;

  const tasks = musicians.map((m) =>
    limit(async () => {
      try {
        const events = await fetchEventsForMusician(m.name, startDate, endDate);
        all.push(...events);
        processed++;
        if (processed % 10 === 0) {
          log.info(`진행 중`, {
            처리: `${processed}/${musicians.length}`,
            수집콘서트수: all.length,
          });
        }
      } catch (err) {
        failed++;
        log.warn(`음악가 처리 실패 — 다음으로 진행`, {
          음악가: m.name,
          에러: err.message,
        });
      }
    })
  );

  await Promise.all(tasks);

  log.info('수집 완료', {
    처리음악가: processed,
    실패음악가: failed,
    총콘서트수: all.length,
  });

  return all;
}
