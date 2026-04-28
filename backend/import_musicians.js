/**
 * musicians_data.json을 DB에 삽입
 * 실행: node import_musicians.js (backend 폴더에서)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, 'concert_tracker.db'));
try { db.exec('ALTER TABLE musicians ADD COLUMN instrument TEXT'); } catch {}
try { db.exec('ALTER TABLE musicians ADD COLUMN nationality TEXT'); } catch {}

const musicians = JSON.parse(fs.readFileSync('./musicians_data.json', 'utf8'));

const insert = db.prepare(`
  INSERT OR IGNORE INTO musicians 
  (name, name_ko, bio, photo_url, official_site, scraper_key, instrument, nationality)
  VALUES (@name, @name_ko, @bio, @photo_url, @official_site, @scraper_key, @instrument, @nationality)
`);

// instrument, nationality 컬럼이 없으면 추가
try {
  db.exec(`ALTER TABLE musicians ADD COLUMN instrument TEXT`);
  console.log('instrument 컬럼 추가됨');
} catch {}
try {
  db.exec(`ALTER TABLE musicians ADD COLUMN nationality TEXT`);
  console.log('nationality 컬럼 추가됨');
} catch {}

const insertMany = db.transaction((list) => {
  let count = 0;
  for (const m of list) {
    const result = insert.run({
      name: m.name,
      name_ko: m.name_ko || null,
      bio: m.bio || null,
      photo_url: null,
      official_site: m.official_site || null,
      scraper_key: m.scraper_key,
      instrument: m.instrument || null,
      nationality: m.nationality || null,
    });
    if (result.changes > 0) count++;
  }
  return count;
});

const added = insertMany(musicians);
const total = db.prepare('SELECT COUNT(*) as c FROM musicians').get().c;
console.log(`✅ ${added}명 추가됨. 전체 음악가: ${total}명`);