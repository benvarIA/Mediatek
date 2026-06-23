import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';
import Database from 'better-sqlite3';

const serverRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(serverRoot, '.env.local') });
dotenv.config({ path: path.join(serverRoot, '.env') });

const DB_PATH = path.join(serverRoot, 'data', 'bibli.sqlite');
const DISCOGS_BASE = 'https://api.discogs.com';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const WRITE = !process.argv.includes('--dry-run');

type Item = {
  id: number;
  type: 'music' | 'video';
  support: string;
  title: string;
  year: number | null;
  genres: string | null;
  cover_url: string | null;
  artist_or_director: string | null;
  label: string | null;
  tracklist: string | null;
  duration_total_sec: number | null;
  vinyl_format: string | null;
  synopsis: string | null;
  duration_min: number | null;
  cast_list: string | null;
  language: string | null;
  catalog_no: string | null;
  country: string | null;
  styles: string | null;
  barcode: string | null;
  original_year: number | null;
  format_detail: string | null;
  credits: string | null;
  community: string | null;
  videos: string | null;
  description: string | null;
  artist_bio: string | null;
  discogs_id: number | null;
  back_cover_url: string | null;
};

type Backfill = Partial<Record<keyof Item, unknown>>;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanName(name: string) {
  return (name || '').replace(/\s*\(\d+\)\s*$/, '').trim();
}

