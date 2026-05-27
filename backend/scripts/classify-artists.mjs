/**
 * 아티스트 정리 + 악기/타입 자동 분류
 *
 * 1. 이벤트 이름이 아티스트로 잘못 들어간 것 제거
 * 2. 공연 없는 아티스트 제거
 * 3. 이름 키워드로 타입 자동 분류 (Orchestra, Quartet 등)
 * 4. MusicBrainz API 로 개인 아티스트 악기 조회
 * 5. 분류 불가능한 것은 'Performer' 로 기본값
 */

import Database from 'better-sqlite3';
import axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';
import { createLogger } from './lib/logger.mjs';

dotenv.config();
const log = createLogger('classify');
const DB_PATH = process.env.DB_PATH || path.resolve('./concert_tracker.db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══ 1단계: 쓰레기 이름 필터 ═════════════════════════════
const JUNK_PATTERNS = [
  // 이벤트/축제 이름 키워드
  /concert/i, /koncert/i, /festival/i, /gala/i, /celebration/i,
  /new year/i, /christmas/i, /holiday/i, /summer\s/i, /winter\s/i,
  /evening\s(of|with)/i, /night\s(of|with|at)/i,
  /best\sof/i, /greatest\shits/i, /tribute/i, /experience/i,
  /spectacular/i, /extravaganza/i, /masterclass/i,
  /classical\s/i, /classics/i,
  // 숫자로 시작하는 이벤트명 (4 Tenoři 등)
  /^\d+\s/,
  // 연도가 들어간 이벤트명
  /20\d{2}/,
  // 너무 긴 이름 (이벤트 설명일 가능성 높음)
  /^.{80,}$/,
  // 슬래시로 여러 아티스트 합친 것 (A / B / C)
  /\s\/\s.*\s\/\s/,
  // "presents", "featuring" 등 이벤트 수식어
  /presents/i, /featuring/i, /feat\./i,
  // 일반 명사 이벤트
  /^the\s(magic|best|great|sound|art|world)/i,
  /in\sconcert$/i,
  /on\stour$/i,
  /live\s(in|at|on)/i,
];

function isJunkName(name) {
  if (!name || name.length < 2) return true;
  return JUNK_PATTERNS.some(p => p.test(name));
}

// ═══ 2단계: 이름 키워드로 타입 분류 ══════════════════════
const TYPE_KEYWORDS = [
  // 오케스트라
  { pattern: /orchestra/i, instrument: 'Orchestra' },
  { pattern: /philharmon/i, instrument: 'Orchestra' },
  { pattern: /symphony(?!\s+no)/i, instrument: 'Orchestra' }, // "Symphony No.5" 제외
  { pattern: /sinfonia/i, instrument: 'Orchestra' },
  { pattern: /sinfonietta/i, instrument: 'Orchestra' },
  { pattern: /staatskapelle/i, instrument: 'Orchestra' },
  { pattern: /kammerorchester/i, instrument: 'Orchestra' },
  { pattern: /gewandhaus/i, instrument: 'Orchestra' },
  { pattern: /tonhalle/i, instrument: 'Orchestra' },
  { pattern: /concertgebouw/i, instrument: 'Orchestra' },

  // 앙상블/실내악
  { pattern: /quartet/i, instrument: 'Quartet' },
  { pattern: /quartett/i, instrument: 'Quartet' },
  { pattern: /trio\b/i, instrument: 'Trio' },
  { pattern: /ensemble/i, instrument: 'Ensemble' },
  { pattern: /consort/i, instrument: 'Ensemble' },
  { pattern: /academy\sof/i, instrument: 'Ensemble' },

  // 합창
  { pattern: /choir/i, instrument: 'Choir' },
  { pattern: /chorus/i, instrument: 'Choir' },
  { pattern: /chorale/i, instrument: 'Choir' },
  { pattern: /singers/i, instrument: 'Choir' },
  { pattern: /voices/i, instrument: 'Choir' },

  // 밴드/그룹 (클래식 크로스오버)
  { pattern: /band\b/i, instrument: 'Ensemble' },
];

function classifyByName(name) {
  for (const { pattern, instrument } of TYPE_KEYWORDS) {
    if (pattern.test(name)) return instrument;
  }
  return null; // 개인 아티스트 → MusicBrainz 에서 조회
}

// ═══ 3단계: MusicBrainz 로 개인 아티스트 악기 조회 ════════
const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_UA = 'ClassicTour/1.0 (graduation-project)';

// 태그 → 악기 매핑
const TAG_TO_INSTRUMENT = {
  // 피아노
  'piano': 'Piano', 'pianist': 'Piano', 'keyboard': 'Piano',
  // 바이올린
  'violin': 'Violin', 'violinist': 'Violin',
  // 비올라
  'viola': 'Viola', 'violist': 'Viola',
  // 첼로
  'cello': 'Cello', 'cellist': 'Cello',
  // 더블베이스
  'double bass': 'Double Bass', 'contrabass': 'Double Bass',
  // 플루트
  'flute': 'Flute', 'flutist': 'Flute',
  // 클라리넷
  'clarinet': 'Clarinet',
  // 오보에
  'oboe': 'Oboe',
  // 바순
  'bassoon': 'Bassoon', 'fagott': 'Bassoon',
  // 호른
  'horn': 'Horn', 'french horn': 'Horn',
  // 트럼펫
  'trumpet': 'Trumpet',
  // 트롬본
  'trombone': 'Trombone',
  // 튜바
  'tuba': 'Tuba',
  // 하프
  'harp': 'Harp', 'harpist': 'Harp',
  // 기타
  'guitar': 'Guitar', 'guitarist': 'Guitar',
  // 오르간
  'organ': 'Organ', 'organist': 'Organ',
  // 하프시코드
  'harpsichord': 'Harpsichord',
  // 타악기
  'percussion': 'Percussion', 'drums': 'Percussion', 'marimba': 'Percussion',
  // 지휘
  'conductor': 'Conductor', 'conducting': 'Conductor',
  // 성악
  'soprano': 'Soprano', 'mezzo-soprano': 'Mezzo-Soprano',
  'alto': 'Alto', 'contralto': 'Contralto',
  'tenor': 'Tenor', 'baritone': 'Baritone', 'bass': 'Bass',
  'singer': 'Vocals', 'vocals': 'Vocals', 'voice': 'Vocals',
  'opera': 'Opera Singer',
  // 작곡
  'composer': 'Composer', 'film composer': 'Composer',
  'film score': 'Composer',
};

async function lookupMusicBrainz(name) {
  try {
    const res = await axios.get(`${MB_BASE}/artist`, {
      params: {
        query: `"${name}"`,
        limit: 3,
        fmt: 'json',
      },
      headers: { 'User-Agent': MB_UA },
      timeout: 10000,
    });

    const artists = res.data.artists || [];
    if (artists.length === 0) return null;

    // 이름이 가장 잘 맞는 것 선택
    const match = artists.find(a =>
      a.name.toLowerCase() === name.toLowerCase()
    ) || artists[0];

    // 1. type 필드 확인 (Orchestra, Group 등)
    if (match.type === 'Orchestra') return 'Orchestra';
    if (match.type === 'Choir') return 'Choir';

    // 2. disambiguation 확인 ("German conductor" 등)
    const disamb = (match.disambiguation || '').toLowerCase();
    for (const [key, value] of Object.entries(TAG_TO_INSTRUMENT)) {
      if (disamb.includes(key)) return value;
    }

    // 3. 태그 확인
    const tags = (match.tags || []).map(t => t.name.toLowerCase());
    for (const tag of tags) {
      if (TAG_TO_INSTRUMENT[tag]) return TAG_TO_INSTRUMENT[tag];
      // 부분 매칭도 시도
      for (const [key, value] of Object.entries(TAG_TO_INSTRUMENT)) {
        if (tag.includes(key)) return value;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

// ═══ 메인 ════════════════════════════════════════════════
async function main() {
  const db = new Database(DB_PATH);

  // ── 1. 쓰레기 이름 제거 ──
  const allMusicians = db.prepare('SELECT id, name FROM musicians').all();
  const junkIds = [];
  for (const m of allMusicians) {
    if (isJunkName(m.name)) {
      junkIds.push(m.id);
      log.info('쓰레기 제거', { name: m.name });
    }
  }
  if (junkIds.length > 0) {
    db.prepare(`DELETE FROM concerts WHERE musician_id IN (${junkIds.join(',')})`).run();
    db.prepare(`DELETE FROM musicians WHERE id IN (${junkIds.join(',')})`).run();
    log.info(`쓰레기 ${junkIds.length}건 제거 완료`);
  }

  // ── 2. 공연 없는 아티스트 제거 ──
  const cleaned = db.prepare(
    'DELETE FROM musicians WHERE id NOT IN (SELECT DISTINCT musician_id FROM concerts)'
  ).run();
  log.info('공연 없는 아티스트 정리', { 삭제: cleaned.changes });

  // ── 3. 이름 키워드로 타입 분류 ──
  const remaining = db.prepare('SELECT id, name, instrument FROM musicians').all();
  const updateInstrument = db.prepare('UPDATE musicians SET instrument = ? WHERE id = ?');

  let keywordClassified = 0;
  const needsMbLookup = [];

  for (const m of remaining) {
    const type = classifyByName(m.name);
    if (type) {
      updateInstrument.run(type, m.id);
      keywordClassified++;
    } else if (!m.instrument) {
      needsMbLookup.push(m);
    }
  }
  log.info('키워드 분류 완료', { 분류: keywordClassified, MB조회필요: needsMbLookup.length });

  // ── 4. MusicBrainz 조회 (1초당 1건) ──
  let mbClassified = 0;
  let mbFailed = 0;

  for (let i = 0; i < needsMbLookup.length; i++) {
    const m = needsMbLookup[i];
    const instrument = await lookupMusicBrainz(m.name);

    if (instrument) {
      updateInstrument.run(instrument, m.id);
      mbClassified++;
    } else {
      // 기본값: Performer
      updateInstrument.run('Performer', m.id);
      mbFailed++;
    }

    if ((i + 1) % 20 === 0) {
      log.info('MB 조회 진행', {
        진행: `${i + 1}/${needsMbLookup.length}`,
        분류: mbClassified,
        기본값: mbFailed,
      });
    }

    // MusicBrainz rate limit: 1 req/sec
    await sleep(1100);
  }

  log.info('MusicBrainz 분류 완료', { 분류: mbClassified, 기본값처리: mbFailed });

  // ── 5. 최종 통계 ──
  const stats = db.prepare(`
    SELECT instrument, COUNT(*) AS cnt
    FROM musicians
    GROUP BY instrument
    ORDER BY cnt DESC
  `).all();

  const total = db.prepare('SELECT COUNT(*) AS c FROM musicians').get();

  log.info('═══ 분류 완료 ═══', { 총연주자: total.c });
  for (const s of stats) {
    log.info(`  ${s.instrument}: ${s.cnt}명`);
  }

  db.close();
}

main().catch(err => {
  log.error('에러', { error: err.message });
  process.exit(1);
});
