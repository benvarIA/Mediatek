import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import db from '../db';

const router = Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      const base = path.basename(file.originalname || 'cover', ext)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'cover';
      cb(null, `${Date.now()}-${base}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    cb(null, /^image\//.test(file.mimetype));
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

function safeParse(value: any, fallback: any) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function parseItem(row: any) {
  if (!row) return null;
  return {
    ...row,
    genres: safeParse(row.genres, []),
    tracklist: safeParse(row.tracklist, []),
    cast_list: safeParse(row.cast_list, []),
    styles: safeParse(row.styles, []),
    credits: safeParse(row.credits, []),
    videos: safeParse(row.videos, []),
    community: safeParse(row.community, null),
  };
}

function userAgent() {
  return `Mediatek/1.0 (+${process.env.APP_CONTACT_EMAIL || 'contact@example.com'})`;
}

function discogsHeaders() {
  const token = process.env.DISCOGS_TOKEN;
  return {
    'User-Agent': userAgent(),
    ...(token ? { Authorization: `Discogs token=${token}` } : {}),
  };
}

function cleanName(n: string) {
  return (n || '').replace(/\s*\(\d+\)\s*$/, '').trim();
}

function buildFormatDetail(formats: any[]): string {
  const f = formats?.[0];
  if (!f) return '';
  const head = Number(f.qty) > 1 ? `${f.qty}×${f.name}` : f.name;
  const parts = [head, ...(f.descriptions || [])];
  if (f.text) parts.push(f.text);
  return parts.filter(Boolean).join(', ');
}

function deriveVinylFormat(formats: any[]): string | null {
  const descs = (formats?.[0]?.descriptions || []).join(' ').toLowerCase();
  if (descs.includes('picture')) return 'picture';
  if (descs.includes('78')) return '78t';
  if (descs.includes('45') || descs.includes('7"')) return '45t';
  if (descs.includes('33') || descs.includes('lp') || descs.includes('12"')) return '33t';
  return null;
}

function cleanProfile(profile: string): string {
  if (!profile) return '';
  let s = profile
    .replace(/\[a=([^\]]+)\]/g, '$1')
    .replace(/\[l=([^\]]+)\]/g, '$1')
    .replace(/\[(?:a|l|r|m)\d+\]/g, '')
    .replace(/\[url=[^\]]*\]([^[]*)\[\/url\]/g, '$1')
    .replace(/\[\/?[bi]\]/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();
  if (s.length > 800) s = s.slice(0, 800).replace(/\s+\S*$/, '') + '…';
  return s;
}

const ROLE_MAP: Record<string, string> = {
  'written-by': 'Compositeur', 'composed by': 'Compositeur', 'music by': 'Compositeur',
  'lyrics by': 'Paroles', songwriter: 'Compositeur',
  producer: 'Producteur', 'co-producer': 'Co-producteur', 'executive-producer': 'Producteur exécutif',
  'arranged by': 'Arrangements', 'orchestrated by': 'Orchestration', conductor: 'Direction',
  'mixed by': 'Mixage', 'mastered by': 'Mastering', 'recorded by': 'Prise de son', engineer: 'Ingénieur du son',
  vocals: 'Chant', featuring: 'Featuring',
  artwork: 'Pochette', design: 'Design', 'photography by': 'Photographie', illustration: 'Illustration',
};

const ROLE_ORDER = ['Compositeur', 'Paroles', 'Producteur', 'Co-producteur', 'Producteur exécutif',
  'Arrangements', 'Orchestration', 'Direction', 'Chant', 'Featuring', 'Mixage', 'Mastering',
  'Prise de son', 'Ingénieur du son', 'Pochette', 'Design', 'Illustration', 'Photographie'];

function buildCredits(release: any): { role: string; names: string[] }[] {
  const groups = new Map<string, Set<string>>();
  const consume = (list: any[]) => {
    for (const a of list || []) {
      const name = cleanName(a.name);
      if (!name) continue;
      for (const raw of String(a.role || '').split(',')) {
        const base = raw.replace(/\s*\[[^\]]*\]/g, '').trim().toLowerCase();
        const label = ROLE_MAP[base];
        if (!label) continue;
        if (!groups.has(label)) groups.set(label, new Set());
        groups.get(label)!.add(name);
      }
    }
  };
  consume(release.extraartists);
  for (const track of release.tracklist || []) consume(track.extraartists);

  return ROLE_ORDER
    .filter((role) => groups.has(role))
    .map((role) => ({ role, names: Array.from(groups.get(role)!).slice(0, 8) }));
}

async function discogsGet(url: string, params: any = {}) {
  const res = await axios.get(`https://api.discogs.com${url}`, { headers: discogsHeaders(), params });
  return res.data;
}

