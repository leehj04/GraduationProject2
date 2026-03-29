const express = require('express');
const { getDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/companions/:concertId
router.get('/:concertId', (req, res) => {
  try {
    const db = getDB();
    const posts = db.prepare(`
      SELECT cp.*, u.name as author_name, u.age as author_age,
             u.gender as author_gender, u.nationality as author_nationality
      FROM companions cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.concert_id = ?
      ORDER BY cp.created_at DESC
    `).all(req.params.concertId);

    res.json(posts);
  } catch (err) {
    console.error('Get companions error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/companions - Create a companion post (requires auth)
router.post('/', authenticateToken, (req, res) => {
  const { concert_id, title, content } = req.body;
  const user_id = req.user.id;

  if (!concert_id || !title || !content) {
    return res.status(400).json({ error: 'concert_id, 제목, 본문은 필수입니다.' });
  }

  if (title.length > 100) {
    return res.status(400).json({ error: '제목은 100자 이내로 작성해주세요.' });
  }

  try {
    const db = getDB();

    // Verify concert exists
    const concert = db.prepare('SELECT id FROM concerts WHERE id = ?').get(concert_id);
    if (!concert) {
      return res.status(404).json({ error: '공연을 찾을 수 없습니다.' });
    }

    const result = db.prepare(`
      INSERT INTO companions (concert_id, user_id, title, content)
      VALUES (?, ?, ?, ?)
    `).run(concert_id, user_id, title, content);

    const newPost = db.prepare(`
      SELECT cp.*, u.name as author_name, u.age as author_age,
             u.gender as author_gender, u.nationality as author_nationality
      FROM companions cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newPost);
  } catch (err) {
    console.error('Create companion post error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /api/companions/:id (only post author can delete)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const post = db.prepare('SELECT * FROM companions WHERE id = ?').get(req.params.id);

    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: '본인이 작성한 글만 삭제할 수 있습니다.' });
    }

    db.prepare('DELETE FROM companions WHERE id = ?').run(req.params.id);
    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    console.error('Delete companion post error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
