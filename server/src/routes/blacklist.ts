// Artistes à retirer de l'historique Last.fm.
//
// L'API Last.fm n'offre aucune suppression de scrobbles : la seule voie est
// l'interface web. `scripts/delete-scrobbles.mjs` la pilote avec Playwright.
// C'est fragile par nature — le script dépend du HTML de Last.fm — et ça reste
// vrai indépendamment de cette fusion.

import { spawn } from 'child_process';
import crypto from 'crypto';
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db, { DATA_DIR } from '../db';

const router = Router();
const JOB_FILE = path.join(DATA_DIR, 'delete-job.json');
const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'delete-scrobbles.mjs');

const ACTIVE_STATUSES = ['starting', 'authenticating', 'waiting_login', 'deleting'];

interface Job {
  status: 'idle' | 'starting' | 'authenticating' | 'waiting_login' | 'deleting' | 'done' | 'error' | 'cancelled';
  total?: number;
  deleted?: number;
  errors?: number;
  message?: string;
  pid?: number;
}

/** Le signal 0 ne fait rien : il ne sert qu'à demander si le processus existe. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = il tourne, mais il ne nous appartient pas.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readJob(): Job {
  let job: Job;
  try { job = JSON.parse(fs.readFileSync(JOB_FILE, 'utf-8')); } catch { return { status: 'idle' }; }

  // Un job « en cours » dont le processus a disparu est un job mort. Sans cette
  // vérification, un script tué net (nodemon qui redémarre, machine qui dort)
  // laisse l'interface bloquée sur « en cours » et fait répondre 409 à toute
  // relance — l'écran ne peut plus rien faire.
  if (ACTIVE_STATUSES.includes(job.status) && job.pid && !isAlive(job.pid)) {
    return { ...job, status: 'error', message: "La suppression s'est interrompue avant la fin." };
  }
  return job;
}

function writeJob(job: Job) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(JOB_FILE, JSON.stringify({ ...job, updatedAt: new Date().toISOString() }, null, 2));
}

// --- Liste ----------------------------------------------------------------

const selAll = db.prepare(
  `SELECT id, type, artist, title, source, added_at AS addedAt FROM blacklist ORDER BY lower(artist) ASC`,
);
const insEntry = db.prepare(
  `INSERT INTO blacklist (id, type, artist, title, source) VALUES (?, ?, ?, ?, ?)`,
);
const selOne = db.prepare('SELECT id, type, artist, title, source, added_at AS addedAt FROM blacklist WHERE id = ?');
const delEntry = db.prepare('DELETE FROM blacklist WHERE id = ?');
const findSame = db.prepare(
  `SELECT id FROM blacklist WHERE type = ? AND lower(artist) = lower(?) AND ifnull(lower(title), '') = ifnull(lower(?), '')`,
);

router.get('/', (_req, res) => res.json(selAll.all()));

router.post('/', (req, res) => {
  const artist = String(req.body?.artist ?? '').trim();
  if (!artist) return res.status(400).json({ error: "Nom d'artiste requis." });
  const type = req.body?.type === 'track' ? 'track' : 'artist';
  const title = type === 'track' ? String(req.body?.title ?? '').trim() || null : null;

  const existing = findSame.get(type, artist, title) as { id: string } | undefined;
  if (existing) return res.status(200).json({ ...selOne.get(existing.id)!, duplicate: true });

  const id = crypto.randomUUID();
  insEntry.run(id, type, artist, title, req.body?.source === 'import' ? 'import' : 'manual');
  res.status(201).json(selOne.get(id));
});

router.delete('/:id', (req, res) => {
  if (!delEntry.run(req.params.id).changes) {
    return res.status(404).json({ error: 'Entrée introuvable.' });
  }
  res.json({ ok: true });
});

// --- Suppression sur Last.fm ---------------------------------------------

router.get('/job', (_req, res) => {
  const { pid, ...job } = readJob();
  res.json(job);
});

router.post('/job', (req, res) => {
  const current = readJob();
  if (ACTIVE_STATUSES.includes(current.status)) {
    return res.status(409).json({ error: 'Une suppression est déjà en cours.' });
  }
  if (!process.env.LASTFM_USERNAME) {
    return res.status(503).json({ error: 'LASTFM_USERNAME absent du serveur.' });
  }
  if (!fs.existsSync(SCRIPT)) {
    return res.status(503).json({ error: 'Script de suppression introuvable.' });
  }

  // La sélection vient toujours du client : le script n'a plus à lire la liste
  // lui-même, ce qui le détache complètement du stockage.
  //
  // `ids` absent = toute la liste. `ids` présent mais vide = aucune sélection,
  // et surtout pas « tout » : confondre les deux fait supprimer l'intégralité
  // de l'historique blacklisté à qui n'avait rien coché.
  const ids: string[] | null = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (ids && !ids.length) return res.status(400).json({ error: 'Aucun artiste sélectionné.' });
  const rows = ids
    ? ids.map(id => selOne.get(id)).filter(Boolean)
    : (selAll.all() as any[]);
  const artists = [...new Set(rows.map((r: any) => r.artist).filter(Boolean))];

  if (!artists.length) return res.status(400).json({ error: 'Aucun artiste sélectionné.' });

  writeJob({ status: 'starting', total: artists.length, deleted: 0, errors: 0 });
  const child = spawn(process.execPath, [SCRIPT], {
    detached: true,
    stdio: 'ignore',
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, ARTISTS: JSON.stringify(artists), DATA_DIR },
  });
  child.unref();
  res.status(202).json({ ok: true, total: artists.length });
});

router.delete('/job', (_req, res) => {
  const job = readJob();
  if (!job.pid) return res.status(409).json({ error: 'Aucune suppression en cours.' });
  try {
    process.kill(job.pid, 'SIGTERM');
  } catch {
    writeJob({ ...job, status: 'cancelled' });
  }
  res.json({ ok: true });
});

export default router;
