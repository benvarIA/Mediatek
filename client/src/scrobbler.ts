import type { Item } from './api';

export interface ScrobbleResult {
  ok: boolean;
  duplicate?: boolean;
  trackCount?: number;
  finishAt?: number;
  error?: string;
}

export async function scrobbleAlbum(item: Item): Promise<ScrobbleResult> {
  const artist = item.artist_or_director?.trim();
  if (!artist || !item.title) return { ok: false, error: 'Artiste ou album manquant' };

  const tracks = (item.tracklist ?? [])
    .filter(t => t.title?.trim())
    .map(t => ({ title: t.title, ...(t.length_sec ? { duration: t.length_sec } : {}) }));

  try {
    const res = await fetch('/api/scrobble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, album: item.title, image: item.cover_url ?? '', tracks: tracks.length ? tracks : undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` };
    return { ok: true, duplicate: data.duplicate, trackCount: data.tracks?.length, finishAt: data.finishAt };
  } catch {
    return { ok: false, error: 'Impossible de joindre le serveur.' };
  }
}
