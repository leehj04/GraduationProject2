/**
 * routes/travel.js
 *
 * 기존 routes/concerts.js, musicians.js 안 건드리고
 * 새 엔드포인트만 추가
 *
 * GET /api/travel/search
 *   ?startDate=2026-07-01&endDate=2026-07-31&country=France
 *   → 해당 기간, 나라의 콘서트 목록 반환
 *
 * GET /api/musicians/search
 *   ?q=임윤찬
 *   → 한국어/영어 이름으로 음악가 검색 (부분 일치)
 */

const express = require('express');
const { getDB } = require('../db');
const router = express.Router();

// ─── 여행 검색: 기간 + 나라 ────────────────────────────────
// GET /api/travel/search?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&country=France
router.get('/search', (req, res) => {
  try {
    const db = getDB();
    const { startDate, endDate, country } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: '날짜를 입력해주세요 (startDate, endDate)' });
    }

    // 나라 필터 (선택)
    let sql = `
      SELECT
        c.*,
        m.name        AS musician_name,
        m.name_ko     AS musician_name_ko,
        m.instrument  AS musician_instrument,
        m.photo_url   AS musician_photo
      FROM concerts c
      JOIN musicians m ON m.id = c.musician_id
      WHERE c.concert_date BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];

    if (country && country !== '전체') {
      sql += ` AND c.venue_country LIKE ?`;
      params.push(`%${country}%`);
    }

    sql += ` ORDER BY c.concert_date ASC`;

    const concerts = db.prepare(sql).all(...params);

    // 나라 목록도 함께 반환 (검색 UI 드롭다운용)
    res.json({
      total: concerts.length,
      concerts,
    });
  } catch (err) {
    console.error('Travel search error:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// ─── 나라 목록 ─────────────────────────────────────────────
// GET /api/travel/countries
router.get('/countries', (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`
      SELECT DISTINCT venue_country
      FROM concerts
      WHERE venue_country IS NOT NULL AND venue_country != ''
      ORDER BY venue_country ASC
    `).all();
    res.json(rows.map(r => r.venue_country));
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// GET /api/travel/transit?venueLat=48.8&venueLng=2.3&venueName=Salle Pleyel
// 공연장 대중교통 정보 (Google Directions API)
router.get('/transit', async (req, res) => {
  try {
    const { venueLat, venueLng, venueName } = req.query;
    if (!venueLat || !venueLng) {
      return res.status(400).json({ error: 'venueLat, venueLng가 필요합니다.' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API 키가 설정되지 않았습니다.' });
    }

    const axios = require('axios');
    const destination = `${venueLat},${venueLng}`;

    // 1) Places API로 공연장 주변 지하철/버스 정류장 검색
    const placesRes = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        location: destination,
        radius: 800,
        type: 'transit_station',
        key: apiKey,
        language: 'ko'
      }
    });

    const stations = (placesRes.data.results || []).slice(0, 5).map(p => {
      const R = 6371000;
      const dLat = (p.geometry.location.lat - parseFloat(venueLat)) * Math.PI / 180;
      const dLng = (p.geometry.location.lng - parseFloat(venueLng)) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 +
        Math.cos(parseFloat(venueLat)*Math.PI/180) *
        Math.cos(p.geometry.location.lat*Math.PI/180) *
        Math.sin(dLng/2)**2;
      const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      return {
        name: p.name,
        distance_m: dist,
        types: p.types,
        place_id: p.place_id
      };
    });

    // 2) 버스 정류장도 따로 검색
    const busRes = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        location: destination,
        radius: 400,
        type: 'bus_station',
        key: apiKey,
        language: 'ko'
      }
    });

    const busStops = (busRes.data.results || []).slice(0, 3).map(p => {
      const R = 6371000;
      const dLat = (p.geometry.location.lat - parseFloat(venueLat)) * Math.PI / 180;
      const dLng = (p.geometry.location.lng - parseFloat(venueLng)) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 +
        Math.cos(parseFloat(venueLat)*Math.PI/180) *
        Math.cos(p.geometry.location.lat*Math.PI/180) *
        Math.sin(dLng/2)**2;
      const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      return {
        name: p.name,
        distance_m: dist,
        types: p.types,
        place_id: p.place_id
      };
    });

    res.json({
      venue_name: venueName,
      transit_stations: stations,
      bus_stops: busStops
    });

  } catch (err) {
    console.error('Transit info error:', err);
    res.status(500).json({ error: '대중교통 정보를 불러올 수 없습니다.' });
  }
});

module.exports = router;
