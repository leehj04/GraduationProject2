/**
 * Generic scraper that attempts to extract concert dates from any musician website.
 * Used as fallback for musicians without dedicated scrapers.
 */
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const MONTH_NAMES = ['january','february','march','april','may','june',
                     'july','august','september','october','november','december'];
const SHORT_MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

async function scrapeGeneric(url, scraperKey) {
  if (!url) return [];
  console.log(`[Generic/${scraperKey}] Scraping: ${url}`);

  let browser;
  let html = '';

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/Users/leehj04/Desktop/4 - 2/졸업프로젝트2/concert-tour-tracker/chrome/mac_arm-147.0.7727.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // await page.waitForTimeout(2000);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // await page.waitForTimeout(1000);
    await new Promise(resolve => setTimeout(resolve, 2000));
    html = await page.content();
  } catch (err) {
    console.warn(`[Generic/${scraperKey}] Puppeteer failed:`, err.message);
  } finally {
    if (browser) await browser.close();
  }

  if (!html) return [];

  return parsePage(html, url, scraperKey);
}

function parsePage(html, sourceUrl, scraperKey) {
  const $ = cheerio.load(html);
  const concerts = [];
  const now = new Date();
  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

  // Strategy 1: Look for structured event containers
  const eventSelectors = [
    '.event', '.concert', '.performance', '.tour-date', '.show',
    '[class*="event"]', '[class*="concert"]', '[class*="performance"]',
    '[class*="tour"]', '[class*="date-item"]', 'article'
  ];

  for (const selector of eventSelectors) {
    const items = $(selector);
    if (items.length < 2) continue;

    const found = [];
    items.each((i, el) => {
      const $el = $(el);
      const text = $el.text();

      const dateStr = findDateInText(text);
      if (!dateStr) return;

      const d = new Date(dateStr);
      if (isNaN(d.getTime()) || d < now || d > sixMonthsLater) return;

      const venueLine = findVenueInElement($el);
      if (!venueLine) return;

      found.push({
        title: null,
        venue_name: venueLine.venue,
        venue_city: venueLine.city,
        venue_country: venueLine.country,
        concert_date: dateStr,
        concert_time: findTimeInText(text),
        ticket_url: $el.find('a[href*="ticket"]').attr('href') || null,
        source_url: sourceUrl
      });
    });

    if (found.length > 0) {
      concerts.push(...found);
      break;
    }
  }

  // Strategy 2: Parse tables
  if (concerts.length === 0) {
    $('table').each((i, table) => {
      $(table).find('tr').each((j, row) => {
        const text = $(row).text();
        const dateStr = findDateInText(text);
        if (!dateStr) return;

        const d = new Date(dateStr);
        if (isNaN(d.getTime()) || d < now || d > sixMonthsLater) return;

        const cells = $(row).find('td').map((k, td) => $(td).text().trim()).get();
        if (cells.length >= 2) {
          concerts.push({
            concert_date: dateStr,
            venue_name: cells[1] || cells[0],
            venue_city: cells[2] || null,
            concert_time: findTimeInText(text),
            source_url: sourceUrl
          });
        }
      });
    });
  }

  return concerts;
}

function findDateInText(text) {
  const patterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i,
    /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})\b/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      try {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch {}
    }
  }
  return null;
}

function findTimeInText(text) {
  const m = text.match(/\b(\d{1,2}:\d{2})\s*(?:AM|PM|am|pm|h|uhr)?\b/i);
  return m ? m[0] : null;
}

function findVenueInElement($el) {
  const venueSelectors = ['[class*="venue"]', '[class*="location"]', '[class*="place"]', '[class*="hall"]'];
  for (const sel of venueSelectors) {
    const el = $el.find(sel).first();
    if (el.length && el.text().trim()) {
      const parts = el.text().split(',').map(s => s.trim());
      return { venue: parts[0], city: parts[1] || null, country: parts[2] || null };
    }
  }

  // Look for venue keywords in text
  const text = $el.text();
  const venueMatch = text.match(/([A-Z][^,\n]{3,50}(?:Hall|Center|Centre|Auditorium|Theater|Theatre|Philharmonic|Symphony))/);
  if (venueMatch) {
    return { venue: venueMatch[1].trim(), city: null, country: null };
  }

  return null;
}

module.exports = { scrapeGeneric };
