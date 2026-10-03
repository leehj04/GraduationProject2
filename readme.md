# 🎵 ClassicTour — 클래식 공연 투어 트래커

클래식 음악가들의 전 세계 공연 일정을 외부 API로 매일 자동 수집해 지도 위 투어 경로로 보여주고,
공연장 주변 정보, 동행 구하기, 관람 후기, 공연 알림을 제공하는 웹 서비스입니다.

> 건국대학교 컴퓨터공학부 졸업 프로젝트 (개인 프로젝트)
> 프로젝트 기간 중 Vercel(프론트엔드)과 Render(백엔드)로 배포해 운영했으며, 현재는 운영을 종료했습니다.

---

## 🏗 시스템 구조

```
[React + Vite]  ⇄  REST API  ⇄  [Node.js + Express]  ⇄  [SQLite]
                                        ▲
                     [데이터 수집 파이프라인 · 매일 03:00 자동 실행]
                                        ▲
                Ticketmaster · KOPIS · MusicBrainz · Google Geocoding
```

### 데이터 수집 파이프라인 (`backend/scripts/pipeline`)

1. Ticketmaster Classical 카테고리를 국가별로 검색해 공연 수집
2. 공연에서 아티스트를 자동 추출해 DB에 등록하고, 악기·유형 자동 분류
3. 정규화 → 중복 제거 → UPSERT 저장
4. 좌표가 없는 공연장은 Geocoding으로 보강 (결과는 캐시)
5. 공연명이 아티스트로 잘못 등록된 항목, 공연 없는 연주자 정리
6. 실행 이력을 `pipeline_runs` 테이블에 기록

**중복 방어 (3단계)**
- 메모리: 악센트·대소문자·구분자를 정규화한 키로 수집 직후 중복 제거 (정보가 더 많은 쪽을 남김)
- DB: 정규화 키(`natural_key`)에 UNIQUE 제약
- 저장: `ON CONFLICT ... DO UPDATE`로 충돌 시 오류 없이 최신 정보로 갱신

**안정성**
- 외부 API 요청 동시성 제한(`p-limit`)과 재시도
- 한 건의 실패가 전체 수집을 멈추지 않도록 실패를 분리
- 스케줄러는 실행 중 오류가 나도 종료하지 않고 다음 실행을 기다림

---

## 📁 프로젝트 구조

```
backend/                      # Node.js + Express API 서버 (포트 3001)
├── server.js                 # 서버 진입점, 라우트 등록, 알림 발송 스케줄
├── db.js                     # SQLite 초기화
├── middleware/auth.js        # JWT 인증 미들웨어
├── routes/                   # REST API (auth, musicians, concerts, nearby, companions,
│                             #  favorites, reviews, notifications, recommendations,
│                             #  share, travel, admin)
├── scripts/
│   ├── scheduler.mjs         # 파이프라인 자동 실행 (매일 03:00)
│   ├── pipeline/             # 수집 파이프라인 (run, upsert)
│   ├── fetchers/             # Ticketmaster, MusicBrainz, 아티스트 자동 탐색
│   ├── lib/                  # normalize, dedupe, geocode, retry, classify, logger
│   └── kopis-fetch.mjs       # KOPIS 국내 클래식 공연 수집
├── scrapers/                 # 초기 버전의 공식 사이트 스크래퍼 (Puppeteer + Cheerio)
└── utils/email.js            # 공연 알림 메일 발송

frontend/                     # React 18 + Vite + Tailwind CSS
└── src/
    ├── App.jsx               # 라우팅 (/, /musicians, /map/:musicianId, /share/:token, /admin)
    ├── api.js                # Axios 클라이언트
    ├── contexts/AuthContext.jsx
    └── components/           # 지도, 일정 사이드바, 공연 상세, 동행, 후기, 즐겨찾기,
                              #  추천, 알림 설정, 공유 카드, 여행 검색, 마이페이지, 관리자
```

---

## 🌐 주요 기능

- **음악가 선택**: 등록된 음악가 목록과 즐겨찾기, 추천 음악가
- **투어 지도**: Google Maps 위에 공연장 마커를 표시하고 날짜순으로 연결, 마커 클러스터링, 월별 필터
- **공연 상세**: 공연 정보와 티켓 링크, 공연장 반경 내 식당·카페·명소(Google Places)
- **동행 구하기**: 공연별 동행 게시판과 댓글
- **관람 후기**: 공연별 후기 작성·조회
- **공연 알림**: 관심 공연 알림 신청 시 매일 09:00 메일 발송
- **공유 카드**: 공연 정보를 링크로 공유
- **여행 검색**: 국가별 공연 검색과 이동 정보
- **관리자 페이지**: 음악가·공연 데이터 관리, 수동 수집 실행

