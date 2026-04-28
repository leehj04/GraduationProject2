/**
 * MusicBrainz API로 음악가 악기 자동 분류
 * 실행: backend 폴더에서 → node classify_instruments.js
 * - instrument가 null인 음악가를 MusicBrainz에서 조회해서 자동으로 채워줘요
 */

const https = require('https');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'concert_tracker.db'));

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'ClassicTour/1.0 (graduation project)',
        'Accept': 'application/json',
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: null }); }
      });
    }).on('error', err => resolve({ status: 0, body: null, error: err.message }));
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// MusicBrainz 악기명 → 한국어
function translateInstrument(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('piano') || n.includes('fortepiano')) return '피아노';
  if (n.includes('violin')) return '바이올린';
  if (n.includes('cello') || n.includes('violoncello')) return '첼로';
  if (n.includes('viola') && !n.includes('violin')) return '비올라';
  if (n.includes('flute') || n.includes('piccolo')) return '플루트';
  if (n.includes('oboe')) return '오보에';
  if (n.includes('clarinet')) return '클라리넷';
  if (n.includes('bassoon') || n.includes('fagott')) return '파곳';
  if (n.includes('horn')) return '호른';
  if (n.includes('trumpet')) return '트럼펫';
  if (n.includes('trombone')) return '트롬본';
  if (n.includes('tuba')) return '튜바';
  if (n.includes('harp')) return '하프';
  if (n.includes('organ')) return '오르간';
  if (n.includes('harpsichord') || n.includes('cembalo')) return '하프시코드';
  if (n.includes('guitar')) return '기타';
  if (n.includes('percussion') || n.includes('timpani') || n.includes('drum')) return '타악기';
  if (n.includes('voice') || n.includes('vocals') || n.includes('singing')) return '성악';
  if (n.includes('conductor') || n.includes('baton')) return '지휘';
  if (n.includes('saxophone')) return '색소폰';
  if (n.includes('double bass') || n.includes('contrabass')) return '더블베이스';
  if (n.includes('lute')) return '류트';
  if (n.includes('accordion')) return '아코디언';
  return null;
}

// 태그에서 악기 추출 (기존 방식 — 백업용)
function getInstrumentFromTags(tags) {
  if (!tags || tags.length === 0) return null;
  const t = tags.map(x => x.name.toLowerCase()).join(' ');
  if (t.includes('piano') || t.includes('pianist')) return '피아노';
  if (t.includes('violin') || t.includes('violinist')) return '바이올린';
  if (t.includes('cello') || t.includes('cellist')) return '첼로';
  if (t.includes('viola')) return '비올라';
  if (t.includes('flute') || t.includes('flutist')) return '플루트';
  if (t.includes('conductor') || t.includes('conducting')) return '지휘';
  if (t.includes('soprano')) return '소프라노';
  if (t.includes('mezzo')) return '메조소프라노';
  if (t.includes('tenor')) return '테너';
  if (t.includes('baritone')) return '바리톤';
  if (t.includes('bass') && (t.includes('voice') || t.includes('singer') || t.includes('opera'))) return '베이스';
  if (t.includes('organ')) return '오르간';
  if (t.includes('harp')) return '하프';
  if (t.includes('clarinet')) return '클라리넷';
  if (t.includes('trumpet')) return '트럼펫';
  if (t.includes('oboe')) return '오보에';
  if (t.includes('horn')) return '호른';
  if (t.includes('trombone')) return '트롬본';
  if (t.includes('soprano') || t.includes('tenor') || t.includes('alto')) return '성악';
  return null;
}

// 성악 파트 분류 (태그 기반)
function getVoiceType(tags) {
  if (!tags || tags.length === 0) return null;
  const t = tags.map(x => x.name.toLowerCase()).join(' ');
  if (t.includes('soprano')) return '소프라노';
  if (t.includes('mezzo-soprano') || t.includes('mezzo soprano')) return '메조소프라노';
  if (t.includes('contralto') || t.includes('alto')) return '알토';
  if (t.includes('tenor')) return '테너';
  if (t.includes('baritone')) return '바리톤';
  if (t.includes('bass-baritone')) return '베이스바리톤';
  if (t.includes('bass') ) return '베이스';
  if (t.includes('countertenor')) return '카운터테너';
  return null;
}

