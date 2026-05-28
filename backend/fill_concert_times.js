/**
 * fill_concert_times.js
 * 시간 없는 공연을 Ticketmaster API로 찾아서 업데이트
 * 실행: node fill_concert_times.js
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');

const db = new Database(path.join(__dirname, 'concert_tracker.db'));
const TM_KEY = process.env.TICKETMASTER_API_KEY;

if (!TM_KEY) {
  console.error('TICKETMASTER_API_KEY가 .env에 없습니다.');
  process.exit(1);
}

// 시간 포맷 정리 (T19:30:00 → 19:30)
function parseTime(timeStr) {
  if (!timeStr) return null;
  return timeStr.slice(0, 5); // "19:30:00" → "19:30"
}

// Ticketmaster에서 공연 시간 검색
async function findTime(concert) {
  try {
    const res = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
      params: {
        apikey: TM_KEY,
        keyword: concert.venue_name,
        startDateTime: `${concert.concert_date}T00:00:00Z`,
        endDateTime: `${concert.concert_date}T23:59:59Z`,
        city: concert.venue_city,
        size: 5,
      },
      timeout: 8000,
    });

    const events = res.data?._embedded?.events;
    if (!events || events.length === 0) return null;

    // 날짜 맞는 이벤트 찾기
    for (const event of events) {
      const localTime = event.dates?.start?.localTime;
      if (localTime) {
        return parseTime(localTime);
      }
    }
    return null;
  } catch (err) {
    if (err.response?.status === 429) {
      console.log('  Rate limit 대기 중...');
      await new Promise(r => setTimeout(r, 3000));
    }
    return null;
  }
}

async function main() {
  const concerts = db.prepare(`
    SELECT id, venue_name, concert_date, venue_city, venue_country
    FROM concerts
    WHERE concert_time IS NULL
    ORDER BY concert_date ASC
  `).all();

  console.log(`시간 없는 공연 ${concerts.length}개 처리 시작...\n`);

  let updated = 0;
  let notFound = 0;

  for (let i = 0; i < concerts.length; i++) {
    const concert = concerts[i];
    process.stdout.write(`[${i + 1}/${concerts.length}] ${concert.venue_name} (${concert.concert_date}) ... `);

    const time = await findTime(concert);

    if (time) {
      db.prepare('UPDATE concerts SET concert_time = ? WHERE id = ?').run(time, concert.id);
      console.log(`✅ ${time}`);
      updated++;
    } else {
      console.log('❌ 못찾음');
      notFound++;
    }

    // API rate limit 방지 (0.5초 간격)
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n완료! 업데이트: ${updated}개 / 못찾음: ${notFound}개`);
}

main().catch(console.error);
