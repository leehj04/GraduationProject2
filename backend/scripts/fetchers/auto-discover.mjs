/**
 * Ticketmaster Auto-Discover Fetcher
 *
 * 시드 리스트 필요 없음. 작동 방식:
 *   1. Classical 카테고리 전체 검색 (키워드 X)
 *   2. 여러 국가/지역별로 검색해서 커버리지 확보
 *   3. 이벤트 안의 attractions 에서 아티스트 이름 자동 추출
 *   4. 아티스트 + 콘서트 둘 다 한 번에 수집
 *
 * 결과: 사람이 리스트를 관리할 필요가 0
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createLogger } from '../lib/logger.mjs';

dotenv.config();
const log = createLogger('auto-discover');

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';
const API_KEY = process.env.TICKETMASTER_API_KEY;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 국가별로 검색해서 전세계 커버리지 확보
const COUNTRY_CODES = [
  'US', 'GB', 'DE', 'FR', 'AT', 'NL', 'IT', 'ES',
  'CH', 'BE', 'AU', 'CA', 'JP', 'KR', 'SE', 'NO',
  'DK', 'FI', 'CZ', 'PL', 'IE', 'NZ', 'MX',
];

function transformEvent(event, artistName) {
  const venue = event._embedded?.venues?.[0];
  return {
    externalId: `tm_${event.id}`,
    source: 'ticketmaster',
    musician: artistName,
    title: event.name || '',
    venue: venue?.name || '',
    venueAddress: venue?.address?.line1 || '',
    city: venue?.city?.name || '',
    country: venue?.country?.name || '',
    date: event.dates?.start?.dateTime || event.dates?.start?.localDate || '',
    time: event.dates?.start?.localTime || '',
    latitude: venue?.location?.latitude ? parseFloat(venue.location.latitude) : null,
    longitude: venue?.location?.longitude ? parseFloat(venue.location.longitude) : null,
    ticketUrl: event.url || null,
  };
}

async function fetchCountry(countryCode, maxPages = 5) {
  const events = [];
  for (let page = 0; page < maxPages; page++) {
    try {
      const res = await axios.get(BASE_URL, {
        params: {
          apikey: API_KEY,
          classificationName: 'Classical',
          countryCode,
          size: 200,
          page,
          sort: 'date,asc',
        },
        timeout: 15000,
      });
      const pageEvents = res.data._embedded?.events || [];
      events.push(...pageEvents);
      const totalPages = res.data.page?.totalPages || 0;
      if (page + 1 >= totalPages) break;
      await sleep(250);
    } catch (err) {
      if (err.response?.status === 429) {
        await sleep(2000);
        page--;
        continue;
      }
      break;
    }
  }
  return events;
}

function extractFromEvents(events) {
  const concerts = [];
  const artists = new Map();

  for (const ev of events) {
    const attractions = ev._embedded?.attractions || [];
    if (attractions.length > 0) {
      for (const attr of attractions) {
        const name = attr.name;
        if (!artists.has(name.toLowerCase())) {
          artists.set(name.toLowerCase(), { name });
        }
        concerts.push(transformEvent(ev, name));
      }
    } else {
      const name = ev.name || '';
      if (name && name.length < 100) {
        concerts.push(transformEvent(ev, name));
      }
    }
  }
  return { concerts, artists: Array.from(artists.values()) };
}

export async function autoDiscover() {
  if (!API_KEY) {
    log.error('TICKETMASTER_API_KEY 미설정');
    return { concerts: [], artists: [] };
  }

  log.info('자동 발견 시작', { 검색국가수: COUNTRY_CODES.length });
  const allEvents = [];
  const seenIds = new Set();

  for (const cc of COUNTRY_CODES) {
    const events = await fetchCountry(cc);
    let added = 0;
    for (const ev of events) {
      if (!seenIds.has(ev.id)) {
        seenIds.add(ev.id);
        allEvents.push(ev);
        added++;
      }
    }
    if (added > 0) {
      log.info(`${cc} 완료`, { 신규: added, 누적: allEvents.length });
    }
    await sleep(200);
  }

  log.info('전체 검색 완료', { 총이벤트: allEvents.length });
  const { concerts, artists } = extractFromEvents(allEvents);
  log.info('추출 완료', { 콘서트: concerts.length, 아티스트: artists.length });
  return { concerts, artists };
}