---

## 🚀 설치 및 실행

### 사전 요구사항
- **Node.js 20.x** (v24에서는 `better-sqlite3` 네이티브 모듈 빌드가 실패해 20 LTS로 고정)
- **Google Maps API 키**: Maps JavaScript API, Places API, Geocoding API 활성화
- **Ticketmaster API 키** (공연 수집), **KOPIS API 키** (국내 공연 수집, 선택)

> 서버에서 Google API를 호출할 때는 브라우저용 키(HTTP 리퍼러 제한)가 거부되므로,
> 서버용 키를 따로 만들어 IP 제한 방식으로 설정해야 합니다.

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

`.env`:
```
PORT=3001
JWT_SECRET=임의의_긴_문자열
GOOGLE_MAPS_API_KEY=서버용_API_키
FRONTEND_URL=http://localhost:5173

TICKETMASTER_API_KEY=발급받은_키
KOPIS_API_KEY=발급받은_키          # 선택

# 공연 알림 메일 (Gmail 기준)
EMAIL_SERVICE=gmail
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=앱_비밀번호
```

```bash
npm start                         # API 서버 실행
node scripts/scheduler.mjs        # 수집 파이프라인 스케줄러 실행 (시작 시 1회 즉시 실행)
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

`.env`:
```
VITE_GOOGLE_MAPS_API_KEY=브라우저용_API_키
VITE_API_URL=http://localhost:3001
```

```bash
npm run dev                       # http://localhost:5173
```

---

## 🔌 주요 API

| Method | URL | 설명 |
|--------|-----|------|
| POST | /api/auth/register · /login | 회원가입 · 로그인 |
| PUT | /api/auth/profile · /password | 프로필 · 비밀번호 수정 |
| GET | /api/musicians · /:id | 음악가 목록 · 상세 |
| GET | /api/concerts · /:id | 공연 목록 · 상세 |
| GET | /api/concerts/months/:musicianId | 월별 공연 수 |
| GET | /api/nearby | 공연장 주변 장소 |
| GET · POST · DELETE | /api/companions | 동행 글 · 댓글 |
| GET · POST · DELETE | /api/reviews/:concertId | 관람 후기 |
| GET · POST · DELETE | /api/favorites/... | 공연 · 음악가 즐겨찾기 |
| GET | /api/recommendations/concerts · /musicians | 추천 |
| GET · POST · DELETE | /api/notifications | 공연 알림 |
| POST · GET | /api/share · /:token | 공유 카드 생성 · 조회 |
| GET | /api/travel/search · /countries · /transit | 여행 검색 |
| - | /api/admin/... | 관리자용 데이터 관리, 수동 수집 |

---

## 🛠 기술 스택

**Backend**: Node.js 20, Express, SQLite (better-sqlite3), JWT (jsonwebtoken + bcryptjs), node-cron, p-limit, Nodemailer, Puppeteer + Cheerio (초기 스크래퍼)

**Frontend**: React 18, Vite, React Router v6, @react-google-maps/api + @googlemaps/markerclusterer, Tailwind CSS, Axios

**External API**: Ticketmaster Discovery API, KOPIS Open API, MusicBrainz, Google Maps · Places · Geocoding

---

## 🔧 주요 트러블슈팅

| 문제 | 원인 | 해결 |
|---|---|---|
| 특정 API 경로 404 | 구체적 경로가 와일드카드 경로(`/:id`) 뒤에 등록됨 | 라우트 선언 순서 변경 |
| 지도 마커 위치 오류 | API 응답의 좌표가 문자열 타입 | 명시적 숫자 변환 |
| 서버 빌드 실패 | Node.js v24에서 네이티브 모듈 빌드 실패 | Node.js 20 LTS로 고정 |
| 서버 측 Google API 403 | 브라우저용 키 제한 방식이 서버 호출과 맞지 않음 | 서버용 키를 IP 제한 방식으로 분리 |
| 같은 공연 중복 저장 | 수집처마다 표기가 다름 (예: Yo-Yo Ma / Yo Yo Ma) | 정규화 키 기반 3단계 중복 방어 |
