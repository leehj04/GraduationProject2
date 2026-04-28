/**
 * MusicBrainz API로 클래식 음악가 150명 데이터 수집
 * 실행: backend 폴더에서 → node fetch_musicians.js
 * 결과: backend/musicians_data.json 파일 생성 (5~10분 소요)
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
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON 파싱 실패: ' + data.slice(0, 100))); }
      });
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getInstrument(tags) {
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
  if (t.includes('bass')) return '베이스';
  if (t.includes('organ')) return '오르간';
  if (t.includes('harp')) return '하프';
  if (t.includes('clarinet')) return '클라리넷';
  if (t.includes('trumpet')) return '트럼펫';
  if (t.includes('oboe')) return '오보에';
  if (t.includes('horn')) return '호른';
  if (t.includes('trombone')) return '트롬본';
  return null;
}

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

  const queries = [
    { q: 'pianist',             label: '피아니스트'     },
    { q: 'violinist',           label: '바이올리니스트'  },
    { q: 'cellist',             label: '첼리스트'       },
    { q: 'conductor classical', label: '지휘자'         },
    { q: 'soprano opera',       label: '소프라노'       },
    { q: 'tenor opera',         label: '테너'           },
    { q: 'classical piano',     label: '피아니스트2'    },
    { q: 'classical violin',    label: '바이올리니스트2' },
    { q: 'baritone opera',      label: '바리톤'         },
    { q: 'flutist',             label: '플루티스트'     },
    { q: 'mezzo-soprano',       label: '메조소프라노'   },
  ];

  for (const { q, label } of queries) {
    if (musicians.length >= 155) break;
    console.log(`\n🔍 [${label}] 검색 중... (현재 ${musicians.length}명)`);

    for (let offset = 0; offset < 100; offset += 25) {
      if (musicians.length >= 155) break;

      // ✅ type 파라미터 제거 — artist 검색에서는 지원 안 됨
      const url = [
        'https://musicbrainz.org/ws/2/artist',
        `?query=${encodeURIComponent(q)}`,
        `&limit=25&offset=${offset}`,
        '&fmt=json',
      ].join('');

      try {
        const data = await fetchJSON(url);

        if (data.error) {
          console.log(`  API 오류: ${data.error}`);
          break;
        }

        const artists = data.artists || [];
        console.log(`  offset ${offset}: ${artists.length}명 응답`);

        if (artists.length === 0) break;

        for (const artist of artists) {
          if (musicians.length >= 155) break;
          if (seen.has(artist.id)) continue;
          if (!artist.name) continue;

          // score 40 미만 제외
          if ((artist.score || 0) < 40) continue;

          // 사람(person)이 아닌 경우 제외 (그룹, 오케스트라 등)
          if (artist.type && artist.type !== 'Person') continue;

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
            instrument: instrument,
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