const express = require('express');
const axios = require('axios');

const router = express.Router();

// Google Places API에서 허용하는 타입 (2024년 기준)
const PLACE_TYPES = {
  restaurant: 'restaurant',
  cafe:       'cafe',
  attraction: 'tourist_attraction',
};

// GET /api/nearby?lat=37.5&lng=127.0&type=restaurant&radius=5000
router.get('/', async (req, res) => {
  const { lat, lng, type = 'restaurant', radius = 5000 } = req.query;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat, lng 좌표가 필요합니다.' });
  }

  if (!apiKey) {
    // API 키 없으면 목 데이터 반환 (개발용)
    return res.json(getMockPlaces(type, parseFloat(lat), parseFloat(lng)));
  }

  const placeType = PLACE_TYPES[type] || 'restaurant';

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      {
        params: {
          location: `${lat},${lng}`,
          radius: parseInt(radius),
          type: placeType,
          language: 'ko',
          key: apiKey,
        },
        timeout: 8000,
      }
    );

    const data = response.data;

    // API 응답 상태 확인
    if (data.status === 'REQUEST_DENIED') {
      console.error('[Nearby] Places API 거부됨:', data.error_message);
      // 목 데이터로 fallback
      return res.json(getMockPlaces(type, parseFloat(lat), parseFloat(lng)));
    }

    if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
      // 반경을 늘려서 재시도 (10km)
      if (parseInt(radius) <= 5000) {
        const retryResponse = await axios.get(
          'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
          {
            params: {
              location: `${lat},${lng}`,
              radius: 10000,
              type: placeType,
              language: 'ko',
              key: apiKey,
            },
            timeout: 8000,
          }
        );
        if (retryResponse.data.results?.length > 0) {
          return res.json(formatPlaces(retryResponse.data.results, apiKey, lat, lng));
        }
      }
      return res.json([]);
    }

    res.json(formatPlaces(data.results, apiKey, lat, lng));
  } catch (err) {
    console.error('[Nearby] API 오류:', err.response?.data || err.message);
    // 오류 시 목 데이터 반환
    return res.json(getMockPlaces(type, parseFloat(lat), parseFloat(lng)));
  }
});

function formatPlaces(results, apiKey, lat, lng) {
  const venueLatNum = parseFloat(lat);
  const venueLngNum = parseFloat(lng);

  return results
    .map(place => ({
      place_id: place.place_id,
      name: place.name,
      rating: place.rating || null,
      user_ratings_total: place.user_ratings_total || 0,
      address: place.vicinity || '',
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      photo_url: place.photos?.[0]?.photo_reference
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`
        : null,
      open_now: place.opening_hours?.open_now ?? null,
      distance: Math.round(
        haversineDistance(venueLatNum, venueLngNum,
          place.geometry.location.lat, place.geometry.location.lng)
      ),
    }))
    .sort((a, b) => a.distance - b.distance);
}

// API 키 없거나 오류 시 보여줄 예시 데이터
function getMockPlaces(type, lat, lng) {
  const labels = {
    restaurant: ['레스토랑 A', '비스트로 B', '레스토랑 C'],
    cafe:       ['카페 A', '커피숍 B', '브런치 카페 C'],
    attraction: ['미술관', '공원', '광장'],
  };
  const names = labels[type] || labels.restaurant;

  return names.map((name, i) => ({
    place_id: `mock_${i}`,
    name,
    rating: (4.0 + Math.random() * 0.9).toFixed(1) * 1,
    user_ratings_total: Math.floor(Math.random() * 500 + 50),
    address: '공연장 인근',
    lat: lat + (Math.random() - 0.5) * 0.02,
    lng: lng + (Math.random() - 0.5) * 0.02,
    photo_url: null,
    open_now: true,
    distance: Math.floor(Math.random() * 800 + 100),
    isMock: true,
  }));
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;