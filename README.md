# 🎵 ClassicTour — 클래식 공연 투어 트래커

클래식 음악가들의 전 세계 공연 일정을 지도로 시각화하고,
주변 정보 탐색 및 동행을 구할 수 있는 웹 서비스입니다.

---

## 📁 프로젝트 구조

```
concert-tour-tracker/
├── backend/                   # Node.js + Express API 서버
│   ├── server.js              # 메인 서버 (포트 3001)
│   ├── db.js                  # SQLite DB 초기화 + 시드 데이터
│   ├── middleware/
│   │   └── auth.js            # JWT 인증 미들웨어
│   ├── routes/
│   │   ├── auth.js            # 로그인 / 회원가입
│   │   ├── musicians.js       # 음악가 목록/상세
│   │   ├── concerts.js        # 공연 일정 조회
│   │   ├── nearby.js          # Google Places 주변 정보
│   │   └── companions.js      # 동행 구하기 게시판
│   └── scrapers/
│       ├── index.js           # 스크래퍼 오케스트레이터 (cron 포함)
│       ├── yunchan-lim.js     # 임윤찬 전용 스크래퍼
│       ├── trifonov.js        # 트리포노프 전용 스크래퍼
│       └── generic.js         # 범용 스크래퍼 (나머지 음악가)
│
└── frontend/                  # React + Vite + Tailwind CSS
    ├── src/
    │   ├── App.jsx            # 라우팅 (/, /musicians, /map/:id)
    │   ├── api.js             # Axios 클라이언트
    │   ├── contexts/
    │   │   └── AuthContext.jsx
    │   └── components/
    │       ├── AuthPage.jsx         # 로그인 / 회원가입 페이지
    │       ├── MusicianSelect.jsx   # 음악가 선택 페이지
    │       ├── MapPage.jsx          # 구글 지도 + 사이드바 (메인)
    │       ├── ScheduleSidebar.jsx  # 우측 공연 일정 사이드바
    │       ├── ConcertDetailPanel.jsx # 공연 상세 패널 (3탭)
    │       └── CompanionTab.jsx     # 동행 구하기 탭
    └── ...config files
```

---

## 🚀 설치 및 실행

### 사전 요구사항
- **Node.js** 18 이상
- **Google Maps API 키** (Maps JavaScript API + Places API + Geocoding API 활성화 필요)

---

### 1️⃣ Google Maps API 키 발급

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성
3. 아래 3가지 API 활성화:
   - **Maps JavaScript API**
   - **Places API**
   - **Geocoding API**
4. 사용자 인증 정보 → API 키 생성

---

### 2️⃣ Backend 설정

```bash
cd backend

# 패키지 설치
npm install

# 환경변수 설정
cp .env.example .env
```

`.env` 파일을 열어서 수정:
```
PORT=3001
JWT_SECRET=비밀_키_여기에_입력  ← 임의의 긴 문자열로 바꾸세요
GOOGLE_MAPS_API_KEY=여기에_API_키_입력
FRONTEND_URL=http://localhost:5173
```

서버 실행:
```bash
npm start
# 또는 개발 모드 (nodemon)
npm run dev
```

서버 시작 시 자동으로:
- SQLite DB 생성 (`concert_tracker.db`)
- 6명의 음악가 데이터 시드
- 16개의 모크 공연 데이터 시드
- 매일 새벽 3시 자동 스크래핑 스케줄링

---

### 3️⃣ Frontend 설정

```bash
cd frontend

# 패키지 설치
npm install

# 환경변수 설정
cp .env.example .env
```

`.env` 파일:
```
VITE_GOOGLE_MAPS_API_KEY=여기에_API_키_입력
VITE_API_URL=http://localhost:3001
```

