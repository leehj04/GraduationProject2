/**
 * 확장 수집 스크립트
 * 
 * 1단계: 유명 연주자/지휘자/오케스트라 시드 리스트로 Ticketmaster 검색
 * 2단계: Ticketmaster Classical 카테고리 전체 검색 (키워드 없이)
 * 3단계: 검색 결과에서 아티스트 자동 추출 → musicians 테이블에 추가
 * 4단계: 공연 없는 연주자 자동 정리
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
const log = createLogger('expand');
const DB_PATH = process.env.DB_PATH || path.resolve('./concert_tracker.db');
const API_KEY = process.env.TICKETMASTER_API_KEY;
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

// ═══ 시드 리스트: 유명 클래식 아티스트 ═══════════════════
const SEED_ARTISTS = [
  // ── 피아니스트 ──
  'Lang Lang', 'Yuja Wang', 'Daniil Trifonov', 'Seong-Jin Cho',
  'Murray Perahia', 'Martha Argerich', 'Evgeny Kissin', 'Krystian Zimerman',
  'Maurizio Pollini', 'Rafal Blechacz', 'Hélène Grimaud', 'Yundi Li',
  'Igor Levit', 'Khatia Buniatishvili', 'Jan Lisiecki', 'Víkingur Ólafsson',
  'Beatrice Rana', 'Benjamin Grosvenor', 'Bruce Liu', 'Arcadi Volodos',
  'Emanuel Ax', 'Garrick Ohlsson', 'Jean-Yves Thibaudet', 'Marc-André Hamelin',
  'Mitsuko Uchida', 'Nelson Freire', 'Radu Lupu', 'Leif Ove Andsnes',
  'Alice Sara Ott', 'Yefim Bronfman', 'Stephen Hough', 'Fazıl Say',

  // ── 바이올리니스트 ──
  'Hilary Hahn', 'Anne-Sophie Mutter', 'Itzhak Perlman', 'Joshua Bell',
  'Maxim Vengerov', 'Janine Jansen', 'Leonidas Kavakos', 'Gil Shaham',
  'Nicola Benedetti', 'Ray Chen', 'Lisa Batiashvili', 'Frank Peter Zimmermann',
  'Augustin Hadelich', 'James Ehnes', 'Pinchas Zukerman', 'Sarah Chang',
  'Midori', 'Vadim Repin', 'Renaud Capuçon', 'Daniel Hope',
  'Nemanja Radulović', 'Stefan Jackiw', 'Randall Goosby',

  // ── 첼리스트 ──
  'Yo-Yo Ma', 'Mischa Maisky', 'Gautier Capuçon', 'Steven Isserlis',
  'Sol Gabetta', 'Alisa Weilerstein', 'Sheku Kanneh-Mason',
  'Kian Soltani', 'Pablo Ferrández', 'Jan Vogler',
  'Truls Mørk', 'Heinrich Schiff', 'Jean-Guihen Queyras',

  // ── 지휘자 ──
  'Gustavo Dudamel', 'Simon Rattle', 'Riccardo Muti', 'Valery Gergiev',
  'Andris Nelsons', 'Kirill Petrenko', 'Yannick Nézet-Séguin',
  'Esa-Pekka Salonen', 'Antonio Pappano', 'Daniel Barenboim',
  'Zubin Mehta', 'Manfred Honeck', 'Jaap van Zweden',
  'Klaus Mäkelä', 'Mirga Gražinytė-Tyla', 'Susanna Mälkki',
  'Lahav Shani', 'Vasily Petrenko', 'Tugan Sokhiev',
  'Franz Welser-Möst', 'Semyon Bychkov', 'Jakub Hrůša',
  'Santtu-Matias Rouvali', 'Teodor Currentzis', 'Myung-Whun Chung',
  'Paavo Järvi', 'Neeme Järvi', 'Herbert Blomstedt',

  // ── 오케스트라 ──
  'Berlin Philharmonic', 'Vienna Philharmonic',
  'London Symphony Orchestra', 'London Philharmonic Orchestra',
  'Royal Concertgebouw Orchestra', 'Chicago Symphony Orchestra',
  'New York Philharmonic', 'Philadelphia Orchestra',
  'Cleveland Orchestra', 'Boston Symphony Orchestra',
  'Los Angeles Philharmonic', 'San Francisco Symphony',
  'Bavarian Radio Symphony', 'Leipzig Gewandhaus Orchestra',
  'Dresden Staatskapelle', 'Munich Philharmonic',
  'Orchestre de Paris', 'Orchestre National de France',
  'NHK Symphony Orchestra', 'Seoul Philharmonic Orchestra',
  'Pittsburgh Symphony Orchestra', 'Minnesota Orchestra',
  'Wiener Symphoniker', 'Tonhalle Orchestra Zurich',
  'Orchestra of the Age of Enlightenment',
  'Academy of St Martin in the Fields',
  'Mahler Chamber Orchestra', 'Chamber Orchestra of Europe',
  'Budapest Festival Orchestra', 'Czech Philharmonic',
  'St. Petersburg Philharmonic', 'Mariinsky Orchestra',
  'Philharmonia Orchestra', 'BBC Symphony Orchestra',
  'Royal Philharmonic Orchestra', 'Hallé Orchestra',
  'City of Birmingham Symphony Orchestra',
  'Scottish Chamber Orchestra', 'Aurora Orchestra',

  // ── 성악가 / 오페라 ──
  'Anna Netrebko', 'Jonas Kaufmann', 'Plácido Domingo',
  'Cecilia Bartoli', 'Diana Damrau', 'Bryn Terfel',
  'Juan Diego Flórez', 'Pretty Yende', 'Lise Davidsen',
  'Elīna Garanča', 'Sonya Yoncheva', 'Asmik Grigorian',
  'Piotr Beczała', 'Ludovic Tézier', 'Christian Gerhaher',
  'Matthias Goerne', 'Joyce DiDonato', 'Renée Fleming',
  'Andrea Bocelli',

  // ── 기타 (비올라, 플루트, 클라리넷, 기타, 하프 등) ──
  'Yuri Bashmet', 'Tabea Zimmermann', 'Antoine Tamestit',
  'Emmanuel Pahud', 'James Galway', 'Sharon Kam',
  'Martin Fröst', 'Andreas Ottensamer', 'Sabine Meyer',
  'Miloš Karadaglić', 'Avi Avital', 'Xavier de Maistre',
  'Martin Grubinger', 'Evelyn Glennie',

  // ── 앙상블 ──
  'Emerson String Quartet', 'Takács Quartet', 'Belcea Quartet',
  'Quatuor Ébène', 'Hagen Quartett', 'Jerusalem Quartet',
  'Danish String Quartet', 'Dover Quartet',
  'Les Arts Florissants', 'Il Giardino Armonico',
  'Ensemble Intercontemporain', 'Kronos Quartet',

  // ── 영화음악 / 크로스오버 ──
  'John Williams', 'Hans Zimmer', 'Ennio Morricone',
  'Joe Hisaishi', 'Alexandre Desplat', 'Howard Shore',
  'Alan Silvestri', 'Danny Elfman', 'Michael Giacchino',
  'André Rieu', 'Max Richter', 'Ludovico Einaudi',
  'Nils Frahm', 'Ólafur Arnalds', 'Yiruma',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══ Ticketmaster에서 아티스트별 콘서트 검색 ═══════════════
async function searchArtist(name) {
  try {
    const res = await axios.get(BASE_URL, {
      params: {
        apikey: API_KEY,
        keyword: name,
        classificationName: 'Music',
        size: 200,
        sort: 'date,asc',
      },
      timeout: 15000,
    });
    return res.data._embedded?.events || [];
  } catch (err) {
    if (err.response?.status === 429) {
      await sleep(2000);
      return searchArtist(name); // 재시도
    }
    return [];
  }
}

// ═══ Ticketmaster Classical 전체 검색 (키워드 없이) ═══════
async function searchClassicalAll() {
  const allEvents = [];
  for (let page = 0; page < 5; page++) {
    try {
      const res = await axios.get(BASE_URL, {
        params: {
          apikey: API_KEY,
          classificationName: 'Classical',
          size: 200,
          page,
          sort: 'date,asc',
        },
        timeout: 15000,
      });
      const events = res.data._embedded?.events || [];
      allEvents.push(...events);
      if (page + 1 >= (res.data.page?.totalPages || 0)) break;
      await sleep(300);
    } catch (err) {
      log.warn('Classical 전체 검색 페이지 실패', { page, error: err.message });
      if (err.response?.status === 429) await sleep(2000);
    }
  }
  return allEvents;
}

// ═══ Ticketmaster event → raw 콘서트 객체 ═══════════════
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

// ═══ 메인 실행 ═══════════════════════════════════════════
async function main() {
  if (!API_KEY) {
    log.error('TICKETMASTER_API_KEY 미설정');
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  const limit = pLimit(3);
  const allRaw = [];
  let processed = 0;

  // ── 1단계: 시드 리스트로 검색 ──
  log.info(`시드 리스트 검색 시작`, { 아티스트수: SEED_ARTISTS.length });

  const tasks = SEED_ARTISTS.map(name => limit(async () => {
    const events = await searchArtist(name);
    if (events.length > 0) {
      const concerts = events.map(ev => transformEvent(ev, name));
      allRaw.push(...concerts);
    }
    processed++;
    if (processed % 20 === 0) {
      log.info(`시드 진행`, { 처리: `${processed}/${SEED_ARTISTS.length}`, 수집: allRaw.length });
    }
    await sleep(200);
  }));

  await Promise.all(tasks);
  log.info(`시드 검색 완료`, { 수집: allRaw.length });

  // ── 2단계: Classical 전체 검색 ──
  log.info('Classical 전체 검색 시작');
  const classicalEvents = await searchClassicalAll();
  for (const ev of classicalEvents) {
    // 이벤트에 포함된 아티스트 이름 추출
    const attractions = ev._embedded?.attractions || [];
    if (attractions.length > 0) {
      for (const attr of attractions) {
        allRaw.push(transformEvent(ev, attr.name));
      }
    } else {
      // attraction 없으면 이벤트 이름을 아티스트로
      allRaw.push(transformEvent(ev, ev.name || 'Unknown'));
    }
  }
  log.info(`Classical 전체 검색 완료`, { 추가: classicalEvents.length, 총합: allRaw.length });

  // ── 3단계: 정규화 + 중복 제거 ──
  const normalized = allRaw.map(normalizeConcert).filter(c => c.musician_name && c.concert_date);
  const deduped = dedupeConcerts(normalized);

  // ── 4단계: 아티스트 자동 등록 (DB에 없으면 추가) ──
  const existingMusicians = new Set(
    db.prepare('SELECT name FROM musicians').all().map(r => r.name.toLowerCase())
  );

  const newArtists = new Set();
  for (const c of deduped) {
    const key = c.musician_name.toLowerCase();
    if (!existingMusicians.has(key) && !newArtists.has(key)) {
      newArtists.add(key);
      db.prepare(`INSERT INTO musicians (name, source) VALUES (?, 'ticketmaster')`)
        .run(c.musician_name);
      log.info('신규 아티스트 추가', { name: c.musician_name });
    }
  }
  log.info(`아티스트 등록`, { 기존: existingMusicians.size, 신규: newArtists.size });

  // ── 5단계: 콘서트 UPSERT ──
  // musician_id 매핑 다시 로드
  const musicianRows = db.prepare('SELECT id, name FROM musicians').all();
  const musicianMap = new Map();
  for (const row of musicianRows) {
    musicianMap.set(row.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^the\s+/, '').replace(/\s+/g, ' ').trim(), row.id);
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
      const lookupKey = c.musician_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^the\s+/, '').replace(/\s+/g, ' ').trim();
      const musicianId = musicianMap.get(lookupKey);
      if (!musicianId) { skipped++; continue; }
      try {
        upsertStmt.run({
          musician_id: musicianId,
          title: c.title || null,
          venue_name: c.venue_name,
          venue_address: c.venue_address || null,
          venue_city: c.venue_city,
          venue_country: c.venue_country,
          concert_date: c.concert_date,
          concert_time: c.concert_time || null,
          venue_lat: c.venue_lat,
          venue_lng: c.venue_lng,
          ticket_url: c.ticket_url,
          external_id: c.external_id,
          source: c.source,
          natural_key: c.natural_key,
        });
        inserted++;
      } catch (err) {
        skipped++;
      }
    }
  });
  txn(deduped);

  // ── 6단계: 공연 없는 연주자 정리 ──
  const deleted = db.prepare('DELETE FROM musicians WHERE id NOT IN (SELECT DISTINCT musician_id FROM concerts)').run();
  log.info('공연 없는 연주자 정리', { 삭제: deleted.changes });

  const finalMusicians = db.prepare('SELECT COUNT(*) AS cnt FROM musicians').get();
  const finalConcerts = db.prepare('SELECT COUNT(*) AS cnt FROM concerts').get();

  db.close();

  log.info('═══ 확장 수집 완료 ═══', {
    콘서트_신규: inserted,
    콘서트_스킵: skipped,
    최종_연주자수: finalMusicians.cnt,
    최종_콘서트수: finalConcerts.cnt,
  });
}

main().catch(err => {
  log.error('치명적 에러', { error: err.message });
  process.exit(1);
});