async function classifyAll() {
  // instrument가 null이거나 비어있는 음악가 조회
  const unclassified = db.prepare(`
    SELECT id, name, scraper_key
    FROM musicians
    WHERE instrument IS NULL OR instrument = ''
    ORDER BY id ASC
  `).all();

  // mb_id가 있는 음악가도 조회 (musicians_data.json에서 가져온 것들)
  const withMbId = db.prepare(`
    SELECT id, name, scraper_key
    FROM musicians
    WHERE instrument IS NULL OR instrument = ''
    ORDER BY id ASC
  `).all();

  console.log(`\n🎵 악기 미분류 음악가: ${unclassified.length}명`);
  console.log('MusicBrainz API로 자동 분류 시작...\n');

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < unclassified.length; i++) {
    const musician = unclassified[i];
    console.log(`[${i + 1}/${unclassified.length}] ${musician.name} 조회 중...`);

    // 이름으로 MusicBrainz 검색
    const searchUrl = [
      'https://musicbrainz.org/ws/2/artist',
      `?query=${encodeURIComponent(musician.name)}`,
      '&limit=5&fmt=json',
    ].join('');

    try {
      const searchRes = await fetchJSON(searchUrl);
      await sleep(1200); // API 제한 준수

      if (!searchRes.body || searchRes.body.error) {
        console.log(`  ⚠ 검색 실패`);
        failed++;
        continue;
      }

      const artists = searchRes.body.artists || [];
      if (artists.length === 0) {
        console.log(`  결과 없음`);
        failed++;
        continue;
      }

      // 가장 관련도 높은 결과 선택
      const best = artists[0];
      let instrument = null;

      // 1순위: instruments 필드 직접 확인
      if (best.instruments && best.instruments.length > 0) {
        const firstInstrument = best.instruments[0];
        instrument = translateInstrument(firstInstrument.name || firstInstrument);
      }

      // 2순위: 태그에서 성악 파트 확인
      if (!instrument) {
        instrument = getVoiceType(best.tags);
      }

      // 3순위: 태그에서 악기 추출
      if (!instrument) {
        instrument = getInstrumentFromTags(best.tags);
      }

      // 4순위: disambiguation 텍스트에서 추출
      if (!instrument && best.disambiguation) {
        const d = best.disambiguation.toLowerCase();
        if (d.includes('piano')) instrument = '피아노';
        else if (d.includes('violin')) instrument = '바이올린';
        else if (d.includes('cello')) instrument = '첼로';
        else if (d.includes('soprano')) instrument = '소프라노';
        else if (d.includes('tenor')) instrument = '테너';
        else if (d.includes('baritone')) instrument = '바리톤';
        else if (d.includes('bass')) instrument = '베이스';
        else if (d.includes('conductor')) instrument = '지휘';
        else if (d.includes('flute')) instrument = '플루트';
        else if (d.includes('clarinet')) instrument = '클라리넷';
        else if (d.includes('oboe')) instrument = '오보에';
        else if (d.includes('horn')) instrument = '호른';
        else if (d.includes('harp')) instrument = '하프';
        else if (d.includes('organ')) instrument = '오르간';
      }

      if (instrument) {
        db.prepare('UPDATE musicians SET instrument = ? WHERE id = ?')
          .run(instrument, musician.id);
        console.log(`  ✅ ${instrument} 로 분류됨`);
        updated++;
      } else {
        // 분류 못 하면 '기타'로 설정
        db.prepare("UPDATE musicians SET instrument = '기타' WHERE id = ?")
          .run(musician.id);
        console.log(`  → 분류 불가, '기타'로 설정`);
        failed++;
      }

    } catch (err) {
      console.error(`  ⚠ 오류: ${err.message}`);
      failed++;
      await sleep(2000);
    }
  }

  // 결과 요약
  const stats = db.prepare(`
    SELECT instrument, COUNT(*) as count
    FROM musicians
    WHERE instrument IS NOT NULL
    GROUP BY instrument
    ORDER BY count DESC
  `).all();

  console.log('\n════════════════════════════════');
  console.log(`✅ 분류 완료: ${updated}명 업데이트`);
  console.log(`⚠ 기타 처리: ${failed}명`);
  console.log('\n📊 악기별 분포:');
  stats.forEach(s => console.log(`  ${s.instrument}: ${s.count}명`));
  console.log('════════════════════════════════\n');
}

classifyAll().catch(console.error);