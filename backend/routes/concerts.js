const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

// GET /api/concerts?musicianId=1&months=6&month=2024-03
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { musicianId, months = 6, month } = req.query;

    if (!musicianId) {
      return res.status(400).json({ error: 'musicianId가 필요합니다.' });
    }

    const now = new Date();
    const fromDate = now.toISOString().split('T')[0];

    // Calculate end date (default 6 months from now)
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + parseInt(months));
    const toDate = endDate.toISOString().split('T')[0];

    let concerts;
    if (month) {
      // Filter by specific month (format: YYYY-MM)
      concerts = db.prepare(`
        SELECT c.*, m.name as musician_name, m.name_ko as musician_name_ko, m.photo_url as musician_photo
        FROM concerts c
        JOIN musicians m ON c.musician_id = m.id
        WHERE c.musician_id = ?
          AND strftime('%Y-%m', c.concert_date) = ?
        ORDER BY c.concert_date ASC
      `).all(musicianId, month);
    } else {
      concerts = db.prepare(`
        SELECT c.*, m.name as musician_name, m.name_ko as musician_name_ko, m.photo_url as musician_photo
        FROM concerts c
        JOIN musicians m ON c.musician_id = m.id
        WHERE c.musician_id = ?
          AND c.concert_date >= ?
          AND c.concert_date <= ?
        ORDER BY c.concert_date ASC
      `).all(musicianId, fromDate, toDate);
    }

    // Parse program JSON
    const parsed = concerts.map(c => ({
      ...c,
      program: c.program ? JSON.parse(c.program) : []
    }));

    res.json(parsed);
  } catch (err) {
    console.error('Get concerts error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/concerts/months/:musicianId - Get available months with concerts
router.get('/months/:musicianId', (req, res) => {
  try {
    const db = getDB();
    const now = new Date();
    const fromDate = now.toISOString().split('T')[0];
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 6);
    const toDate = endDate.toISOString().split('T')[0];

    const months = db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', concert_date) as month, COUNT(*) as count
      FROM concerts
      WHERE musician_id = ?
        AND concert_date >= ?
        AND concert_date <= ?
      GROUP BY month
      ORDER BY month ASC
    `).all(req.params.musicianId, fromDate, toDate);

    res.json(months);
  } catch (err) {
    console.error('Get months error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/concerts/:id - Single concert detail
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const concert = db.prepare(`
      SELECT c.*, m.name as musician_name, m.name_ko as musician_name_ko,
             m.photo_url as musician_photo, m.bio as musician_bio
      FROM concerts c
      JOIN musicians m ON c.musician_id = m.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!concert) return res.status(404).json({ error: '공연을 찾을 수 없습니다.' });

    concert.program = concert.program ? JSON.parse(concert.program) : [];
    res.json(concert);
  } catch (err) {
    console.error('Get concert error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
