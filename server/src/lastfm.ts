// Accès à l'API Last.fm — entièrement côté serveur.
//
// ScrobblerVari signait ses appels dans le navigateur, ce qui obligeait à
// livrer le *secret* Last.fm dans le bundle client. Ici le secret ne quitte
// jamais le serveur : le client demande une URL d'autorisation, Last.fm le
// renvoie avec un jeton, le serveur échange ce jeton contre une clé de session
// et la garde. Le navigateur ne voit ni le secret, ni la clé de session.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './db';

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
const AUTH_URL = 'https://www.last.fm/api/auth/';
const SESSION_FILE = path.join(DATA_DIR, 'lastfm-session.json');

export interface StoredSession {
  sessionKey: string;
  username: string;
  savedAt: string;
}

const apiKey = () => process.env.LASTFM_API_KEY ?? '';
const secret = () => process.env.LASTFM_SECRET ?? '';

export function isConfigured(): boolean {
  return Boolean(apiKey() && secret());
}

/** Signature Last.fm : clés triées, concaténées, suffixées du secret, en MD5. */
function sign(params: Record<string, string>): string {
  const base = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHash('md5').update(base + secret(), 'utf-8').digest('hex');
}

async function call<T>(params: Record<string, string>, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const all = { ...params, api_key: apiKey(), format: 'json' };
  let res: Response;
  if (method === 'POST') {
    res = await fetch(BASE_URL, { method: 'POST', body: new URLSearchParams(all) });
  } else {
    const url = new URL(BASE_URL);
    Object.entries(all).forEach(([k, v]) => url.searchParams.set(k, v));
    res = await fetch(url);
  }
  const data = (await res.json()) as any;
  if (data.error) throw new Error(`Last.fm ${data.error} : ${data.message}`);
  return data as T;
}

// --- Session --------------------------------------------------------------

export function readSession(): StoredSession | null {
  try {
    const s = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    return s?.sessionKey ? s : null;
  } catch {
    return null;
  }
}

function writeSession(s: StoredSession) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2), { mode: 0o600 });
}

export function clearSession() {
  try { fs.unlinkSync(SESSION_FILE); } catch { /* déjà absente */ }
}

/** URL vers laquelle envoyer l'utilisateur pour autoriser l'application. */
export function authUrl(callback: string): string {
  return `${AUTH_URL}?api_key=${apiKey()}&cb=${encodeURIComponent(callback)}`;
}

/** Échange le jeton de retour contre une clé de session, et la persiste. */
export async function exchangeToken(token: string): Promise<StoredSession> {
  const params = { api_key: apiKey(), method: 'auth.getSession', token };
  const data = await call<{ session: { key: string; name: string } }>({
    method: 'auth.getSession',
    token,
    api_sig: sign(params),
  });
  const session: StoredSession = {
    sessionKey: data.session.key,
    username: data.session.name,
    savedAt: new Date().toISOString(),
  };
  writeSession(session);
  return session;
}

// --- Lectures publiques ---------------------------------------------------

export interface LastFmUser {
  name: string;
  realname: string;
  image: { '#text': string; size: string }[];
  playcount: string;
  url: string;
}

export async function getUserInfo(user: string): Promise<LastFmUser> {
  const data = await call<{ user: LastFmUser }>({ method: 'user.getInfo', user });
  return data.user;
}

export async function searchArtists(query: string, limit = 6) {
  if (!query.trim()) return [];
  const data = await call<any>({ method: 'artist.search', artist: query, limit: String(limit) });
  const raw = data.results?.artistmatches?.artist;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((a: any) => ({ name: a.name, listeners: Number(a.listeners) || 0 }));
}

export interface AlbumTrack {
  title: string;
  duration?: number;
}

/** Tracklist de secours quand la fiche du catalogue n'en a pas. */
export async function getAlbumTracks(album: string, artist: string): Promise<AlbumTrack[]> {
  try {
    const data = await call<any>({ method: 'album.getInfo', album, artist });
    const raw = data.album?.tracks?.track;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr.map((t: any) => ({
      title: t.name,
      duration: t.duration ? Number(t.duration) : undefined,
    }));
  } catch {
    return [];
  }
}

// --- Écriture -------------------------------------------------------------

/** Envoie une piste. `timestamp` est l'heure d'écoute en secondes Unix. */
export async function scrobble(
  artist: string,
  track: string,
  album: string,
  timestamp: number,
  sessionKey: string,
): Promise<void> {
  const params: Record<string, string> = {
    api_key: apiKey(),
    artist,
    track,
    album,
    timestamp: String(timestamp),
    method: 'track.scrobble',
    sk: sessionKey,
  };
  await call({ ...params, api_sig: sign(params) }, 'POST');
}
