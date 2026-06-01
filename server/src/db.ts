import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'bibli.sqlite');

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

export default db;
