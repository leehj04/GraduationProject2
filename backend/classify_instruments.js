/**
 * MusicBrainz API로 음악가 악기 자동 분류
 * 실행: backend 폴더에서 → node classify_instruments.js
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
  if (n.includes('piano') || n.includes('fortepiano') || n.includes('keyboard')) return '피아노';
  if (n.includes('violin') && !n.includes('viola')) return '바이올린';
  if (n.includes('viola') && !n.includes('violin')) return '비올라';
  if (n.includes('cello') || n.includes('violoncello')) return '첼로';
  if (n.includes('double bass') || n.includes('contrabass')) return '더블베이스';
  if (n.includes('flute') || n.includes('piccolo')) return '플루트';
  if (n.includes('oboe')) return '오보에';
  if (n.includes('clarinet')) return '클라리넷';
  if (n.includes('bassoon') || n.includes('fagott')) return '파곳';
  if (n.includes('horn')) return '호른';
  if (n.includes('trumpet')) return '트럼펫';
  if (n.includes('trombone')) return '트롬본';
  if (n.includes('tuba')) return '튜바';
  if (n.includes('harp')) return '하프';
  if (n.includes('organ') || n.includes('pipe organ')) return '오르간';
  if (n.includes('harpsichord') || n.includes('cembalo')) return '하프시코드';
  if (n.includes('guitar')) return '기타악기';
  if (n.includes('percussion') || n.includes('timpani') || n.includes('drum')) return '타악기';
  if (n.includes('voice') || n.includes('vocal') || n.includes('singing')) return '성악';
  if (n.includes('conductor') || n.includes('baton')) return '지휘';
  if (n.includes('saxophone')) return '색소폰';
  if (n.includes('accordion')) return '아코디언';
  if (n.includes('lute')) return '류트';
  return null;
}

// 태그에서 악기/성악 파트 추출
function getInstrumentFromTags(tags) {
  if (!tags || tags.length === 0) return null;
  const t = tags.map(x => (x.name || '').toLowerCase()).join(' ');

  // 성악 파트 (더 구체적인 것 먼저)
  if (t.includes('mezzo-soprano') || t.includes('mezzo soprano')) return '메조소프라노';
  if (t.includes('bass-baritone')) return '베이스바리톤';
  if (t.includes('countertenor') || t.includes('counter-tenor')) return '카운터테너';
  if (t.includes('contralto') || t.includes('alto')) return '알토';
  if (t.includes('soprano')) return '소프라노';
  if (t.includes('tenor')) return '테너';
  if (t.includes('baritone')) return '바리톤';
  if (t.includes('bass') && (t.includes('opera') || t.includes('voice') || t.includes('singer') || t.includes('vocal'))) return '베이스';

  // 악기
  if (t.includes('pianist') || t.includes('piano')) return '피아노';
  if (t.includes('violinist') || (t.includes('violin') && !t.includes('viola'))) return '바이올린';
  if (t.includes('violist') || t.includes('viola')) return '비올라';
  if (t.includes('cellist') || t.includes('cello')) return '첼로';
  if (t.includes('conductor') || t.includes('conducting')) return '지휘';
  if (t.includes('flutist') || t.includes('flute')) return '플루트';
  if (t.includes('oboist') || t.includes('oboe')) return '오보에';
  if (t.includes('clarinetist') || t.includes('clarinet')) return '클라리넷';
  if (t.includes('bassoonist') || t.includes('bassoon')) return '파곳';
  if (t.includes('hornist') || t.includes('french horn')) return '호른';
  if (t.includes('trumpeter') || t.includes('trumpet')) return '트럼펫';
  if (t.includes('trombonist') || t.includes('trombone')) return '트롬본';
  if (t.includes('harpist') || t.includes('harp')) return '하프';
  if (t.includes('organist') || t.includes('organ')) return '오르간';
  if (t.includes('harpsichord')) return '하프시코드';
  if (t.includes('percussionist') || t.includes('percussion') || t.includes('drummer')) return '타악기';
  if (t.includes('guitarist') || t.includes('guitar')) return '기타악기';
  if (t.includes('double bassist') || t.includes('double bass') || t.includes('contrabass')) return '더블베이스';
  if (t.includes('singer') || t.includes('vocalist') || t.includes('voice')) return '성악';

  return null;
}

// disambiguation 텍스트에서 추출
function getInstrumentFromBio(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  if (t.includes('mezzo-soprano') || t.includes('mezzo soprano')) return '메조소프라노';
  if (t.includes('countertenor')) return '카운터테너';
  if (t.includes('contralto')) return '알토';
  if (t.includes('soprano')) return '소프라노';
  if (t.includes('tenor')) return '테너';
  if (t.includes('baritone')) return '바리톤';
  if (t.includes('bass-baritone')) return '베이스바리톤';
  if (t.includes('bassist') || (t.includes('bass') && t.includes('singer'))) return '베이스';
  if (t.includes('pianist') || t.includes('piano')) return '피아노';
  if (t.includes('violinist') || t.includes('violin')) return '바이올린';
  if (t.includes('violist') || t.includes('viola')) return '비올라';
  if (t.includes('cellist') || t.includes('cello')) return '첼로';
  if (t.includes('conductor')) return '지휘';
  if (t.includes('flutist') || t.includes('flute')) return '플루트';
  if (t.includes('oboist') || t.includes('oboe')) return '오보에';
  if (t.includes('clarinetist') || t.includes('clarinet')) return '클라리넷';
  if (t.includes('bassoonist') || t.includes('bassoon')) return '파곳';
  if (t.includes('hornist') || t.includes('horn player')) return '호른';
  if (t.includes('trumpeter') || t.includes('trumpet')) return '트럼펫';
  if (t.includes('harpist') || t.includes('harp')) return '하프';
  if (t.includes('organist') || t.includes('organ')) return '오르간';
  if (t.includes('harpsichordist') || t.includes('harpsichord')) return '하프시코드';
  if (t.includes('percussionist') || t.includes('drummer')) return '타악기';
  if (t.includes('guitarist') || t.includes('guitar')) return '기타악기';
  if (t.includes('singer') || t.includes('vocalist')) return '성악';

  return null;
}

async function classifyAll() {
  const unclassified = db.prepare(`
    SELECT id, name, scraper_key
    FROM musicians
    WHERE instrument IS NULL OR instrument = '' OR instrument = '기타'
    ORDER BY id ASC
  `).all();

  console.log(`\n🎵 분류 필요 음악가: ${unclassified.length}명`);
  console.log('MusicBrainz API로 자동 분류 시작...\n');

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < unclassified.length; i++) {
    const musician = unclassified[i];
    process.stdout.write(`[${i + 1}/${unclassified.length}] ${musician.name} ... `);

    // ✅ inc=tags 추가해서 태그도 같이 받아오기
    const searchUrl = [
      'https://musicbrainz.org/ws/2/artist',
      `?query=${encodeURIComponent('"' + musician.name + '"')}`, // 정확한 이름 검색
      '&limit=5',
      '&fmt=json',
      '&inc=tags',  // ✅ 태그 포함
    ].join('');

    try {
      const searchRes = await fetchJSON(searchUrl);
      await sleep(1200);

      if (!searchRes.body || searchRes.body.error) {
        console.log('검색 실패');
        failed++;
        continue;
      }

      const artists = searchRes.body.artists || [];
      if (artists.length === 0) {
        // 따옴표 없이 재검색
        const retryUrl = [
          'https://musicbrainz.org/ws/2/artist',
          `?query=${encodeURIComponent(musician.name)}`,
          '&limit=5&fmt=json&inc=tags',
        ].join('');
        const retryRes = await fetchJSON(retryUrl);
        await sleep(1200);

        if (!retryRes.body?.artists?.length) {
          console.log('결과 없음 → 기타');
          db.prepare("UPDATE musicians SET instrument = '기타' WHERE id = ?").run(musician.id);
          failed++;
          continue;
        }
        artists.push(...retryRes.body.artists);
      }

      // score 가장 높은 사람 선택
      const best = artists.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
      let instrument = null;

      // 1단계: instruments 필드
      if (best.instruments?.length > 0) {
        for (const inst of best.instruments) {
          instrument = translateInstrument(inst.name || inst);
          if (instrument) break;
        }
      }

      // 2단계: 태그
      if (!instrument) {
        instrument = getInstrumentFromTags(best.tags);
      }

      // 3단계: disambiguation
      if (!instrument) {
        instrument = getInstrumentFromBio(best.disambiguation);
      }

      // 4단계: 이름으로 상세 조회 (mb_id 있으면)
      if (!instrument && best.id) {
        const detailUrl = `https://musicbrainz.org/ws/2/artist/${best.id}?fmt=json&inc=tags`;
        const detailRes = await fetchJSON(detailUrl);
        await sleep(1200);

        if (detailRes.body && !detailRes.body.error) {
          instrument = getInstrumentFromTags(detailRes.body.tags);
          if (!instrument) instrument = getInstrumentFromBio(detailRes.body.disambiguation);
        }
      }

      if (instrument) {
        db.prepare('UPDATE musicians SET instrument = ? WHERE id = ?').run(instrument, musician.id);
        console.log(`✅ ${instrument}`);
        updated++;
      } else {
        db.prepare("UPDATE musicians SET instrument = '기타' WHERE id = ?").run(musician.id);
        console.log('→ 기타');
        failed++;
      }

    } catch (err) {
      console.log(`오류: ${err.message}`);
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
  console.log(`✅ 성공: ${updated}명`);
  console.log(`→ 기타: ${failed}명`);
  console.log('\n📊 악기별 분포:');
  stats.forEach(s => console.log(`  ${s.instrument}: ${s.count}명`));
  console.log('════════════════════════════════\n');
}

classifyAll().catch(console.error);