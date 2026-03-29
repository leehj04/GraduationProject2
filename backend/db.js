const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDB() {
  db = new Database(path.join(__dirname, 'concert_tracker.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      nationality TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS musicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ko TEXT,
      bio TEXT,
      photo_url TEXT,
      official_site TEXT,
      scraper_key TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS concerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      musician_id INTEGER NOT NULL,
      title TEXT,
      venue_name TEXT NOT NULL,
      venue_address TEXT,
      venue_city TEXT,
      venue_country TEXT,
      venue_lat REAL,
      venue_lng REAL,
      venue_phone TEXT,
      venue_photo_url TEXT,
      concert_date TEXT NOT NULL,
      concert_time TEXT,
      program TEXT,
      ticket_url TEXT,
      source_url TEXT,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (musician_id) REFERENCES musicians(id)
    );

    CREATE TABLE IF NOT EXISTS companions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concert_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (concert_id) REFERENCES concerts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_concerts_musician_date ON concerts(musician_id, concert_date);
    CREATE INDEX IF NOT EXISTS idx_companions_concert ON companions(concert_id);

    CREATE TABLE IF NOT EXISTS concert_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      concert_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, concert_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (concert_id) REFERENCES concerts(id)
    );

    CREATE TABLE IF NOT EXISTS musician_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      musician_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, musician_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (musician_id) REFERENCES musicians(id)
    );

    CREATE INDEX IF NOT EXISTS idx_concert_favs_user ON concert_favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_musician_favs_user ON musician_favorites(user_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      concert_id INTEGER NOT NULL,
      notify_days INTEGER NOT NULL,
      notify_date TEXT NOT NULL,
      sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, concert_id, notify_days),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (concert_id) REFERENCES concerts(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concert_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, concert_id),
      FOREIGN KEY (concert_id) REFERENCES concerts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS share_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      musician_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (musician_id) REFERENCES musicians(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(notify_date, sent);
    CREATE INDEX IF NOT EXISTS idx_reviews_concert ON reviews(concert_id);
    CREATE INDEX IF NOT EXISTS idx_share_token ON share_cards(token);
  `);

  seedMusicians();
  seedMockConcerts();

  console.log('[DB] Database initialized successfully');
  return db;
}

function seedMusicians() {
  const musicians = [
    {
      name: 'Yunchan Lim',
      name_ko: '임윤찬',
      bio: '2022 반 클라이번 국제 피아노 콩쿠르 역대 최연소 우승자 (18세). 섬세한 감성과 압도적 테크닉으로 세계 무대를 사로잡고 있는 한국의 피아니스트.',
      photo_url: null,
      official_site: 'https://www.opus3artists.com/artists/yunchan-lim',
      scraper_key: 'yunchan-lim'
    },
    {
      name: 'Daniil Trifonov',
      name_ko: '다닐 트리포노프',
      bio: '러시아 출신의 피아니스트. 2011 쇼팽 국제 피아노 콩쿠르 3위, 루빈스타인 콩쿠르 우승. 그라모폰 올해의 아티스트 수상.',
      photo_url: null,
      official_site: 'https://www.daniiltrifonov.com/tour/',
      scraper_key: 'trifonov'
    },
    {
      name: 'Seong-Jin Cho',
      name_ko: '조성진',
      bio: '2015 쇼팽 국제 피아노 콩쿠르 우승자. 섬세하고 시적인 음악 해석으로 유럽과 아시아에서 큰 사랑을 받고 있는 한국의 피아니스트.',
      photo_url: null,
      official_site: 'https://www.seongjincho.com/concerts',
      scraper_key: 'seongjin-cho'
    },
    {
      name: 'Yuja Wang',
      name_ko: '유자 왕',
      bio: '중국 출신의 피아니스트. 강렬한 테크닉과 개성 있는 무대 스타일로 클래식 음악계의 스타로 자리잡았다.',
      photo_url: null,
      official_site: 'https://yujawang.com/concerts/',
      scraper_key: 'yuja-wang'
    },
    {
      name: 'Lang Lang',
      name_ko: '랑랑',
      bio: '중국 출신의 세계적인 피아니스트. 화려한 테크닉과 카리스마 넘치는 연주로 클래식 음악의 대중화에 기여했다.',
      photo_url: null,
      official_site: 'https://langlang.com/events/',
      scraper_key: 'lang-lang'
    },
    {
      name: 'Hilary Hahn',
      name_ko: '힐러리 한',
      bio: '미국 출신의 바이올리니스트. 11세에 프로 데뷔, 3회 그래미 수상. 순수하고 정확한 음색으로 유명하다.',
      photo_url: null,
      official_site: 'https://www.hilaryhahn.com/tour/',
      scraper_key: 'hilary-hahn'
    }
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO musicians (name, name_ko, bio, photo_url, official_site, scraper_key)
    VALUES (@name, @name_ko, @bio, @photo_url, @official_site, @scraper_key)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) insert.run(item);
  });

  insertMany(musicians);
}

function seedMockConcerts() {
  const count = db.prepare('SELECT COUNT(*) as c FROM concerts').get();
  if (count.c > 0) return; // Already seeded

  const musicians = db.prepare('SELECT * FROM musicians').all();
  const musicianMap = {};
  musicians.forEach(m => { musicianMap[m.scraper_key] = m.id; });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  const mockConcerts = [
    // ── 임윤찬 실제 2026 투어 데이터 (출처: yunchanlimofficial.com/tour/) ──
    {
      musician_key: 'yunchan-lim',
      title: '임윤찬 피아노 리사이틀',
      venue_name: '부산콘서트홀',
      venue_address: '부산광역시 해운대구 APEC로 55',
      venue_city: '부산',
      venue_country: '대한민국',
      venue_lat: 35.1695,
      venue_lng: 129.1309,
      concert_date: '2026-05-09',
      concert_time: '19:30',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.yunchanlimofficial.com/tour/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yunchan-lim',
      title: '임윤찬 피아노 리사이틀',
      venue_name: '예술의전당 콘서트홀',
      venue_address: '서울특별시 서초구 남부순환로 2406',
      venue_city: '서울',
      venue_country: '대한민국',
      venue_lat: 37.4775,
      venue_lng: 127.0146,
      concert_date: '2026-05-12',
      concert_time: '19:30',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.yunchanlimofficial.com/tour/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yunchan-lim',
      title: 'Yunchan Lim Recital - London',
      venue_name: 'Wigmore Hall',
      venue_address: '36 Wigmore St, London W1U 2BP, UK',
      venue_city: 'London',
      venue_country: 'UK',
      venue_lat: 51.5153,
      venue_lng: -0.1496,
      concert_date: '2026-05-29',
      concert_time: '19:30',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.yunchanlimofficial.com/tour/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yunchan-lim',
      title: 'Yunchan Lim Recital - Tokyo',
      venue_name: 'Tokyo Metropolitan Theatre',
      venue_address: '1-8-1 Nishiikebukuro, Toshima, Tokyo 171-0021, Japan',
      venue_city: 'Tokyo',
      venue_country: 'Japan',
      venue_lat: 35.7285,
      venue_lng: 139.7101,
      concert_date: '2026-06-09',
      concert_time: '19:00',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.yunchanlimofficial.com/tour/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yunchan-lim',
      title: 'Yunchan Lim Recital - Suntory Hall',
      venue_name: 'Suntory Hall',
      venue_address: '1-13-1 Akasaka, Minato, Tokyo 107-8403, Japan',
      venue_city: 'Tokyo',
      venue_country: 'Japan',
      venue_lat: 35.6706,
      venue_lng: 139.7360,
      concert_date: '2026-06-11',
      concert_time: '19:00',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.yunchanlimofficial.com/tour/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yunchan-lim',
      title: 'Yunchan Lim - Gewandhaus Leipzig',
      venue_name: 'Gewandhaus zu Leipzig',
      venue_address: 'Augustusplatz 8, 04109 Leipzig, Germany',
      venue_city: 'Leipzig',
      venue_country: 'Germany',
      venue_lat: 51.3397,
      venue_lng: 12.3800,
      concert_date: '2026-06-18',
      concert_time: '20:00',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.yunchanlimofficial.com/tour/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yunchan-lim',
      title: 'Yunchan Lim - Gewandhaus Leipzig',
      venue_name: 'Gewandhaus zu Leipzig',
      venue_address: 'Augustusplatz 8, 04109 Leipzig, Germany',
      venue_city: 'Leipzig',
      venue_country: 'Germany',
      venue_lat: 51.3397,
      venue_lng: 12.3800,
      concert_date: '2026-06-19',
      concert_time: '20:00',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.yunchanlimofficial.com/tour/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yunchan-lim',
      title: 'Yunchan Lim - Verbier Festival',
      venue_name: 'Salle des Combins',
      venue_address: 'Verbier, Switzerland',
      venue_city: 'Verbier',
      venue_country: 'Switzerland',
      venue_lat: 46.0959,
      venue_lng: 7.2272,
      concert_date: '2026-07-26',
      concert_time: '19:30',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.yunchanlimofficial.com/tour/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yunchan-lim',
      title: 'Yunchan Lim - Lucerne Festival',
      venue_name: 'KKL Luzern Concert Hall',
      venue_address: 'Europaplatz 1, 6005 Luzern, Switzerland',
      venue_city: 'Lucerne',
      venue_country: 'Switzerland',
      venue_lat: 47.0510,
      venue_lng: 8.3093,
      concert_date: '2026-09-08',
      concert_time: '19:30',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.yunchanlimofficial.com/tour/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yunchan-lim',
      title: 'Yunchan Lim - Carnegie Hall',
      venue_name: 'Carnegie Hall',
      venue_address: '881 7th Ave, New York, NY 10019, USA',
      venue_city: 'New York',
      venue_country: 'USA',
      venue_lat: 40.7651,
      venue_lng: -73.9800,
      concert_date: '2026-10-21',
      concert_time: '19:30',
      program: JSON.stringify(['Bach - Goldberg Variations BWV 988']),
      ticket_url: 'https://www.carnegiehall.org/',
      venue_photo_url: null,
    },
    // ── Daniil Trifonov 실제 2026 투어 데이터 (출처: daniiltrifonov.com/schedule/) ──
    {
      musician_key: 'trifonov',
      title: 'Daniil Trifonov & Oregon Symphony',
      venue_name: 'Oregon Symphony',
      venue_address: 'Arlene Schnitzer Concert Hall, 1037 SW Broadway, Portland, OR 97205, USA',
      venue_city: 'Portland',
      venue_country: 'USA',
      venue_lat: 45.5189,
      venue_lng: -122.6820,
      concert_date: '2026-04-16',
      concert_time: '19:30',
      program: JSON.stringify(['Shostakovich - Piano Concerto No. 1', 'Shostakovich - Piano Concerto No. 2']),
      ticket_url: 'https://www.orsymphony.org/productions/2526/daniil-trifonov-with-the-oregon-symphony',
      venue_photo_url: null,
    },
    {
      musician_key: 'trifonov',
      title: 'Daniil Trifonov Recital - Vancouver',
      venue_name: 'The Orpheum',
      venue_address: '601 Smithe St, Vancouver, BC V6B 3L4, Canada',
      venue_city: 'Vancouver',
      venue_country: 'Canada',
      venue_lat: 49.2797,
      venue_lng: -123.1208,
      concert_date: '2026-04-19',
      concert_time: '19:30',
      program: JSON.stringify(['Taneyev - Prelude and Fugue in G-Sharp Minor', 'Prokofiev - Vision Fugitives Op. 22', 'Myaskovsky - Sonata No. 2', 'Schumann - Sonata No. 1 in F-Sharp Minor']),
      ticket_url: 'https://chopinsociety.org/daniil-trifonov-2026.html',
      venue_photo_url: null,
    },
    {
      musician_key: 'trifonov',
      title: 'Daniil Trifonov & Seattle Symphony',
      venue_name: 'Benaroya Hall',
      venue_address: '200 University St, Seattle, WA 98101, USA',
      venue_city: 'Seattle',
      venue_country: 'USA',
      venue_lat: 47.6063,
      venue_lng: -122.3355,
      concert_date: '2026-04-23',
      concert_time: '19:30',
      program: JSON.stringify(['Saint-Saëns - Piano Concerto No. 2']),
      ticket_url: 'https://www.seattlesymphony.org/',
      venue_photo_url: null,
    },
    {
      musician_key: 'trifonov',
      title: 'Daniil Trifonov - Carnegie Hall',
      venue_name: 'Carnegie Hall',
      venue_address: '881 7th Ave, New York, NY 10019, USA',
      venue_city: 'New York',
      venue_country: 'USA',
      venue_lat: 40.7651,
      venue_lng: -73.9800,
      concert_date: '2026-05-05',
      concert_time: '20:00',
      program: JSON.stringify(['50th Anniversary of the Concert of the Century']),
      ticket_url: 'https://www.carnegiehall.org/calendar/2026/05/05/50th-anniversary-of-the-concert-of-the-century-0700pm',
      venue_photo_url: null,
    },
    {
      musician_key: 'trifonov',
      title: 'Trifonov & Szeps-Znaider - Konzerthaus Berlin',
      venue_name: 'Konzerthaus Berlin',
      venue_address: 'Gendarmenmarkt 2, 10117 Berlin, Germany',
      venue_city: 'Berlin',
      venue_country: 'Germany',
      venue_lat: 52.5136,
      venue_lng: 13.3922,
      concert_date: '2026-05-11',
      concert_time: '20:00',
      program: JSON.stringify(['C. Schumann - Three Romances for piano and violin Op. 22', 'R. Schumann - Violin Sonata No. 2', 'Webern - Four Pieces for Violin & Piano', 'Beethoven - Sonata No. 9 "Kreutzer"']),
      ticket_url: 'https://www.konzerthaus.de/',
      venue_photo_url: null,
    },
    {
      musician_key: 'trifonov',
      title: 'Trifonov & Szeps-Znaider - Wiener Konzerthaus',
      venue_name: 'Wiener Konzerthaus',
      venue_address: 'Lothringerstraße 20, 1030 Wien, Austria',
      venue_city: 'Vienna',
      venue_country: 'Austria',
      venue_lat: 48.2006,
      venue_lng: 16.3795,
      concert_date: '2026-05-13',
      concert_time: '19:30',
      program: JSON.stringify(['C. Schumann - Three Romances for piano and violin Op. 22', 'R. Schumann - Violin Sonata No. 2', 'Webern - Four Pieces for Violin & Piano', 'Beethoven - Sonata No. 9 "Kreutzer"']),
      ticket_url: 'https://konzerthaus.at/',
      venue_photo_url: null,
    },
    {
      musician_key: 'trifonov',
      title: 'Trifonov & Szeps-Znaider - Elbphilharmonie',
      venue_name: 'Elbphilharmonie Hamburg',
      venue_address: 'Platz der Deutschen Einheit 4, 20457 Hamburg, Germany',
      venue_city: 'Hamburg',
      venue_country: 'Germany',
      venue_lat: 53.5413,
      venue_lng: 9.9842,
      concert_date: '2026-05-14',
      concert_time: '20:00',
      program: JSON.stringify(['C. Schumann - Three Romances for piano and violin Op. 22', 'R. Schumann - Violin Sonata No. 2', 'Webern - Four Pieces for Violin & Piano', 'Beethoven - Sonata No. 9 "Kreutzer"']),
      ticket_url: 'https://www.elbphilharmonie.de/',
      venue_photo_url: null,
    },
    {
      musician_key: 'trifonov',
      title: 'Trifonov & Rotterdam Philharmonic',
      venue_name: 'De Doelen',
      venue_address: 'Schouwburgplein 50, 3012 CL Rotterdam, Netherlands',
      venue_city: 'Rotterdam',
      venue_country: 'Netherlands',
      venue_lat: 51.9218,
      venue_lng: 4.4777,
      concert_date: '2026-05-21',
      concert_time: '20:15',
      program: JSON.stringify(['Brahms - Piano Concerto No. 2']),
      ticket_url: 'https://www.rotterdamsphilharmonisch.nl/',
      venue_photo_url: null,
    },
    // ── 조성진 실제 2026 투어 데이터 (출처: seongjin-cho.com, koreatimes, carnegiehall.org) ──
    {
      musician_key: 'seongjin-cho',
      title: 'Seong-Jin Cho Recital - Orlando',
      venue_name: 'Steinmetz Hall, Dr. Phillips Center',
      venue_address: '445 S Magnolia Ave, Orlando, FL 32801, USA',
      venue_city: 'Orlando',
      venue_country: 'USA',
      venue_lat: 28.5383,
      venue_lng: -81.3792,
      concert_date: '2026-04-09',
      concert_time: '19:30',
      program: JSON.stringify(['Bach - Partita No. 1 BWV 825', 'Schoenberg - Suite for Piano Op. 25', 'Schumann - Faschingsschwank aus Wien Op. 26', 'Chopin - 14 Waltzes']),
      ticket_url: 'https://www.drphillipscenter.org/events/tickets/2026/seong-jin-cho/',
      venue_photo_url: null,
    },
    {
      musician_key: 'seongjin-cho',
      title: 'Seong-Jin Cho Recital - Carnegie Hall',
      venue_name: 'Carnegie Hall',
      venue_address: '881 7th Ave, New York, NY 10019, USA',
      venue_city: 'New York',
      venue_country: 'USA',
      venue_lat: 40.7651,
      venue_lng: -73.9800,
      concert_date: '2026-04-12',
      concert_time: '14:00',
      program: JSON.stringify(['Bach - Partita No. 1 BWV 825', 'Schoenberg - Suite for Piano Op. 25', 'Schumann - Faschingsschwank aus Wien Op. 26', 'Chopin - 14 Waltzes']),
      ticket_url: 'https://www.carnegiehall.org/Calendar/2026/04/12/SeongJin-Cho-Piano-0200PM',
      venue_photo_url: null,
    },
    {
      musician_key: 'seongjin-cho',
      title: '조성진 & 뮌헨 필하모닉 - 서울',
      venue_name: '예술의전당 콘서트홀',
      venue_address: '서울특별시 서초구 남부순환로 2406',
      venue_city: '서울',
      venue_country: '대한민국',
      venue_lat: 37.4775,
      venue_lng: 127.0146,
      concert_date: '2026-05-05',
      concert_time: '19:30',
      program: JSON.stringify(['Beethoven - Piano Concerto (with Munich Philharmonic, cond. Lahav Shani)']),
      ticket_url: 'https://www.sac.or.kr/',
      venue_photo_url: null,
    },
    {
      musician_key: 'seongjin-cho',
      title: '조성진 & 뮌헨 필하모닉 - 서울 2',
      venue_name: '예술의전당 콘서트홀',
      venue_address: '서울특별시 서초구 남부순환로 2406',
      venue_city: '서울',
      venue_country: '대한민국',
      venue_lat: 37.4775,
      venue_lng: 127.0146,
      concert_date: '2026-05-06',
      concert_time: '19:30',
      program: JSON.stringify(['Beethoven - Piano Concerto (with Munich Philharmonic, cond. Lahav Shani)']),
      ticket_url: 'https://www.sac.or.kr/',
      venue_photo_url: null,
    },
    {
      musician_key: 'seongjin-cho',
      title: '조성진 챔버 콘서트 - 롯데콘서트홀',
      venue_name: '롯데콘서트홀',
      venue_address: '서울특별시 송파구 올림픽로 300',
      venue_city: '서울',
      venue_country: '대한민국',
      venue_lat: 37.5120,
      venue_lng: 127.1005,
      concert_date: '2026-07-14',
      concert_time: '19:30',
      program: JSON.stringify(['Chamber Concert with Daishin Kashimoto (violin), Wenzel Fuchs (clarinet), Stefan Dohr (horn)']),
      ticket_url: 'https://www.lotteconcerthall.com/',
      venue_photo_url: null,
    },
    {
      musician_key: 'seongjin-cho',
      title: '조성진 피아노 리사이틀 - 롯데콘서트홀',
      venue_name: '롯데콘서트홀',
      venue_address: '서울특별시 송파구 올림픽로 300',
      venue_city: '서울',
      venue_country: '대한민국',
      venue_lat: 37.5120,
      venue_lng: 127.1005,
      concert_date: '2026-07-19',
      concert_time: '19:30',
      program: JSON.stringify(['Bach - Partita No. 1 BWV 825', 'Schoenberg - Suite for Piano Op. 25', 'Schumann - Faschingsschwank aus Wien Op. 26', 'Chopin - 14 Waltzes']),
      ticket_url: 'https://www.lotteconcerthall.com/',
      venue_photo_url: null,
    },

    // ── 유자 왕 실제 2026 투어 데이터 (출처: concertfix.com, carnegiehall.org, artsandlectures.ucsb.edu) ──
    {
      musician_key: 'yuja-wang',
      title: 'Yuja Wang & Mahler Chamber Orchestra - Santa Barbara',
      venue_name: 'Granada Theatre',
      venue_address: '1214 State St, Santa Barbara, CA 93101, USA',
      venue_city: 'Santa Barbara',
      venue_country: 'USA',
      venue_lat: 34.4220,
      venue_lng: -119.7039,
      concert_date: '2026-04-23',
      concert_time: '19:00',
      program: JSON.stringify(['Prokofiev - Symphony No. 1 "Classical"', 'Chopin - Piano Concerto No. 1', 'Prokofiev - Piano Concerto No. 2']),
      ticket_url: 'https://artsandlectures.ucsb.edu/events-tickets/events/25-26/yuja-wang-and-mahler-chamber-orchestra/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yuja-wang',
      title: 'Yuja Wang & Mahler Chamber Orchestra - San Francisco',
      venue_name: 'Davies Symphony Hall',
      venue_address: '201 Van Ness Ave, San Francisco, CA 94102, USA',
      venue_city: 'San Francisco',
      venue_country: 'USA',
      venue_lat: 37.7777,
      venue_lng: -122.4196,
      concert_date: '2026-04-26',
      concert_time: '19:30',
      program: JSON.stringify(['Prokofiev - Symphony No. 1 "Classical"', 'Chopin - Piano Concerto No. 1', 'Prokofiev - Piano Concerto No. 2']),
      ticket_url: 'https://www.sfsymphony.org/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yuja-wang',
      title: 'Yuja Wang & Mahler Chamber Orchestra - Chicago',
      venue_name: 'Orchestra Hall at Symphony Center',
      venue_address: '220 S Michigan Ave, Chicago, IL 60604, USA',
      venue_city: 'Chicago',
      venue_country: 'USA',
      venue_lat: 41.8796,
      venue_lng: -87.6245,
      concert_date: '2026-04-29',
      concert_time: '19:30',
      program: JSON.stringify(['Prokofiev - Symphony No. 1 "Classical"', 'Chopin - Piano Concerto No. 1', 'Prokofiev - Piano Concerto No. 2']),
      ticket_url: 'https://www.cso.org/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yuja-wang',
      title: 'Yuja Wang & Mahler Chamber Orchestra - Carnegie Hall',
      venue_name: 'Carnegie Hall',
      venue_address: '881 7th Ave, New York, NY 10019, USA',
      venue_city: 'New York',
      venue_country: 'USA',
      venue_lat: 40.7651,
      venue_lng: -73.9800,
      concert_date: '2026-05-01',
      concert_time: '20:00',
      program: JSON.stringify(['Prokofiev - Symphony No. 1 "Classical"', 'Chopin - Piano Concerto No. 1', 'Prokofiev - Piano Concerto No. 2']),
      ticket_url: 'https://www.carnegiehall.org/calendar/2026/05/01/Mahler-Chamber-Orchestra-Yuja-Wang-Piano-and-Director-0800PM',
      venue_photo_url: null,
    },
    {
      musician_key: 'yuja-wang',
      title: 'Yuja Wang & Mahler Chamber Orchestra - Chapel Hill',
      venue_name: 'Memorial Hall at Chapel Hill',
      venue_address: '114 E Cameron Ave, Chapel Hill, NC 27514, USA',
      venue_city: 'Chapel Hill',
      venue_country: 'USA',
      venue_lat: 35.9132,
      venue_lng: -79.0512,
      concert_date: '2026-05-02',
      concert_time: '20:00',
      program: JSON.stringify(['Prokofiev - Symphony No. 1 "Classical"', 'Chopin - Piano Concerto No. 1', 'Prokofiev - Piano Concerto No. 2']),
      ticket_url: 'https://www.carolinaperformingarts.org/',
      venue_photo_url: null,
    },
    {
      musician_key: 'yuja-wang',
      title: 'Yuja Wang & Mahler Chamber Orchestra - Naples',
      venue_name: 'Artis-Naples',
      venue_address: '5833 Pelican Bay Blvd, Naples, FL 34108, USA',
      venue_city: 'Naples',
      venue_country: 'USA',
      venue_lat: 26.2378,
      venue_lng: -81.8008,
      concert_date: '2026-05-03',
      concert_time: '19:00',
      program: JSON.stringify(['Prokofiev - Symphony No. 1 "Classical"', 'Chopin - Piano Concerto No. 1', 'Prokofiev - Piano Concerto No. 2']),
      ticket_url: 'https://www.artisnaples.org/',
      venue_photo_url: null,
    },

    // ── 랑랑 실제 2026 투어 데이터 (출처: langlangofficial.com/tour, shazam.com) ──
    {
      musician_key: 'lang-lang',
      title: 'Lang Lang Recital - Segerstrom Center',
      venue_name: 'Segerstrom Center for the Arts',
      venue_address: '600 Town Center Dr, Costa Mesa, CA 92626, USA',
      venue_city: 'Costa Mesa',
      venue_country: 'USA',
      venue_lat: 33.6918,
      venue_lng: -117.8881,
      concert_date: '2026-03-23',
      concert_time: '20:00',
      program: JSON.stringify(['Lang Lang Recital Program']),
      ticket_url: 'https://www.langlangofficial.com/tour',
      venue_photo_url: null,
    },
    {
      musician_key: 'lang-lang',
      title: 'Lang Lang Recital - Austin',
      venue_name: 'Bass Concert Hall',
      venue_address: '2350 Robert Dedman Dr, Austin, TX 78712, USA',
      venue_city: 'Austin',
      venue_country: 'USA',
      venue_lat: 30.2849,
      venue_lng: -97.7341,
      concert_date: '2026-04-04',
      concert_time: '19:30',
      program: JSON.stringify(['Lang Lang Recital Program']),
      ticket_url: 'https://www.langlangofficial.com/tour',
      venue_photo_url: null,
    },
    {
      musician_key: 'lang-lang',
      title: 'Lang Lang & Boston Symphony',
      venue_name: 'Symphony Hall Boston',
      venue_address: '301 Massachusetts Ave, Boston, MA 02115, USA',
      venue_city: 'Boston',
      venue_country: 'USA',
      venue_lat: 42.3426,
      venue_lng: -71.0858,
      concert_date: '2026-04-08',
      concert_time: '19:30',
      program: JSON.stringify(['Grieg - Piano Concerto', 'Dvořák - Symphony No. 9 "New World"']),
      ticket_url: 'https://www.bso.org/',
      venue_photo_url: null,
    },
    {
      musician_key: 'lang-lang',
      title: 'Lang Lang Recital - Wiener Konzerthaus',
      venue_name: 'Wiener Konzerthaus',
      venue_address: 'Lothringerstraße 20, 1030 Wien, Austria',
      venue_city: 'Vienna',
      venue_country: 'Austria',
      venue_lat: 48.2006,
      venue_lng: 16.3795,
      concert_date: '2026-05-21',
      concert_time: '19:30',
      program: JSON.stringify(['Lang Lang Recital Program']),
      ticket_url: 'https://konzerthaus.at/',
      venue_photo_url: null,
    },
    {
      musician_key: 'lang-lang',
      title: 'Lang Lang - Auditorium Parco della Musica',
      venue_name: 'Auditorium Parco della Musica Ennio Morricone',
      venue_address: 'Via Pietro de Coubertin 30, 00196 Roma, Italy',
      venue_city: 'Rome',
      venue_country: 'Italy',
      venue_lat: 41.9295,
      venue_lng: 12.4722,
      concert_date: '2026-05-25',
      concert_time: '20:30',
      program: JSON.stringify(['Lang Lang Recital Program']),
      ticket_url: 'https://www.auditorium.com/',
      venue_photo_url: null,
    },

    // ── 힐러리 한 실제 2026 투어 데이터 (출처: deutschegrammophon.com, cso.org, concertfix.com) ──
    {
      musician_key: 'hilary-hahn',
      title: 'Hilary Hahn - Kennedy Center (World Premiere)',
      venue_name: 'Kennedy Center',
      venue_address: '2700 F St NW, Washington, DC 20566, USA',
      venue_city: 'Washington',
      venue_country: 'USA',
      venue_lat: 38.8956,
      venue_lng: -77.0554,
      concert_date: '2026-03-12',
      concert_time: '20:00',
      program: JSON.stringify(['Simon - Double Concerto (World Premiere)']),
      ticket_url: 'https://www.kennedy-center.org/',
      venue_photo_url: null,
    },
    {
      musician_key: 'hilary-hahn',
      title: 'Hilary Hahn - Kennedy Center',
      venue_name: 'Kennedy Center',
      venue_address: '2700 F St NW, Washington, DC 20566, USA',
      venue_city: 'Washington',
      venue_country: 'USA',
      venue_lat: 38.8956,
      venue_lng: -77.0554,
      concert_date: '2026-03-13',
      concert_time: '20:00',
      program: JSON.stringify(['Simon - Double Concerto']),
      ticket_url: 'https://www.kennedy-center.org/',
      venue_photo_url: null,
    },
    {
      musician_key: 'hilary-hahn',
      title: 'Hilary Hahn Recital - Chicago Symphony Center',
      venue_name: 'Orchestra Hall at Symphony Center',
      venue_address: '220 S Michigan Ave, Chicago, IL 60604, USA',
      venue_city: 'Chicago',
      venue_country: 'USA',
      venue_lat: 41.8796,
      venue_lng: -87.6245,
      concert_date: '2026-05-24',
      concert_time: '19:30',
      program: JSON.stringify(['Ravel - Violin Sonata', 'Lam - Solitude d\'automne', 'Boulanger - Nocturne', 'Debussy - Violin Sonata']),
      ticket_url: 'https://cso.org/performances/25-26/scp-featured-concerts/hilary-hahn-in-recital/',
      venue_photo_url: null,
    },
    {
      musician_key: 'hilary-hahn',
      title: 'Hilary Hahn & Detroit Symphony - Mozart',
      venue_name: 'Detroit Symphony Orchestra Hall',
      venue_address: '3711 Woodward Ave, Detroit, MI 48201, USA',
      venue_city: 'Detroit',
      venue_country: 'USA',
      venue_lat: 42.3564,
      venue_lng: -83.0631,
      concert_date: '2026-06-11',
      concert_time: '19:30',
      program: JSON.stringify(['Mozart - Violin Concerto']),
      ticket_url: 'https://www.dso.org/',
      venue_photo_url: null,
    },
    {
      musician_key: 'hilary-hahn',
      title: 'Hilary Hahn & Detroit Symphony - Mozart',
      venue_name: 'Detroit Symphony Orchestra Hall',
      venue_address: '3711 Woodward Ave, Detroit, MI 48201, USA',
      venue_city: 'Detroit',
      venue_country: 'USA',
      venue_lat: 42.3564,
      venue_lng: -83.0631,
      concert_date: '2026-06-13',
      concert_time: '20:00',
      program: JSON.stringify(['Mozart - Violin Concerto']),
      ticket_url: 'https://www.dso.org/',
      venue_photo_url: null,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO concerts
      (musician_id, title, venue_name, venue_address, venue_city, venue_country,
       venue_lat, venue_lng, venue_photo_url, concert_date, concert_time, program, ticket_url)
    VALUES
      (@musician_id, @title, @venue_name, @venue_address, @venue_city, @venue_country,
       @venue_lat, @venue_lng, @venue_photo_url, @concert_date, @concert_time, @program, @ticket_url)
  `);

  const insertMany = db.transaction((concerts) => {
    for (const c of concerts) {
      const mid = musicianMap[c.musician_key];
      if (!mid) { console.warn(`No musician found for key: ${c.musician_key}`); continue; }
      insert.run({ ...c, musician_id: mid });
    }
  });

  insertMany(mockConcerts);
  console.log(`[DB] Seeded ${mockConcerts.length} mock concerts`);
}

function getDB() {
  if (!db) initDB();
  return db;
}

module.exports = { initDB, getDB };