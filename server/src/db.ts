import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'bibli.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('music', 'video')),
    support TEXT NOT NULL CHECK(support IN ('cd', 'vinyl', 'dvd', 'bluray')),
    title TEXT NOT NULL,
    year INTEGER,
    genres TEXT DEFAULT '[]',
    cover_url TEXT,
    artist_or_director TEXT,
    notes TEXT DEFAULT '',
    state TEXT DEFAULT 'bon_etat' CHECK(state IN ('neuf', 'bon_etat', 'use')),
    watched_or_listened INTEGER DEFAULT 0,
    -- music specific
    label TEXT,
    tracklist TEXT DEFAULT '[]',
    duration_total_sec INTEGER,
    vinyl_format TEXT,
    -- video specific
    synopsis TEXT,
    duration_min INTEGER,
    cast_list TEXT DEFAULT '[]',
    language TEXT,
    subtitles TEXT,
    extras TEXT,
    -- timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS update_items_updated_at
  AFTER UPDATE ON items
  FOR EACH ROW
  BEGIN
    UPDATE items SET updated_at = datetime('now') WHERE id = OLD.id;
  END;
`);

// --- Migrations non destructives : colonnes d'enrichissement « disque » ---
// Ajoutées via ALTER TABLE pour ne pas toucher aux données existantes.
const EXTRA_COLUMNS: Record<string, string> = {
  catalog_no: "TEXT",                  // n° de catalogue du pressage
  country: "TEXT",                     // pays de pressage
  styles: "TEXT DEFAULT '[]'",         // styles fins (Hard Bop, French House…)
  barcode: "TEXT",                     // code-barres
  original_year: "INTEGER",            // année de sortie originale (master Discogs)
  format_detail: "TEXT",               // format détaillé (« LP, 33⅓ RPM, Gatefold »)
  credits: "TEXT DEFAULT '[]'",        // crédits groupés [{role, names[]}] (compositeur, producteur…)
  community: "TEXT",                   // JSON {have, want, rating, lowest_price…} popularité & valeur
  videos: "TEXT DEFAULT '[]'",         // [{title, url, duration}] liens YouTube
  description: "TEXT",                 // notes / description du pressage (Discogs)
  artist_bio: "TEXT",                  // résumé / bio de l'artiste
  discogs_id: "INTEGER",               // id Discogs de la release
  back_cover_url: "TEXT",              // verso de la pochette
};

const existingCols = new Set(
  (db.prepare("PRAGMA table_info(items)").all() as { name: string }[]).map(c => c.name)
);
for (const [col, def] of Object.entries(EXTRA_COLUMNS)) {
  if (!existingCols.has(col)) {
    db.exec(`ALTER TABLE items ADD COLUMN ${col} ${def}`);
  }
}

// --- File de scrobble + liste d'artistes à retirer -------------------------
// En base plutôt qu'en JSON : l'ordonnanceur écrit toutes les 5 s pendant que
// l'API lit, et un fichier réécrit en entier perdrait des mises à jour.
db.exec(`
  CREATE TABLE IF NOT EXISTS scrobble_album (
    id TEXT PRIMARY KEY,
    item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    artist TEXT NOT NULL,
    album TEXT NOT NULL,
    image TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'done', 'cancelled')),
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scrobble_track (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id TEXT NOT NULL REFERENCES scrobble_album(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    duration INTEGER,
    -- Durée effective retenue pour l'espacement, figée à l'insertion : la durée
    -- réelle si le pressage la fournit, sinon un repli tiré une seule fois.
    -- Sans ça, l'heure de fin annoncée changerait à chaque lecture.
    span INTEGER NOT NULL DEFAULT 240,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'done', 'error')),
    scrobble_at INTEGER,
    scrobbled_at INTEGER,
    error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_track_album ON scrobble_track(album_id, position);
  CREATE INDEX IF NOT EXISTS idx_track_due ON scrobble_track(status, scrobble_at);
  CREATE INDEX IF NOT EXISTS idx_album_status ON scrobble_album(status);

  CREATE TABLE IF NOT EXISTS blacklist (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'artist' CHECK(type IN ('artist', 'track')),
    artist TEXT NOT NULL,
    title TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
