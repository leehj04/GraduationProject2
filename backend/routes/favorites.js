const express = require('express');
const { getDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ── 공연 즐겨찾기 ─────────────────────────────

// GET /api/favorites/concerts  — 내 즐겨찾기 공연 목록
router.get('/concerts', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`
      SELECT c.*, m.name as musician_name, m.name_ko as musician_name_ko,
             m.photo_url as musician_photo, cf.created_at as favorited_at
      FROM concert_favorites cf
      JOIN concerts c ON cf.concert_id = c.id
      JOIN musicians m ON c.musician_id = m.id
      WHERE cf.user_id = ?
      ORDER BY cf.created_at DESC
    `).all(req.user.id);

    const parsed = rows.map(c => ({ ...c, program: c.program ? JSON.parse(c.program) : [] }));
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// POST /api/favorites/concerts/:concertId  — 공연 즐겨찾기 추가
router.post('/concerts/:concertId', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    db.prepare(`
      INSERT OR IGNORE INTO concert_favorites (user_id, concert_id) VALUES (?, ?)
    `).run(req.user.id, req.params.concertId);
    res.json({ favorited: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// DELETE /api/favorites/concerts/:concertId  — 공연 즐겨찾기 해제
router.delete('/concerts/:concertId', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    db.prepare(`
      DELETE FROM concert_favorites WHERE user_id = ? AND concert_id = ?
    `).run(req.user.id, req.params.concertId);
    res.json({ favorited: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// GET /api/favorites/concerts/check/:concertId  — 즐겨찾기 여부 확인
router.get('/concerts/check/:concertId', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const row = db.prepare(`
      SELECT id FROM concert_favorites WHERE user_id = ? AND concert_id = ?
    `).get(req.user.id, req.params.concertId);
    res.json({ favorited: !!row });
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// ── 연주자 즐겨찾기 ───────────────────────────

// GET /api/favorites/musicians  — 내 즐겨찾기 연주자 목록
router.get('/musicians', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`
      SELECT m.*, mf.created_at as favorited_at
      FROM musician_favorites mf
      JOIN musicians m ON mf.musician_id = m.id
      WHERE mf.user_id = ?
      ORDER BY mf.created_at DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// POST /api/favorites/musicians/:musicianId  — 연주자 즐겨찾기 추가
router.post('/musicians/:musicianId', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    db.prepare(`
      INSERT OR IGNORE INTO musician_favorites (user_id, musician_id) VALUES (?, ?)
    `).run(req.user.id, req.params.musicianId);
    res.json({ favorited: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// DELETE /api/favorites/musicians/:musicianId  — 연주자 즐겨찾기 해제
router.delete('/musicians/:musicianId', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    db.prepare(`
      DELETE FROM musician_favorites WHERE user_id = ? AND musician_id = ?
    `).run(req.user.id, req.params.musicianId);
    res.json({ favorited: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// GET /api/favorites/musicians/check/:musicianId
router.get('/musicians/check/:musicianId', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const row = db.prepare(`
      SELECT id FROM musician_favorites WHERE user_id = ? AND musician_id = ?
    `).get(req.user.id, req.params.musicianId);
    res.json({ favorited: !!row });
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// GET /api/favorites/all  — 즐겨찾기 concert_id + musician_id 목록 한번에
router.get('/all', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const concertIds = db.prepare(
      'SELECT concert_id FROM concert_favorites WHERE user_id = ?'
    ).all(req.user.id).map(r => r.concert_id);

    const musicianIds = db.prepare(
      'SELECT musician_id FROM musician_favorites WHERE user_id = ?'
    ).all(req.user.id).map(r => r.musician_id);

    res.json({ concertIds, musicianIds });
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;
