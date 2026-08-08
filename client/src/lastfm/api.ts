// Accès Last.fm — toujours via notre serveur, jamais en direct.
//
// ScrobblerVari appelait ws.audioscrobbler.com depuis le navigateur et signait
// ses requêtes avec le secret Last.fm, ce qui obligeait à livrer ce secret dans
// le bundle client. Ici le client ne connaît ni le secret, ni la clé de
// session : il demande une URL, renvoie le jeton, et lit un statut.

export interface LastFmUser {
  name: string;
  realname: string;
  image: { '#text': string; size: string }[];
  playcount: string;
  url: string;
}

export interface LastFmStatus {
  /** Le serveur a-t-il des clés Last.fm ? Sans elles, rien n'est possible. */
  configured: boolean;
  connected: boolean;
  username?: string;
  user?: LastFmUser | null;
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? `Erreur ${res.status}`);
  return data as T;
}

export async function fetchStatus(): Promise<LastFmStatus> {
  return json<LastFmStatus>(await fetch('/api/lastfm/status'));
}

/** Renvoie l'URL Last.fm vers laquelle envoyer l'utilisateur. */
export async function fetchAuthUrl(): Promise<string> {
  const res = await fetch(`/api/lastfm/auth-url?origin=${encodeURIComponent(window.location.origin)}`);
  const { url } = await json<{ url: string }>(res);
  return url;
}

/** Repasse au serveur le jeton renvoyé par Last.fm. */
export async function exchangeToken(token: string): Promise<LastFmStatus> {
  return json<LastFmStatus>(
    await fetch('/api/lastfm/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }),
  );
}

export async function logout(): Promise<void> {
  await fetch('/api/lastfm/session', { method: 'DELETE' });
}

export interface ArtistSuggestion {
  name: string;
  listeners: number;
}

export async function searchArtists(q: string): Promise<ArtistSuggestion[]> {
  if (q.trim().length < 2) return [];
  try {
    return await json<ArtistSuggestion[]>(await fetch(`/api/lastfm/artists?q=${encodeURIComponent(q)}`));
  } catch {
    return [];
  }
}

export function avatarOf(user?: LastFmUser | null): string | null {
  if (!user) return null;
  return user.image?.find(i => i.size === 'large')?.['#text'] || user.image?.[0]?.['#text'] || null;
}
