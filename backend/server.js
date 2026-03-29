require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { initDB, getDB } = require('./db');
const authRoutes          = require('./routes/auth');
const musicianRoutes      = require('./routes/musicians');
const concertRoutes       = require('./routes/concerts');
const nearbyRoutes        = require('./routes/nearby');
const companionRoutes     = require('./routes/companions');
const favoritesRoutes     = require('./routes/favorites');
const recommendationsRoutes = require('./routes/recommendations');
const notificationsRoutes = require('./routes/notifications');
const reviewsRoutes       = require('./routes/reviews');
const shareRoutes         = require('./routes/share');
const { scrapeAll }       = require('./scrapers/index');
const { sendNotificationEmail } = require('./utils/email');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

initDB();

// Routes
app.use('/api/auth',            authRoutes);
app.use('/api/musicians',       musicianRoutes);
app.use('/api/concerts',        concertRoutes);
app.use('/api/nearby',          nearbyRoutes);
app.use('/api/companions',      companionRoutes);
app.use('/api/favorites',       favoritesRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/notifications',   notificationsRoutes);
app.use('/api/reviews',         reviewsRoutes);
app.use('/api/share',           shareRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.post('/api/admin/scrape', async (req, res) => {
  try {
    res.json({ message: 'Scraping started in background' });
    await scrapeAll();
  } catch (err) {
    console.error('Manual scrape failed:', err);
  }
});

// ── 알림 발송 함수 ─────────────────────────────
async function sendPendingNotifications() {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];

  // 오늘 발송해야 할 알림 조회
  const pending = db.prepare(`
    SELECT n.*, u.email, u.name as user_name,
           c.venue_name, c.venue_address, c.venue_city, c.venue_country,
           c.concert_date, c.concert_time, c.program, c.ticket_url,
           c.venue_photo_url,
           m.name as musician_name, m.name_ko as musician_name_ko
    FROM notifications n
    JOIN users u ON n.user_id = u.id
    JOIN concerts c ON n.concert_id = c.id
    JOIN musicians m ON c.musician_id = m.id
    WHERE n.notify_date = ? AND n.sent = 0
  `).all(today);

  if (pending.length === 0) {
    console.log('[Notifications] 오늘 발송할 알림 없음');
    return;
  }

  console.log(`[Notifications] ${pending.length}개 알림 발송 시작...`);

  for (const n of pending) {
    const concert = {
      ...n,
      program: n.program ? JSON.parse(n.program) : [],
    };

    const sent = await sendNotificationEmail({
      to: n.email,
      userName: n.user_name,
      concert,
      daysLeft: n.notify_days,
    });

    if (sent) {
      db.prepare('UPDATE notifications SET sent = 1 WHERE id = ?').run(n.id);
    }
  }

  console.log(`[Notifications] 알림 발송 완료`);
}

// 매일 새벽 3시 — 스크래핑
cron.schedule('0 3 * * *', async () => {
  console.log('[CRON] 스크래핑 시작...');
  try { await scrapeAll(); } catch (err) { console.error('[CRON] 스크래핑 실패:', err); }
});

// 매일 오전 9시 — 알림 발송
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] 알림 발송 시작...');
  try { await sendPendingNotifications(); } catch (err) { console.error('[CRON] 알림 발송 실패:', err); }
});

app.listen(PORT, async () => {
  console.log(`🎵 Concert Tour Tracker backend running on port ${PORT}`);
  const db = getDB();
  const count = db.prepare('SELECT COUNT(*) as c FROM concerts').get();
  if (count.c === 0) {
    console.log('초기 데이터 없음. 시드 데이터 로딩...');
    await scrapeAll().catch(console.error);
  } else {
    console.log(`DB에 ${count.c}개 공연 로드됨`);
  }
});
