/**
 * UPSERT — 기존 concert_tracker.db 스키마에 맞춘 버전
 *
 * musicians: name, nationality, mbid, source, instrument
 * concerts: musician_id, title, venue_name, venue_address, venue_city,
 *           venue_country, venue_lat, venue_lng, concert_date, concert_time,
 *           ticket_url, external_id, source, natural_key, updated_at
 */

import Database from 'better-sqlite3';
import path from 'path';
import { createLogger } from '../lib/logger.mjs';

const log = createLogger('upsert');

const DB_PATH = process.env.DB_PATH || path.resolve('./concert_tracker.db');

/**
 * 음악가 배열을 UPSERT
 */
export function upsertMusicians(musicians) {
  const db = new Database(DB_PATH);

  const findByMbid = db.prepare('SELECT id FROM musicians WHERE mbid = ?');
  const findByName = db.prepare('SELECT id FROM musicians WHERE name = ?');
  const insert = db.prepare(`
    INSERT INTO musicians (mbid, name, nationality, source)
    VALUES (@mbid, @name, @nationality, @source)
  `);
  const update = db.prepare(`
    UPDATE musicians
       SET mbid        = COALESCE(@mbid, mbid),
           nationality = COALESCE(@nationality, nationality),
           source      = COALESCE(@source, source)
     WHERE id = @id
  `);

  let inserted = 0;
  let updated = 0;

  const txn = db.transaction((items) => {
    for (const m of items) {
      const existing =
        (m.mbid && findByMbid.get(m.mbid)) || findByName.get(m.name);
      if (existing) {
        update.run({
          id: existing.id,
          mbid: m.mbid || null,
          nationality: m.country || null,
          source: 'musicbrainz',
        });
        updated++;
      } else {
        insert.run({
          mbid: m.mbid || null,
          name: m.name,
          nationality: m.country || null,
          source: 'musicbrainz',
        });
        inserted++;
      }
    }
  });

  txn(musicians);
  db.close();

  log.info('음악가 UPSERT 완료', { inserted, updated });
  return { inserted, updated };
}

/**
 * 콘서트 배열을 UPSERT — 실제 컬럼명 사용
 */
export function upsertConcerts(concerts) {
  const db = new Database(DB_PATH);

  // musician_id 매핑용 (이름 기준)
  const musicianRows = db.prepare('SELECT id, name FROM musicians').all();
  const musicianMap = new Map();
  for (const row of musicianRows) {
    musicianMap.set(
      row.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^the\s+/, '')
        .replace(/\s+/g, ' ')
        .trim(),
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
      venue_address = COALESCE(excluded.venue_address, venue_address),
      venue_city    = COALESCE(excluded.venue_city, venue_city),
      venue_country = COALESCE(excluded.venue_country, venue_country),
      venue_lat     = COALESCE(excluded.venue_lat, venue_lat),
      venue_lng     = COALESCE(excluded.venue_lng, venue_lng),
      ticket_url    = COALESCE(excluded.ticket_url, ticket_url),
      external_id   = COALESCE(excluded.external_id, external_id),
      source        = COALESCE(excluded.source, source),
      updated_at    = datetime('now')
  `);

  let inserted = 0;
  let skipped = 0;

  const txn = db.transaction((items) => {
    for (const c of items) {
      const lookupKey = c.musician_name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^the\s+/, '')
        .replace(/\s+/g, ' ')
        .trim();
      const musicianId = musicianMap.get(lookupKey);

      if (!musicianId) {
        skipped++;
        continue;
      }

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
        log.warn('UPSERT 실패', { 콘서트: c.natural_key, error: err.message });
      }
    }
  });

  txn(concerts);
  db.close();

  log.info('콘서트 UPSERT 완료', {
    처리: inserted,
    스킵: skipped,
  });
  return { inserted, updated: 0, skipped };
}

/**
 * 파이프라인 실행 이력 기록
 */
export function recordRun({
  startedAt,
  finishedAt,
  status,
  fetched,
  inserted,
  updated,
  skipped,
  error,
}) {
  const db = new Database(DB_PATH);

  // 테이블 없으면 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT,
      fetched_count INTEGER,
      inserted_count INTEGER,
      updated_count INTEGER,
      skipped_count INTEGER,
      error TEXT
    )
  `);

  db.prepare(
    `INSERT INTO pipeline_runs (
       started_at, finished_at, status,
       fetched_count, inserted_count, updated_count, skipped_count, error
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    startedAt,
    finishedAt,
    status,
    fetched || 0,
    inserted || 0,
    updated || 0,
    skipped || 0,
    error || null
  );
  db.close();
}