async function resolveDiscogsDetail(item: any) {
  if (!process.env.DISCOGS_TOKEN) return null;

  let discogsId = item.discogs_id || null;
  if (!discogsId) {
    const q = [item.artist_or_director, item.title, item.year].filter(Boolean).join(' ');
    const search = await discogsGet('/database/search', { q, type: 'release', per_page: 8 });
    const best = (search.results || []).find((result: any) => result.id) || null;
    discogsId = best?.id || null;
  }
  if (!discogsId) return null;

  const release = await discogsGet(`/releases/${discogsId}`, { curr_abbr: 'EUR' });
  const artistId = release.artists?.[0]?.id;
  const [masterRes, artistRes] = await Promise.allSettled([
    release.master_id ? discogsGet(`/masters/${release.master_id}`) : Promise.resolve(null),
    artistId ? discogsGet(`/artists/${artistId}`) : Promise.resolve(null),
  ]);
  const master = masterRes.status === 'fulfilled' ? masterRes.value : null;
  const artist = artistRes.status === 'fulfilled' ? artistRes.value : null;

  const tracklist = (release.tracklist || [])
    .filter((track: any) => track.type_ === 'track' || !track.type_)
    .map((track: any, index: number) => {
      let length_sec: number | null = null;
      if (track.duration && /^\d+:\d{2}$/.test(track.duration)) {
        const [m, s] = track.duration.split(':').map(Number);
        length_sec = m * 60 + s;
      }
      return {
        position: track.position || String(index + 1),
        title: track.title,
        length_sec,
      };
    });
  const duration_total_sec = tracklist.reduce((acc: number, track: any) => acc + (track.length_sec || 0), 0) || null;
  const images: any[] = release.images || [];
  const primary = images.find((image) => image.type === 'primary') || images[0];
  const secondary = images.find((image) => image.type === 'secondary');
  const barcode = (release.identifiers || []).find((identifier: any) => identifier.type === 'Barcode')?.value || null;
  const community = release.community ? {
    have: release.community.have ?? null,
    want: release.community.want ?? null,
    rating: release.community.rating?.average ?? null,
    rating_count: release.community.rating?.count ?? null,
    lowest_price: release.lowest_price ?? null,
    num_for_sale: release.num_for_sale ?? null,
  } : null;

  return {
    type: 'music',
    discogs_id: release.id,
    title: release.title || null,
    artist_or_director: cleanName(release.artists?.[0]?.name) || null,
    year: release.year || (release.released ? parseInt(release.released, 10) : null),
    original_year: master?.year || null,
    country: release.country || null,
    label: cleanName(release.labels?.[0]?.name) || null,
    catalog_no: release.labels?.[0]?.catno || null,
    barcode,
    genres: release.genres || [],
    styles: release.styles || [],
    format_detail: buildFormatDetail(release.formats),
    vinyl_format: deriveVinylFormat(release.formats),
    tracklist,
    duration_total_sec,
    credits: buildCredits(release),
    community,
    videos: (release.videos || []).slice(0, 8).map((video: any) => ({
      title: video.title,
      url: video.uri,
      duration: video.duration || null,
    })),
    description: release.notes || null,
    artist_bio: cleanProfile(artist?.profile) || null,
    cover_url: primary?.uri || primary?.resource_url || null,
    back_cover_url: secondary?.uri || null,
  };
}

async function resolveMusicBrainzDetail(item: any) {
  const query = [item.artist_or_director, item.title, item.year].filter(Boolean).join(' ');
  const searchRes = await axios.get('https://musicbrainz.org/ws/2/release/', {
    headers: { 'User-Agent': userAgent() },
    params: { query, fmt: 'json', limit: 5 },
  });
  const release = searchRes.data?.releases?.[0];
  if (!release?.id) return null;

  const [releaseRes, coverRes] = await Promise.allSettled([
    axios.get(`https://musicbrainz.org/ws/2/release/${release.id}?inc=recordings+artist-credits+labels&fmt=json`, {
      headers: { 'User-Agent': userAgent() },
    }),
    axios.get(`https://coverartarchive.org/release/${release.id}`, { maxRedirects: 5 }),
  ]);

  const detail = releaseRes.status === 'fulfilled' ? releaseRes.value.data : null;
  const cover = coverRes.status === 'fulfilled' ? coverRes.value.data : null;
  if (!detail) return null;

  const tracklist = detail.media?.[0]?.tracks?.map((track: any) => ({
    position: track.position,
    title: track.title,
    length_sec: track.length ? Math.round(track.length / 1000) : null,
  })) || [];

  return {
    type: 'music',
    title: detail.title || null,
    year: detail.date ? parseInt(detail.date, 10) : null,
    artist_or_director: detail['artist-credit']?.[0]?.name || null,
    label: detail['label-info']?.[0]?.label?.name || null,
    tracklist,
    cover_url: cover?.images?.[0]?.thumbnails?.large || cover?.images?.[0]?.image || null,
  };
}