프론트엔드 실행:
```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## 🌐 주요 기능

### 1. 로그인 / 회원가입
- 이메일, 비밀번호, 이름 (필수)
- 나이, 성별, 국적 (선택 — 동행 구하기에 표시됨)
- JWT 기반 인증 (30일 유효)

### 2. 음악가 선택 화면
- 6명의 클래식 음악가 카드 목록
- 우측 상단 `업데이트` 버튼 → 실시간 스크래핑 트리거

### 3. 지도 + 공연 일정 사이드바
- Google Maps 다크 테마 전체화면
- 공연장 위치에 마커 표시, 날짜순 선(폴리라인)으로 연결
- **마커 클러스터링**: 축소 시 가까운 공연들이 숫자로 뭉쳐짐
- 오른쪽 사이드바: 6개월 일정 전체 표시
- 월별 필터 버튼으로 특정 달만 보기 (지도 + 사이드바 동시 필터)

### 4. 공연 상세 패널 (마커 또는 카드 클릭 시)
#### 공연 정보 탭
- 공연장 사진, 이름, 주소, 전화번호
- 연주자 사진 및 이름
- 공연 날짜/시간
- 연주 곡목 리스트
- 티켓 구매 링크

#### 주변 정보 탭
- 식당 / 카페 / 명소 서브탭
- 공연장 반경 5km 이내 Google Places 검색
- 장소 이름, 사진, 구글 별점, 공연장까지 거리 카드

#### 동행 구하기 탭
- 글 목록 (제목, 내용 미리보기, 작성자, 작성 시간)
- 글 클릭 → 작성자의 나이/성별/국적 확인
- 우측 하단 연필 버튼 → 글쓰기 (제목 + 본문)

### 5. 자동 스크래핑
- Puppeteer + Cheerio로 각 음악가 공식 사이트 크롤링
- 매일 새벽 3시 자동 실행
- 기존 데이터와 중복 체크 후 신규만 저장
- 주소 → 좌표 자동 변환 (Geocoding API)

---

## 🎭 현재 등록된 음악가

| 이름 | 영문명 | 공식 사이트 |
|------|--------|------------|
| 임윤찬 | Yunchan Lim | opus3artists.com |
| 다닐 트리포노프 | Daniil Trifonov | daniiltrifonov.com |
| 조성진 | Seong-Jin Cho | seongjincho.com |
| 유자 왕 | Yuja Wang | yujawang.com |
| 랑랑 | Lang Lang | langlang.com |
| 힐러리 한 | Hilary Hahn | hilaryhahn.com |

---

## 🔌 API 엔드포인트

| Method | URL | 설명 |
|--------|-----|------|
| POST | /api/auth/register | 회원가입 |
| POST | /api/auth/login | 로그인 |
| GET | /api/musicians | 음악가 목록 |
| GET | /api/musicians/:id | 음악가 상세 |
| GET | /api/concerts?musicianId=&months=&month= | 공연 목록 |
| GET | /api/concerts/months/:musicianId | 월별 공연 수 |
| GET | /api/concerts/:id | 공연 상세 |
| GET | /api/nearby?lat=&lng=&type=&radius= | 주변 장소 |
| GET | /api/companions/:concertId | 동행 글 목록 |
| POST | /api/companions | 동행 글 작성 (인증 필요) |
| DELETE | /api/companions/:id | 동행 글 삭제 (작성자만) |
| POST | /api/admin/scrape | 수동 스크래핑 트리거 |

---

## ➕ 음악가 추가 방법

`backend/db.js`의 `seedMusicians()` 함수에 항목 추가:

```js
{
  name: 'Martha Argerich',
  name_ko: '마르타 아르헤리치',
  bio: '아르헨티나 출신의 세계적인 피아니스트...',
  photo_url: 'https://...',
  official_site: 'https://...',
  scraper_key: 'martha-argerich'
}
```

전용 스크래퍼가 없으면 `generic.js`가 자동으로 공식 사이트를 크롤링합니다.
더 정확한 크롤링이 필요하면 `scrapers/` 폴더에 전용 스크래퍼 파일을 추가하고
`scrapers/index.js`의 `switch` 문에 등록하세요.

---

## 🛠 기술 스택

**Backend**
- Node.js + Express
- SQLite (better-sqlite3)
- JWT 인증 (jsonwebtoken + bcryptjs)
- Puppeteer + Cheerio (웹 스크래핑)
- node-cron (스케줄링)

**Frontend**
- React 18 + Vite
- React Router v6
- @react-google-maps/api + @googlemaps/markerclusterer
- Tailwind CSS
- Lucide React (아이콘)
- Axios

---

## ⚠️ 주의사항

1. **스크래핑**: 각 음악가 공식 사이트의 HTML 구조가 변경되면 스크래퍼 수정이 필요합니다. 기본 모크 데이터(16개 공연)는 항상 DB에 존재합니다.

2. **Google API 비용**: Places API 호출은 유료입니다. 개발 중에는 Google Cloud Console에서 일일 한도를 설정해두세요.

3. **프로덕션 배포 시**:
   - `JWT_SECRET`을 강력한 랜덤 문자열로 변경
   - Google Maps API 키에 도메인 제한 설정
   - SQLite → PostgreSQL로 DB 교체 권장
