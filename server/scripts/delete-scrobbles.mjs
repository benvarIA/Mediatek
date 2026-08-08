#!/usr/bin/env node
/**
 * Suppression d'artistes de l'historique Last.fm.
 *
 * L'API Last.fm n'expose aucune suppression : la seule voie est le formulaire
 * « Delete artist from library » de l'interface web. Ce script le pilote avec
 * Playwright — un POST par artiste, sans parcourir l'historique.
 *
 * C'est fragile par construction : ça dépend du HTML de Last.fm, qui peut
 * changer sans préavis.
 *
 * Lancé par le serveur (routes/blacklist.ts), jamais à la main.
 *   ARTISTS   JSON — la liste d'artistes à traiter (obligatoire)
 *   DATA_DIR  où écrire l'avancement et les cookies
 *
 * Avancement → <DATA_DIR>/delete-job.json
 * Cookies    → <DATA_DIR>/lastfm-cookies.json
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(__dirname, '../data');
const JOB_FILE = path.join(DATA_DIR, 'delete-job.json');
const COOKIES_FILE = path.join(DATA_DIR, 'lastfm-cookies.json');

const USERNAME = process.env.LASTFM_USERNAME;
if (!USERNAME) {
  console.error('LASTFM_USERNAME manquant');
  process.exit(1);
}

const startedAt = new Date().toISOString();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function writeJob(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    JOB_FILE,
    JSON.stringify({ ...data, pid: process.pid, startedAt, updatedAt: new Date().toISOString() }, null, 2),
  );
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}

const encodeArtist = name => encodeURIComponent(name).replace(/%20/g, '+');
const extractCsrf = html => html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] ?? null;

async function deleteArtist(context, artistName) {
  const encoded = encodeArtist(artistName);
  const baseUrl = `https://www.last.fm/user/${USERNAME}/library/music/${encoded}/+delete`;
  const modalUrl = `${baseUrl}?is_modal=1`;

  const modalResp = await context.request.get(modalUrl, {
    headers: {
      Referer: `https://www.last.fm/user/${USERNAME}/library/music/${encoded}`,
      Accept: 'text/html',
    },
  });
  const modalHtml = await modalResp.text();

  if (modalHtml.includes('action="/login"') || modalHtml.includes('/login?next=')) {
    throw new Error('session_expired');
  }

  let token = extractCsrf(modalHtml);
  if (!token) {
    const cookies = await context.cookies('https://www.last.fm');
    token = cookies.find(c => c.name === 'csrftoken')?.value;
  }
  if (!token) throw new Error('csrf_not_found');

  const resp = await context.request.post(modalUrl, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: modalUrl,
      'X-CSRFToken': token,
      'X-Requested-With': 'XMLHttpRequest',
    },
    form: { csrfmiddlewaretoken: token, confirm: 'on' },
  });
  return resp.status();
}

/** Ouvre un vrai navigateur pour que l'utilisateur se reconnecte à la main. */
async function reauth() {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  await page.goto('https://www.last.fm/login', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 300_000 });
  await page.goto(`https://www.last.fm/user/${USERNAME}/library`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(await context.cookies('https://www.last.fm'), null, 2), { mode: 0o600 });
  return { browser, context };
}

async function runDeletions(context, artists, browserRef = null) {
  let deleted = 0;
  let errors = 0;
  let ctx = context;
  let browser = browserRef;

  writeJob({ status: 'deleting', total: artists.length, deleted, errors });

  for (const artist of artists) {
    try {
      const status = await deleteArtist(ctx, artist);
      status >= 200 && status < 400 ? deleted++ : errors++;
      console.log(`  ${status < 400 ? '✓' : '✗'} ${artist} (HTTP ${status})`);
    } catch (e) {
      if (e.message === 'session_expired') {
        writeJob({ status: 'waiting_login', total: artists.length, deleted, errors });
        console.log('Session expirée — ouverture du navigateur pour reconnexion…');
        if (browser) await browser.close().catch(() => {});
        ({ browser, context: ctx } = await reauth());
        try {
          const status = await deleteArtist(ctx, artist);
          status >= 200 && status < 400 ? deleted++ : errors++;
        } catch {
          errors++;
          console.warn(`  ✗ ${artist} : échec après reconnexion`);
        }
        writeJob({ status: 'deleting', total: artists.length, deleted, errors });
        await sleep(800);
        continue;
      }
      errors++;
      console.warn(`  ✗ ${artist} : ${e.message}`);
    }
    writeJob({ status: 'deleting', total: artists.length, deleted, errors });
    await sleep(800);
  }

  if (browser) await browser.close().catch(() => {});
  writeJob({
    status: 'done', total: artists.length, deleted, errors,
    finishedAt: new Date().toISOString(),
  });
  console.log(`Terminé : ${deleted}/${artists.length} supprimés, ${errors} erreurs`);
}

async function main() {
  writeJob({ status: 'starting' });

  let artists = [];
  try { artists = JSON.parse(process.env.ARTISTS ?? '[]'); } catch { /* liste vide */ }
  artists = artists.filter(a => typeof a === 'string' && a.trim());

  if (!artists.length) {
    writeJob({ status: 'done', total: 0, deleted: 0, errors: 0 });
    return;
  }

  const savedCookies = readJSON(COOKIES_FILE, null);
  const hasCookies = Boolean(savedCookies?.length);
  writeJob({
    status: hasCookies ? 'authenticating' : 'waiting_login',
    total: artists.length, deleted: 0, errors: 0,
  });

  const browser = await chromium.launch({
    headless: hasCookies,
    args: hasCookies ? [] : ['--start-maximized'],
  });
  const context = await browser.newContext({ viewport: null });
  if (hasCookies) await context.addCookies(savedCookies);

  const page = await context.newPage();
  await page.goto(`https://www.last.fm/user/${USERNAME}/library`, { waitUntil: 'domcontentloaded' }).catch(() => {});

  const cookies = await context.cookies('https://www.last.fm');
  const loggedIn = cookies.some(c => c.name === 'sessionid');

  if (!loggedIn) {
    await browser.close().catch(() => {});
    writeJob({ status: 'waiting_login', total: artists.length, deleted: 0, errors: 0 });
    const { browser: nb, context: nc } = await reauth();
    await runDeletions(nc, artists, nb);
    return;
  }

  if (!hasCookies) {
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2), { mode: 0o600 });
  }
  await runDeletions(context, artists, browser);
}

main().catch(e => {
  console.error(e);
  writeJob({ status: 'error', message: e.message });
  process.exit(1);
});
