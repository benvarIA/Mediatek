import { Router } from 'express';
import { addAlbum, cancelAlbum, forgetAlbum, getAlbum, listQueue } from '../scrobbler';
import { isConfigured, readSession } from '../lastfm';

const router = Router();

/** La file complète : en cours, à suivre, et l'historique. */
router.get('/queue', (_req, res) => {
  res.json({
    connected: Boolean(readSession()),
    configured: isConfigured(),
    albums: listQueue(),
  });
});

router.get('/queue/:id', (req, res) => {
  const album = getAlbum(req.params.id);
  if (!album) return res.status(404).json({ error: 'Album introuvable dans la file.' });
  res.json(album);
});

/** Poser un disque sur la platine. */
router.post('/queue', async (req, res) => {
  const { artist, album, image, itemId, tracks } = req.body ?? {};
  if (!artist?.trim() || !album?.trim()) {
    return res.status(400).json({ error: 'Artiste et album sont requis.' });
  }
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Clés Last.fm absentes du serveur.' });
  }
  try {
    const { album: created, duplicate } = await addAlbum({
      artist, album, image, itemId: itemId ?? null, tracks,
    });
    res.status(duplicate ? 200 : 201).json({ ...created, duplicate });
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

/** Retirer de la file : annule si actif, oublie si déjà terminé. */
router.delete('/queue/:id', (req, res) => {
  const album = getAlbum(req.params.id);
  if (!album) return res.status(404).json({ error: 'Album introuvable dans la file.' });
  if (album.status === 'active') cancelAlbum(album.id);
  else forgetAlbum(album.id);
  res.json({ ok: true });
});

export default router;
