/**
 * KOPIS (공연예술통합전산망) 한국 클래식 공연 수집
 *
 * 문화체육관광부 공식 Open API — 한국 모든 예매 채널 데이터 포함
 * (인터파크, 예스24, 멜론티켓, 교보문고 등)
 *
 * API 키 발급: https://www.kopis.or.kr → Open API → API 신청
 * .env 에 KOPIS_API_KEY=발급받은키 추가
 *
 * genrenm 장르 코드:
 *   AAAA = 연극
 *   AAAB = 뮤지컬
 *   AAAC = 오페라
 *   AAAD = 무용
 *   AAAE = 대중무용
 *   AAAF = 서양음악(클래식)  ← 우리가 쓸 것
 *   AAAG = 한국음악(국악)
 *   AAAH = 대중음악
 *   AAAI = 복합
 *   AAAJ = 서커스/마술
 *   AAAK = 아동
 */

import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';
import { createLogger } from './lib/logger.mjs';

dotenv.config();
const log = createLogger('kopis');
const DB_PATH = process.env.DB_PATH || path.resolve('./concert_tracker.db');
const API_KEY = process.env.KOPIS_API_KEY;
const BASE_URL = 'http://www.kopis.or.kr/openApi/restful/pblprfr';

// 한국 주요 공연장 위도/경도 (KOPIS는 좌표를 안 줘서 직접 매핑)
const VENUE_COORDS = {
  '예술의전당': { lat: 37.4779, lng: 127.0083 },
  '세종문화회관': { lat: 37.5721, lng: 126.9764 },
  '롯데콘서트홀': { lat: 37.5130, lng: 127.0998 },
  '서울시향': { lat: 37.5721, lng: 126.9764 },
  '고양아람누리': { lat: 37.6777, lng: 126.7712 },
  '성남아트센터': { lat: 37.4207, lng: 127.1267 },
  '수원시립교향악단': { lat: 37.2636, lng: 127.0286 },
  '부산문화회관': { lat: 35.1380, lng: 129.0684 },
  '대구콘서트하우스': { lat: 35.8702, lng: 128.5912 },
  '광주예술의전당': { lat: 35.1714, lng: 126.9086 },
  '인천종합문화예술회관': { lat: 37.4563, lng: 126.7052 },
  '통영국제음악당': { lat: 34.8544, lng: 128.4333 },
  '대전예술의전당': { lat: 36.3505, lng: 127.3845 },
  '울산문화예술회관': { lat: 35.5385, lng: 129.3114 },
  '창원성산아트홀': { lat: 35.2280, lng: 128.6811 },
  '경기필하모닉오케스트라': { lat: 37.2636, lng: 127.0286 },
};

