/**
 * MusicBrainz API로 클래식 음악가 150명 데이터 수집
 * 실행: backend 폴더에서 → node fetch_musicians.js
 * 결과: backend/musicians_data.json 파일 생성 (5~10분 소요)
 *
 * ※ 이전보다 필터링이 강화되어 엉뚱한 음악가가 섞이지 않아요
 */

const https = require('https');
const fs = require('fs');

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
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── 이름 필터링 ─────────────────────────────────
// 이름에 이런 단어가 있으면 클래식 음악가가 아님
const BAD_WORDS = [
  'hardstyle', 'depressive', 'black metal', 'death metal', 'heavy metal',
  'jazz', 'blues', 'hip hop', 'hiphop', 'rap', 'rock', 'punk',
  'electronic', 'ambient', 'techno', 'house', 'trance', 'dubstep',
  'video game', 'game music', 'anime', 'soundtrack',
  'dark', 'light blue', 'secret', 'hospital',
  'classical kids', 'classical robot', 'kids', 'robot',
  'project', 'ensemble', 'quartet', 'trio', 'duo',
  'orchestra', 'philharmonic', 'symphony', 'chamber',
  'band', 'group', 'collective',
];

const BAD_PATTERNS = [
  // 악기/직업명이 이름에 그대로 포함된 경우
  /pianist/i, /violinist/i, /cellist/i, /violist/i,
  /flutist/i, /conductor$/i, /soprano$/i, /tenor$/i,
  /baritone$/i, /guitarist/i, /drummer/i, /organist/i,
  // "The + 무언가" 형태
  /^the /i,
  // 관사로 시작
  /^een /i, /^der /i, /^die /i, /^das /i, /^le /i, /^la /i,
  // 숫자만
  /^\d+$/,
  // ✅ 추가 — "Classical + 무언가" 형태
  /^classical /i,
  /^classical$/i,
];

function isBadName(name) {
  if (!name) return true;
  const n = name.toLowerCase().trim();

  // 나쁜 단어 포함
  for (const bad of BAD_WORDS) {
    if (n.includes(bad)) return true;
  }

  // 나쁜 패턴 매칭
  for (const pattern of BAD_PATTERNS) {
    if (pattern.test(name.trim())) return true;
  }

  // 이름이 단어 하나이고 너무 짧음 (실명이 아닐 가능성)
  const words = name.trim().split(/\s+/);
  if (words.length === 1 && name.length <= 3) return true;

  return false;
}

// ── 악기 추출 ───────────────────────────────────
function getInstrument(tags) {
  if (!tags || tags.length === 0) return null;
  const t = tags.map(x => (x.name || '').toLowerCase()).join(' ');

  if (t.includes('mezzo-soprano') || t.includes('mezzo soprano')) return '메조소프라노';
  if (t.includes('countertenor')) return '카운터테너';
  if (t.includes('contralto') || t.includes('alto')) return '알토';
  if (t.includes('soprano')) return '소프라노';
  if (t.includes('tenor')) return '테너';
  if (t.includes('baritone')) return '바리톤';
  if (t.includes('bass') && (t.includes('opera') || t.includes('voice') || t.includes('singer'))) return '베이스';
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
  if (t.includes('harpist') || t.includes('harp')) return '하프';
  if (t.includes('organist') || t.includes('organ')) return '오르간';
  if (t.includes('harpsichord')) return '하프시코드';
  if (t.includes('percussionist') || t.includes('percussion')) return '타악기';
  if (t.includes('singer') || t.includes('vocalist') || t.includes('voice')) return '성악';
  return null;
}

// ── 국가 코드 → 한국어 ──────────────────────────
function getCountry(area, country) {
  const code = country || area?.['iso-3166-1-codes']?.[0] || '';
  const map = {
    'KR':'대한민국','US':'미국','GB':'영국','DE':'독일',
    'FR':'프랑스','IT':'이탈리아','AT':'오스트리아','RU':'러시아',
    'JP':'일본','CN':'중국','PL':'폴란드','ES':'스페인',
    'NL':'네덜란드','AR':'아르헨티나','AU':'호주','CA':'캐나다',
    'CZ':'체코','HU':'헝가리','RO':'루마니아','FI':'핀란드',
    'NO':'노르웨이','SE':'스웨덴','DK':'덴마크','CH':'스위스',
    'BE':'벨기에','UA':'우크라이나','IL':'이스라엘','GR':'그리스',
    'PT':'포르투갈','BR':'브라질','MX':'멕시코','LV':'라트비아',
    'EE':'에스토니아','LT':'리투아니아','SK':'슬로바키아',
    'GE':'조지아','AM':'아르메니아','BG':'불가리아',
  };
  return map[code] || null;
}

