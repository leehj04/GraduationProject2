const express = require('express');
const { getDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/:concertId  — 공연 후기 목록
router.get('/:concertId', (req, res) => {
  try {
    const db = getDB();
    const reviews = db.prepare(`
      SELECT r.*, u.name as author_name, u.nationality as author_nationality
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.concert_id = ?
      ORDER BY r.created_at DESC
    `).all(req.params.concertId);

    // 평균 별점 계산
    const avg = reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    res.json({ reviews, avgRating: avg ? Number(avg) : null, count: reviews.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// GET /api/reviews/:concertId/mine  — 내가 쓴 후기 확인
router.get('/:concertId/mine', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const review = db.prepare(`
      SELECT * FROM reviews WHERE concert_id = ? AND user_id = ?
    `).get(req.params.concertId, req.user.id);
    res.json(review || null);
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// POST /api/reviews/:concertId  — 후기 작성 (인증 필요)
router.post('/:concertId', authenticateToken, (req, res) => {
  const { rating, content } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: '별점은 1~5 사이여야 합니다.' });
  }

  if (content && content.length > 500) {
    return res.status(400).json({ error: '후기는 500자 이내로 작성해주세요.' });
  }

  try {
    const db = getDB();

    // 공연 존재 확인
    const concert = db.prepare('SELECT id FROM concerts WHERE id = ?').get(req.params.concertId);
    if (!concert) return res.status(404).json({ error: '공연을 찾을 수 없습니다.' });

    // 이미 작성한 후기 있으면 수정
    const existing = db.prepare(
      'SELECT id FROM reviews WHERE concert_id = ? AND user_id = ?'
    ).get(req.params.concertId, req.user.id);

    if (existing) {
      db.prepare(`
        UPDATE reviews SET rating = ?, content = ? WHERE id = ?
      `).run(rating, content || null, existing.id);
    } else {
      db.prepare(`
        INSERT INTO reviews (concert_id, user_id, rating, content)
        VALUES (?, ?, ?, ?)
      `).run(req.params.concertId, req.user.id, rating, content || null);
    }

    // 업데이트된 후기 반환
    const saved = db.prepare(`
      SELECT r.*, u.name as author_name, u.nationality as author_nationality
      FROM reviews r JOIN users u ON r.user_id = u.id
      WHERE r.concert_id = ? AND r.user_id = ?
    `).get(req.params.concertId, req.user.id);

    res.status(existing ? 200 : 201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// DELETE /api/reviews/:concertId  — 내 후기 삭제
router.delete('/:concertId', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const result = db.prepare(
      'DELETE FROM reviews WHERE concert_id = ? AND user_id = ?'
    ).run(req.params.concertId, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '삭제할 후기가 없습니다.' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;