function getCoords(venueName) {
  for (const [key, coords] of Object.entries(VENUE_COORDS)) {
    if (venueName && venueName.includes(key)) return coords;
  }
  return { lat: 37.5665, lng: 126.9780 }; // 서울 기본값
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const KOREAN_SEED_NAMES = [
  '임윤찬','조성진','손열음','김선욱','백건우','선우예권','박재홍',
  '정경화','장영주','김봄소리','양인모','한수진','신지아','임지영','조진주',
  '정명화','장한나','양성원','문태국','한재민','최하영','리처드 용재 오닐',
  '정명훈','김은선','성시연','함신익','장한나',
  '조수미','신영옥','홍혜경','황수미','연광철','최나경','이루마',
  '김다미','정재원','강승현','이혁','박민하','문지영','이수연',
];

function findKoreanArtist(title) {
  for (const name of KOREAN_SEED_NAMES) {
    if (title.includes(name)) return name;
  }
  return null;
}

// 날짜 형식 변환 YYYYMMDD → YYYY-MM-DD
function parseKopisDate(dateStr) {
  if (!dateStr) return '';
  // 2026.06.13 형식
  if (dateStr.includes('.')) return dateStr.replace(/\./g, '-');
  // 20260613 형식
  if (dateStr.length === 8) return dateStr.slice(0,4)+'-'+dateStr.slice(4,6)+'-'+dateStr.slice(6,8);
  return '';
}

// 공연명에서 아티스트 이름 추출 시도
function extractArtistFromTitle(title) {
  if (!title) return null;
  // "임윤찬 피아노 리사이틀" → "임윤찬"
  // "정명훈 지휘 서울시향" → "정명훈"
  // "조수미 소프라노 콘서트" → "조수미"
  const patterns = [
    /^([가-힣]{2,5})\s+(피아노|바이올린|첼로|비올라|지휘|소프라노|테너|바리톤|메조|플루트|클라리넷|하프|오보에)/,
    /^([A-Za-z\s\-\.]{3,30})\s+(Piano|Violin|Cello|Viola|Conductor|Soprano|Tenor)/i,
    /^([가-힣]{2,5})\s+리사이틀/,
    /^([가-힣]{2,5})\s+콘서트/,
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

// 장르코드 → instrument
function genreToInstrument(genre) {
  if (!genre) return 'Performer';
  if (genre.includes('오케스트라') || genre.includes('교향')) return 'Orchestra';
  if (genre.includes('오페라')) return 'Opera Singer';
  if (genre.includes('합창') || genre.includes('코러스')) return 'Choir';
  if (genre.includes('실내악') || genre.includes('앙상블')) return 'Ensemble';
  if (genre.includes('피아노')) return 'Piano';
  if (genre.includes('바이올린')) return 'Violin';
  if (genre.includes('첼로')) return 'Cello';
  if (genre.includes('성악') || genre.includes('소프라노')) return 'Soprano';
  if (genre.includes('지휘')) return 'Conductor';
  return 'Performer';
}

// KOPIS 공연 목록 조회
async function fetchKopis(stdate, eddate, rows = 100, start = 1) {
  const res = await axios.get(BASE_URL, {
    params: {
      service: API_KEY,
      stdate,
      eddate,
      rows,
      cpage: start,
    },
    timeout: 15000,
  });
  return res.data;
}

// KOPIS 공연 상세 조회 (출연진 정보)
async function fetchDetail(mt20id) {
  try {
    const res = await axios.get(`http://www.kopis.or.kr/openApi/restful/pblprfr/${mt20id}`, {
      params: { service: API_KEY },
      timeout: 10000,
    });
    return res.data;
  } catch { return null; }
}

async function main() {
  if (!API_KEY) {
    log.error('KOPIS_API_KEY 미설정 — .env 에 KOPIS_API_KEY=발급받은키 추가');
    process.exit(1);
  }

  const parser = new XMLParser({ ignoreAttributes: false });
  const db = new Database(DB_PATH);

  // 오늘부터 1년치
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(today.getFullYear() + 1);
  const stdate = today.toISOString().slice(0, 10).replace(/-/g, '');
  const eddate = nextYear.toISOString().slice(0, 10).replace(/-/g, '');

  log.info('KOPIS 수집 시작', { 기간: `${stdate} ~ ${eddate}` });

  // 전체 목록 페이지네이션
  let allPerformances = [];
  let start = 1;
  const rows = 100; // 최대

  while (true) {
    const raw = await fetchKopis(stdate, eddate, rows, start);
    const parsed = parser.parse(raw);
    const items = parsed?.dbs?.db;
    if (!items) break;
    // 클래식만 필터
    const list = (Array.isArray(items) ? items : [items]).filter(p => p.genrenm && (p.genrenm.includes('클래식') || p.genrenm.includes('서양음악')));
    if (list.length === 0) break;
    allPerformances.push(...list);
    log.info(`페이지 수집`, { start, 수집: list.length, 누적: allPerformances.length });
    if (list.length < rows) break;
    start += rows;
    await sleep(300);
  }

  log.info(`전체 공연 수집 완료`, { 총: allPerformances.length });

  // DB에서 기존 아티스트 로드
  const existingMusicians = new Map(
    db.prepare('SELECT id, name, name_ko FROM musicians').all()
      .map(r => [r.name_ko || r.name, r.id])
  );

  const insertMusician = db.prepare(`
    INSERT INTO musicians (name, name_ko, instrument, nationality, source)
    VALUES (?, ?, ?, 'South Korea', 'kopis')
  `);

  const upsertConcert = db.prepare(`
    INSERT INTO concerts (
      musician_id, title, venue_name, venue_city, venue_country,
      concert_date, venue_lat, venue_lng,
      ticket_url, external_id, source, natural_key, updated_at
    ) VALUES (
      @musician_id, @title, @venue_name, '대한민국', 'South Korea',
      @concert_date, @venue_lat, @venue_lng,
      @ticket_url, @external_id, 'kopis', @natural_key, datetime('now')
    )
    ON CONFLICT(natural_key) DO UPDATE SET
      venue_name  = COALESCE(excluded.venue_name, venue_name),
      venue_lat   = COALESCE(excluded.venue_lat, venue_lat),
      venue_lng   = COALESCE(excluded.venue_lng, venue_lng),
      ticket_url  = COALESCE(excluded.ticket_url, ticket_url),
      updated_at  = datetime('now')
  `);

  let inserted = 0;
  let skipped = 0;
  let newMusicians = 0;

  for (const perf of allPerformances) {
    const title = perf.prfnm || '';
    const venueName = perf.fcltynm || '';
    const startDate = parseKopisDate(String(perf.prfpdfrom || ''));
    const endDate = parseKopisDate(String(perf.prfpdto || ''));
    const mt20id = perf.mt20id || '';
    const poster = perf.poster || '';

    if (!startDate || !title) continue;

    // 1. 한국 음악가 시드 매칭
    let artistName = findKoreanArtist(title);
    // 2. 정규식 패턴 추출
    if (!artistName) artistName = extractArtistFromTitle(title);
    // 3. 못 찾으면 스킵
    if (!artistName) { skipped++; continue; }

    // musician_id 찾거나 생성
    let musicianId = existingMusicians.get(artistName);
    if (!musicianId) {
      const instrument = genreToInstrument(perf.genrenm || '');
      const result = insertMusician.run(artistName, artistName, instrument);
      musicianId = result.lastInsertRowid;
      existingMusicians.set(artistName, musicianId);
      newMusicians++;
      log.info('신규 음악가', { name: artistName });
    }

    // 좌표
    const coords = getCoords(venueName);

    // 공연 기간을 날짜별로 분리 (연속 공연인 경우)
    const start_d = new Date(startDate);
    const end_d = endDate ? new Date(endDate) : start_d;
    const daysDiff = Math.min(
      Math.round((end_d - start_d) / (1000 * 60 * 60 * 24)),
      30 // 최대 30일 (너무 긴 공연은 대표일만)
    );

    // 대표 날짜 (시작일)만 저장
    const naturalKey = `${artistName.toLowerCase().replace(/\s/g, '')}|${venueName.toLowerCase().replace(/\s/g, '')}|${startDate}`;
    const externalId = `kopis_${mt20id}`;

    try {
      upsertConcert.run({
        musician_id: musicianId,
        title,
        venue_name: venueName,
        concert_date: startDate,
        venue_lat: coords.lat,
        venue_lng: coords.lng,
        ticket_url: `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00010&mt20id=${mt20id}`,
        external_id: externalId,
        natural_key: naturalKey,
      });
      inserted++;
    } catch (err) {
      skipped++;
    }
  }

  // 최종 통계
  const stats = {
    한국공연: inserted,
    신규음악가: newMusicians,
    총_음악가: db.prepare('SELECT COUNT(*) AS c FROM musicians').get().c,
    총_콘서트: db.prepare('SELECT COUNT(*) AS c FROM concerts').get().c,
  };

  db.close();
  log.info('═══ KOPIS 수집 완료 ═══', stats);
}

main().catch(err => {
  log.error('에러', { error: err.message });
  process.exit(1);
});
