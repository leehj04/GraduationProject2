const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

// GET /api/musicians
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const musicians = db.prepare('SELECT * FROM musicians ORDER BY name').all();
    res.json(musicians);
  } catch (err) {
    console.error('Get musicians error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/musicians/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const musician = db.prepare('SELECT * FROM musicians WHERE id = ?').get(req.params.id);
    if (!musician) return res.status(404).json({ error: '음악가를 찾을 수 없습니다.' });
    res.json(musician);
  } catch (err) {
    console.error('Get musician error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
