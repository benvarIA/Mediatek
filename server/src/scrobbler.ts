// Ordonnanceur de scrobbles.
//
// Il vit dans le serveur Express, pas dans le serveur de développement Vite.
// C'est la correction d'un défaut de fond de ScrobblerVari : la boucle y était
// déclarée dans `configureServer()` d'un plugin Vite, donc la file gelait en
// silence dès que le front était arrêté.
//
// Espacement des pistes : une piste part quand la précédente est censée être
// finie, c'est-à-dire après sa propre durée. ScrobblerVari utilisait un
// intervalle fixe de 20 à 40 s, ce qui envoyait un 33 tours entier en quatre
// minutes et fabriquait un historique faux. La durée reste le repli aléatoire
// quand le pressage ne la fournit pas (fréquent sur les vinyles Discogs).

import crypto from 'crypto';
import db from './db';
import { getAlbumTracks, readSession, scrobble } from './lastfm';

const TICK_MS = 5_000;
/** Repli quand la durée d'une piste est inconnue : 3 à 5 minutes. */
const FALLBACK_MIN = 180;
const FALLBACK_SPREAD = 120;
/** Souffle entre deux albums de la file. */
const ALBUM_GAP = 90;

export interface QueueTrack {
  position: number;
  title: string;
  duration: number | null;
  span: number;
  status: 'pending' | 'done' | 'error';
  scrobbleAt: number | null;
  scrobbledAt: number | null;
  error: string | null;
}

export interface QueueAlbum {
  id: string;
  itemId: number | null;
  artist: string;
  album: string;
  image: string;
  status: 'active' | 'done' | 'cancelled';
  addedAt: string;
  tracks: QueueTrack[];
  finishAt: number | null;
}

const now = () => Math.floor(Date.now() / 1000);
/** Tiré une seule fois, à l'insertion, puis figé en base (colonne `span`). */
const fallbackGap = () => FALLBACK_MIN + Math.floor(Math.random() * FALLBACK_SPREAD);
const resolveSpan = (duration?: number | null) =>
  duration && duration > 0 ? duration : fallbackGap();

// --- Lecture --------------------------------------------------------------

// L'image est photographiée au moment où le disque est posé. Si la fiche n'en
// avait pas encore — ou si elle a été corrigée depuis — on retombe sur celle du
// catalogue plutôt que d'afficher un carré vide sur la platine.
const ALBUM_COLS = `
  a.id, a.item_id AS itemId, a.artist, a.album,
  CASE WHEN a.image <> '' THEN a.image ELSE ifnull(i.cover_url, '') END AS image,
  a.status, a.added_at AS addedAt
  FROM scrobble_album a LEFT JOIN items i ON i.id = a.item_id
`;
const selAlbums = db.prepare(`SELECT ${ALBUM_COLS} ORDER BY a.added_at ASC`);
const selAlbum = db.prepare(`SELECT ${ALBUM_COLS} WHERE a.id = ?`);
const selTracks = db.prepare(`
  SELECT position, title, duration, span, status,
         scrobble_at AS scrobbleAt, scrobbled_at AS scrobbledAt, error
  FROM scrobble_track WHERE album_id = ? ORDER BY position ASC
`);

function hydrate(row: any): QueueAlbum {
  const tracks = selTracks.all(row.id) as QueueTrack[];
  const scheduled = tracks.filter(t => t.scrobbleAt != null);
  const last = scheduled.length ? scheduled[scheduled.length - 1] : null;
  return {
    ...row,
    tracks,
    // Fin annoncée = départ de la dernière piste + sa durée.
    finishAt: last ? last.scrobbleAt! + last.span : null,
  };
}

export function listQueue(): QueueAlbum[] {
  return (selAlbums.all() as any[]).map(hydrate);
}

export function getAlbum(id: string): QueueAlbum | null {
  const row = selAlbum.get(id);
  return row ? hydrate(row) : null;
}

// --- Planification --------------------------------------------------------

const updTrackTime = db.prepare('UPDATE scrobble_track SET scrobble_at = ? WHERE album_id = ? AND position = ?');

/**
 * Place les pistes en attente d'un album à partir de `startAt`.
 * Renvoie l'instant où la dernière piste posée sera terminée.
 */
function schedule(albumId: string, tracks: QueueTrack[], startAt: number): number {
  let cursor = startAt;
  for (const t of tracks) {
    if (t.status === 'done') continue;
    updTrackTime.run(cursor, albumId, t.position);
    t.scrobbleAt = cursor;
    cursor += t.span;
  }
  return cursor;
}

/** Queue de file : l'instant où tout ce qui est déjà programmé sera fini. */
function tailOfQueue(): number {
  let tail = now() + 5;
  for (const a of listQueue()) {
    if (a.status !== 'active') continue;
    for (const t of a.tracks) {
      if (t.status === 'pending' && t.scrobbleAt != null) {
        tail = Math.max(tail, t.scrobbleAt + t.span + ALBUM_GAP);
      }
    }
  }
  return tail;
}