function normalize(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseJsonArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeArrayJson(existing: string | null | undefined, incoming: unknown[]) {
  const seen = new Set<string>();
  const merged = [...parseJsonArray(existing), ...incoming].filter(value => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return JSON.stringify(merged);
}

function empty(value: unknown) {
  return value == null || value === '' || value === '[]';
}

function setIfEmpty(item: Item, patch: Backfill, key: keyof Item, value: unknown) {
  if (value == null || value === '') return;
  if (empty(item[key])) patch[key] = value;
}

function userAgent() {
  return `BibliAnalogique/1.0 (+${process.env.APP_CONTACT_EMAIL || 'contact@example.com'})`;
}

async function discogsGet(url: string, params: Record<string, unknown> = {}) {
  const token = process.env.DISCOGS_TOKEN;
  const response = await axios.get(`${DISCOGS_BASE}${url}`, {
    headers: {
      'User-Agent': userAgent(),
      ...(token ? { Authorization: `Discogs token=${token}` } : {}),
    },
    params,
    timeout: 20000,
  });
  return response.data;
}

function scoreDiscogsResult(item: Item, result: any) {
  const resultTitle = normalize(result.title);
  const itemTitle = normalize(item.title);
  const artist = normalize(item.artist_or_director);
  let score = 0;

  if (resultTitle.includes(itemTitle)) score += 45;
  if (artist && resultTitle.includes(artist)) score += 35;
  if (result.year && item.year && Number(result.year) === item.year) score += 10;
  if ((result.format || []).some((format: string) => normalize(format).includes(normalize(item.support)))) score += 8;
  if (result.cover_image || result.thumb) score += 12;

  return score;
}

function buildFormatDetail(formats: any[]) {
  const format = formats?.[0];
  if (!format) return null;
  const head = Number(format.qty) > 1 ? `${format.qty}x${format.name}` : format.name;
  return [head, ...(format.descriptions || []), format.text].filter(Boolean).join(', ');
}

function deriveVinylFormat(formats: any[]) {
  const descs = (formats?.[0]?.descriptions || []).join(' ').toLowerCase();
  if (descs.includes('picture')) return 'picture';
  if (descs.includes('78')) return '78t';
  if (descs.includes('45') || descs.includes('7"')) return '45t';
  if (descs.includes('33') || descs.includes('lp') || descs.includes('12"')) return '33t';
  return null;
}

function buildTracklist(release: any) {
  return (release.tracklist || [])
    .filter((track: any) => track.type_ === 'track' || !track.type_)
    .map((track: any) => {
      let length_sec = null;
      if (track.duration && /^\d+:\d{2}$/.test(track.duration)) {
        const [minutes, seconds] = track.duration.split(':').map(Number);
        length_sec = minutes * 60 + seconds;
      }
      return { position: track.position, title: track.title, length_sec };
    });
}

async function enrichMusic(item: Item): Promise<Backfill | null> {
  if (!process.env.DISCOGS_TOKEN) return null;

  const query = [item.artist_or_director, item.title].filter(Boolean).join(' ');
  const search = await discogsGet('/database/search', {
    q: query || item.title,
    type: 'release',
    per_page: 8,
  });
  await sleep(1200);

  const candidates = (search.results || [])
    .map((result: any) => ({ result, score: scoreDiscogsResult(item, result) }))
    .sort((a: any, b: any) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 45) return null;

  const release = await discogsGet(`/releases/${best.result.id}`, { curr_abbr: 'EUR' });
  await sleep(1200);

  const patch: Backfill = {};
  const images = release.images || [];
  const primary = images.find((image: any) => image.type === 'primary') || images[0];
  const secondary = images.find((image: any) => image.type === 'secondary');
  const tracklist = buildTracklist(release);
  const durationTotal = tracklist.reduce((sum: number, track: any) => sum + (track.length_sec || 0), 0) || null;
  const barcode = (release.identifiers || []).find((identifier: any) => identifier.type === 'Barcode')?.value || null;

  setIfEmpty(item, patch, 'cover_url', primary?.uri || primary?.resource_url || best.result.cover_image || best.result.thumb);
  setIfEmpty(item, patch, 'artist_or_director', cleanName(release.artists?.[0]?.name));
  setIfEmpty(item, patch, 'year', release.year || (release.released ? parseInt(release.released) : null));
  setIfEmpty(item, patch, 'label', cleanName(release.labels?.[0]?.name));
  setIfEmpty(item, patch, 'catalog_no', release.labels?.[0]?.catno);
  setIfEmpty(item, patch, 'country', release.country);
  setIfEmpty(item, patch, 'barcode', barcode);
  setIfEmpty(item, patch, 'format_detail', buildFormatDetail(release.formats));
  setIfEmpty(item, patch, 'vinyl_format', deriveVinylFormat(release.formats));
  setIfEmpty(item, patch, 'back_cover_url', secondary?.uri);
  setIfEmpty(item, patch, 'description', release.notes);
  setIfEmpty(item, patch, 'discogs_id', release.id);
  setIfEmpty(item, patch, 'duration_total_sec', durationTotal);

  if (release.genres?.length) patch.genres = mergeArrayJson(item.genres, release.genres);
  if (release.styles?.length) patch.styles = mergeArrayJson(item.styles, release.styles);
  if (tracklist.length && empty(item.tracklist)) patch.tracklist = JSON.stringify(tracklist);
  if (release.videos?.length && empty(item.videos)) {
    patch.videos = JSON.stringify(release.videos.slice(0, 8).map((video: any) => ({
      title: video.title,
      url: video.uri,
      duration: video.duration || null,
    })));
  }
  if (release.community && empty(item.community)) {
    patch.community = JSON.stringify({
      have: release.community.have ?? null,
      want: release.community.want ?? null,
      rating: release.community.rating?.average ?? null,
      rating_count: release.community.rating?.count ?? null,
      lowest_price: release.lowest_price ?? null,
      num_for_sale: release.num_for_sale ?? null,
    });
  }

  return patch;
}

function scoreTmdbResult(item: Item, result: any) {
  const resultTitle = normalize(result.title || result.name);
  const itemTitle = normalize(item.title);
  let score = 0;

  if (resultTitle === itemTitle) score += 70;
  else if (resultTitle.includes(itemTitle) || itemTitle.includes(resultTitle)) score += 45;
  if ((result.release_date || result.first_air_date) && item.year) {
    const year = parseInt(result.release_date || result.first_air_date);
    if (year === item.year) score += 10;
  }
  if (result.poster_path) score += 15;
  if (result.media_type === 'movie') score += 5;

  return score;
}

async function enrichVideo(item: Item): Promise<Backfill | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;

  const response = await axios.get('https://api.themoviedb.org/3/search/multi', {
    params: {
      api_key: key,
      query: item.title,
      language: 'fr-FR',
      include_adult: false,
    },
    timeout: 20000,
  });
  await sleep(250);

  const candidates = (response.data.results || [])
    .filter((result: any) => result.media_type === 'movie' || result.media_type === 'tv')
    .map((result: any) => ({ result, score: scoreTmdbResult(item, result) }))
    .sort((a: any, b: any) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 50) return null;

  const detailsResponse = await axios.get(
    `https://api.themoviedb.org/3/${best.result.media_type}/${best.result.id}`,
    {
      params: { api_key: key, language: 'fr-FR', append_to_response: 'credits' },
      timeout: 20000,
    }
  );
  await sleep(250);

  const details = detailsResponse.data;
  const patch: Backfill = {};
  const genres = details.genres?.map((genre: any) => genre.name) || [];
  const cast = details.credits?.cast?.slice(0, 5).map((person: any) => person.name) || [];

  setIfEmpty(item, patch, 'cover_url', details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path}` : null);
  setIfEmpty(item, patch, 'year', (details.release_date || details.first_air_date) ? parseInt(details.release_date || details.first_air_date) : null);
  setIfEmpty(item, patch, 'synopsis', details.overview);
  setIfEmpty(item, patch, 'duration_min', details.runtime || null);
  setIfEmpty(item, patch, 'language', details.original_language);

  if (genres.length) patch.genres = mergeArrayJson(item.genres, genres);
  if (cast.length && empty(item.cast_list)) patch.cast_list = JSON.stringify(cast);

  return patch;
}

function applyPatch(db: Database.Database, item: Item, patch: Backfill) {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (!entries.length) return false;

  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  db.prepare(`UPDATE items SET ${assignments} WHERE id = ?`).run(
    ...entries.map(([, value]) => value),
    item.id
  );
  return true;
}

async function main() {
  const db = new Database(DB_PATH);
  const items = db.prepare(`
    SELECT * FROM items
    WHERE cover_url IS NULL OR trim(cover_url) = ''
    ORDER BY type, id
  `).all() as Item[];

  if (WRITE) {
    const backupPath = `${DB_PATH}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`Backup: ${backupPath}`);
  } else {
    console.log('Mode simulation: aucune écriture.');
  }

  let updated = 0;
  let missed = 0;

  for (const item of items) {
    try {
      const patch = item.type === 'music' ? await enrichMusic(item) : await enrichVideo(item);
      if (!patch || !patch.cover_url) {
        missed += 1;
        console.log(`MISS #${item.id} ${item.type} ${item.title}`);
        continue;
      }

      if (WRITE) applyPatch(db, item, patch);
      updated += 1;
      console.log(`OK   #${item.id} ${item.type} ${item.title}`);
    } catch (error: any) {
      missed += 1;
      const status = error?.response?.status ? `HTTP ${error.response.status}` : error?.message;
      console.log(`ERR  #${item.id} ${item.type} ${item.title} (${status})`);
    }
  }

  const after = db.prepare(`
    SELECT
      count(*) AS total,
      sum(CASE WHEN cover_url IS NOT NULL AND trim(cover_url) != '' THEN 1 ELSE 0 END) AS with_cover
    FROM items
  `).get() as { total: number; with_cover: number };

  console.log(`Resultat: ${updated} enrichis, ${missed} sans correspondance, ${after.with_cover}/${after.total} avec pochette.`);
  db.close();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
