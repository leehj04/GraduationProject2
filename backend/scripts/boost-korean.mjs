/**
 * 한국 음악가 공연 보강 — 다중 검색어 버전
 * 
 * 같은 음악가를 여러 표기로 검색해서 더 많은 공연을 잡는다
 */

import dotenv from 'dotenv';
import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import pLimit from 'p-limit';
import { createLogger } from './lib/logger.mjs';
import { normalizeConcert } from './lib/normalize.mjs';
import { dedupeConcerts } from './lib/dedupe.mjs';

dotenv.config();
const log = createLogger('boost-korean');
const DB_PATH = process.env.DB_PATH || path.resolve('./concert_tracker.db');
const API_KEY = process.env.TICKETMASTER_API_KEY;
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 다중 검색어 — 표기가 다른 경우 모두 포함
const SEARCH_VARIANTS = [
  { name: 'Yunchan Lim',       aliases: ['Lim Yunchan', 'Yun-Chan Lim'] },
  { name: 'Seong-Jin Cho',     aliases: ['Cho Seong-Jin', 'Cho SeongJin'] },
  { name: 'Yeol Eum Son',      aliases: ['Son Yeol-Eum', 'Son Yeoleum'] },
  { name: 'Sunwook Kim',       aliases: ['Kim Sunwook'] },
  { name: 'Kun-Woo Paik',      aliases: ['Paik Kun-Woo', 'Baek Kun Woo'] },
  { name: 'Sunwoo Yekwon',     aliases: ['Yekwon Sunwoo'] },
  { name: 'Kyung-Wha Chung',   aliases: ['Chung Kyung-Wha', 'Kyung Wha Chung'] },
  { name: 'Sarah Chang',       aliases: ['Chang Sarah'] },
  { name: 'Clara-Jumi Kang',   aliases: ['Kang Clara Jumi', 'Clara Jumi Kang'] },
  { name: 'Bomsori Kim',       aliases: ['Kim Bomsori', 'Kim Bom-Sori'] },
  { name: 'Inmo Yang',         aliases: ['Yang Inmo', 'Yang In-Mo'] },
  { name: 'Dami Kim',          aliases: ['Kim Dami'] },
  { name: 'Ji-Young Lim',      aliases: ['Lim Ji-Young', 'Lim Jiyoung'] },
  { name: 'Myung-Wha Chung',   aliases: ['Chung Myung-Wha'] },
  { name: 'Han-Na Chang',      aliases: ['Chang Han-Na', 'Chang Hanna'] },
  { name: 'Sung-Won Yang',     aliases: ['Yang Sung-Won'] },
  { name: 'Tae-Guk Mun',       aliases: ['Mun Tae-Guk'] },
  { name: 'Jaemin Han',        aliases: ['Han Jaemin', 'Han Jae-Min'] },
  { name: 'Hayoung Choi',      aliases: ['Choi Hayoung', 'Choi Ha-Young'] },
  { name: 'Myung-Whun Chung',  aliases: ['Chung Myung-Whun', 'Myung Whun Chung'] },
  { name: 'Sumi Jo',           aliases: ['Jo Sumi', 'Jo Su-Mi'] },
  { name: 'Jinjoo Cho',        aliases: ['Cho Jinjoo'] },
];

async function searchTM(keyword) {
  try {
    const res = await axios.get(BASE_URL, {
      params: {
        apikey: API_KEY,
        keyword,
        size: 200,
        sort: 'date,asc',
      },
      timeout: 15000,
    });
    return res.data._embedded?.events || [];
  } catch (err) {
    if (err.response?.status === 429) { await sleep(2000); return searchTM(keyword); }
    return [];
  }
}

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

async function main() {
  if (!API_KEY) { log.error('TICKETMASTER_API_KEY 미설정'); process.exit(1); }

  const db = new Database(DB_PATH);
  const limit = pLimit(2);
  const allRaw = [];

  log.info('한국 음악가 보강 시작', { 음악가수: SEARCH_VARIANTS.length });

  const tasks = SEARCH_VARIANTS.map(artist => limit(async () => {
    const allKeywords = [artist.name, ...artist.aliases];
    const found = [];

    for (const kw of allKeywords) {
      const events = await searchTM(kw);
      for (const ev of events) {
        found.push(transformEvent(ev, artist.name));
      }
      await sleep(300);
    }

    if (found.length > 0) {
      log.info(`✓ ${artist.name}`, { 공연수: found.length });
      allRaw.push(...found);
    }
  }));

  await Promise.all(tasks);

  // 정규화 + 중복 제거
  const normalized = allRaw.map(normalizeConcert).filter(c => c.musician_name && c.concert_date);
  const deduped = dedupeConcerts(normalized);

  // musician_id 매핑
  const musicianMap = new Map();
  for (const row of db.prepare('SELECT id, name FROM musicians').all()) {
    musicianMap.set(
      row.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^the\s+/, '').replace(/\s+/g, ' ').trim(),
      row.id
    );
  }

  // UPSERT
  const upsertStmt = db.prepare(`
    INSERT INTO concerts (
      musician_id, title, venue_name, venue_address, venue_city, venue_country,
      concert_date, concert_time, venue_lat, venue_lng,
      ticket_url, external_id, source, natural_key, updated_at
    ) VALUES (
      @musician_id, @title, @venue_name, @venue_address, @venue_city, @venue_country,
      @concert_date, @concert_time, @venue_lat, @venue_lng,
      @ticket_url, @external_id, @source, @natural_key, datetime('now')
    )
    ON CONFLICT(natural_key) DO UPDATE SET
      venue_lat  = COALESCE(excluded.venue_lat, venue_lat),
      venue_lng  = COALESCE(excluded.venue_lng, venue_lng),
      ticket_url = COALESCE(excluded.ticket_url, ticket_url),
      updated_at = datetime('now')
  `);

  let inserted = 0, skipped = 0;
  const txn = db.transaction((items) => {
    for (const c of items) {
      const key = c.musician_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^the\s+/, '').replace(/\s+/g, ' ').trim();
      const musicianId = musicianMap.get(key);
      if (!musicianId) { skipped++; continue; }
      try {
        upsertStmt.run({
          musician_id: musicianId, title: c.title || null,
          venue_name: c.venue_name, venue_address: c.venue_address || null,
          venue_city: c.venue_city, venue_country: c.venue_country,
          concert_date: c.concert_date, concert_time: c.concert_time || null,
          venue_lat: c.venue_lat, venue_lng: c.venue_lng,
          ticket_url: c.ticket_url, external_id: c.external_id,
          source: c.source, natural_key: c.natural_key,
        });
        inserted++;
      } catch { skipped++; }
    }
  });
  txn(deduped);

  // 결과 확인
  const results = db.prepare(`
    SELECT m.name_ko, m.name, COUNT(c.id) as cnt
    FROM musicians m
    LEFT JOIN concerts c ON c.musician_id = m.id
    WHERE m.source = 'korean-seed'
    GROUP BY m.id ORDER BY cnt DESC
  `).all();

  db.close();

  log.info('═══ 보강 완료 ═══', { 신규저장: inserted });
  log.info('음악가별 공연 수:');
  for (const r of results) {
    log.info(`  ${r.name_ko || r.name}: ${r.cnt}건`);
  }
}

main().catch(err => { log.error('에러', { error: err.message }); process.exit(1); });
