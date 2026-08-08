import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
// dotenv ne lit que `.env` par défaut : on charge aussi `.env.local` (prioritaire),
// en chemin absolu pour être indépendant du dossier de lancement.
// override:true → les valeurs des fichiers .env priment sur l'environnement hérité.
// Indispensable car App-Manager injecte PORT=<port du frontend> (ex. 3005) pour lancer
// `npm run dev` ; sans override, l'API écouterait ce port et entrerait en collision avec
// le client vite. On charge .env d'abord puis .env.local en dernier pour qu'il reste prioritaire.
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });
import express from 'express';
import cors from 'cors';
import itemsRouter from './routes/items';
import lookupRouter from './routes/lookup';
import scrobbleRouter from './routes/scrobble';
import lastfmRouter from './routes/lastfm';
import blacklistRouter from './routes/blacklist';
import { isConfigured } from './lastfm';
import { start as startScrobbler } from './scrobbler';

const app = express();
const PORT = process.env.PORT || 8002;
const uploadsDir = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.use('/api/items', itemsRouter);
app.use('/api/lookup', lookupRouter);
app.use('/api/scrobble', scrobbleRouter);
app.use('/api/lastfm', lastfmRouter);
app.use('/api/blacklist', blacklistRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Redémarrage propre — App Manager détecte la sortie et relance le process.
app.post('/api/restart', (_req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 100);
});

app.listen(PORT, () => {
  console.log(`Mediatek — API sur http://localhost:${PORT}`);
  if (!isConfigured()) {
    console.warn('[lastfm] LASTFM_API_KEY/LASTFM_SECRET absents : le scrobble est désactivé.');
  }
  // L'ordonnanceur vit ici, pas dans le serveur de développement du client :
  // la file avance même quand aucun onglet n'est ouvert.
  startScrobbler();
});