async function resolveTmdbDetail(item: any) {
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) return null;

  const q = [item.title, item.year].filter(Boolean).join(' ');
  const searchRes = await axios.get('https://api.themoviedb.org/3/search/multi', {
    params: {
      api_key: tmdbKey,
      query: q,
      language: 'fr-FR',
      include_adult: false,
    },
  });
  const result = (searchRes.data?.results || []).find((candidate: any) =>
    candidate.media_type === 'movie' || candidate.media_type === 'tv'
  );
  if (!result?.id) return null;

  const detailRes = await axios.get(`https://api.themoviedb.org/3/${result.media_type}/${result.id}`, {
    params: {
      api_key: tmdbKey,
      language: 'fr-FR',
      append_to_response: 'credits',
    },
  });
  const detail = detailRes.data;

  return {
    type: 'video',
    title: detail.title || detail.name || null,
    year: (detail.release_date || detail.first_air_date) ? parseInt(detail.release_date || detail.first_air_date, 10) : null,
    synopsis: detail.overview || null,
    duration_min: detail.runtime || null,
    cover_url: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
    genres: detail.genres?.map((genre: any) => genre.name) || [],
    cast_list: detail.credits?.cast?.slice(0, 5).map((cast: any) => cast.name) || [],
    language: detail.original_language || null,
  };
}

function mergeValue(current: any, incoming: any, overwrite: boolean) {
  if (incoming == null) return current;
  if (Array.isArray(incoming)) {
    if (overwrite) return incoming;
    return Array.isArray(current) && current.length ? current : incoming;
  }
  if (typeof incoming === 'object') {
    if (overwrite) return incoming;
    return current ?? incoming;
  }
  if (typeof incoming === 'string') {
    if (!incoming.trim()) return current;
    return overwrite || !current ? incoming : current;
  }
  return overwrite || current == null ? incoming : current;
}

function applyEnrichment(base: any, incoming: any, overwrite: boolean, updateImage: boolean) {
  if (!incoming) return base;
  const next = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (!updateImage && (key === 'cover_url' || key === 'back_cover_url')) continue;
    next[key] = mergeValue(next[key], value, overwrite);
  }
  return next;
}

function clearUnselectedSourceData(item: any, sources: string[]) {
  const next = { ...item };

  if (item.type === 'music' && !sources.includes('discogs')) {
    next.catalog_no = null;
    next.country = null;
    next.styles = [];
    next.barcode = null;
    next.original_year = null;
    next.format_detail = null;
    next.vinyl_format = null;
    next.credits = [];
    next.community = null;
    next.videos = [];
    next.description = null;
    next.artist_bio = null;
    next.discogs_id = null;
    next.back_cover_url = null;
  }

  return next;
}

// GET /items — list with optional filters
router.get('/', (req: Request, res: Response) => {
  const { type, support, genre, decade, state, search, sort } = req.query;

  let query = 'SELECT * FROM items WHERE 1=1';
  const params: any[] = [];

  if (type) { query += ' AND type = ?'; params.push(type); }
  if (support) { query += ' AND support = ?'; params.push(support); }
  if (state) { query += ' AND state = ?'; params.push(state); }
  if (decade) {
    const d = parseInt(decade as string);
    query += ' AND year >= ? AND year < ?';
    params.push(d, d + 10);
  }
  if (genre) { query += ' AND genres LIKE ?'; params.push(`%"${genre}"%`); }
  if (search) {
    query += ' AND (title LIKE ? OR artist_or_director LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const sortMap: Record<string, string> = {
    title: 'title ASC',
    year: 'year DESC',
    added: 'created_at DESC',
  };
  query += ` ORDER BY ${sortMap[(sort as string) || ''] || 'created_at DESC'}`;

  const rows = db.prepare(query).all(...params);
  res.json(rows.map(parseItem));
});