function makeKey(name) {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c').replace(/[ß]/g, 'ss')
    .replace(/[ø]/g, 'o').replace(/[æ]/g, 'ae')
    .replace(/[^a-z0-9\s]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
    .slice(0, 60);
}

async function fetchMusicians() {
  const musicians = [];
  const seen = new Set();

  // 쿼리 앞에 "classical"을 붙여서 클래식 음악가 위주로 검색
  const queries = [
    { q: 'classical pianist',      label: '피아니스트'      },
    { q: 'classical violinist',    label: '바이올리니스트'   },
    { q: 'classical cellist',      label: '첼리스트'        },
    { q: 'classical conductor',    label: '지휘자'          },
    { q: 'opera soprano',          label: '소프라노'        },
    { q: 'opera tenor',            label: '테너'            },
    { q: 'opera baritone',         label: '바리톤'          },
    { q: 'opera mezzo-soprano',    label: '메조소프라노'     },
    { q: 'classical flutist',      label: '플루티스트'      },
    { q: 'classical violist',      label: '비올리스트'      },
    { q: 'classical oboist',       label: '오보이스트'      },
    { q: 'classical clarinetist',  label: '클라리넷'        },
    { q: 'classical organist',     label: '오르가니스트'    },
    { q: 'classical harpist',      label: '하프이스트'      },
  ];

  for (const { q, label } of queries) {
    if (musicians.length >= 155) break;
    console.log(`\n🔍 [${label}] 검색 중... (현재 ${musicians.length}명)`);

    for (let offset = 0; offset < 75; offset += 25) {
      if (musicians.length >= 155) break;

      const url = [
        'https://musicbrainz.org/ws/2/artist',
        `?query=${encodeURIComponent(q)}`,
        `&limit=25&offset=${offset}`,
        '&fmt=json',
        '&inc=tags',
      ].join('');

      try {
        const res = await fetchJSON(url);

        if (!res.body || res.body.error) {
          console.log(`  API 오류: ${res.body?.error || '알 수 없는 오류'}`);
          break;
        }

        const artists = res.body.artists || [];
        console.log(`  offset ${offset}: ${artists.length}명 응답`);
        if (artists.length === 0) break;

        for (const artist of artists) {
          if (musicians.length >= 155) break;
          if (seen.has(artist.id)) continue;
          if (!artist.name) continue;

          // score 50 미만 제외 (이전보다 기준 높임)
          if ((artist.score || 0) < 50) continue;

          // 개인(Person)이 아닌 건 제외
          if (artist.type && artist.type !== 'Person') continue;

          // ✅ 사망한 음악가 제외
          if (artist['life-span']?.ended === true) {
            console.log(`  [필터] ${artist.name} → 사망, 제외`);
            continue;
          }

          // ✅ 이름 필터링 — 엉뚱한 이름 제외
          if (isBadName(artist.name)) {
            console.log(`  [필터] ${artist.name} → 제외`);
            continue;
          }

          seen.add(artist.id);

          const instrument = getInstrument(artist.tags);
          const country = getCountry(artist.area, artist.country);
          const officialUrl = artist.relations?.find(
            r => r.type === 'official homepage'
          )?.url?.resource || null;

          musicians.push({
            name: artist.name,
            name_ko: null,
            bio: artist.disambiguation || null,
            instrument,
            nationality: country,
            photo_url: null,
            official_site: officialUrl,
            scraper_key: makeKey(artist.name),
            mb_id: artist.id,
          });

          console.log(`  [${musicians.length}] ${artist.name} | ${instrument || '악기불명'} | ${country || '국적불명'}`);
        }

        await sleep(1200);

      } catch (err) {
        console.error(`  ⚠ 오류: ${err.message}`);
        await sleep(3000);
      }
    }
  }

  const result = musicians.slice(0, 150);
  fs.writeFileSync('./musicians_data.json', JSON.stringify(result, null, 2));
  console.log(`\n✅ 완료! ${result.length}명 저장 → musicians_data.json`);
}

fetchMusicians().catch(console.error);