/**
 * DB 마이그레이션 — concert_tracker.db 실제 스키마에 맞춤
 * 
 * 이미 첫 실행에서 대부분 성공했으므로 남은 부분만 처리
 */

import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';
import { createLogger } from '../lib/logger.mjs';

dotenv.config();
const log = createLogger('migrate');

const DB_PATH = process.env.DB_PATH || path.resolve('./concert_tracker.db');

function tableExists(db, table) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  return !!row;
}

function indexExists(db, name) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`)
    .get(name);
  return !!row;
}

function safeRun(db, sql, description) {
  try {
    db.exec(sql);
    log.info(`✓ ${description}`);
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      log.info(`- ${description} (이미 존재, 건너뜀)`);
    } else {
      log.error(`✗ ${description}`, { error: err.message });
    }
  }
}

function main() {
  log.info(`DB 마이그레이션 시작`, { path: DB_PATH });
  const db = new Database(DB_PATH);

  // ── concerts 인덱스 (실제 컬럼명: concert_date) ──
  if (!indexExists(db, 'idx_concerts_concert_date')) {
    safeRun(
      db,
      `CREATE INDEX idx_concerts_concert_date ON concerts(concert_date)`,
      'concerts.concert_date 인덱스'
    );
  }

  // ── geocode_cache 테이블 ──
  if (!tableExists(db, 'geocode_cache')) {
    safeRun(
      db,
      `CREATE TABLE geocode_cache (
        query TEXT PRIMARY KEY,
        lat REAL,
        lng REAL,
        fetched_at TEXT NOT NULL
      );`,
      'geocode_cache 테이블 생성'
    );
  }

  // ── pipeline_runs 테이블 ──
  if (!tableExists(db, 'pipeline_runs')) {
    safeRun(
      db,
      `CREATE TABLE pipeline_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT,
        fetched_count INTEGER,
        inserted_count INTEGER,
        updated_count INTEGER,
        skipped_count INTEGER,
        error TEXT
      );`,
      'pipeline_runs 테이블 생성'
    );
  }

  db.close();
  log.info('마이그레이션 완료 ✓');
}

main();
