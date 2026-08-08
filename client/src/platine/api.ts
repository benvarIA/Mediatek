// La platine : ce qui tourne, ce qui suit, ce qui est passé.

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
  duplicate?: boolean;
}

export interface QueueState {
  configured: boolean;
  connected: boolean;
  albums: QueueAlbum[];
}

export const EMPTY_QUEUE: QueueState = { configured: false, connected: false, albums: [] };

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? `Erreur ${res.status}`);
  return data as T;
}

export async function fetchQueue(): Promise<QueueState> {
  return json<QueueState>(await fetch('/api/scrobble/queue'));
}

export interface PoserInput {
  artist: string;
  album: string;
  image?: string;
  itemId?: number | null;
  tracks?: { title: string; duration?: number | null }[];
}

/** Poser un disque sur la platine. */
export async function poser(input: PoserInput): Promise<QueueAlbum> {
  return json<QueueAlbum>(
    await fetch('/api/scrobble/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

/** Annule un album actif, ou l'oublie s'il est déjà terminé. */
export async function retirer(id: string): Promise<void> {
  await json(await fetch(`/api/scrobble/queue/${id}`, { method: 'DELETE' }));
}

// --- Petits utilitaires de temps, partagés par toutes les vues -------------

export const heure = (unixSec?: number | null) =>
  unixSec == null ? '' : new Date(unixSec * 1000).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });

export const heureSec = (unixSec?: number | null) =>
  unixSec == null ? '' : new Date(unixSec * 1000).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

export const duree = (sec?: number | null) =>
  !sec ? '' : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** La piste en cours : la dernière dont l'heure de départ est passée. */
export function pisteEnCours(album: QueueAlbum, nowSec: number): QueueTrack | null {
  const started = album.tracks.filter(t => t.scrobbleAt != null && t.scrobbleAt <= nowSec);
  return started.length ? started[started.length - 1] : null;
}

/** Avancement de la piste en cours, de 0 à 1 — interpolé, pas sondé. */
export function avancement(track: QueueTrack | null, nowSec: number): number {
  if (!track?.scrobbleAt || !track.span) return 0;
  return Math.min(1, Math.max(0, (nowSec - track.scrobbleAt) / track.span));
}