// GET /items/random — tirage aléatoire
router.get('/random', (req: Request, res: Response) => {
  const { type, support, genre, decade } = req.query;

  let query = 'SELECT * FROM items WHERE 1=1';
  const params: any[] = [];

  if (type) { query += ' AND type = ?'; params.push(type); }
  if (support) { query += ' AND support = ?'; params.push(support); }
  if (decade) {
    const d = parseInt(decade as string);
    query += ' AND year >= ? AND year < ?';
    params.push(d, d + 10);
  }
  if (genre) { query += ' AND genres LIKE ?'; params.push(`%"${genre}"%`); }

  query += ' ORDER BY RANDOM() LIMIT 1';
  const row = db.prepare(query).get(...params);
  if (!row) return res.status(404).json({ error: 'Rien trouvé avec ces filtres' });
  res.json(parseItem(row));
});

// GET /items/:id
router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  res.json(parseItem(row));
});

router.post('/:id/cover-upload', upload.single('cover'), (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  if (!req.file) return res.status(400).json({ error: 'Image requise' });

  const filename = path.basename(req.file.filename);
  const coverUrl = `/uploads/${filename}`;

  db.prepare('UPDATE items SET cover_url = ? WHERE id = ?').run(coverUrl, req.params.id);
  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  res.json(parseItem(updated));
});

router.post('/:id/re-enrich', async (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Introuvable' });

  const item = parseItem(row);
  const sources = Array.isArray(req.body?.sources) ? req.body.sources.map(String) : [];
  const updateImage = req.body?.updateImage !== false;

  if (!sources.length) {
    return res.status(400).json({ error: 'Au moins une source est requise' });
  }

  try {
    let enriched = clearUnselectedSourceData(item, sources);

    for (const [index, source] of sources.entries()) {
      let patch: any = null;
      if (item.type === 'music' && source === 'discogs') patch = await resolveDiscogsDetail(enriched);
      if (item.type === 'music' && source === 'musicbrainz') patch = await resolveMusicBrainzDetail(enriched);
      if (item.type === 'video' && source === 'tmdb') patch = await resolveTmdbDetail(enriched);
      if (!patch) continue;
      enriched = applyEnrichment(enriched, patch, index === 0, updateImage);
    }

    const fields = { ...row, ...enriched };
    const asJson = (v: any) => (typeof v === 'string' ? v : JSON.stringify(v || []));

    db.prepare(`
      UPDATE items SET
        type=?, support=?, title=?, year=?, genres=?, cover_url=?, artist_or_director=?,
        notes=?, state=?,
        label=?, tracklist=?, duration_total_sec=?, vinyl_format=?,
        synopsis=?, duration_min=?, cast_list=?, language=?, subtitles=?, extras=?,
        catalog_no=?, country=?, styles=?, barcode=?, original_year=?, format_detail=?,
        credits=?, community=?, videos=?, description=?, artist_bio=?, discogs_id=?, back_cover_url=?
      WHERE id=?
    `).run(
      fields.type, fields.support, fields.title, fields.year,
      asJson(fields.genres),
      fields.cover_url, fields.artist_or_director,
      fields.notes, fields.state,
      fields.label,
      asJson(fields.tracklist),
      fields.duration_total_sec, fields.vinyl_format,
      fields.synopsis, fields.duration_min,
      asJson(fields.cast_list),
      fields.language, fields.subtitles, fields.extras,
      fields.catalog_no ?? null, fields.country ?? null, asJson(fields.styles),
      fields.barcode ?? null, fields.original_year ?? null, fields.format_detail ?? null,
      asJson(fields.credits),
      typeof fields.community === 'string' ? fields.community : (fields.community ? JSON.stringify(fields.community) : null),
      asJson(fields.videos),
      fields.description ?? null, fields.artist_bio ?? null,
      fields.discogs_id ?? null, fields.back_cover_url ?? null,
      req.params.id,
    );

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    res.json(parseItem(updated));
  } catch (error: any) {
    res.status(500).json({
      error: 'Erreur lors du réenrichissement',
      detail: error?.response?.status || error?.message || null,
    });
  }
});

