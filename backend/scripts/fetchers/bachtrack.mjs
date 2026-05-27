/**
 * Bachtrack 백업 스크래퍼 (선택 사항 / 보조 소스)
 *
 * 중요: 이건 메인이 아니라 백업이다.
 *   - Ticketmaster API 가 모든 베뉴를 커버하지 못함 (특히 유럽 일부)
 *   - Bachtrack 은 클래식 전문 사이트라 보완 가능
 *
 * 다만 HTML 구조 변경에 취약하므로:
 *   - 실패해도 파이프라인 전체를 죽이지 않음 (try/catch 로 격리)
 *   - 결과 0건이어도 로그만 남기고 진행
 *   - 핵심 데이터 흐름이 여기에 의존하지 않게 구성
 *
 * robots.txt 와 이용약관을 반드시 확인할 것.
 * 학술/졸업 프로젝트 용도라도 무리한 호출은 자제 (예의의 문제).
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { withRetry, sleep } from '../lib/retry.mjs';
import { createLogger } from '../lib/logger.mjs';

const log = createLogger('bachtrack');

const BASE_URL = 'https://bachtrack.com';

/**
 * Bachtrack 콘서트 리스팅 페이지 1개 파싱
 *
 * 주의: 실제 셀렉터는 사이트 구조에 따라 조정 필요.
 * 여기서는 일반적인 패턴을 보여주는 골격만 제공.
 * 실서비스 전 한 번은 직접 확인해야 함.
 */
async function fetchPage(url) {
  return withRetry(async () => {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        // 봇이 아닌 일반 브라우저로 보이도록
        'User-Agent':
          'Mozilla/5.0 (ClassicTour academic project, contact@classictour.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    return res.data;
  });
}

function parseEventCards(html) {
  const $ = cheerio.load(html);
  const events = [];

  // 일반적인 이벤트 카드 셀렉터 패턴 — 실제와 다를 수 있음
  $('.event-listing, .concert-card, article.event').each((_, el) => {
    const $el = $(el);
    const title = $el.find('.event-title, h2, h3').first().text().trim();
    const venue = $el.find('.venue, .location').first().text().trim();
    const dateText = $el.find('.date, time').first().attr('datetime') ||
                     $el.find('.date, time').first().text().trim();
    const ticketUrl = $el.find('a').first().attr('href');

    if (title && venue && dateText) {
      events.push({
        externalId: `bachtrack_${Buffer.from(`${title}|${venue}|${dateText}`).toString('base64').slice(0, 16)}`,
        source: 'bachtrack',
        musician: title,
        venue,
        city: '',
        country: '',
        date: dateText,
        latitude: null,
        longitude: null,
        ticketUrl: ticketUrl?.startsWith('http') ? ticketUrl : `${BASE_URL}${ticketUrl}`,
      });
    }
  });

  return events;
}

/**
 * 메인 export
 * @param {object} opts - { maxPages: 5 }
 * @returns {Promise<Array>} raw 콘서트 객체 배열 (실패 시 빈 배열)
 */
export async function fetchBachtrackConcerts(opts = {}) {
  const { maxPages = 3 } = opts;
  const all = [];

  try {
    log.info('백업 스크래퍼 시작 (실패해도 파이프라인은 계속됨)');

    for (let page = 1; page <= maxPages; page++) {
      try {
        const url = `${BASE_URL}/find/listings?page=${page}`;
        const html = await fetchPage(url);
        const events = parseEventCards(html);
        all.push(...events);

        log.info('페이지 스크랩', { page, 수집: events.length });

        if (events.length === 0) break; // 더 이상 없음

        // 예의 있게 대기 (서버 부담 X)
        await sleep(2000);
      } catch (err) {
        log.warn('페이지 실패 — 다음 페이지로', { page, error: err.message });
        // 한 페이지 실패해도 다음으로 진행
      }
    }

    log.info('백업 스크래퍼 종료', { 총수집: all.length });
  } catch (err) {
    log.error('백업 스크래퍼 전체 실패 — 빈 결과 반환', { error: err.message });
    // 백업 소스는 절대 파이프라인을 죽이지 않는다
    return [];
  }

  return all;
}
