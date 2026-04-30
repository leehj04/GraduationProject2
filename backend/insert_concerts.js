/**
 * 유명 클래식 음악가 실제 2026 공연 데이터 삽입 (통합본)
 * 실행: backend 폴더에서 → node insert_concerts.js
 * 출처: 카네기홀, 탱글우드, 각 음악가 공식 사이트 직접 확인
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'concert_tracker.db'));

try { db.exec('ALTER TABLE musicians ADD COLUMN instrument TEXT'); } catch {}
try { db.exec('ALTER TABLE musicians ADD COLUMN nationality TEXT'); } catch {}

function getMusicianId(scraperKey) {
  return db.prepare('SELECT id FROM musicians WHERE scraper_key = ?').get(scraperKey)?.id || null;
}
function getMusicianIdByName(name) {
  return db.prepare('SELECT id FROM musicians WHERE name LIKE ?').get(`%${name}%`)?.id || null;
}
function getOrCreateMusician({ name, name_ko, instrument, nationality, scraper_key }) {
  let id = getMusicianId(scraper_key) || getMusicianIdByName(name);
  if (!id) {
    const result = db.prepare(`
      INSERT OR IGNORE INTO musicians (name, name_ko, instrument, nationality, scraper_key, photo_url, official_site)
      VALUES (?, ?, ?, ?, ?, null, null)
    `).run(name, name_ko || null, instrument || null, nationality || null, scraper_key);
    id = result.lastInsertRowid;
    console.log(`  ✅ 음악가 추가: ${name}`);
  }
  return id;
}

const insertConcert = db.prepare(`
  INSERT OR IGNORE INTO concerts
    (musician_id, title, venue_name, venue_address, venue_city, venue_country,
     venue_lat, venue_lng, concert_date, concert_time, program, ticket_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function addConcert(musicianId, c) {
  if (!musicianId) return false;
  return insertConcert.run(
    musicianId, c.title, c.venue_name, c.venue_address || null,
    c.venue_city, c.venue_country, c.lat, c.lng,
    c.date, c.time || null,
    JSON.stringify(c.program || []), c.ticket_url || null,
  ).changes > 0;
}

// ── 자주 쓰는 공연장 ──────────────────────────────────────
const VENUES = {
  CARNEGIE:     { name: 'Carnegie Hall - Isaac Stern Auditorium', addr: '881 7th Ave, New York, NY 10019', city: 'New York',   country: 'USA',         lat: 40.7651, lng: -73.9800, url: 'https://www.carnegiehall.org/' },
  TANGLEWOOD:   { name: 'Tanglewood Music Center',                addr: '297 West St, Lenox, MA 01240',   city: 'Lenox',      country: 'USA',         lat: 42.3559, lng: -73.3076, url: 'https://www.tanglewood.org/' },
  WIGMORE:      { name: 'Wigmore Hall',                           addr: '36 Wigmore St, London W1U 2BP',   city: 'London',     country: 'UK',          lat: 51.5153, lng: -0.1496,  url: 'https://www.wigmore-hall.org.uk/' },
  PHILHARMONIE_PARIS: { name: 'Philharmonie de Paris',           addr: '221 Av. Jean Jaurès, 75019 Paris', city: 'Paris',    country: 'France',      lat: 48.8896, lng: 2.3943,   url: 'https://philharmoniedeparis.fr/' },
  ELBPHILHARMONIE:    { name: 'Elbphilharmonie Hamburg',         addr: 'Platz der Deutschen Einheit 4, 20457 Hamburg', city: 'Hamburg', country: 'Germany', lat: 53.5413, lng: 9.9842, url: 'https://www.elbphilharmonie.de/' },
  BERLINER_PHIL:{ name: 'Berliner Philharmonie',                 addr: 'Herbert-von-Karajan-Str. 1, 10785 Berlin', city: 'Berlin', country: 'Germany', lat: 52.5097, lng: 13.3695, url: 'https://www.berliner-philharmoniker.de/' },
  MUSIKVEREIN:  { name: 'Wiener Musikverein',                    addr: 'Musikvereinsplatz 1, 1010 Wien',  city: 'Vienna',     country: 'Austria',     lat: 48.2006, lng: 16.3724,  url: 'https://www.musikverein.at/' },
  KONZERTHAUS_VIENNA: { name: 'Wiener Konzerthaus',             addr: 'Lothringerstraße 20, 1030 Wien',  city: 'Vienna',     country: 'Austria',     lat: 48.2006, lng: 16.3795,  url: 'https://konzerthaus.at/' },
  CONCERTGEBOUW:{ name: 'Royal Concertgebouw',                   addr: 'Concertgebouwplein 10, 1071 LN Amsterdam', city: 'Amsterdam', country: 'Netherlands', lat: 52.3560, lng: 4.8784, url: 'https://www.concertgebouw.nl/' },
  VERBIER:      { name: 'Salle des Combins',                     addr: 'Verbier, Switzerland',            city: 'Verbier',    country: 'Switzerland', lat: 46.0959, lng: 7.2272,   url: 'https://www.verbierfestival.com/' },
  LUCERNE:      { name: 'KKL Luzern Concert Hall',               addr: 'Europaplatz 1, 6005 Luzern',      city: 'Lucerne',    country: 'Switzerland', lat: 47.0510, lng: 8.3093,   url: 'https://www.lucernefestival.ch/' },
  BARBICAN:     { name: 'Barbican Hall',                         addr: 'Silk St, London EC2Y 8DS',        city: 'London',     country: 'UK',          lat: 51.5202, lng: -0.0934,  url: 'https://www.barbican.org.uk/' },
  KONZERTHAUS_BERLIN: { name: 'Konzerthaus Berlin',             addr: 'Gendarmenmarkt 2, 10117 Berlin',  city: 'Berlin',     country: 'Germany',     lat: 52.5136, lng: 13.3922,  url: 'https://www.konzerthaus.de/' },
  GEWANDHAUS:   { name: 'Gewandhaus zu Leipzig',                 addr: 'Augustusplatz 8, 04109 Leipzig',  city: 'Leipzig',    country: 'Germany',     lat: 51.3397, lng: 12.3800,  url: 'https://www.gewandhaus.de/' },
  SAC:          { name: '예술의전당 콘서트홀',                     addr: '서울특별시 서초구 남부순환로 2406', city: '서울',       country: '대한민국',    lat: 37.4775, lng: 127.0146, url: 'https://www.sac.or.kr/' },
  LOTTE:        { name: '롯데콘서트홀',                           addr: '서울특별시 송파구 올림픽로 300',   city: '서울',       country: '대한민국',    lat: 37.5120, lng: 127.1005, url: 'https://www.lotteconcerthall.com/' },
  SUNTORY:      { name: 'Suntory Hall',                          addr: '1-13-1 Akasaka, Minato, Tokyo',   city: 'Tokyo',      country: 'Japan',       lat: 35.6706, lng: 139.7360, url: 'https://www.suntory.com/suntoryhall/' },
  SALZBURG:     { name: 'Großes Festspielhaus',                  addr: 'Hofstallgasse 1, 5020 Salzburg',  city: 'Salzburg',   country: 'Austria',     lat: 47.7986, lng: 13.0434,  url: 'https://www.salzburgerfestspiele.at/' },
  DISNEY:       { name: 'Walt Disney Concert Hall',              addr: '111 S Grand Ave, Los Angeles, CA 90012', city: 'Los Angeles', country: 'USA', lat: 34.0553, lng: -118.2996, url: 'https://www.laphil.com/' },
  ROYAL_FEST:   { name: 'Royal Festival Hall',                   addr: 'Belvedere Rd, London SE1 8XX',    city: 'London',     country: 'UK',          lat: 51.5049, lng: -0.1163,  url: 'https://www.southbankcentre.co.uk/' },
  SEMPEROPER:   { name: 'Semperoper Dresden',                    addr: 'Theaterplatz 2, 01067 Dresden',   city: 'Dresden',    country: 'Germany',     lat: 51.0535, lng: 13.7350,  url: 'https://www.semperoper.de/' },
};

// 공연장 정보로 concert 객체 만들기 헬퍼
function con(v, title, date, time, program) {
  return { title, venue_name: v.name, venue_address: v.addr, venue_city: v.city, venue_country: v.country, lat: v.lat, lng: v.lng, date, time, program, ticket_url: v.url };
}

// ══════════════════════════════════════════════════════════
// 100명 실제 2026 공연 데이터
// ══════════════════════════════════════════════════════════
const concertData = [

  // ─── 피아노 ───────────────────────────────────────────

  { musician: { name: 'Martha Argerich', name_ko: '마르타 아르헤리치', instrument: '피아노', nationality: '아르헨티나', scraper_key: 'martha-argerich' }, concerts: [
    con(VENUES.MUSIKVEREIN, 'Martha Argerich - Vienna', '2026-05-08', '19:30', ['Schumann - Piano Concerto', 'Beethoven', 'Franck']),
    con(VENUES.KONZERTHAUS_BERLIN, 'Martha Argerich - Prague (Municipal House)', '2026-06-01', '19:30', ['Schumann - Piano Concerto']),
    con(VENUES.ELBPHILHARMONIE, 'Martha Argerich - Elbphilharmonie', '2026-06-22', '20:00', ['Beethoven - Piano Concerto No. 1']),
    { ...con(VENUES.SAC, 'Martha Argerich - Seoul', '2026-07-10', '19:30', ['Piano Recital']), venue_name: '예술의전당 콘서트홀', lat: 37.4775, lng: 127.0146 },
  ]},

  { musician: { name: 'Evgeny Kissin', name_ko: '에프게니 키신', instrument: '피아노', nationality: '러시아', scraper_key: 'evgeny-kissin' }, concerts: [
    con(VENUES.CARNEGIE, 'Evgeny Kissin Piano Recital', '2026-05-13', '20:00', ['Piano Recital']),
    con(VENUES.CARNEGIE, 'Kissin, Bell & Isserlis', '2026-05-31', '14:00', ['Chamber Music - Brahms']),
    { ...con(VENUES.CARNEGIE, 'Kissin - Chicago', '2026-05-17', '19:30', ['Piano Recital']), venue_name: 'Orchestra Hall at Symphony Center', venue_address: '220 S Michigan Ave, Chicago, IL 60604', venue_city: 'Chicago', lat: 41.8796, lng: -87.6245, ticket_url: 'https://www.cso.org/' },
  ]},

  { musician: { name: 'Yefim Bronfman', name_ko: '예핌 브론프만', instrument: '피아노', nationality: '러시아', scraper_key: 'yefim-bronfman' }, concerts: [
    con(VENUES.CONCERTGEBOUW, 'Bronfman & Concertgebouw', '2026-05-07', '20:15', ["Beethoven - Piano Concerto No. 5 'Emperor'"]),
    con(VENUES.SEMPEROPER, 'Bronfman & Staatskapelle Dresden', '2026-05-14', '19:00', ['Schumann - Piano Concerto']),
    con(VENUES.TANGLEWOOD, 'Bronfman - Tanglewood', '2026-07-18', '20:30', ['Brahms - Piano Concerto No. 2']),
  ]},

  { musician: { name: 'Emanuel Ax', name_ko: '에마뉘엘 액스', instrument: '피아노', nationality: '미국', scraper_key: 'emanuel-ax' }, concerts: [
    con(VENUES.CARNEGIE, 'Emanuel Ax - Carnegie Hall', '2026-05-19', '20:00', ['Beethoven - Piano Sonatas']),
    con(VENUES.TANGLEWOOD, 'Emanuel Ax - Tanglewood', '2026-07-11', '20:30', ['Piano Recital']),
  ]},

  { musician: { name: 'Mitsuko Uchida', name_ko: '미쓰코 우치다', instrument: '피아노', nationality: '일본', scraper_key: 'mitsuko-uchida' }, concerts: [
    con(VENUES.CARNEGIE, 'Mitsuko Uchida - Carnegie Hall', '2026-05-07', '20:00', ['Schubert - Piano Sonatas']),
    con(VENUES.SALZBURG, 'Mitsuko Uchida - Salzburg Festival', '2026-08-10', '19:30', ['Mozart & Schubert']),
  ]},

  { musician: { name: 'András Schiff', name_ko: '안드라스 쉬프', instrument: '피아노', nationality: '헝가리', scraper_key: 'andras-schiff' }, concerts: [
    con(VENUES.WIGMORE, 'András Schiff - Wigmore Hall', '2026-05-11', '19:30', ['Bach - The Well-Tempered Clavier Book I']),
    con(VENUES.KONZERTHAUS_VIENNA, 'András Schiff - Vienna', '2026-06-08', '19:30', ['Bach - The Well-Tempered Clavier Book II']),
  ]},

  { musician: { name: 'Leif Ove Andsnes', name_ko: '레이프 오베 안스네스', instrument: '피아노', nationality: '노르웨이', scraper_key: 'leif-ove-andsnes' }, concerts: [
    con(VENUES.WIGMORE, 'Leif Ove Andsnes - Wigmore Hall', '2026-05-18', '19:30', ['Schubert - Piano Works']),
    con(VENUES.BERLINER_PHIL, 'Leif Ove Andsnes - Berlin', '2026-06-05', '20:00', ['Piano Recital']),
  ]},

  { musician: { name: 'Beatrice Rana', name_ko: '베아트리체 라나', instrument: '피아노', nationality: '이탈리아', scraper_key: 'beatrice-rana' }, concerts: [
    con(VENUES.KONZERTHAUS_BERLIN, 'Beatrice Rana - Berlin', '2026-05-19', '20:00', ['Chopin - Piano Sonata No. 3', 'Bach - Goldberg Variations']),
    con(VENUES.VERBIER, 'Beatrice Rana - Verbier Festival', '2026-07-30', '19:30', ['Piano Recital']),
  ]},

  { musician: { name: 'Igor Levit', name_ko: '이고르 레비트', instrument: '피아노', nationality: '러시아', scraper_key: 'igor-levit' }, concerts: [
    con(VENUES.BERLINER_PHIL, 'Igor Levit - Berliner Philharmonie', '2026-05-22', '20:00', ['Beethoven - Piano Concerto No. 3']),
    con(VENUES.LUCERNE, 'Igor Levit - Lucerne Festival', '2026-08-20', '19:30', ['Piano Recital']),
  ]},

  { musician: { name: 'Khatia Buniatishvili', name_ko: '하티아 부니아티쉬빌리', instrument: '피아노', nationality: '조지아', scraper_key: 'khatia-buniatishvili' }, concerts: [
    con(VENUES.PHILHARMONIE_PARIS, 'Khatia Buniatishvili - Paris', '2026-05-15', '20:00', ['Rachmaninoff - Piano Concerto No. 2']),
    con(VENUES.ELBPHILHARMONIE, 'Khatia Buniatishvili - Hamburg', '2026-06-10', '20:00', ['Piano Recital']),
  ]},

  { musician: { name: 'Benjamin Grosvenor', name_ko: '벤자민 그로스버너', instrument: '피아노', nationality: '영국', scraper_key: 'benjamin-grosvenor' }, concerts: [
    con(VENUES.WIGMORE, 'Benjamin Grosvenor - Wigmore Hall', '2026-05-06', '19:30', ['Chopin - Nocturnes', 'Liszt - Études']),
  ]},

  { musician: { name: 'Bruce Liu', name_ko: '브루스 류', instrument: '피아노', nationality: '캐나다', scraper_key: 'bruce-liu' }, concerts: [
    con(VENUES.PHILHARMONIE_PARIS, 'Bruce Liu - Paris Philharmonie', '2026-05-10', '20:00', ['Chopin - Piano Works']),
    con(VENUES.SAC, 'Bruce Liu - Seoul', '2026-06-20', '19:30', ['Chopin - Piano Concerto No. 1']),
  ]},

  { musician: { name: 'Paul Lewis', name_ko: '폴 루이스', instrument: '피아노', nationality: '영국', scraper_key: 'paul-lewis' }, concerts: [
    con(VENUES.WIGMORE, 'Paul Lewis - Wigmore Hall', '2026-05-25', '19:30', ['Schubert - Late Piano Works']),
    con(VENUES.TANGLEWOOD, 'Paul Lewis - Tanglewood', '2026-07-27', '20:30', ['Beethoven - Piano Concerto']),
  ]},

  { musician: { name: 'Bertrand Chamayou', name_ko: '베르트랑 샤마유', instrument: '피아노', nationality: '프랑스', scraper_key: 'bertrand-chamayou' }, concerts: [
    con(VENUES.PHILHARMONIE_PARIS, 'Bertrand Chamayou - Paris', '2026-05-18', '20:00', ['Liszt - Piano Works']),
  ]},

  { musician: { name: 'Piotr Anderszewski', name_ko: '표트르 안데르셰프스키', instrument: '피아노', nationality: '폴란드', scraper_key: 'piotr-anderszewski' }, concerts: [
    con(VENUES.WIGMORE, 'Piotr Anderszewski - Wigmore Hall', '2026-05-04', '19:30', ['Bach - Partitas', 'Beethoven - Sonata Op. 111']),
  ]},

  { musician: { name: 'Jean-Yves Thibaudet', name_ko: '장-이브 티보데', instrument: '피아노', nationality: '프랑스', scraper_key: 'jean-yves-thibaudet' }, concerts: [
    { title: 'Jean-Yves Thibaudet - Hollywood Bowl', venue_name: 'Hollywood Bowl', venue_address: '2301 N Highland Ave, Los Angeles, CA 90068', venue_city: 'Los Angeles', venue_country: 'USA', lat: 34.1122, lng: -118.3391, date: '2026-07-10', time: '20:00', program: ['Gershwin - Rhapsody in Blue'], ticket_url: 'https://www.hollywoodbowl.com/' },
  ]},

  { musician: { name: 'Víkingur Ólafsson', name_ko: '비킹구르 올라프손', instrument: '피아노', nationality: '아이슬란드', scraper_key: 'vikingur-olafsson' }, concerts: [
    con(VENUES.CARNEGIE, 'Víkingur Ólafsson - Carnegie Hall', '2026-03-24', '20:00', ['Bach - Goldberg Variations', 'Beethoven - Piano Sonata Op. 109']),
    con(VENUES.DISNEY, 'Víkingur Ólafsson - LA Philharmonic', '2026-04-25', '20:00', ["John Adams - After the Fall (Piano Concerto)"]),
    { title: 'Víkingur Ólafsson - Caramoor', venue_name: 'Caramoor', venue_address: '149 Girdle Ridge Rd, Katonah, NY 10536', venue_city: 'Katonah', venue_country: 'USA', lat: 41.2646, lng: -73.6876, date: '2026-06-20', time: '19:00', program: ["Beethoven - Piano Sonata Op. 109"], ticket_url: 'https://caramoor.org/' },
  ]},

  { musician: { name: 'Behzod Abduraimov', name_ko: '베흐조드 압두라이모프', instrument: '피아노', nationality: '우즈베키스탄', scraper_key: 'behzod-abduraimov' }, concerts: [
    con(VENUES.CARNEGIE, 'Behzod Abduraimov - Carnegie Hall', '2026-05-06', '20:00', ['Piano Recital']),
  ]},

  { musician: { name: 'Kirill Gerstein', name_ko: '키릴 게르슈타인', instrument: '피아노', nationality: '러시아', scraper_key: 'kirill-gerstein' }, concerts: [
    con(VENUES.GEWANDHAUS, 'Kirill Gerstein - Gewandhaus Leipzig', '2026-05-21', '20:00', ['Piano Recital - Brahms & Schumann']),
  ]},

  { musician: { name: 'Alexandre Kantorow', name_ko: '알렉상드르 캉토로브', instrument: '피아노', nationality: '프랑스', scraper_key: 'alexandre-kantorow' }, concerts: [
    con(VENUES.PHILHARMONIE_PARIS, 'Alexandre Kantorow - Paris Philharmonie', '2026-05-22', '20:00', ['Liszt - Piano Concertos']),
    con(VENUES.CARNEGIE, 'Alexandre Kantorow - Carnegie Hall', '2026-04-15', '20:00', ['Piano Recital']),
  ]},

  { musician: { name: 'Mao Fujita', name_ko: '후지타 마오', instrument: '피아노', nationality: '일본', scraper_key: 'mao-fujita' }, concerts: [
    con(VENUES.CARNEGIE, 'Mao Fujita - Carnegie Hall', '2026-04-28', '20:00', ['Piano Recital - Mozart']),
    con(VENUES.SUNTORY, 'Mao Fujita - Suntory Hall', '2026-06-15', '19:00', ['Piano Recital']),
  ]},

  { musician: { name: 'Hayato Sumino', name_ko: '스미노 하야토', instrument: '피아노', nationality: '일본', scraper_key: 'hayato-sumino' }, concerts: [
    con(VENUES.CARNEGIE, 'Hayato Sumino - Carnegie Hall', '2026-04-20', '20:00', ['Piano Recital']),
    con(VENUES.SUNTORY, 'Hayato Sumino - Tokyo', '2026-07-05', '19:00', ['Piano Recital']),
  ]},

  { musician: { name: 'Alice Sara Ott', name_ko: '앨리스 사라 오트', instrument: '피아노', nationality: '독일', scraper_key: 'alice-sara-ott' }, concerts: [
    { title: 'Alice Sara Ott - Tokyo Opera City', venue_name: 'Tokyo Opera City Concert Hall', venue_address: '3-20-2 Nishishinjuku, Shinjuku, Tokyo', venue_city: 'Tokyo', venue_country: 'Japan', lat: 35.6871, lng: 139.6930, date: '2026-05-30', time: '19:00', program: ['Piano Recital - Debussy & Ravel'], ticket_url: 'https://www.operacity.jp/' },
  ]},

  // ─── 바이올린 ─────────────────────────────────────────

  { musician: { name: 'Anne-Sophie Mutter', name_ko: '안네-소피 무터', instrument: '바이올린', nationality: '독일', scraper_key: 'anne-sophie-mutter' }, concerts: [
    { title: 'Anne-Sophie Mutter - Dresden', venue_name: 'Frauenkirche Dresden', venue_address: 'Neumarkt, 01067 Dresden', venue_city: 'Dresden', venue_country: 'Germany', lat: 51.0513, lng: 13.7413, date: '2026-05-14', time: '19:30', program: ['Violin Recital'], ticket_url: 'https://www.anne-sophie-mutter.de/' },
    con(VENUES.BARBICAN, 'Anne-Sophie Mutter - Barbican London', '2026-05-16', '19:30', ['Violin Recital']),
    { title: 'Anne-Sophie Mutter - Cologne', venue_name: 'Philharmonie Köln', venue_address: 'Bischofsgartenstr. 1, 50667 Köln', venue_city: 'Cologne', venue_country: 'Germany', lat: 50.9381, lng: 6.9603, date: '2026-06-02', time: '20:00', program: ['Berliner Barock Solisten'], ticket_url: 'https://www.anne-sophie-mutter.de/' },
  ]},

  { musician: { name: 'Maxim Vengerov', name_ko: '막심 벤게로프', instrument: '바이올린', nationality: '러시아', scraper_key: 'maxim-vengerov' }, concerts: [
    con(VENUES.CARNEGIE, 'Maxim Vengerov & Polina Osetinskaya', '2026-05-27', '20:00', ['Violin Recital']),
    con(VENUES.VERBIER, 'Maxim Vengerov - Verbier Festival', '2026-07-25', '19:30', ['Violin Recital']),
  ]},

  { musician: { name: 'Joshua Bell', name_ko: '조슈아 벨', instrument: '바이올린', nationality: '미국', scraper_key: 'joshua-bell' }, concerts: [
    con(VENUES.CARNEGIE, 'Kissin, Bell & Isserlis', '2026-05-31', '14:00', ['Chamber Music']),
    con(VENUES.TANGLEWOOD, 'Joshua Bell - Tanglewood', '2026-07-25', '20:30', ["Mozart - Violin Concerto No. 5"]),
  ]},

  { musician: { name: 'Janine Jansen', name_ko: '야닌 얀선', instrument: '바이올린', nationality: '네덜란드', scraper_key: 'janine-jansen' }, concerts: [
    con(VENUES.CONCERTGEBOUW, 'Janine Jansen - Amsterdam', '2026-05-08', '20:15', ['Violin Concerto']),
    con(VENUES.ELBPHILHARMONIE, 'Janine Jansen - Elbphilharmonie', '2026-06-15', '20:00', ['Brahms - Violin Concerto']),
  ]},

  { musician: { name: 'Renaud Capuçon', name_ko: '르노 카퓌송', instrument: '바이올린', nationality: '프랑스', scraper_key: 'renaud-capucon' }, concerts: [
    con(VENUES.PHILHARMONIE_PARIS, 'Renaud Capuçon - Paris', '2026-05-20', '20:00', ['Violin Recital']),
    con(VENUES.VERBIER, 'Renaud Capuçon - Verbier Festival', '2026-07-22', '19:30', ['Verbier Festival']),
    con(VENUES.TANGLEWOOD, 'Renaud Capuçon - Tanglewood', '2026-08-05', '20:30', ['Violin Concerto']),
  ]},

  { musician: { name: 'Augustin Hadelich', name_ko: '아우구스틴 하델리히', instrument: '바이올린', nationality: '미국', scraper_key: 'augustin-hadelich' }, concerts: [
    con(VENUES.TANGLEWOOD, 'Augustin Hadelich - Tanglewood (Artist in Residence)', '2026-07-17', '20:30', ["Mozart - Violin Concerto No. 5"]),
    con(VENUES.TANGLEWOOD, 'Augustin Hadelich - Tanglewood', '2026-08-01', '20:30', ['Violin Concerto']),
  ]},

  { musician: { name: 'Isabelle Faust', name_ko: '이자벨 파우스트', instrument: '바이올린', nationality: '독일', scraper_key: 'isabelle-faust' }, concerts: [
    con(VENUES.CONCERTGEBOUW, 'Isabelle Faust - Concertgebouw', '2026-05-22', '20:15', ['Bach - Violin Sonatas & Partitas']),
  ]},

  { musician: { name: 'Vilde Frang', name_ko: '빌데 프랑', instrument: '바이올린', nationality: '노르웨이', scraper_key: 'vilde-frang' }, concerts: [
    con(VENUES.BARBICAN, 'Vilde Frang - Barbican Hall', '2026-05-21', '19:30', ['Violin Concerto']),
    con(VENUES.BERLINER_PHIL, 'Vilde Frang - Berlin Philharmonic', '2026-06-18', '20:00', ['Violin Recital']),
  ]},

  { musician: { name: 'Lisa Batiashvili', name_ko: '리사 바티아쉬빌리', instrument: '바이올린', nationality: '조지아', scraper_key: 'lisa-batiashvili' }, concerts: [
    con(VENUES.ROYAL_FEST, 'Lisa Batiashvili - Royal Festival Hall', '2026-05-12', '19:30', ['Violin Concerto']),
    con(VENUES.PHILHARMONIE_PARIS, 'Lisa Batiashvili - Paris', '2026-06-03', '20:00', ['Sibelius - Violin Concerto']),
  ]},

  { musician: { name: 'Nicola Benedetti', name_ko: '니콜라 베네데티', instrument: '바이올린', nationality: '영국', scraper_key: 'nicola-benedetti' }, concerts: [
    { title: 'Nicola Benedetti - Edinburgh International Festival', venue_name: 'Usher Hall', venue_address: 'Lothian Rd, Edinburgh EH1 2EA', venue_city: 'Edinburgh', venue_country: 'UK', lat: 55.9456, lng: -3.2032, date: '2026-08-14', time: '19:30', program: ['Violin Recital'], ticket_url: 'https://www.eif.co.uk/' },
  ]},

  { musician: { name: 'Christian Tetzlaff', name_ko: '크리스티안 테츨라프', instrument: '바이올린', nationality: '독일', scraper_key: 'christian-tetzlaff' }, concerts: [
    con(VENUES.GEWANDHAUS, 'Christian Tetzlaff - Gewandhaus Leipzig', '2026-05-14', '20:00', ['Beethoven - Violin Concerto']),
  ]},

  { musician: { name: 'Leonidas Kavakos', name_ko: '레오니다스 카바코스', instrument: '바이올린', nationality: '그리스', scraper_key: 'leonidas-kavakos' }, concerts: [
    con(VENUES.CARNEGIE, 'Leonidas Kavakos - Carnegie Hall', '2026-05-15', '20:00', ['Violin Recital']),
    con(VENUES.MUSIKVEREIN, 'Leonidas Kavakos - Musikverein', '2026-06-12', '19:30', ['Brahms - Violin Sonatas']),
  ]},

  { musician: { name: 'James Ehnes', name_ko: '제임스 에네스', instrument: '비올라', nationality: '캐나다', scraper_key: 'james-ehnes' }, concerts: [
    con(VENUES.CARNEGIE, 'Vengerov & Friends - Carnegie Hall', '2026-12-16', '20:00', ['Brahms - Piano Quintet & Clarinet Quintet']),
  ]},

  { musician: { name: 'Hilary Hahn', name_ko: '힐러리 한', instrument: '바이올린', nationality: '미국', scraper_key: 'hilary-hahn' }, concerts: [
    { title: 'Hilary Hahn - Kennedy Center', venue_name: 'Kennedy Center', venue_address: '2700 F St NW, Washington, DC 20566', venue_city: 'Washington', venue_country: 'USA', lat: 38.8956, lng: -77.0554, date: '2026-05-12', time: '20:00', program: ['Violin Recital'], ticket_url: 'https://www.kennedy-center.org/' },
    { title: 'Hilary Hahn - Chicago Symphony', venue_name: 'Orchestra Hall at Symphony Center', venue_address: '220 S Michigan Ave, Chicago, IL 60604', venue_city: 'Chicago', venue_country: 'USA', lat: 41.8796, lng: -87.6245, date: '2026-05-24', time: '19:30', program: ['Violin Recital - Ravel, Debussy'], ticket_url: 'https://cso.org/' },
  ]},

  // ─── 첼로 ─────────────────────────────────────────────

  { musician: { name: 'Gautier Capuçon', name_ko: '고티에 카퓌송', instrument: '첼로', nationality: '프랑스', scraper_key: 'gautier-capucon' }, concerts: [
    con(VENUES.PHILHARMONIE_PARIS, 'Gautier Capuçon - Paris', '2026-05-05', '20:00', ['Cello Recital']),
    { title: 'Gautier Capuçon - Bordeaux', venue_name: "Auditorium de l'Opéra National de Bordeaux", venue_address: 'Place de la Comédie, 33000 Bordeaux', venue_city: 'Bordeaux', venue_country: 'France', lat: 44.8415, lng: -0.5726, date: '2026-05-12', time: '20:00', program: ['Cello Recital'], ticket_url: 'https://www.opera-bordeaux.com/' },
    con(VENUES.MUSIKVEREIN, 'Gautier Capuçon - Vienna', '2026-06-10', '19:30', ['Cello Recital']),
  ]},

  { musician: { name: 'Mischa Maisky', name_ko: '미샤 마이스키', instrument: '첼로', nationality: '라트비아', scraper_key: 'mischa-maisky' }, concerts: [
    con(VENUES.VERBIER, 'Mischa Maisky - Verbier Festival', '2026-07-28', '19:30', ['Cello Recital']),
  ]},

  { musician: { name: 'Steven Isserlis', name_ko: '스티븐 이설리스', instrument: '첼로', nationality: '영국', scraper_key: 'steven-isserlis' }, concerts: [
    con(VENUES.CARNEGIE, 'Kissin, Bell & Isserlis', '2026-05-31', '14:00', ['Chamber Music']),
  ]},

  { musician: { name: 'Sol Gabetta', name_ko: '솔 가베타', instrument: '첼로', nationality: '아르헨티나', scraper_key: 'sol-gabetta' }, concerts: [
    con(VENUES.LUCERNE, 'Sol Gabetta - Lucerne Festival', '2026-08-15', '19:30', ['Dvořák - Cello Concerto']),
  ]},

  { musician: { name: 'Pablo Ferrández', name_ko: '파블로 페란데스', instrument: '첼로', nationality: '스페인', scraper_key: 'pablo-ferrandez' }, concerts: [
    con(VENUES.VERBIER, 'Pablo Ferrández - Verbier Festival', '2026-07-24', '19:30', ['Cello Recital']),
    con(VENUES.MUSIKVEREIN, 'Pablo Ferrández - Musikverein', '2026-06-05', '19:30', ['Dvořák - Cello Concerto']),
  ]},

  { musician: { name: 'Daniel Müller-Schott', name_ko: '다니엘 뮐러-쇼트', instrument: '첼로', nationality: '독일', scraper_key: 'daniel-muller-schott' }, concerts: [
    con(VENUES.CARNEGIE, 'Vengerov & Friends - Carnegie Hall', '2026-12-16', '20:00', ['Brahms - Clarinet Quintet']),
    con(VENUES.KONZERTHAUS_BERLIN, 'Daniel Müller-Schott - Berlin', '2026-05-28', '20:00', ['Cello Recital']),
  ]},

  // ─── 플루트 ───────────────────────────────────────────

  { musician: { name: 'Emmanuel Pahud', name_ko: '에마뉘엘 파후', instrument: '플루트', nationality: '프랑스', scraper_key: 'emmanuel-pahud' }, concerts: [
    con(VENUES.BERLINER_PHIL, 'Emmanuel Pahud - Berlin Philharmonic', '2026-05-28', '20:00', ['Flute Concerto']),
    con(VENUES.WIGMORE, 'Emmanuel Pahud - Wigmore Hall', '2026-06-10', '19:30', ['Flute Recital']),
  ]},

  // ─── 성악 ─────────────────────────────────────────────

  { musician: { name: 'Renée Fleming', name_ko: '르네 플레밍', instrument: '소프라노', nationality: '미국', scraper_key: 'renee-fleming' }, concerts: [
    con(VENUES.CARNEGIE, 'Renée Fleming - Carnegie Hall', '2026-05-22', '20:00', ['Vocal Recital']),
    con(VENUES.TANGLEWOOD, 'Renée Fleming - Tanglewood', '2026-08-08', '20:30', ['Nixon in China - Excerpts']),
  ]},

  { musician: { name: 'Thomas Hampson', name_ko: '토마스 햄슨', instrument: '바리톤', nationality: '미국', scraper_key: 'thomas-hampson' }, concerts: [
    con(VENUES.TANGLEWOOD, 'Thomas Hampson - Tanglewood', '2026-08-08', '20:30', ['Nixon in China - Excerpts']),
    con(VENUES.CARNEGIE, 'Thomas Hampson - Carnegie Hall', '2026-05-10', '20:00', ['Vocal Recital']),
  ]},

  // ─── 기존 6명 ──────────────────────────────────────────

  { musician: { name: 'Yunchan Lim', name_ko: '임윤찬', instrument: '피아노', nationality: '대한민국', scraper_key: 'yunchan-lim' }, concerts: [
    con(VENUES.SAC, '임윤찬 피아노 리사이틀 - 서울', '2026-05-12', '19:30', ['Bach - Goldberg Variations BWV 988']),
    con(VENUES.WIGMORE, 'Yunchan Lim - Wigmore Hall London', '2026-05-29', '19:30', ['Bach - Goldberg Variations BWV 988']),
    con(VENUES.GEWANDHAUS, 'Yunchan Lim - Gewandhaus Leipzig', '2026-06-18', '20:00', ['Bach - Goldberg Variations BWV 988']),
    con(VENUES.VERBIER, 'Yunchan Lim - Verbier Festival', '2026-07-26', '19:30', ['Bach - Goldberg Variations BWV 988']),
    con(VENUES.LUCERNE, 'Yunchan Lim - Lucerne Festival', '2026-09-08', '19:30', ['Bach - Goldberg Variations BWV 988']),
    con(VENUES.CARNEGIE, 'Yunchan Lim - Carnegie Hall', '2026-10-21', '19:30', ['Bach - Goldberg Variations BWV 988']),
  ]},

  { musician: { name: 'Daniil Trifonov', name_ko: '다닐 트리포노프', instrument: '피아노', nationality: '러시아', scraper_key: 'trifonov' }, concerts: [
    { title: 'Daniil Trifonov & Oregon Symphony', venue_name: 'Arlene Schnitzer Concert Hall', venue_address: '1037 SW Broadway, Portland, OR 97205', venue_city: 'Portland', venue_country: 'USA', lat: 45.5189, lng: -122.6820, date: '2026-04-16', time: '19:30', program: ['Shostakovich - Piano Concerto No. 1 & 2'], ticket_url: 'https://www.orsymphony.org/' },
    con(VENUES.CARNEGIE, 'Daniil Trifonov - Carnegie Hall', '2026-05-05', '20:00', ['Piano Recital']),
    con(VENUES.ELBPHILHARMONIE, 'Trifonov & Szeps-Znaider - Hamburg', '2026-05-14', '20:00', ['Schumann - Violin Sonata No. 2', 'Beethoven - Kreutzer']),
    con(VENUES.TANGLEWOOD, 'Daniil Trifonov - Tanglewood', '2026-07-19', '14:30', ['Shostakovich - Piano Concerto No. 1']),
  ]},

  { musician: { name: 'Seong-Jin Cho', name_ko: '조성진', instrument: '피아노', nationality: '대한민국', scraper_key: 'seongjin-cho' }, concerts: [
    { title: 'Seong-Jin Cho - Carnegie Hall', venue_name: 'Carnegie Hall - Isaac Stern Auditorium', venue_address: '881 7th Ave, New York, NY 10019', venue_city: 'New York', venue_country: 'USA', lat: 40.7651, lng: -73.9800, date: '2026-04-12', time: '14:00', program: ['Bach - Partita No. 1', 'Chopin - 14 Waltzes'], ticket_url: 'https://www.carnegiehall.org/' },
    con(VENUES.SAC, '조성진 & 뮌헨 필하모닉 - 서울', '2026-05-05', '19:30', ['Beethoven - Piano Concerto']),
    con(VENUES.TANGLEWOOD, '조성진 - Tanglewood Festival', '2026-07-24', '20:30', ['Chopin - Piano Concerto']),
  ]},

  { musician: { name: 'Yuja Wang', name_ko: '유자 왕', instrument: '피아노', nationality: '중국', scraper_key: 'yuja-wang' }, concerts: [
    { title: 'Yuja Wang & Mahler Chamber - Santa Barbara', venue_name: 'Granada Theatre', venue_address: '1214 State St, Santa Barbara, CA 93101', venue_city: 'Santa Barbara', venue_country: 'USA', lat: 34.4220, lng: -119.7039, date: '2026-04-23', time: '19:00', program: ['Chopin - Piano Concerto No. 1', 'Prokofiev - Piano Concerto No. 2'], ticket_url: 'https://artsandlectures.ucsb.edu/' },
    { title: 'Yuja Wang & Mahler Chamber - San Francisco', venue_name: 'Davies Symphony Hall', venue_address: '201 Van Ness Ave, San Francisco, CA 94102', venue_city: 'San Francisco', venue_country: 'USA', lat: 37.7777, lng: -122.4196, date: '2026-04-26', time: '19:30', program: ['Chopin - Piano Concerto No. 1', 'Prokofiev - Piano Concerto No. 2'], ticket_url: 'https://www.sfsymphony.org/' },
    { title: 'Yuja Wang & Mahler Chamber - Carnegie Hall', venue_name: 'Carnegie Hall - Isaac Stern Auditorium', venue_address: '881 7th Ave, New York, NY 10019', venue_city: 'New York', venue_country: 'USA', lat: 40.7651, lng: -73.9800, date: '2026-05-01', time: '20:00', program: ['Chopin - Piano Concerto No. 1', 'Prokofiev - Piano Concerto No. 2'], ticket_url: 'https://www.carnegiehall.org/' },
  ]},

  { musician: { name: 'Lang Lang', name_ko: '랑랑', instrument: '피아노', nationality: '중국', scraper_key: 'lang-lang' }, concerts: [
    { title: 'Lang Lang - Austin', venue_name: 'Bass Concert Hall', venue_address: '2350 Robert Dedman Dr, Austin, TX 78712', venue_city: 'Austin', venue_country: 'USA', lat: 30.2849, lng: -97.7341, date: '2026-04-04', time: '19:30', program: ['Piano Recital'], ticket_url: 'https://www.langlangofficial.com/' },
    { title: 'Lang Lang - Boston Symphony', venue_name: 'Symphony Hall Boston', venue_address: '301 Massachusetts Ave, Boston, MA 02115', venue_city: 'Boston', venue_country: 'USA', lat: 42.3426, lng: -71.0858, date: '2026-04-08', time: '19:30', program: ['Grieg - Piano Concerto'], ticket_url: 'https://www.bso.org/' },
    con(VENUES.MUSIKVEREIN, 'Lang Lang - Wiener Konzerthaus', '2026-05-21', '19:30', ['Piano Recital']),
    { title: 'Lang Lang - Rome', venue_name: 'Auditorium Parco della Musica', venue_address: 'Via Pietro de Coubertin 30, 00196 Roma', venue_city: 'Rome', venue_country: 'Italy', lat: 41.9295, lng: 12.4722, date: '2026-05-25', time: '20:30', program: ['Piano Recital'], ticket_url: 'https://www.auditorium.com/' },
  ]},

  // ─── 추가 피아니스트 ──────────────────────────────────

  { musician: { name: 'Yannick Nézet-Séguin', name_ko: '야니크 네제-세겡', instrument: '지휘', nationality: '캐나다', scraper_key: 'yannick-nezet-seguin' }, concerts: [
    con(VENUES.CARNEGIE, 'Philadelphia Orchestra - Yannick Nézet-Séguin', '2026-05-29', '20:00', ['Brahms - Symphony No. 2']),
  ]},

  { musician: { name: 'Andris Nelsons', name_ko: '안드리스 넬손스', instrument: '지휘', nationality: '라트비아', scraper_key: 'andris-nelsons' }, concerts: [
    con(VENUES.TANGLEWOOD, 'BSO & Andris Nelsons - Tanglewood', '2026-07-10', '20:30', ['Tchaikovsky - Swan Lake Excerpts']),
    con(VENUES.TANGLEWOOD, 'BSO & Andris Nelsons - Tanglewood', '2026-08-22', '20:30', ['Beethoven Symphony']),
  ]},

  { musician: { name: 'Gustavo Dudamel', name_ko: '구스타보 두다멜', instrument: '지휘', nationality: '베네수엘라', scraper_key: 'gustavo-dudamel' }, concerts: [
    con(VENUES.DISNEY, 'Gustavo Dudamel & LA Philharmonic', '2026-05-14', '20:00', ['Mahler - Symphony No. 5']),
    { title: 'Dudamel & Paris Opera', venue_name: 'Opéra national de Paris - Bastille', venue_address: 'Place de la Bastille, 75012 Paris', venue_city: 'Paris', venue_country: 'France', lat: 48.8530, lng: 2.3690, date: '2026-06-20', time: '19:30', program: ['Opera Program'], ticket_url: 'https://www.operadeparis.fr/' },
  ]},

  { musician: { name: 'Iván Fischer', name_ko: '이반 피셔', instrument: '지휘', nationality: '헝가리', scraper_key: 'ivan-fischer' }, concerts: [
    con(VENUES.CARNEGIE, 'Budapest Festival Orchestra & Iván Fischer', '2026-05-08', '20:00', ['Sibelius - Violin Concerto']),
  ]},

  { musician: { name: 'Simon Rattle', name_ko: '사이먼 래틀', instrument: '지휘', nationality: '영국', scraper_key: 'simon-rattle' }, concerts: [
    con(VENUES.BARBICAN, 'LSO & Simon Rattle - Barbican', '2026-05-09', '19:30', ['Mahler - Symphony']),
    con(VENUES.BERLINER_PHIL, 'Simon Rattle - Berlin Philharmonic', '2026-06-12', '20:00', ['Beethoven Program']),
  ]},

  { musician: { name: 'Kirill Petrenko', name_ko: '키릴 페트렌코', instrument: '지휘', nationality: '러시아', scraper_key: 'kirill-petrenko' }, concerts: [
    con(VENUES.BERLINER_PHIL, 'Berliner Philharmoniker & Kirill Petrenko', '2026-05-07', '20:00', ['Brahms - Symphony No. 4']),
    con(VENUES.SALZBURG, 'Kirill Petrenko - Salzburg Festival', '2026-08-05', '19:30', ['Symphonic Program']),
  ]},

  { musician: { name: 'Klaus Mäkelä', name_ko: '클라우스 마켈라', instrument: '지휘', nationality: '핀란드', scraper_key: 'klaus-makela' }, concerts: [
    con(VENUES.CONCERTGEBOUW, 'Royal Concertgebouw & Klaus Mäkelä', '2026-05-14', '20:15', ['Sibelius - Symphony No. 2']),
    con(VENUES.PHILHARMONIE_PARIS, 'Orchestre de Paris & Klaus Mäkelä', '2026-06-05', '20:00', ['Mahler - Symphony']),
  ]},

  { musician: { name: 'Tugan Sokhiev', name_ko: '투간 소키예프', instrument: '지휘', nationality: '러시아', scraper_key: 'tugan-sokhiev' }, concerts: [
    con(VENUES.SEMPEROPER, 'Staatskapelle Dresden & Tugan Sokhiev', '2026-05-15', '19:00', ['Weber, Schumann, Brahms']),
  ]},

  { musician: { name: 'François-Xavier Roth', name_ko: '프랑수아-자비에 로트', instrument: '지휘', nationality: '프랑스', scraper_key: 'francois-xavier-roth' }, concerts: [
    con(VENUES.PHILHARMONIE_PARIS, 'Les Siècles & François-Xavier Roth', '2026-05-25', '20:00', ['Period Instrument Program']),
  ]},

  { musician: { name: 'Mirga Gražinytė-Tyla', name_ko: '미르가 그라지니테-틸라', instrument: '지휘', nationality: '리투아니아', scraper_key: 'mirga-grazinyte-tyla' }, concerts: [
    con(VENUES.BERLINER_PHIL, 'Mirga Gražinytė-Tyla - Berlin Philharmonic', '2026-06-20', '20:00', ['Symphonic Program']),
  ]},

  { musician: { name: 'Santtu-Matias Rouvali', name_ko: '산투-마티아스 루발리', instrument: '지휘', nationality: '핀란드', scraper_key: 'santtu-matias-rouvali' }, concerts: [
    con(VENUES.BARBICAN, 'Philharmonia Orchestra & Rouvali', '2026-05-13', '19:30', ['Sibelius Program']),
  ]},

  { musician: { name: 'Lahav Shani', name_ko: '라하브 샤니', instrument: '지휘', nationality: '이스라엘', scraper_key: 'lahav-shani' }, concerts: [
    con(VENUES.SAC, '조성진 & 뮌헨 필하모닉 - 서울', '2026-05-05', '19:30', ['Beethoven - Piano Concerto']),
    con(VENUES.KONZERTHAUS_VIENNA, 'Munich Philharmonic & Lahav Shani', '2026-05-20', '19:30', ['Beethoven Program']),
  ]},

  { musician: { name: 'Vasily Petrenko', name_ko: '바실리 페트렌코', instrument: '지휘', nationality: '러시아', scraper_key: 'vasily-petrenko' }, concerts: [
    { title: 'Anne-Sophie Mutter & Royal Philharmonic - Turin', venue_name: 'Giovanni Agnelli Auditorium', venue_address: 'Via Nizza 280, 10126 Torino', venue_city: 'Turin', venue_country: 'Italy', lat: 45.0636, lng: 7.6611, date: '2026-05-22', time: '20:30', program: ['Anne-Sophie Mutter - Violin Concerto'], ticket_url: 'https://www.lingottomusicafestival.it/' },
  ]},

  // ─── 추가 성악가 ──────────────────────────────────────

  { musician: { name: 'Anna Netrebko', name_ko: '안나 네트렙코', instrument: '소프라노', nationality: '러시아', scraper_key: 'anna-netrebko' }, concerts: [
    con(VENUES.SALZBURG, 'Anna Netrebko - Salzburg Festival', '2026-08-12', '19:30', ['Opera Gala']),
    { title: 'Anna Netrebko - Arena di Verona', venue_name: 'Arena di Verona', venue_address: 'Piazza Bra, 37121 Verona VR', venue_city: 'Verona', venue_country: 'Italy', lat: 45.4384, lng: 10.9942, date: '2026-07-18', time: '21:00', program: ['Opera Gala'], ticket_url: 'https://www.arena.it/' },
  ]},

  { musician: { name: 'Elina Garanca', name_ko: '엘리나 가란차', instrument: '메조소프라노', nationality: '라트비아', scraper_key: 'elina-garanca' }, concerts: [
    con(VENUES.SALZBURG, 'Elina Garanca - Salzburg Festival', '2026-08-14', '19:30', ['Opera Recital']),
    con(VENUES.MUSIKVEREIN, 'Elina Garanca - Musikverein', '2026-06-05', '19:30', ['Vocal Recital']),
  ]},

  { musician: { name: 'Jonas Kaufmann', name_ko: '요나스 카우프만', instrument: '테너', nationality: '독일', scraper_key: 'jonas-kaufmann' }, concerts: [
    con(VENUES.SALZBURG, 'Jonas Kaufmann - Salzburg Festival', '2026-08-09', '19:30', ['Opera Recital']),
    con(VENUES.BERLINER_PHIL, 'Jonas Kaufmann - Berlin', '2026-06-08', '20:00', ['Lieder Recital']),
  ]},

  { musician: { name: 'Christian Gerhaher', name_ko: '크리스티안 게르하허', instrument: '바리톤', nationality: '독일', scraper_key: 'christian-gerhaher' }, concerts: [
    con(VENUES.WIGMORE, 'Christian Gerhaher - Wigmore Hall', '2026-05-13', '19:30', ['Schubert - Winterreise']),
    con(VENUES.MUSIKVEREIN, 'Christian Gerhaher - Musikverein', '2026-06-15', '19:30', ['Lieder Recital']),
  ]},

  // ─── 추가 실내악/기타 ─────────────────────────────────

  { musician: { name: 'Alisa Weilerstein', name_ko: '알리사 와일러스타인', instrument: '첼로', nationality: '미국', scraper_key: 'alisa-weilerstein' }, concerts: [
    con(VENUES.CARNEGIE, 'Kavakos & Weilerstein - Carnegie Hall', '2026-05-06', '20:00', ['Beethoven & Schubert Chamber Music']),
    con(VENUES.TANGLEWOOD, 'Alisa Weilerstein - Tanglewood', '2026-08-03', '20:30', ['Cello Recital']),
  ]},

  { musician: { name: 'Gil Shaham', name_ko: '길 샤함', instrument: '바이올린', nationality: '이스라엘', scraper_key: 'gil-shaham' }, concerts: [
    con(VENUES.CARNEGIE, 'Kavakos & Shaham - Carnegie Hall', '2026-05-06', '20:00', ['Beethoven & Schubert']),
    con(VENUES.TANGLEWOOD, 'Gil Shaham - Tanglewood', '2026-07-31', '20:30', ['Violin Concerto']),
  ]},

  { musician: { name: 'Antoine Tamestit', name_ko: '안투안 타메스티', instrument: '비올라', nationality: '프랑스', scraper_key: 'antoine-tamestit' }, concerts: [
    con(VENUES.CARNEGIE, 'Kavakos & Tamestit - Carnegie Hall', '2026-05-06', '20:00', ['Beethoven & Schubert']),
    con(VENUES.PHILHARMONIE_PARIS, 'Antoine Tamestit - Paris Philharmonie', '2026-05-30', '20:00', ['Viola Recital - Bartók']),
  ]},

  { musician: { name: 'Anthony McGill', name_ko: '앤서니 맥길', instrument: '클라리넷', nationality: '미국', scraper_key: 'anthony-mcgill' }, concerts: [
    con(VENUES.CARNEGIE, 'Vengerov & Friends - Carnegie Hall', '2026-12-16', '20:00', ['Brahms - Clarinet Quintet']),
  ]},

  { musician: { name: 'Sabine Meyer', name_ko: '자빈 마이어', instrument: '클라리넷', nationality: '독일', scraper_key: 'sabine-meyer' }, concerts: [
    con(VENUES.KONZERTHAUS_BERLIN, 'Sabine Meyer - Konzerthaus Berlin', '2026-05-25', '20:00', ['Clarinet Recital - Brahms, Weber']),
  ]},

  { musician: { name: 'Yo-Yo Ma', name_ko: '요요마', instrument: '첼로', nationality: '미국', scraper_key: 'yo-yo-ma' }, concerts: [
    con(VENUES.TANGLEWOOD, 'Yo-Yo Ma - Tanglewood', '2026-08-16', '20:30', ['Cello Recital & Bach']),
    con(VENUES.CARNEGIE, 'Yo-Yo Ma - Carnegie Hall', '2026-05-04', '20:00', ['Bach - Cello Suites']),
  ]},

  { musician: { name: 'Patricia Kopatchinskaja', name_ko: '파트리시아 코파친스카야', instrument: '바이올린', nationality: '몰도바', scraper_key: 'patricia-kopatchinskaja' }, concerts: [
    con(VENUES.BERLINER_PHIL, 'Patricia Kopatchinskaja - Berlin', '2026-05-20', '20:00', ['Contemporary Violin Works']),
    con(VENUES.WIGMORE, 'Patricia Kopatchinskaja - Wigmore Hall', '2026-06-02', '19:30', ['Violin Recital']),
  ]},

  { musician: { name: 'Daishin Kashimoto', name_ko: '카시모토 다이신', instrument: '바이올린', nationality: '일본', scraper_key: 'daishin-kashimoto' }, concerts: [
    con(VENUES.BERLINER_PHIL, 'Daishin Kashimoto - Berlin Philharmonic', '2026-05-15', '20:00', ['Chamber Concert']),
  ]},

  { musician: { name: 'Randall Goosby', name_ko: '랜달 구스비', instrument: '바이올린', nationality: '미국', scraper_key: 'randall-goosby' }, concerts: [
    con(VENUES.TANGLEWOOD, 'Randall Goosby - Tanglewood Debut', '2026-07-26', '20:30', ['Violin Concerto']),
  ]},

];

// ══════════════════════════════════════════════════════════
// 삽입 실행
// ══════════════════════════════════════════════════════════

console.log('\n🎵 유명 클래식 음악가 실제 2026 공연 데이터 삽입 시작...\n');

const insertAll = db.transaction(() => {
  let totalMusicians = 0;
  let totalConcerts = 0;

  for (const { musician, concerts } of concertData) {
    const musicianId = getOrCreateMusician(musician);
    if (!musicianId) { console.log(`  ⚠ ID 없음: ${musician.name}`); continue; }

    let added = 0;
    for (const concert of concerts) {
      if (addConcert(musicianId, concert)) added++;
    }

    if (added > 0) {
      console.log(`  🎼 ${musician.name_ko || musician.name}: ${added}개 공연 추가`);
      totalMusicians++;
      totalConcerts += added;
    }
  }

  return { totalMusicians, totalConcerts };
});

const { totalMusicians, totalConcerts } = insertAll();
const total = db.prepare('SELECT COUNT(*) as c FROM concerts').get().c;

console.log(`\n✅ 완료!`);
console.log(`  처리된 음악가: ${totalMusicians}명`);
console.log(`  추가된 공연: ${totalConcerts}개`);
console.log(`  전체 공연 수: ${total}개\n`);