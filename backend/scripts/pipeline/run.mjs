/**
 * 파이프라인 v3 — 완전 자동 수집 + 자동 분류
 *
 * 흐름:
 *   1. Ticketmaster Classical 23개국 전체 검색
 *   2. 아티스트 자동 추출 + DB 등록
 *   3. 신규 아티스트 악기/타입 자동 분류  ← 추가됨!
 *   4. 정규화 → 중복 제거 → UPSERT
 *   5. 쓰레기 이름 + 공연 없는 연주자 정리
 *   6. 실행 이력 기록
 */

import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import path from 'path';

import { createLogger } from '../lib/logger.mjs';
import { normalizeConcert } from '../lib/normalize.mjs';
import { dedupeConcerts } from '../lib/dedupe.mjs';
import { geocode } from '../lib/geocode.mjs';
import { autoDiscover } from '../fetchers/auto-discover.mjs';
import { classifyNewArtists } from '../lib/classify.mjs';
import { recordRun } from './upsert.mjs';

dotenv.config();
const log = createLogger('pipeline');
const DB_PATH = process.env.DB_PATH || path.resolve('./concert_tracker.db');

// 쓰레기 이름 필터
const JUNK_PATTERNS = [
  /concert/i, /koncert/i, /festival/i, /gala/i, /celebration/i,
  /new year/i, /christmas/i, /holiday/i, /best\sof/i, /tribute/i,
  /experience/i, /spectacular/i, /classical\s/i, /classics/i,
  /^\d+\s/, /20\d{2}/, /^.{80,}$/, /\s\/\s.*\s\/\s/,
  /presents/i, /featuring/i, /in\sconcert$/i, /on\stour$/i,
  /live\s(in|at|on)/i,
];

function isJunkName(name) {
  if (!name || name.length < 2) return true;
  return JUNK_PATTERNS.some(p => p.test(name));
}

async function enrichWithGeocoding(concerts) {
  const noCoords = concerts.filter(c => !c.venue_lat || !c.venue_lng);
  if (noCoords.length === 0) return concerts;
  log.info('지오코딩 보강 시작', { 좌표없음: noCoords.length });
  let geocoded = 0;
  for (const c of noCoords) {
    const result = await geocode({ venue: c.venue_name, city: c.venue_city, country: c.venue_country });
    if (result) { c.venue_lat = result.lat; c.venue_lng = result.lng; geocoded++; }
  }
  log.info('지오코딩 보강 완료', { 신규좌표: geocoded });
  return concerts;
}

export async function runPipeline() {
  const startedAt = new Date().toISOString();
  log.info('═══ 파이프라인 시작 ═══');

  let status = 'success';
  let errorMsg = null;
  let fetchedCount = 0;
  let insertedCount = 0;
  let skippedCount = 0;

  try {
    // ── 1. 자동 발견: Classical 전체 검색 ──
    const { concerts: rawConcerts } = await autoDiscover();
    fetchedCount = rawConcerts.length;
    if (rawConcerts.length === 0) throw new Error('콘서트 수집 실패');

    // ── 2. 정규화 + 중복 제거 ──
    const normalized = rawConcerts.map(normalizeConcert).filter(c => c.musician_name && c.concert_date);
    const deduped = dedupeConcerts(normalized);
    log.info('정규화 + 중복 제거', { 입력: rawConcerts.length, 중복제거후: deduped.length });

    // ── 3. 지오코딩 보강 ──
    const enriched = await enrichWithGeocoding(deduped);

    // ── 4. DB 작업 ──
    const db = new Database(DB_PATH);

    // 4-1. 쓰레기 이름 필터링 후 아티스트 등록
    const existingNames = new Set(
      db.prepare('SELECT name FROM musicians').all().map(r => r.name.toLowerCase())
    );
    let newArtists = 0;
    const insertArtist = db.prepare(`INSERT INTO musicians (name, source) VALUES (?, 'ticketmaster')`);
    for (const c of enriched) {
      const key = c.musician_name.toLowerCase();
      if (!existingNames.has(key) && !isJunkName(c.musician_name)) {
        existingNames.add(key);
        insertArtist.run(c.musician_name);
        newArtists++;
      }
    }
    log.info('아티스트 등록', { 신규: newArtists });

    // 4-2. 신규 아티스트 악기/타입 자동 분류
    await classifyNewArtists(db);

    // 4-3. musician_id 매핑
    const musicianMap = new Map();
    for (const row of db.prepare('SELECT id, name FROM musicians').all()) {
      musicianMap.set(
        row.name.toLowerCase().normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/^the\s+/, '')
          .replace(/\s+/g, ' ').trim(),
        row.id
      );
    }

    // 4-4. 콘서트 UPSERT
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

    const txn = db.transaction((items) => {
      for (const c of items) {
        const lookupKey = c.musician_name.toLowerCase().normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '').replace(/^the\s+/, '').replace(/\s+/g, ' ').trim();
        const musicianId = musicianMap.get(lookupKey);
        if (!musicianId) { skippedCount++; continue; }
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
          insertedCount++;
        } catch { skippedCount++; }
      }
    });
    txn(enriched);

    // ── 5. 공연 없는 연주자 정리 ──
    const cleaned = db.prepare(
      'DELETE FROM musicians WHERE id NOT IN (SELECT DISTINCT musician_id FROM concerts) AND source != 'korean-seed''
    ).run();
    log.info('공연 없는 연주자 정리', { 삭제: cleaned.changes });

    const stats = {
      연주자: db.prepare('SELECT COUNT(*) AS c FROM musicians').get().c,
      콘서트: db.prepare('SELECT COUNT(*) AS c FROM concerts').get().c,
    };
    db.close();

    log.info('═══ 파이프라인 완료 ═══', {
      수집: fetchedCount, DB저장: insertedCount, 스킵: skippedCount,
      최종_연주자: stats.연주자, 최종_콘서트: stats.콘서트,
    });
  } catch (err) {
    status = 'failed';
    errorMsg = err.message;
    log.error('═══ 파이프라인 실패 ═══', { error: err.message });
  } finally {
    recordRun({
      startedAt, finishedAt: new Date().toISOString(), status,
      fetched: fetchedCount, inserted: insertedCount, updated: 0,
      skipped: skippedCount, error: errorMsg,
    });
  }
  return { status, fetchedCount, insertedCount, skippedCount };
}

const isMain = true;
if (isMain) {
  runPipeline()
    .then(r => { log.info('실행 결과', r); process.exit(r.status === 'success' ? 0 : 1); })
    .catch(err => { log.error('치명적 에러', { error: err.message }); process.exit(1); });
}
