const express = require('express');
const { getDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const VALID_DAYS = [1, 3, 7]; // 허용되는 사전 알림 일수

// GET /api/notifications  — 내 알림 설정 목록
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`
      SELECT n.*, c.venue_name, c.concert_date, c.concert_time,
             c.venue_city, c.venue_country,
             m.name as musician_name, m.name_ko as musician_name_ko
      FROM notifications n
      JOIN concerts c ON n.concert_id = c.id
      JOIN musicians m ON c.musician_id = m.id
      WHERE n.user_id = ?
      ORDER BY c.concert_date ASC, n.notify_days DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// GET /api/notifications/concert/:concertId  — 특정 공연의 내 알림 설정
router.get('/concert/:concertId', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`
      SELECT notify_days, sent FROM notifications
      WHERE user_id = ? AND concert_id = ?
    `).all(req.user.id, req.params.concertId);
    // 활성화된 notify_days 배열로 반환
    const activeDays = rows.map(r => r.notify_days);
    res.json({ activeDays });
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// POST /api/notifications  — 알림 설정 추가
router.post('/', authenticateToken, (req, res) => {
  const { concert_id, notify_days } = req.body;

  if (!concert_id || !notify_days) {
    return res.status(400).json({ error: 'concert_id와 notify_days가 필요합니다.' });
  }

  if (!VALID_DAYS.includes(Number(notify_days))) {
    return res.status(400).json({ error: 'notify_days는 1, 3, 7 중 하나여야 합니다.' });
  }

  try {
    const db = getDB();

    // 공연 날짜 가져오기
    const concert = db.prepare('SELECT concert_date FROM concerts WHERE id = ?').get(concert_id);
    if (!concert) return res.status(404).json({ error: '공연을 찾을 수 없습니다.' });

    // 알림 발송 날짜 계산
    const concertDate = new Date(concert.concert_date + 'T00:00:00');
    const notifyDate = new Date(concertDate);
    notifyDate.setDate(notifyDate.getDate() - Number(notify_days));
    const notifyDateStr = notifyDate.toISOString().split('T')[0];

    // 이미 지난 날짜면 거부
    const today = new Date().toISOString().split('T')[0];
    if (notifyDateStr < today) {
      return res.status(400).json({ error: '알림 날짜가 이미 지났습니다.' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO notifications (user_id, concert_id, notify_days, notify_date)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, concert_id, Number(notify_days), notifyDateStr);

    res.json({ success: true, notify_date: notifyDateStr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// DELETE /api/notifications  — 알림 설정 해제
router.delete('/', authenticateToken, (req, res) => {
  const { concert_id, notify_days } = req.body;

  if (!concert_id || !notify_days) {
    return res.status(400).json({ error: 'concert_id와 notify_days가 필요합니다.' });
  }

  try {
    const db = getDB();
    db.prepare(`
      DELETE FROM notifications WHERE user_id = ? AND concert_id = ? AND notify_days = ?
    `).run(req.user.id, concert_id, Number(notify_days));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;
