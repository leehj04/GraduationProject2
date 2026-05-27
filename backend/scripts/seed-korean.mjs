/**
 * 한국 음악가 보강 스크립트
 *
 * Ticketmaster에서 영문 이름으로 검색해서 해외 공연을 가져오고,
 * 동시에 한국어 이름을 musicians.name_ko 에 저장한다.
 *
 * 검색 결과가 없는 음악가도 DB에는 등록해둔다 (name_ko 활용을 위해).
 * 단, 공연이 없으면 일반 정리 단계에서 삭제되므로, 여기서는 등록만 하고
 * 검색 결과가 있는 사람만 최종 남는다.
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
const log = createLogger('korean-seed');
const DB_PATH = process.env.DB_PATH || path.resolve('./concert_tracker.db');
const API_KEY = process.env.TICKETMASTER_API_KEY;
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══ 한국 음악가 시드 리스트 ═══════════════════════════════
// 형식: { en: 검색용 영문명, ko: 한국어명, instrument: 악기/타입 }
// 영문 표기는 Ticketmaster 검색이 잡히는 형태로
const KOREAN_ARTISTS = [
  // ── 피아노 ──
  { en: 'Yunchan Lim', ko: '임윤찬', instrument: 'Piano' },
  { en: 'Seong-Jin Cho', ko: '조성진', instrument: 'Piano' },
  { en: 'Sunwoo Yekwon', ko: '선우예권', instrument: 'Piano' },
  { en: 'Yeol Eum Son', ko: '손열음', instrument: 'Piano' },
  { en: 'Sunwook Kim', ko: '김선욱', instrument: 'Piano' },
  { en: 'Kun-Woo Paik', ko: '백건우', instrument: 'Piano' },
  { en: 'Tong-Il Han', ko: '한동일', instrument: 'Piano' },
  { en: 'HJ Lim', ko: '임현정', instrument: 'Piano' },
  { en: 'Jae-Hong Park', ko: '박재홍', instrument: 'Piano' },
  { en: 'Tae-Hyung Kim', ko: '김태형', instrument: 'Piano' },
  { en: 'Yunchan Lim', ko: '임윤찬', instrument: 'Piano' },
  { en: 'Soyeon Kate Lee', ko: '이소연', instrument: 'Piano' },
  { en: 'Nayoung Kim', ko: '김나영', instrument: 'Piano' },
  { en: 'Soo-Yeoul Choi', ko: '최수열', instrument: 'Piano' },
  { en: 'Hyuk Lee', ko: '이혁', instrument: 'Piano' },
  { en: 'Dasol Kim', ko: '김다솔', instrument: 'Piano' },

  // ── 바이올린 ──
  { en: 'Kyung-Wha Chung', ko: '정경화', instrument: 'Violin' },
  { en: 'Sarah Chang', ko: '장영주', instrument: 'Violin' },
  { en: 'Clara-Jumi Kang', ko: '클라라 주미 강', instrument: 'Violin' },
  { en: 'Bomsori Kim', ko: '김봄소리', instrument: 'Violin' },
  { en: 'Inmo Yang', ko: '양인모', instrument: 'Violin' },
  { en: 'Dami Kim', ko: '김다미', instrument: 'Violin' },
  { en: 'Ji-Young Lim', ko: '임지영', instrument: 'Violin' },
  { en: 'Sue-Jin Han', ko: '한수진', instrument: 'Violin' },
  { en: 'Jia Shin', ko: '신지아', instrument: 'Violin' },
  { en: 'Hye-Yoon Park', ko: '박혜윤', instrument: 'Violin' },
  { en: 'Jinjoo Cho', ko: '조진주', instrument: 'Violin' },
  { en: 'Stephen Kim', ko: '김 스테판', instrument: 'Violin' },

  // ── 첼로 ──
  { en: 'Myung-Wha Chung', ko: '정명화', instrument: 'Cello' },
  { en: 'Han-Na Chang', ko: '장한나', instrument: 'Cello' },
  { en: 'Sung-Won Yang', ko: '양성원', instrument: 'Cello' },
  { en: 'Tae-Guk Mun', ko: '문태국', instrument: 'Cello' },
  { en: 'Jaemin Han', ko: '한재민', instrument: 'Cello' },
  { en: 'Hayoung Choi', ko: '최하영', instrument: 'Cello' },
  { en: 'Young-Chang Cho', ko: '조영창', instrument: 'Cello' },
  { en: 'Doomin Kim', ko: '김두민', instrument: 'Cello' },

  // ── 비올라 ──
  { en: 'Richard Yongjae O\'Neill', ko: '리처드 용재 오닐', instrument: 'Viola' },

  // ── 지휘자 ──
  { en: 'Myung-Whun Chung', ko: '정명훈', instrument: 'Conductor' },
  { en: 'Eun Sun Kim', ko: '김은선', instrument: 'Conductor' },
  { en: 'Shi-Yeon Sung', ko: '성시연', instrument: 'Conductor' },
  { en: 'Shinik Hahm', ko: '함신익', instrument: 'Conductor' },
  { en: 'Han-Na Chang', ko: '장한나', instrument: 'Conductor' },
  { en: 'Ji-Soo Yoo', ko: '유지수', instrument: 'Conductor' },

  // ── 성악 ──
  { en: 'Sumi Jo', ko: '조수미', instrument: 'Soprano' },
  { en: 'Youngok Shin', ko: '신영옥', instrument: 'Soprano' },
  { en: 'Hei-Kyung Hong', ko: '홍혜경', instrument: 'Soprano' },
  { en: 'Sumi Hwang', ko: '황수미', instrument: 'Soprano' },
  { en: 'Kathleen Kim', ko: '김지현', instrument: 'Soprano' },
  { en: 'Yeree Suh', ko: '서예리', instrument: 'Soprano' },
  { en: 'Sae-Kyung Rim', ko: '임세경', instrument: 'Soprano' },
  { en: 'Samuel Yoon', ko: '연광철', instrument: 'Bass' },
  { en: 'Kwangchul Youn', ko: '연광철', instrument: 'Bass' },
  { en: 'Attilio Glaser', ko: '글레이저', instrument: 'Tenor' },

  // ── 기타/플루트 등 ──
  { en: 'Jiyeong Mun', ko: '문지영', instrument: 'Piano' },
  { en: 'Jasmine Choi', ko: '최나경', instrument: 'Flute' },
  { en: 'Yoo Sun Yoon', ko: '윤유선', instrument: 'Flute' },

  // ── 작곡가/크로스오버 ──
  { en: 'Yiruma', ko: '이루마', instrument: 'Composer' },
  { en: 'Lee-Ahn', ko: '이안', instrument: 'Composer' },
  { en: 'Joe Hisaishi', ko: '히사이시 조', instrument: 'Composer' }, // 일본인이지만 한국 인기 많음

  // ── 오케스트라 ──
  { en: 'Seoul Philharmonic Orchestra', ko: '서울시립교향악단', instrument: 'Orchestra' },
  { en: 'KBS Symphony Orchestra', ko: 'KBS교향악단', instrument: 'Orchestra' },
  { en: 'Korean Symphony Orchestra', ko: '국립심포니오케스트라', instrument: 'Orchestra' },
  { en: 'Bucheon Philharmonic Orchestra', ko: '부천필하모닉오케스트라', instrument: 'Orchestra' },
  { en: 'Suwon Philharmonic Orchestra', ko: '수원시립교향악단', instrument: 'Orchestra' },
  { en: 'Daegu Symphony Orchestra', ko: '대구시립교향악단', instrument: 'Orchestra' },
  { en: 'Busan Philharmonic Orchestra', ko: '부산시립교향악단', instrument: 'Orchestra' },
  { en: 'Incheon Philharmonic Orchestra', ko: '인천시립교향악단', instrument: 'Orchestra' },
  { en: 'Gyeonggi Philharmonic Orchestra', ko: '경기필하모닉오케스트라', instrument: 'Orchestra' },
];

// ═══ Ticketmaster 검색 ════════════════════════════════════
async function searchArtist(name) {
  try {
    const res = await axios.get(BASE_URL, {
      params: {
        apikey: API_KEY,
        keyword: name,
        size: 100,
        sort: 'date,asc',
      },
      timeout: 15000,
    });
    return res.data._embedded?.events || [];
  } catch (err) {
    if (err.response?.status === 429) {
      await sleep(2000);
      return searchArtist(name);
    }
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

// ═══ 메인 ════════════════════════════════════════════════
async function main() {
  if (!API_KEY) {
    log.error('TICKETMASTER_API_KEY 미설정');
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  // ── 1. 한국 음악가 DB 등록 (name_ko, instrument 포함) ──
  const existingByName = new Map(
    db.prepare('SELECT id, name FROM musicians').all()
      .map(r => [r.name.toLowerCase(), r.id])
  );

  const upsertArtist = db.prepare(`
    INSERT INTO musicians (name, name_ko, instrument, nationality, source)
    VALUES (?, ?, ?, 'South Korea', 'korean-seed')
    ON CONFLICT(scraper_key) DO NOTHING
  `);
  const updateExisting = db.prepare(`
    UPDATE musicians SET name_ko = ?, instrument = COALESCE(instrument, ?), nationality = COALESCE(nationality, 'South Korea')
    WHERE id = ?
  `);
  const insertArtist = db.prepare(`
    INSERT INTO musicians (name, name_ko, instrument, nationality, source)
    VALUES (?, ?, ?, 'South Korea', 'korean-seed')
  `);

  let registered = 0;
  let updated = 0;
  for (const artist of KOREAN_ARTISTS) {
    const existingId = existingByName.get(artist.en.toLowerCase());
    if (existingId) {
      updateExisting.run(artist.ko, artist.instrument, existingId);
      updated++;
    } else {
      const result = insertArtist.run(artist.en, artist.ko, artist.instrument);
      existingByName.set(artist.en.toLowerCase(), result.lastInsertRowid);
      registered++;
    }
  }
  log.info('한국 음악가 등록', { 신규: registered, 갱신: updated });

  // ── 2. Ticketmaster 검색 (해외 공연 잡기) ──
  log.info(`Ticketmaster 검색 시작`, { 음악가수: KOREAN_ARTISTS.length });

  const limit = pLimit(3);
  const allRaw = [];
  let processed = 0;
  let foundArtists = 0;

  const tasks = KOREAN_ARTISTS.map(artist => limit(async () => {
    const events = await searchArtist(artist.en);
    if (events.length > 0) {
      foundArtists++;
      const concerts = events.map(ev => transformEvent(ev, artist.en));
      allRaw.push(...concerts);
      log.info(`✓ 공연 발견`, { 음악가: `${artist.ko} (${artist.en})`, 공연수: events.length });
    }
    processed++;
    await sleep(300);
  }));

  await Promise.all(tasks);
  log.info('Ticketmaster 검색 완료', { 처리: processed, 공연있는음악가: foundArtists, 총공연: allRaw.length });

  // ── 3. 정규화 + 중복 제거 ──
  const normalized = allRaw
    .map(normalizeConcert)
    .filter(c => c.musician_name && c.concert_date);
  const deduped = dedupeConcerts(normalized);

  // ── 4. 콘서트 UPSERT ──
  const musicianRows = db.prepare('SELECT id, name FROM musicians').all();
  const musicianMap = new Map();
  for (const row of musicianRows) {
    musicianMap.set(
      row.name.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^the\s+/, '')
        .replace(/\s+/g, ' ').trim(),
      row.id
    );
  }

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
      title         = COALESCE(excluded.title, title),
      venue_name    = COALESCE(excluded.venue_name, venue_name),
      venue_city    = COALESCE(excluded.venue_city, venue_city),
      venue_country = COALESCE(excluded.venue_country, venue_country),
      venue_lat     = COALESCE(excluded.venue_lat, venue_lat),
      venue_lng     = COALESCE(excluded.venue_lng, venue_lng),
      ticket_url    = COALESCE(excluded.ticket_url, ticket_url),
      updated_at    = datetime('now')
  `);

  let inserted = 0, skipped = 0;
  const txn = db.transaction((items) => {
    for (const c of items) {
      const lookupKey = c.musician_name.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/^the\s+/, '').replace(/\s+/g, ' ').trim();
      const musicianId = musicianMap.get(lookupKey);
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

  // ── 5. 최종 통계 ──
  const stats = {
    한국음악가_DB등록: db.prepare("SELECT COUNT(*) AS c FROM musicians WHERE nationality = 'South Korea' OR source = 'korean-seed'").get().c,
    한국음악가_공연있음: db.prepare(`
      SELECT COUNT(DISTINCT m.id) AS c FROM musicians m
      JOIN concerts c ON c.musician_id = m.id
      WHERE m.source = 'korean-seed'
    `).get().c,
    총_음악가: db.prepare('SELECT COUNT(*) AS c FROM musicians').get().c,
    총_콘서트: db.prepare('SELECT COUNT(*) AS c FROM concerts').get().c,
  };

  db.close();

  log.info('═══ 한국 음악가 보강 완료 ═══', stats);
}

main().catch(err => {
  log.error('에러', { error: err.message, stack: err.stack });
  process.exit(1);
});
