/**
 * Scraper for Yunchan Lim's tour schedule.
 * Primary source: Opus 3 Artists management page
 * Fallback: Harrison Parrott
 */
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

const SOURCES = [
  'https://www.yunchanlimofficial.com/tour/',
];

async function scrapeYunchanLim() {
  console.log('[Yunchan Lim] Starting scrape...');
  let concerts = [];

  // Try with Puppeteer (JS-rendered pages)
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/Users/leehj04/Desktop/4 - 2/졸업프로젝트2/concert-tour-tracker/chrome/mac_arm-147.0.7727.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    for (const url of SOURCES) {
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for content to load
        //await page.waitForTimeout(2000);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const html = await page.content();
        const parsed = parseOpus3Page(html, url);

        if (parsed.length > 0) {
          concerts = [...concerts, ...parsed];
          console.log(`[Yunchan Lim] Found ${parsed.length} concerts from ${url}`);
          await page.close();
          break;
        }
        await page.close();
      } catch (err) {
        console.warn(`[Yunchan Lim] Failed to scrape ${url}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Yunchan Lim] Puppeteer error:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  return concerts;
}

function parseOpus3Page(html, sourceUrl) {
  const $ = cheerio.load(html);
  const concerts = [];
  const now = new Date();
  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

  // Opus3 Artists page structure
  // Selectors may need updating if the website changes
  const eventSelectors = [
    '.event-item', '.concert-item', '.performance-item',
    '[class*="event"]', '[class*="concert"]', '[class*="tour-date"]',
    'tr.event', '.performances li'
  ];

  for (const selector of eventSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      elements.each((i, el) => {
        const text = $(el).text().trim();
        const links = $(el).find('a');
        const ticketUrl = links.first().attr('href');

        // Try to extract date
        const dateMatch = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})|(\w+ \d{1,2},?\s*\d{4})|(\d{4}-\d{2}-\d{2})/i);
        if (!dateMatch) return;

        const dateStr = parseDateString(dateMatch[0]);
        if (!dateStr) return;

        const concertDate = new Date(dateStr);
        if (concertDate < now || concertDate > sixMonthsLater) return;

        // Extract venue and city
        const venueLine = extractVenueFromText(text);
        if (!venueLine) return;

        concerts.push({
          title: `Yunchan Lim - ${venueLine.city || 'Concert'}`,
          venue_name: venueLine.venue,
          venue_city: venueLine.city,
          venue_country: venueLine.country,
          venue_address: venueLine.address,
          concert_date: dateStr,
          concert_time: extractTime(text),
          program: extractProgram(text),
          ticket_url: ticketUrl && ticketUrl.startsWith('http') ? ticketUrl : null,
          source_url: sourceUrl
        });
      });

      if (concerts.length > 0) break;
    }
  }

  return concerts;
}

function parseDateString(str) {
  if (!str) return null;
  try {
    // Format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // Format: Month DD, YYYY
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return null;
}

function extractTime(text) {
  const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!match) return null;
  return match[0];
}

function extractProgram(text) {
  const programs = [];
  // Common classical composers
  const composerPatterns = [
    /beethoven[^,\n]*/gi, /chopin[^,\n]*/gi, /rachmaninoff[^,\n]*/gi,
    /brahms[^,\n]*/gi, /liszt[^,\n]*/gi, /schumann[^,\n]*/gi,
    /bach[^,\n]*/gi, /mozart[^,\n]*/gi
  ];

  for (const pattern of composerPatterns) {
    const matches = text.match(pattern);
    if (matches) programs.push(...matches.map(m => m.trim()));
  }

  return programs.slice(0, 5);
}

function extractVenueFromText(text) {
  // Common venue patterns
  const venuePatterns = [
    /(?:at|@|,)\s+([A-Z][^,\n]{3,50}(?:Hall|Center|Centre|Auditorium|Theater|Theatre|Philharmonic|Symphony|Arena))/i,
    /([A-Z][^,\n]{3,40}(?:Hall|Center|Centre|Auditorium|Theater|Theatre))/i
  ];

  for (const pattern of venuePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        venue: match[1].trim(),
        city: extractCity(text),
        country: extractCountry(text),
        address: null
      };
    }
  }

  return null;
}

function extractCity(text) {
  const cityPatterns = [
    'New York', 'London', 'Berlin', 'Vienna', 'Paris', 'Tokyo', 'Seoul',
    'Amsterdam', 'Chicago', 'Boston', 'Los Angeles', 'San Francisco',
    'Munich', 'Hamburg', 'Zurich', 'Milan', 'Rome', 'Barcelona', 'Madrid'
  ];

  for (const city of cityPatterns) {
    if (text.includes(city)) return city;
  }
  return null;
}

function extractCountry(text) {
  const countryMap = {
    'USA': ['New York', 'Chicago', 'Boston', 'Los Angeles', 'San Francisco'],
    'UK': ['London', 'Birmingham', 'Manchester'],
    'Germany': ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'],
    'Austria': ['Vienna'],
    'France': ['Paris'],
    'Japan': ['Tokyo', 'Osaka'],
    'South Korea': ['Seoul', 'Busan'],
    'Netherlands': ['Amsterdam'],
    'Switzerland': ['Zurich'],
    'Italy': ['Milan', 'Rome']
  };

  for (const [country, cities] of Object.entries(countryMap)) {
    if (cities.some(city => text.includes(city))) return country;
  }
  return null;
}

module.exports = { scrapeYunchanLim };
