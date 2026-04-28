const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'classictour_admin';

function adminAuth(req, res, next) {
  const pw = req.headers['x-admin-password'];
  if (pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '관리자 비밀번호가 틀렸습니다.' });
  }
  next();
}

/* ════════════════════════════════════════
   음악가 API
════════════════════════════════════════ */

// 전체 음악가 목록
router.get('/musicians', adminAuth, (req, res) => {
  try {
    const db = getDB();
    const musicians = db.prepare(
      'SELECT * FROM musicians ORDER BY name ASC'
    ).all();
    res.json(musicians);
  } catch {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 음악가 추가
router.post('/musicians', adminAuth, (req, res) => {
  const { name, name_ko, bio, instrument, nationality, official_site, photo_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '이름은 필수입니다.' });

  const scraper_key = name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c').replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9\s]/g, '').trim()
    .replace(/\s+/g, '-').slice(0, 60);

  try {
    const db = getDB();
    try { db.exec('ALTER TABLE musicians ADD COLUMN instrument TEXT'); } catch {}
    try { db.exec('ALTER TABLE musicians ADD COLUMN nationality TEXT'); } catch {}

    const existing = db.prepare('SELECT id FROM musicians WHERE name = ?').get(name.trim());
    if (existing) return res.status(409).json({ error: '이미 등록된 음악가입니다.' });

    const result = db.prepare(`
      INSERT INTO musicians (name, name_ko, bio, photo_url, official_site, scraper_key, instrument, nationality)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(), name_ko?.trim() || null, bio?.trim() || null,
      photo_url?.trim() || null, official_site?.trim() || null,
      scraper_key, instrument?.trim() || null, nationality?.trim() || null,
    );

    res.status(201).json(db.prepare('SELECT * FROM musicians WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 음악가 수정
router.put('/musicians/:id', adminAuth, (req, res) => {
  const { name, name_ko, bio, instrument, nationality, official_site, photo_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '이름은 필수입니다.' });
  try {
    const db = getDB();
    db.prepare(`
      UPDATE musicians SET
        name=?, name_ko=?, bio=?, photo_url=?, official_site=?, instrument=?, nationality=?
      WHERE id=?
    `).run(
      name.trim(), name_ko?.trim() || null, bio?.trim() || null,
      photo_url?.trim() || null, official_site?.trim() || null,
      instrument?.trim() || null, nationality?.trim() || null, req.params.id,
    );
    res.json(db.prepare('SELECT * FROM musicians WHERE id = ?').get(req.params.id));
  } catch {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 음악가 삭제
router.delete('/musicians/:id', adminAuth, (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM musicians WHERE id = ?').run(req.params.id);
    res.json({ message: '삭제됐습니다.' });
  } catch {
    res.status(500).json({ error: '서버 오류' });
  }
});

/* ════════════════════════════════════════
   공연 API
════════════════════════════════════════ */

// 공연 목록 (음악가별 또는 전체)
router.get('/concerts', adminAuth, (req, res) => {
  try {
    const db = getDB();
    const { musicianId } = req.query;
    const query = musicianId
      ? `SELECT c.*, m.name as musician_name, m.name_ko as musician_name_ko
         FROM concerts c JOIN musicians m ON c.musician_id = m.id
         WHERE c.musician_id = ? ORDER BY c.concert_date ASC`
      : `SELECT c.*, m.name as musician_name, m.name_ko as musician_name_ko
         FROM concerts c JOIN musicians m ON c.musician_id = m.id
         ORDER BY c.concert_date ASC`;

    const rows = musicianId
      ? db.prepare(query).all(musicianId)
      : db.prepare(query).all();

    const parsed = rows.map(c => ({
      ...c,
      program: c.program ? JSON.parse(c.program) : [],
    }));
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 공연 추가
router.post('/concerts', adminAuth, (req, res) => {
  const {
    musician_id, title, venue_name, venue_address,
    venue_city, venue_country, concert_date, concert_time,
    program, ticket_url,
  } = req.body;

  if (!musician_id) return res.status(400).json({ error: '음악가를 선택해주세요.' });
  if (!venue_name?.trim()) return res.status(400).json({ error: '공연장 이름은 필수입니다.' });
  if (!concert_date) return res.status(400).json({ error: '날짜는 필수입니다.' });

  try {
    const db = getDB();

    // 주소로 좌표 자동 변환 시도 (Google Geocoding)
    // 없으면 null로 저장
    const programJson = JSON.stringify(
      Array.isArray(program) ? program : (program ? [program] : [])
    );

    const result = db.prepare(`
      INSERT INTO concerts
        (musician_id, title, venue_name, venue_address, venue_city, venue_country,
         venue_lat, venue_lng, concert_date, concert_time, program, ticket_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      musician_id,
      title?.trim() || `${venue_name} 공연`,
      venue_name.trim(),
      venue_address?.trim() || null,
      venue_city?.trim() || null,
      venue_country?.trim() || null,
      req.body.venue_lat ? parseFloat(req.body.venue_lat) : null,
      req.body.venue_lng ? parseFloat(req.body.venue_lng) : null,
      concert_date,
      concert_time?.trim() || null,
      programJson,
      ticket_url?.trim() || null,
    );

    // 좌표가 없고 주소가 있으면 Geocoding 시도
    if (!req.body.venue_lat && venue_address) {
      geocodeAndUpdate(result.lastInsertRowid, venue_address);
    }

    res.status(201).json(
      db.prepare('SELECT * FROM concerts WHERE id = ?').get(result.lastInsertRowid)
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 공연 수정
router.put('/concerts/:id', adminAuth, (req, res) => {
  const {
    musician_id, title, venue_name, venue_address,
    venue_city, venue_country, concert_date, concert_time,
    program, ticket_url, venue_lat, venue_lng,
  } = req.body;

  try {
    const db = getDB();
    const programJson = JSON.stringify(
      Array.isArray(program) ? program : (program ? [program] : [])
    );

    db.prepare(`
      UPDATE concerts SET
        musician_id=?, title=?, venue_name=?, venue_address=?,
        venue_city=?, venue_country=?, venue_lat=?, venue_lng=?,
        concert_date=?, concert_time=?, program=?, ticket_url=?
      WHERE id=?
    `).run(
      musician_id, title?.trim() || null, venue_name?.trim() || null,
      venue_address?.trim() || null, venue_city?.trim() || null,
      venue_country?.trim() || null,
      venue_lat ? parseFloat(venue_lat) : null,
      venue_lng ? parseFloat(venue_lng) : null,
      concert_date, concert_time?.trim() || null,
      programJson, ticket_url?.trim() || null,
      req.params.id,
    );

    res.json(db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 공연 삭제
router.delete('/concerts/:id', adminAuth, (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM concerts WHERE id = ?').run(req.params.id);
    res.json({ message: '삭제됐습니다.' });
  } catch {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 좌표 자동 변환 (백그라운드)
async function geocodeAndUpdate(concertId, address) {
  try {
    const axios = require('axios');
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return;

    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address, key }
    });

    const loc = res.data.results?.[0]?.geometry?.location;
    if (!loc) return;

    const db = getDB();
    db.prepare('UPDATE concerts SET venue_lat=?, venue_lng=? WHERE id=?')
      .run(loc.lat, loc.lng, concertId);

    console.log(`[Geocode] 공연 ${concertId} 좌표 업데이트: ${loc.lat}, ${loc.lng}`);
  } catch (err) {
    console.error('[Geocode] 실패:', err.message);
  }
}

// 수동 스크래핑
router.post('/scrape', adminAuth, async (req, res) => {
  try {
    res.json({ message: '스크래핑 시작됨' });
    const { scrapeAll } = require('../scrapers/index');
    await scrapeAll();
  } catch (err) {
    console.error(err);
  }
});

module.exports = router;