import { Router } from 'express';
import {
  authUrl, clearSession, exchangeToken, getUserInfo, isConfigured, readSession, searchArtists,
} from '../lastfm';

const router = Router();

/** Qui est connecté, et l'app sait-elle seulement parler à Last.fm. */
router.get('/status', async (_req, res) => {
  const session = readSession();
  if (!session) return res.json({ configured: isConfigured(), connected: false });
  try {
    const user = await getUserInfo(session.username);
    res.json({ configured: true, connected: true, username: session.username, user });
  } catch {
    // La clé de session peut avoir été révoquée côté Last.fm.
    res.json({ configured: true, connected: true, username: session.username, user: null });
  }
});

/**
 * Étape 1 — l'URL vers laquelle envoyer l'utilisateur. Le client fournit son
 * origine ; c'est là que Last.fm le renverra avec un jeton.
 */
router.get('/auth-url', (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Clés Last.fm absentes du serveur.' });
  }
  const origin = String(req.query.origin ?? '').trim();
  if (!/^https?:\/\//.test(origin)) {
    return res.status(400).json({ error: 'Origine invalide.' });
  }
  res.json({ url: authUrl(`${origin.replace(/\/$/, '')}/callback`) });
});

/**
 * Étape 2 — le client repasse le jeton, le serveur fait l'échange signé.
 * Le secret Last.fm et la clé de session ne quittent jamais le serveur.
 */
router.post('/session', async (req, res) => {
  const token = String(req.body?.token ?? '').trim();
  if (!token) return res.status(400).json({ error: 'Jeton manquant.' });
  try {
    const session = await exchangeToken(token);
    let user = null;
    try { user = await getUserInfo(session.username); } catch { /* facultatif */ }
    res.json({ connected: true, username: session.username, user });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/session', (_req, res) => {
  clearSession();
  res.json({ ok: true });
});

/** Autocomplétion d'artistes pour la liste à retirer. */
router.get('/artists', async (req, res) => {
  const q = String(req.query.q ?? '');
  if (q.trim().length < 2) return res.json([]);
  try {
    res.json(await searchArtists(q));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
