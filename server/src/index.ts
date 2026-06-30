import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
// dotenv ne lit que `.env` par défaut : on charge aussi `.env.local` (prioritaire),
// en chemin absolu pour être indépendant du dossier de lancement.
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import express from 'express';
import cors from 'cors';
import https from 'https';
import axios from 'axios';
import itemsRouter from './routes/items';
import lookupRouter from './routes/lookup';

const app = express();
const PORT = process.env.PORT || 8002;
const uploadsDir = path.join(__dirname, '..', 'uploads');
const SCROBBLER_URL = process.env.SCROBBLER_URL || 'https://100.117.225.90:3008';

fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.use('/api/items', itemsRouter);
app.use('/api/lookup', lookupRouter);

// Proxy vers ScrobblerVari — évite le problème de certificat auto-signé côté navigateur
const scrobblerAgent = new https.Agent({ rejectUnauthorized: false });
app.post('/api/scrobble', async (req, res) => {
  try {
    const { data, status } = await axios.post(
      `${SCROBBLER_URL}/api/vinyl/queue`,
      req.body,
      { httpsAgent: scrobblerAgent, validateStatus: () => true },
    );
    res.status(status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: 'ScrobblerVari injoignable', detail: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Redémarrage propre — App Manager détecte la sortie et relance le process.
app.post('/api/restart', (_req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 100);
});

app.get('/api/scrobble/queue', async (_req, res) => {
  try {
    const { data, status } = await axios.get(
      `${SCROBBLER_URL}/api/vinyl/queue`,
      { httpsAgent: scrobblerAgent, validateStatus: () => true },
    );
    res.status(status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: 'ScrobblerVari injoignable', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`BibliAnalogique API running on http://localhost:${PORT}`);
});
