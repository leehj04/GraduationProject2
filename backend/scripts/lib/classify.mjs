/**
 * 아티스트 자동 분류 모듈
 * 
 * run.mjs 에서 import 해서 사용.
 * 1. 이름 키워드로 즉시 분류 (Orchestra, Quartet 등)
 * 2. MusicBrainz API 로 개인 아티스트 악기 조회
 * 3. 못 찾으면 'Performer' 기본값
 */

import axios from 'axios';
import { createLogger } from './logger.mjs';

const log = createLogger('classify');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const TYPE_KEYWORDS = [
  { pattern: /orchestra/i, instrument: 'Orchestra' },
  { pattern: /philharmon/i, instrument: 'Orchestra' },
  { pattern: /symphony(?!\s+no)/i, instrument: 'Orchestra' },
  { pattern: /sinfonia/i, instrument: 'Orchestra' },
  { pattern: /sinfonietta/i, instrument: 'Orchestra' },
  { pattern: /staatskapelle/i, instrument: 'Orchestra' },
  { pattern: /concertgebouw/i, instrument: 'Orchestra' },
  { pattern: /gewandhaus/i, instrument: 'Orchestra' },
  { pattern: /tonhalle/i, instrument: 'Orchestra' },
  { pattern: /quartet/i, instrument: 'Quartet' },
  { pattern: /quartett/i, instrument: 'Quartet' },
  { pattern: /trio\b/i, instrument: 'Trio' },
  { pattern: /ensemble/i, instrument: 'Ensemble' },
  { pattern: /consort/i, instrument: 'Ensemble' },
  { pattern: /academy\sof/i, instrument: 'Ensemble' },
  { pattern: /choir/i, instrument: 'Choir' },
  { pattern: /chorus/i, instrument: 'Choir' },
  { pattern: /chorale/i, instrument: 'Choir' },
  { pattern: /singers/i, instrument: 'Choir' },
  { pattern: /voices/i, instrument: 'Choir' },
];

const TAG_TO_INSTRUMENT = {
  'piano': 'Piano', 'pianist': 'Piano', 'keyboard': 'Piano',
  'violin': 'Violin', 'violinist': 'Violin',
  'viola': 'Viola', 'violist': 'Viola',
  'cello': 'Cello', 'cellist': 'Cello',
  'double bass': 'Double Bass', 'contrabass': 'Double Bass',
  'flute': 'Flute', 'flutist': 'Flute',
  'clarinet': 'Clarinet', 'oboe': 'Oboe',
  'bassoon': 'Bassoon', 'horn': 'Horn', 'french horn': 'Horn',
  'trumpet': 'Trumpet', 'trombone': 'Trombone', 'tuba': 'Tuba',
  'harp': 'Harp', 'harpist': 'Harp',
  'guitar': 'Guitar', 'guitarist': 'Guitar',
  'organ': 'Organ', 'organist': 'Organ',
  'harpsichord': 'Harpsichord',
  'percussion': 'Percussion', 'marimba': 'Percussion',
  'conductor': 'Conductor', 'conducting': 'Conductor',
  'soprano': 'Soprano', 'mezzo-soprano': 'Mezzo-Soprano',
  'alto': 'Alto', 'contralto': 'Contralto',
  'tenor': 'Tenor', 'baritone': 'Baritone', 'bass': 'Bass',
  'singer': 'Vocals', 'vocals': 'Vocals', 'voice': 'Vocals',
  'opera': 'Opera Singer',
  'composer': 'Composer', 'film composer': 'Composer', 'film score': 'Composer',
};

function classifyByName(name) {
  for (const { pattern, instrument } of TYPE_KEYWORDS) {
    if (pattern.test(name)) return instrument;
  }
  return null;
}

async function lookupMusicBrainz(name) {
  try {
    const res = await axios.get('https://musicbrainz.org/ws/2/artist', {
      params: { query: `"${name}"`, limit: 3, fmt: 'json' },
      headers: { 'User-Agent': 'ClassicTour/1.0 (graduation-project)' },
      timeout: 10000,
    });
    const artists = res.data.artists || [];
    if (artists.length === 0) return null;
    const match = artists.find(a => a.name.toLowerCase() === name.toLowerCase()) || artists[0];
    if (match.type === 'Orchestra') return 'Orchestra';
    if (match.type === 'Choir') return 'Choir';
    const disamb = (match.disambiguation || '').toLowerCase();
    for (const [key, value] of Object.entries(TAG_TO_INSTRUMENT)) {
      if (disamb.includes(key)) return value;
    }
    const tags = (match.tags || []).map(t => t.name.toLowerCase());
    for (const tag of tags) {
      if (TAG_TO_INSTRUMENT[tag]) return TAG_TO_INSTRUMENT[tag];
      for (const [key, value] of Object.entries(TAG_TO_INSTRUMENT)) {
        if (tag.includes(key)) return value;
      }
    }
    return null;
  } catch { return null; }
}

/**
 * DB 에서 instrument 가 없는 아티스트를 자동 분류
 * @param {Database} db - better-sqlite3 인스턴스 (열린 상태)
 */
export async function classifyNewArtists(db) {
  const unclassified = db.prepare(
    "SELECT id, name FROM musicians WHERE instrument IS NULL OR instrument = ''"
  ).all();

  if (unclassified.length === 0) {
    log.info('분류할 신규 아티스트 없음');
    return;
  }

  log.info('신규 아티스트 분류 시작', { 대상: unclassified.length });
  const update = db.prepare('UPDATE musicians SET instrument = ? WHERE id = ?');
  let classified = 0;

  for (const m of unclassified) {
    // 1. 키워드 분류 (즉시)
    const byName = classifyByName(m.name);
    if (byName) {
      update.run(byName, m.id);
      classified++;
      continue;
    }

    // 2. MusicBrainz 조회 (1초 대기)
    const byMb = await lookupMusicBrainz(m.name);
    update.run(byMb || 'Performer', m.id);
    if (byMb) classified++;
    await sleep(1100);
  }

  log.info('신규 아티스트 분류 완료', { 분류: classified, 기본값: unclassified.length - classified });
}
