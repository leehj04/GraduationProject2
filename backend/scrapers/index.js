const { getDB } = require('../db');
const { scrapeYunchanLim } = require('./yunchan-lim');
const { scrapeTrifonov } = require('./trifonov');
const { scrapeGeneric } = require('./generic');
const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Geocode an address to lat/lng using Google Maps Geocoding API
async function geocodeAddress(address) {
  if (!GOOGLE_API_KEY) return { lat: null, lng: null };
  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address, key: GOOGLE_API_KEY }
    });
    if (res.data.results.length > 0) {
      const loc = res.data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch (err) {
    console.error('Geocoding error:', err.message);
  }
  return { lat: null, lng: null };
}

// Save scraped concerts to database
async function saveConcerts(musicianId, concerts) {
  const db = getDB();
  let saved = 0;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO concerts
      (musician_id, title, venue_name, venue_address, venue_city, venue_country,
       venue_lat, venue_lng, concert_date, concert_time, program, ticket_url, source_url, scraped_at)
    VALUES
      (@musician_id, @title, @venue_name, @venue_address, @venue_city, @venue_country,
       @venue_lat, @venue_lng, @concert_date, @concert_time, @program, @ticket_url, @source_url, datetime('now'))
  `);

  for (const concert of concerts) {
    // Skip if missing required fields
    if (!concert.venue_name || !concert.concert_date) continue;

    // Geocode if lat/lng not available
    if (!concert.venue_lat && concert.venue_address) {
      console.log(`Geocoding: ${concert.venue_address}`);
      const coords = await geocodeAddress(concert.venue_address);
      concert.venue_lat = coords.lat;
      concert.venue_lng = coords.lng;
      // Rate limit geocoding requests
      await new Promise(r => setTimeout(r, 200));
    }

    // Check if this concert already exists (same musician, venue, date)
    const existing = db.prepare(`
      SELECT id FROM concerts
      WHERE musician_id = ? AND venue_name = ? AND concert_date = ?
    `).get(musicianId, concert.venue_name, concert.concert_date);

    if (!existing) {
      upsert.run({
        musician_id: musicianId,
        title: concert.title || null,
        venue_name: concert.venue_name,
        venue_address: concert.venue_address || null,
        venue_city: concert.venue_city || null,
        venue_country: concert.venue_country || null,
        venue_lat: concert.venue_lat || null,
        venue_lng: concert.venue_lng || null,
        concert_date: concert.concert_date,
        concert_time: concert.concert_time || null,
        program: concert.program ? JSON.stringify(concert.program) : null,
        ticket_url: concert.ticket_url || null,
        source_url: concert.source_url || null,
      });
      saved++;
    }
  }

  return saved;
}

// Run all scrapers
async function scrapeAll() {
  const db = getDB();
  const musicians = db.prepare('SELECT * FROM musicians').all();

  for (const musician of musicians) {
    console.log(`\n[SCRAPER] Scraping ${musician.name} (${musician.scraper_key})...`);
    let concerts = [];

    try {
      switch (musician.scraper_key) {
        case 'yunchan-lim':
          concerts = await scrapeYunchanLim();
          break;
        case 'trifonov':
          concerts = await scrapeTrifonov();
          break;
        default:
          concerts = await scrapeGeneric(musician.official_site, musician.scraper_key);
          break;
      }

      if (concerts.length > 0) {
        const saved = await saveConcerts(musician.id, concerts);
        console.log(`[SCRAPER] ${musician.name}: ${concerts.length} found, ${saved} new saved`);
      } else {
        console.log(`[SCRAPER] ${musician.name}: No concerts found (site may have changed)`);
      }
    } catch (err) {
      console.error(`[SCRAPER] ${musician.name} failed:`, err.message);
    }

    // Be respectful with rate limits between musicians
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n[SCRAPER] All scrapers completed');
}

module.exports = { scrapeAll, saveConcerts, geocodeAddress };
