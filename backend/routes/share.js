const express = require('express');
const { getDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// POST /api/share  — 공유 카드 토큰 생성
router.post('/', authenticateToken, (req, res) => {
  const { musician_id } = req.body;
  if (!musician_id) return res.status(400).json({ error: 'musician_id가 필요합니다.' });

  try {
    const db = getDB();
    const musician = db.prepare('SELECT * FROM musicians WHERE id = ?').get(musician_id);
    if (!musician) return res.status(404).json({ error: '연주자를 찾을 수 없습니다.' });

    const token = uuidv4();
    db.prepare(`
      INSERT INTO share_cards (musician_id, user_id, token)
      VALUES (?, ?, ?)
    `).run(musician_id, req.user.id, token);

    res.json({
      token,
      share_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${token}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// GET /api/share/:token  — 공유 카드 데이터 조회 (인증 불필요 — 공개)
router.get('/:token', (req, res) => {
  try {
    const db = getDB();

    const card = db.prepare(`
      SELECT sc.*, m.name, m.name_ko, m.bio, m.photo_url, m.scraper_key
      FROM share_cards sc
      JOIN musicians m ON sc.musician_id = m.id
      WHERE sc.token = ?
    `).get(req.params.token);

    if (!card) return res.status(404).json({ error: '공유 링크를 찾을 수 없습니다.' });

    // 앞으로 6개월 공연 가져오기
    const now = new Date().toISOString().split('T')[0];
    const end = new Date();
    end.setMonth(end.getMonth() + 6);
    const endStr = end.toISOString().split('T')[0];

    const concerts = db.prepare(`
      SELECT id, venue_name, venue_city, venue_country, venue_lat, venue_lng,
             concert_date, concert_time, program
      FROM concerts
      WHERE musician_id = ? AND concert_date >= ? AND concert_date <= ?
      ORDER BY concert_date ASC
    `).all(card.musician_id, now, endStr).map(c => ({
      ...c,
      program: c.program ? JSON.parse(c.program) : []
    }));

    res.json({
      musician: {
        id: card.musician_id,
        name: card.name,
        name_ko: card.name_ko,
        photo_url: card.photo_url,
        scraper_key: card.scraper_key,
      },
      concerts,
      created_at: card.created_at,
      token: card.token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;
