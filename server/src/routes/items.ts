import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

function parseItem(row: any) {
  if (!row) return null;
  return {
    ...row,
    genres: JSON.parse(row.genres || '[]'),
    tracklist: JSON.parse(row.tracklist || '[]'),
    cast_list: JSON.parse(row.cast_list || '[]'),
    watched_or_listened: Boolean(row.watched_or_listened),
  };
}

// GET /items — list with optional filters
router.get('/', (req: Request, res: Response) => {
  const { type, support, genre, decade, state, unwatched, search, sort } = req.query;

  let query = 'SELECT * FROM items WHERE 1=1';
  const params: any[] = [];

  if (type) { query += ' AND type = ?'; params.push(type); }
  if (support) { query += ' AND support = ?'; params.push(support); }
  if (state) { query += ' AND state = ?'; params.push(state); }
  if (unwatched === 'true') { query += ' AND watched_or_listened = 0'; }
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
  const { type, support, genre, decade, unwatched } = req.query;

  let query = 'SELECT * FROM items WHERE 1=1';
  const params: any[] = [];

  if (type) { query += ' AND type = ?'; params.push(type); }
  if (support) { query += ' AND support = ?'; params.push(support); }
  if (unwatched === 'true') { query += ' AND watched_or_listened = 0'; }
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

// POST /items
router.post('/', (req: Request, res: Response) => {
  const {
    type, support, title, year, genres, cover_url, artist_or_director,
    notes, state, watched_or_listened,
    label, tracklist, duration_total_sec, vinyl_format,
    synopsis, duration_min, cast_list, language, subtitles, extras,
  } = req.body;

  if (!type || !support || !title) {
    return res.status(400).json({ error: 'type, support et title sont requis' });
  }

  const result = db.prepare(`
    INSERT INTO items (
      type, support, title, year, genres, cover_url, artist_or_director,
      notes, state, watched_or_listened,
      label, tracklist, duration_total_sec, vinyl_format,
      synopsis, duration_min, cast_list, language, subtitles, extras
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    type, support, title, year || null,
    JSON.stringify(genres || []), cover_url || null, artist_or_director || null,
    notes || '', state || 'bon_etat', watched_or_listened ? 1 : 0,
    label || null, JSON.stringify(tracklist || []), duration_total_sec || null, vinyl_format || null,
    synopsis || null, duration_min || null, JSON.stringify(cast_list || []),
    language || null, subtitles || null, extras || null,
  );

  const created = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseItem(created));
});

// PUT /items/:id
router.put('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Introuvable' });

  const fields = { ...existing, ...req.body };

  db.prepare(`
    UPDATE items SET
      type=?, support=?, title=?, year=?, genres=?, cover_url=?, artist_or_director=?,
      notes=?, state=?, watched_or_listened=?,
      label=?, tracklist=?, duration_total_sec=?, vinyl_format=?,
      synopsis=?, duration_min=?, cast_list=?, language=?, subtitles=?, extras=?
    WHERE id=?
  `).run(
    fields.type, fields.support, fields.title, fields.year,
    typeof fields.genres === 'string' ? fields.genres : JSON.stringify(fields.genres || []),
    fields.cover_url, fields.artist_or_director,
    fields.notes, fields.state, fields.watched_or_listened ? 1 : 0,
    fields.label,
    typeof fields.tracklist === 'string' ? fields.tracklist : JSON.stringify(fields.tracklist || []),
    fields.duration_total_sec, fields.vinyl_format,
    fields.synopsis, fields.duration_min,
    typeof fields.cast_list === 'string' ? fields.cast_list : JSON.stringify(fields.cast_list || []),
    fields.language, fields.subtitles, fields.extras,
    req.params.id,
  );

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
