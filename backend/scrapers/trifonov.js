/**
 * Scraper for Daniil Trifonov's tour schedule.
 * Primary source: daniiltrifonov.com/tour/
 */
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const TOUR_URL = 'https://www.daniiltrifonov.com/tour/';

async function scrapeTrifonov() {
  console.log('[Trifonov] Starting scrape...');
  const concerts = [];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/Users/leehj04/Desktop/4 - 2/졸업프로젝트2/concert-tour-tracker/chrome/mac_arm-147.0.7727.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(TOUR_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for events to load
    // await page.waitForTimeout(3000);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to scroll to load lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // await page.waitForTimeout(1000);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const html = await page.content();
    const parsed = parseTrifonovPage(html);
    concerts.push(...parsed);

    console.log(`[Trifonov] Found ${concerts.length} concerts`);
  } catch (err) {
    console.error('[Trifonov] Scrape failed:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  return concerts;
}

function parseTrifonovPage(html) {
  const $ = cheerio.load(html);
  const concerts = [];
  const now = new Date();
  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

  // daniiltrifonov.com typically uses these structures
  const containerSelectors = [
    '.tour-date', '.event', '.performance', '.concert',
    '[class*="tour"]', '[class*="event"]', '[class*="concert"]',
    'article', '.entry'
  ];

  for (const selector of containerSelectors) {
    const items = $(selector);
    if (items.length < 2) continue;

    items.each((i, el) => {
      const $el = $(el);
      const text = $el.text();

      // Try to find date
      const dateEl = $el.find('[class*="date"], time, .date').first();
      const dateText = dateEl.length ? dateEl.text().trim() : text;

      const dateStr = findDateInText(dateText);
      if (!dateStr) return;

      const concertDate = new Date(dateStr);
      if (isNaN(concertDate) || concertDate < now || concertDate > sixMonthsLater) return;

      // Find venue info
      const venueEl = $el.find('[class*="venue"], [class*="location"], [class*="place"]').first();
      const venueText = venueEl.length ? venueEl.text().trim() : '';

      if (!venueText && text.length < 10) return;

      const parts = parseVenueText(venueText || text);

      // Find ticket link
      const ticketLink = $el.find('a[href*="ticket"], a[href*="concert"], a').first().attr('href');

      concerts.push({
        title: $el.find('[class*="title"], h2, h3').first().text().trim() || `Daniil Trifonov - ${parts.city || 'Concert'}`,
        venue_name: parts.venue || venueText.split(',')[0] || 'TBA',
        venue_city: parts.city,
        venue_country: parts.country,
        venue_address: parts.address,
        concert_date: dateStr,
        concert_time: extractTime(text),
        program: extractProgramFromEl($el),
        ticket_url: ticketLink && ticketLink.startsWith('http') ? ticketLink : null,
        source_url: TOUR_URL
      });
    });

    if (concerts.length > 0) break;
  }

  // Fallback: parse raw text looking for structured date patterns
  if (concerts.length === 0) {
    const bodyText = $('body').text();
    const rawConcerts = parseRawText(bodyText, 'Daniil Trifonov', TOUR_URL);
    concerts.push(...rawConcerts);
  }

  return concerts;
}

function findDateInText(text) {
  const patterns = [
    // ISO format
    /(\d{4}-\d{2}-\d{2})/,
    // Month Day, Year
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,
    // Day Month Year
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    // Short month
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
    // MM/DD/YYYY
    /(\d{2}\/\d{2}\/\d{4})/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const d = new Date(match[1]);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch {}
    }
  }
  return null;
}

function extractTime(text) {
  const match = text.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/);
  return match ? match[0] : null;
}

function parseVenueText(text) {
  const parts = text.split(',').map(p => p.trim()).filter(Boolean);
  return {
    venue: parts[0] || null,
    city: parts[1] || null,
    country: parts[parts.length - 1] || null,
    address: parts.length > 2 ? parts.join(', ') : null
  };
}

function extractProgramFromEl($el) {
  const programEl = $el.find('[class*="program"], [class*="repertoire"], [class*="piece"]');
  if (!programEl.length) return [];

  const text = programEl.text();
  return text.split(/[;\n]/).map(s => s.trim()).filter(s => s.length > 5).slice(0, 6);
}

function parseRawText(text, artistName, sourceUrl) {
  const concerts = [];
  const now = new Date();
  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi;
  const matches = [...text.matchAll(datePattern)];

  for (const match of matches) {
    try {
      const d = new Date(match[0]);
      if (isNaN(d.getTime()) || d < now || d > sixMonthsLater) continue;

      const dateStr = d.toISOString().split('T')[0];
      // Extract surrounding context (200 chars)
      const start = Math.max(0, match.index - 100);
      const end = Math.min(text.length, match.index + 200);
      const context = text.slice(start, end);

      const lines = context.split('\n').map(l => l.trim()).filter(Boolean);
      const venueLine = lines.find(l => l.length > 10 && l.length < 80 &&
        /hall|center|centre|theater|theatre|philharmonic|auditorium/i.test(l));

      if (!venueLine) continue;

      concerts.push({
        title: `${artistName} - Concert`,
        venue_name: venueLine,
        concert_date: dateStr,
        source_url: sourceUrl
      });
    } catch {}
  }

  return concerts;
}

module.exports = { scrapeTrifonov };