// POST /items
router.post('/', (req: Request, res: Response) => {
  const {
    type, support, title, year, genres, cover_url, artist_or_director,
    notes, state,
    label, tracklist, duration_total_sec, vinyl_format,
    synopsis, duration_min, cast_list, language, subtitles, extras,
    catalog_no, country, styles, barcode, original_year, format_detail,
    credits, community, videos, description, artist_bio, discogs_id, back_cover_url,
  } = req.body;

  if (!type || !support || !title) {
    return res.status(400).json({ error: 'type, support et title sont requis' });
  }

  const result = db.prepare(`
    INSERT INTO items (
      type, support, title, year, genres, cover_url, artist_or_director,
      notes, state,
      label, tracklist, duration_total_sec, vinyl_format,
      synopsis, duration_min, cast_list, language, subtitles, extras,
      catalog_no, country, styles, barcode, original_year, format_detail,
      credits, community, videos, description, artist_bio, discogs_id, back_cover_url
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    type, support, title, year || null,
    JSON.stringify(genres || []), cover_url || null, artist_or_director || null,
    notes || '', state || 'bon_etat',
    label || null, JSON.stringify(tracklist || []), duration_total_sec || null, vinyl_format || null,
    synopsis || null, duration_min || null, JSON.stringify(cast_list || []),
    language || null, subtitles || null, extras || null,
    catalog_no || null, country || null, JSON.stringify(styles || []), barcode || null,
    original_year || null, format_detail || null,
    JSON.stringify(credits || []), community ? JSON.stringify(community) : null,
    JSON.stringify(videos || []), description || null, artist_bio || null,
    discogs_id || null, back_cover_url || null,
  );

  const created = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseItem(created));
});

// PUT /items/:id
// Les colonnes sont énumérées une seule fois : la liste construit à la fois le
// SET et l'ordre des valeurs. L'ancienne version tenait deux listes en
// parallèle, et un paramètre `watched_or_listened` était resté dans l'appel
// après le retrait de la colonne du SET — tout décalait d'un cran et SQLite
// refusait chaque mise à jour, notes personnelles comprises.
const asJson = (v: any) => (typeof v === 'string' ? v : JSON.stringify(v ?? []));
const asJsonOrNull = (v: any) =>
  typeof v === 'string' ? v : v ? JSON.stringify(v) : null;

const UPDATABLE: { col: string; read: (f: any) => unknown }[] = [
  { col: 'type', read: f => f.type },
  { col: 'support', read: f => f.support },
  { col: 'title', read: f => f.title },
  { col: 'year', read: f => f.year ?? null },
  { col: 'genres', read: f => asJson(f.genres) },
  { col: 'cover_url', read: f => f.cover_url ?? null },
  { col: 'artist_or_director', read: f => f.artist_or_director ?? null },
  { col: 'notes', read: f => f.notes ?? '' },
  { col: 'state', read: f => f.state },
  { col: 'label', read: f => f.label ?? null },
  { col: 'tracklist', read: f => asJson(f.tracklist) },
  { col: 'duration_total_sec', read: f => f.duration_total_sec ?? null },
  { col: 'vinyl_format', read: f => f.vinyl_format ?? null },
  { col: 'synopsis', read: f => f.synopsis ?? null },
  { col: 'duration_min', read: f => f.duration_min ?? null },
  { col: 'cast_list', read: f => asJson(f.cast_list) },
  { col: 'language', read: f => f.language ?? null },
  { col: 'subtitles', read: f => f.subtitles ?? null },
  { col: 'extras', read: f => f.extras ?? null },
  { col: 'catalog_no', read: f => f.catalog_no ?? null },
  { col: 'country', read: f => f.country ?? null },
  { col: 'styles', read: f => asJson(f.styles) },
  { col: 'barcode', read: f => f.barcode ?? null },
  { col: 'original_year', read: f => f.original_year ?? null },
  { col: 'format_detail', read: f => f.format_detail ?? null },
  { col: 'credits', read: f => asJson(f.credits) },
  { col: 'community', read: f => asJsonOrNull(f.community) },
  { col: 'videos', read: f => asJson(f.videos) },
  { col: 'description', read: f => f.description ?? null },
  { col: 'artist_bio', read: f => f.artist_bio ?? null },
  { col: 'discogs_id', read: f => f.discogs_id ?? null },
  { col: 'back_cover_url', read: f => f.back_cover_url ?? null },
];

const updateStmt = db.prepare(
  `UPDATE items SET ${UPDATABLE.map(c => `${c.col}=?`).join(', ')} WHERE id=?`,
);

router.put('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Introuvable' });

  const fields = { ...existing, ...req.body };

  try {
    updateStmt.run(...UPDATABLE.map(c => c.read(fields)), req.params.id);
  } catch (err) {
    // Sans ça, Express renvoie sa page HTML d'erreur et le client n'affiche
    // qu'un message générique — c'est ce qui a masqué ce défaut longtemps.
    return res.status(500).json({ error: (err as Error).message });
  }

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  res.json(parseItem(updated));
});

// DELETE /items/:id
router.delete('/:id', (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Introuvable' });
  res.status(204).send();
});

export default router;
