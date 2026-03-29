const express = require('express');
const { getDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * 점수 계산 방식 (공연 추천)
 *
 * [A] 비슷한 유저(나이±10 / 성별 / 국적)의 즐겨찾기       → +1점
 * [B] 비슷한 유저의 별점 4~5점 리뷰                       → +2점
 * [C] 내가 별점 4점 이상 준 연주자의 앞으로 공연           → +3점  ★ 가장 중요
 * [D] 내가 별점 높게 준 공연과 같은 곡목 포함 공연         → +2점
 *
 * 점수 계산 방식 (연주자 추천)
 *
 * [A] 비슷한 유저의 즐겨찾기                               → +1점
 * [B] 비슷한 유저의 해당 연주자 공연 평균 별점(4점 이상)   → +2점
 * [C] 내가 별점 높게 준 연주자와 같은 국적/악기군          → +1점  (확장 여지)
 *
 * 이미 내가 즐겨찾기했거나 직접 리뷰 남긴 연주자는 제외
 */

// ── 공연 추천 ──────────────────────────────────────────────────
router.get('/concerts', authenticateToken, async (req, res) => {
  try {
    const db   = getDB();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const myAge = user.age || 25;
    const ageLow  = myAge - 10;
    const ageHigh = myAge + 10;

    // ── 1. 내가 이미 즐겨찾기한 공연 ID (추천 제외용)
    const myFavConcertIds = new Set(
      db.prepare('SELECT concert_id FROM concert_favorites WHERE user_id = ?')
        .all(user.id).map(r => r.concert_id)
    );

    // ── 2. 내가 별점 4점 이상 준 공연 → 연주자 ID + 곡목 추출
    const myHighRatedConcerts = db.prepare(`
      SELECT c.id, c.musician_id, c.program
      FROM reviews r
      JOIN concerts c ON r.concert_id = c.id
      WHERE r.user_id = ? AND r.rating >= 4
    `).all(user.id);

    const myHighRatedMusicianIds = new Set(
      myHighRatedConcerts.map(c => c.musician_id)
    );

    // 내가 좋아한 공연에 등장한 곡목 키워드 수집 (작곡가 이름 기반)
    const likedProgramKeywords = new Set();
    for (const c of myHighRatedConcerts) {
      if (!c.program) continue;
      try {
        const pieces = JSON.parse(c.program);
        for (const piece of pieces) {
          // "Beethoven - Sonata" → "Beethoven" 추출
          const composer = piece.split(/[-–:]/)[0].trim().toLowerCase();
          if (composer.length > 2) likedProgramKeywords.add(composer);
        }
      } catch {}
    }

    // ── 3. 앞으로 공연 전체 목록 (아직 안 지난 것만)
    const futureConcerts = db.prepare(`
      SELECT c.*, m.name as musician_name, m.name_ko as musician_name_ko,
             m.photo_url as musician_photo
      FROM concerts c
      JOIN musicians m ON c.musician_id = m.id
      WHERE c.concert_date >= date('now')
    `).all().map(c => ({
      ...c,
      program: c.program ? JSON.parse(c.program) : []
    }));

    // ── 4. 비슷한 유저들의 즐겨찾기 카운트 (concert_id → count)
    const similarFavCount = {};
    db.prepare(`
      SELECT cf.concert_id, COUNT(*) as cnt
      FROM concert_favorites cf
      JOIN users u ON cf.user_id = u.id
      WHERE cf.user_id != ?
        AND (
          (u.age BETWEEN ? AND ?)
          OR u.gender = ?
          OR u.nationality = ?
        )
      GROUP BY cf.concert_id
    `).all(user.id, ageLow, ageHigh, user.gender || '__', user.nationality || '__')
      .forEach(r => { similarFavCount[r.concert_id] = r.cnt; });

    // ── 5. 비슷한 유저들의 별점 4~5점 카운트 (concert_id → count)
    const similarHighReviewCount = {};
    db.prepare(`
      SELECT r.concert_id, COUNT(*) as cnt
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.user_id != ?
        AND r.rating >= 4
        AND (
          (u.age BETWEEN ? AND ?)
          OR u.gender = ?
          OR u.nationality = ?
        )
      GROUP BY r.concert_id
    `).all(user.id, ageLow, ageHigh, user.gender || '__', user.nationality || '__')
      .forEach(r => { similarHighReviewCount[r.concert_id] = r.cnt; });

    // ── 6. 각 공연에 점수 매기기
    const scored = futureConcerts
      .filter(c => !myFavConcertIds.has(c.id)) // 이미 즐겨찾기한 공연 제외
      .map(concert => {
        let score = 0;
        const reasons = [];

        // [A] 비슷한 유저 즐겨찾기
        const favCnt = similarFavCount[concert.id] || 0;
        if (favCnt > 0) {
          score += favCnt * 1;
          reasons.push(`비슷한 취향의 ${favCnt}명이 즐겨찾기`);
        }

        // [B] 비슷한 유저 별점 4~5점
        const reviewCnt = similarHighReviewCount[concert.id] || 0;
        if (reviewCnt > 0) {
          score += reviewCnt * 2;
          reasons.push(`비슷한 취향의 ${reviewCnt}명이 좋게 평가`);
        }

        // [C] 내가 별점 높게 준 연주자의 공연 ← 가장 강한 신호
        if (myHighRatedMusicianIds.has(concert.musician_id)) {
          score += 3;
          reasons.push(`내가 좋아했던 ${concert.musician_name_ko || concert.musician_name}의 공연`);
        }

        // [D] 내가 좋아했던 공연과 같은 곡목 포함
        if (likedProgramKeywords.size > 0 && concert.program.length > 0) {
          const matchedComposers = [];
          for (const piece of concert.program) {
            const composer = piece.split(/[-–:]/)[0].trim().toLowerCase();
            if (likedProgramKeywords.has(composer)) {
              matchedComposers.push(piece.split(/[-–:]/)[0].trim());
            }
          }
          if (matchedComposers.length > 0) {
            score += matchedComposers.length * 2;
            const unique = [...new Set(matchedComposers)].slice(0, 2).join(', ');
            reasons.push(`내가 좋아했던 ${unique} 곡 포함`);
          }
        }

        // [E] 국적 보너스 (같은 나라 공연)
        const countryMatch = checkCountryMatch(user.nationality, concert.venue_country);
        if (countryMatch) {
          score += 1;
          reasons.push('내 국가에서 열리는 공연');
        }

        return {
          ...concert,
          score,
          reason: reasons.length > 0
            ? reasons.slice(0, 2).join(' · ')  // 최대 2개 이유만 표시
            : '지금 주목받는 공연'
        };
      })
      .filter(c => c.score > 0 || futureConcerts.length <= 10) // 점수 없으면 fallback
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // 점수 있는 공연이 부족하면 전체 인기순으로 채우기
    if (scored.length < 5) {
      const extraIds = new Set([...myFavConcertIds, ...scored.map(c => c.id)]);
      const extras = futureConcerts
        .filter(c => !extraIds.has(c.id))
        .sort((a, b) => (similarFavCount[b.id] || 0) - (similarFavCount[a.id] || 0))
        .slice(0, 10 - scored.length)
        .map(c => ({ ...c, score: 0, reason: '지금 주목받는 공연' }));
      scored.push(...extras);
    }

    res.json(scored);
  } catch (err) {
    console.error('Concert recommendation error:', err);
    res.status(500).json({ error: '추천을 불러오는데 실패했습니다.' });
  }
});

// ── 연주자 추천 ────────────────────────────────────────────────
router.get('/musicians', authenticateToken, async (req, res) => {
  try {
    const db   = getDB();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const myAge  = user.age || 25;
    const ageLow  = myAge - 10;
    const ageHigh = myAge + 10;

    // ── 1. 내가 이미 즐겨찾기하거나 직접 리뷰 남긴 연주자 ID (추천 제외)
    const myFavMusicianIds = new Set(
      db.prepare('SELECT musician_id FROM musician_favorites WHERE user_id = ?')
        .all(user.id).map(r => r.musician_id)
    );

    // 내가 리뷰 남긴 공연의 연주자도 "이미 아는 연주자"로 간주
    const myReviewedMusicianIds = new Set(
      db.prepare(`
        SELECT DISTINCT c.musician_id
        FROM reviews r
        JOIN concerts c ON r.concert_id = c.id
        WHERE r.user_id = ?
      `).all(user.id).map(r => r.musician_id)
    );

    // ── 2. 전체 연주자 목록
    const allMusicians = db.prepare('SELECT * FROM musicians').all();

    // ── 3. 비슷한 유저들의 연주자 즐겨찾기 카운트
    const similarMusicianFavCount = {};
    db.prepare(`
      SELECT mf.musician_id, COUNT(*) as cnt
      FROM musician_favorites mf
      JOIN users u ON mf.user_id = u.id
      WHERE mf.user_id != ?
        AND (
          (u.age BETWEEN ? AND ?)
          OR u.gender = ?
          OR u.nationality = ?
        )
      GROUP BY mf.musician_id
    `).all(user.id, ageLow, ageHigh, user.gender || '__', user.nationality || '__')
      .forEach(r => { similarMusicianFavCount[r.musician_id] = r.cnt; });

    // ── 4. 비슷한 유저들이 해당 연주자 공연에 남긴 평균 별점
    const similarMusicianAvgRating = {};
    db.prepare(`
      SELECT c.musician_id,
             AVG(r.rating) as avg_rating,
             COUNT(*) as review_cnt
      FROM reviews r
      JOIN concerts c ON r.concert_id = c.id
      JOIN users u ON r.user_id = u.id
      WHERE r.user_id != ?
        AND (
          (u.age BETWEEN ? AND ?)
          OR u.gender = ?
          OR u.nationality = ?
        )
      GROUP BY c.musician_id
    `).all(user.id, ageLow, ageHigh, user.gender || '__', user.nationality || '__')
      .forEach(r => {
        similarMusicianAvgRating[r.musician_id] = {
          avg: Math.round(r.avg_rating * 10) / 10,
          cnt: r.review_cnt
        };
      });

    // ── 5. 내가 별점 높게 준 공연의 연주자 (같은 연주자 다른 공연 추천 근거)
    const myHighRatedMusicianIds = new Set(
      db.prepare(`
        SELECT DISTINCT c.musician_id
        FROM reviews r
        JOIN concerts c ON r.concert_id = c.id
        WHERE r.user_id = ? AND r.rating >= 4
      `).all(user.id).map(r => r.musician_id)
    );

    // ── 6. 점수 계산
    const scored = allMusicians
      .filter(m =>
        !myFavMusicianIds.has(m.id) &&     // 이미 즐겨찾기한 연주자 제외
        !myReviewedMusicianIds.has(m.id)   // 이미 리뷰 남긴 연주자 제외 (이미 알고 있음)
      )
      .map(musician => {
        let score = 0;
        const reasons = [];

        // [A] 비슷한 유저 즐겨찾기
        const favCnt = similarMusicianFavCount[musician.id] || 0;
        if (favCnt > 0) {
          score += favCnt * 1;
          reasons.push(`비슷한 취향의 ${favCnt}명이 즐겨찾기`);
        }

        // [B] 비슷한 유저들의 해당 연주자 공연 평균 별점
        const ratingInfo = similarMusicianAvgRating[musician.id];
        if (ratingInfo && ratingInfo.avg >= 4.0) {
          score += ratingInfo.cnt * 2;
          reasons.push(`비슷한 취향 유저 평균 ★${ratingInfo.avg}`);
        }

        // [C] 내가 높은 별점 줬던 연주자 — 이 경우는 제외 목록에 이미 있으나
        //     해당 연주자가 아닌 "같은 계열" 발굴은 현재 DB 구조상 생략
        //     (악기/장르 필드가 없으므로)

        return {
          ...musician,
          score,
          reason: reasons.length > 0
            ? reasons.slice(0, 2).join(' · ')
            : '지금 주목받는 연주자'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // fallback: 점수 없으면 전체 연주자 표시
    if (scored.length === 0) {
      const fallback = allMusicians
        .filter(m => !myFavMusicianIds.has(m.id))
        .map(m => ({ ...m, score: 0, reason: '지금 주목받는 연주자' }))
        .slice(0, 8);
      return res.json(fallback);
    }

    res.json(scored);
  } catch (err) {
    console.error('Musician recommendation error:', err);
    res.status(500).json({ error: '추천을 불러오는데 실패했습니다.' });
  }
});

// ── 유틸: 국적-국가 매칭 ───────────────────────────────────────
function checkCountryMatch(nationality, venueCountry) {
  if (!nationality || !venueCountry) return false;
  const map = {
    '대한민국': ['대한민국', 'South Korea', 'Korea'],
    '일본':     ['Japan', '일본'],
    '미국':     ['USA', 'United States'],
    '영국':     ['UK', 'United Kingdom'],
    '독일':     ['Germany', '독일'],
    '프랑스':   ['France', '프랑스'],
    '중국':     ['China', '중국'],
    '오스트리아': ['Austria'],
    '이탈리아': ['Italy'],
    '네덜란드': ['Netherlands'],
  };
  const countries = map[nationality] || [];
  return countries.some(c => venueCountry.includes(c));
}

module.exports = router;