// --- Écriture -------------------------------------------------------------

const insAlbum = db.prepare(`
  INSERT INTO scrobble_album (id, item_id, artist, album, image, status)
  VALUES (?, ?, ?, ?, ?, 'active')
`);
const insTrack = db.prepare(`
  INSERT INTO scrobble_track (album_id, position, title, duration, span, status)
  VALUES (?, ?, ?, ?, ?, 'pending')
`);
const findDuplicate = db.prepare(`
  SELECT id FROM scrobble_album
  WHERE status = 'active' AND lower(artist) = lower(?) AND lower(album) = lower(?)
`);

export interface AddInput {
  artist: string;
  album: string;
  image?: string;
  itemId?: number | null;
  tracks?: { title: string; duration?: number | null }[];
}

export async function addAlbum(input: AddInput): Promise<{ album: QueueAlbum; duplicate: boolean }> {
  const artist = input.artist.trim();
  const album = input.album.trim();

  const dup = findDuplicate.get(artist, album) as { id: string } | undefined;
  if (dup) return { album: getAlbum(dup.id)!, duplicate: true };

  let tracks = (input.tracks ?? [])
    .filter(t => t?.title?.trim())
    .map(t => ({ title: t.title.trim(), duration: t.duration ?? null }));

  // Pas de tracklist dans la fiche : on demande à Last.fm.
  if (!tracks.length) {
    const fetched = await getAlbumTracks(album, artist);
    tracks = fetched.map(t => ({ title: t.title, duration: t.duration ?? null }));
  }
  if (!tracks.length) throw new Error('Aucune piste trouvée pour cet album.');

  const id = crypto.randomUUID();
  db.transaction(() => {
    insAlbum.run(id, input.itemId ?? null, artist, album, input.image ?? '');
    tracks.forEach((t, i) => insTrack.run(id, i + 1, t.title, t.duration, resolveSpan(t.duration)));
  })();

  schedule(id, selTracks.all(id) as QueueTrack[], tailOfQueue());
  void tick();
  return { album: getAlbum(id)!, duplicate: false };
}

const updAlbumStatus = db.prepare('UPDATE scrobble_album SET status = ? WHERE id = ?');

export function cancelAlbum(id: string): boolean {
  if (!selAlbum.get(id)) return false;
  updAlbumStatus.run('cancelled', id);
  return true;
}

/** Retire de l'historique un album déjà terminé ou annulé. */
const delAlbum = db.prepare("DELETE FROM scrobble_album WHERE id = ? AND status != 'active'");
export function forgetAlbum(id: string): boolean {
  return delAlbum.run(id).changes > 0;
}

// --- Boucle ---------------------------------------------------------------

const updTrackDone = db.prepare('UPDATE scrobble_track SET status = ?, scrobbled_at = ?, error = ? WHERE album_id = ? AND position = ?');

let ticking = false;

export async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const session = readSession();
    const t0 = now();

    for (const a of listQueue()) {
      if (a.status !== 'active') continue;

      const due = a.tracks.filter(
        t => t.status === 'pending' && t.scrobbleAt != null && t.scrobbleAt <= t0,
      );

      // Pas connecté : on laisse la file en place, elle repartira au prochain
      // tick une fois la session rétablie. Rien ne se perd, rien ne s'envoie.
      if (due.length && !session) continue;

      for (const t of due) {
        try {
          await scrobble(a.artist, t.title, a.album, t.scrobbleAt!, session!.sessionKey);
          updTrackDone.run('done', now(), null, a.id, t.position);
        } catch (err) {
          updTrackDone.run('error', null, (err as Error).message, a.id, t.position);
        }
      }

      const fresh = selTracks.all(a.id) as QueueTrack[];
      if (fresh.every(t => t.status !== 'pending')) updAlbumStatus.run('done', a.id);
    }
  } finally {
    ticking = false;
  }
}

let timer: NodeJS.Timeout | null = null;

/**
 * Au démarrage, tout ce qui était en attente est replanifié séquentiellement à
 * partir de maintenant. Sans ça, un serveur arrêté deux heures enverrait au
 * redémarrage toutes les pistes en retard d'un seul coup.
 */
export function start(): void {
  let cursor = now() + 5;
  let replanned = 0;
  for (const a of listQueue()) {
    if (a.status !== 'active') continue;
    if (!a.tracks.some(t => t.status === 'pending')) continue;
    cursor = schedule(a.id, a.tracks, cursor) + ALBUM_GAP;
    replanned++;
  }
  if (replanned) console.log(`[scrobbler] ${replanned} album(s) replanifié(s) depuis maintenant`);

  timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  void tick();
}

export function stop(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
