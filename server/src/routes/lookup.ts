import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
//  Discogs — source principale pour la musique (disques physiques / vinyles)
//  Doc : https://www.discogs.com/developers
// ─────────────────────────────────────────────────────────────────────────────

const DISCOGS_BASE = 'https://api.discogs.com';

// Évalué à l'appel (l'env est chargé après le hoisting des imports)
function userAgent() {
  return `BibliAnalogique/1.0 (+${process.env.APP_CONTACT_EMAIL || 'contact@example.com'})`;
}

function discogsHeaders() {
  const token = process.env.DISCOGS_TOKEN;
  return {
    'User-Agent': userAgent(),
    ...(token ? { Authorization: `Discogs token=${token}` } : {}),
  };
}

// Retire la désambiguïsation Discogs « Nom (2) » → « Nom »
const cleanName = (n: string) => (n || '').replace(/\s*\(\d+\)\s*$/, '').trim();

// Rôles Discogs intéressants → libellé FR (pour apprendre des choses sur le disque)
const ROLE_MAP: Record<string, string> = {
  'written-by': 'Compositeur', 'composed by': 'Compositeur', 'music by': 'Compositeur',
  'lyrics by': 'Paroles', 'songwriter': 'Compositeur',
  'producer': 'Producteur', 'co-producer': 'Co-producteur', 'executive-producer': 'Producteur exécutif',
  'arranged by': 'Arrangements', 'orchestrated by': 'Orchestration', 'conductor': 'Direction',
  'mixed by': 'Mixage', 'mastered by': 'Mastering', 'recorded by': 'Prise de son', 'engineer': 'Ingénieur du son',
  'vocals': 'Chant', 'featuring': 'Featuring',
  'artwork': 'Pochette', 'design': 'Design', 'photography by': 'Photographie', 'illustration': 'Illustration',
};
// Ordre d'affichage des crédits
const ROLE_ORDER = ['Compositeur', 'Paroles', 'Producteur', 'Co-producteur', 'Producteur exécutif',
  'Arrangements', 'Orchestration', 'Direction', 'Chant', 'Featuring', 'Mixage', 'Mastering',
  'Prise de son', 'Ingénieur du son', 'Pochette', 'Design', 'Illustration', 'Photographie'];

// Agrège extraartists (niveau release + par piste) en crédits groupés [{role, names[]}]
function buildCredits(release: any): { role: string; names: string[] }[] {
  const groups = new Map<string, Set<string>>();
  const consume = (list: any[]) => {
    for (const a of list || []) {
      const name = cleanName(a.name);
      if (!name) continue;
      // un même artiste peut cumuler plusieurs rôles séparés par virgule
      for (const raw of String(a.role || '').split(',')) {
        const base = raw.replace(/\s*\[[^\]]*\]/g, '').trim().toLowerCase(); // enlève « [Bionics] »
        const label = ROLE_MAP[base];
        if (!label) continue; // on ne garde que les rôles « utiles »
        if (!groups.has(label)) groups.set(label, new Set());
        groups.get(label)!.add(name);
      }
    }
  };
  consume(release.extraartists);
  for (const t of release.tracklist || []) consume(t.extraartists);

  return ROLE_ORDER
    .filter(r => groups.has(r))
    .map(r => ({ role: r, names: Array.from(groups.get(r)!).slice(0, 8) }));
}

// Format détaillé lisible : « 2×Vinyl, LP, Album, Gatefold, Red »
function buildFormatDetail(formats: any[]): string {
  const f = formats?.[0];
  if (!f) return '';
  const head = Number(f.qty) > 1 ? `${f.qty}×${f.name}` : f.name;
  const parts = [head, ...(f.descriptions || [])];
  if (f.text) parts.push(f.text); // couleur du vinyle, édition spéciale…
  return parts.filter(Boolean).join(', ');
}

// Déduit la valeur du <select> vinyle existant (33t/45t/78t/picture)
function deriveVinylFormat(formats: any[]): string | null {
  const descs = (formats?.[0]?.descriptions || []).join(' ').toLowerCase();
  if (descs.includes('picture')) return 'picture';
  if (descs.includes('78')) return '78t';
  if (descs.includes('45') || descs.includes('7"')) return '45t';
  if (descs.includes('33') || descs.includes('lp') || descs.includes('12"')) return '33t';
  return null;
}

// Nettoie le markup Discogs des profils artiste ([a=...], [url=...], [b]…)
function cleanProfile(profile: string): string {
  if (!profile) return '';
  let s = profile
    .replace(/\[a=([^\]]+)\]/g, '$1')
    .replace(/\[l=([^\]]+)\]/g, '$1')
    .replace(/\[(?:a|l|r|m)\d+\]/g, '')
    .replace(/\[url=[^\]]*\]([^[]*)\[\/url\]/g, '$1')
    .replace(/\[\/?[bi]\]/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();
  if (s.length > 800) s = s.slice(0, 800).replace(/\s+\S*$/, '') + '…';
  return s;
}

function decodeHtml(text: string): string {
  return (text || '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(text: string): string {
  return decodeHtml(String(text || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function summarizeText(text: string, maxLength = 420, maxSentences = 3): string | null {
  const clean = stripHtml(text);
  if (!clean) return null;
  const chunks = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const selected = chunks.slice(0, maxSentences).join(' ');
  const base = selected || clean;
  if (base.length <= maxLength) return base;
  return `${base.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}

function compactNumber(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat('fr-FR').format(value);
}

function lastFmSegment(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, '+');
}

function parseSources(value: unknown, defaults: string[]) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  return defaults;
}

async function wikiSummary(query: string, kind: 'album' | 'artist', artist?: string) {
  const attempts = kind === 'album'
    ? [
      `${query} ${artist || ''} album`,
      `${query} ${artist || ''}`,
      query,
    ]
    : [query];

  for (const search of attempts) {
    try {
      const searchRes = await axios.get('https://fr.wikipedia.org/w/api.php', {
        headers: { 'User-Agent': userAgent() },
        params: {
          action: 'opensearch',
          search,
          limit: 1,
          namespace: 0,
          format: 'json',
        },
      });
      const title = searchRes.data?.[1]?.[0];
      if (!title) continue;
      const summaryRes = await axios.get(
        `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { 'User-Agent': userAgent() } }
      );
      const data = summaryRes.data;
      const extract = summarizeText(data?.extract, kind === 'artist' ? 240 : 420, kind === 'artist' ? 2 : 3);
      if (!extract) continue;
      return {
        extract,
        title,
        url: data?.content_urls?.desktop?.page || `https://fr.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      };
    } catch {}
  }
  return null;
}

async function audioDbAlbum(artist: string, album: string) {
  try {
    const res = await axios.get('https://www.theaudiodb.com/api/v1/json/2/searchalbum.php', {
      params: { s: artist, a: album },
      headers: { 'User-Agent': userAgent() },
    });
    const first = res.data?.album?.[0];
    if (!first) return null;
    return {
      summary: summarizeText(first.strDescriptionFR || first.strDescriptionEN || first.strDescription, 420, 3),
      year: first.intYearReleased ? Number(first.intYearReleased) : null,
      genre: first.strGenre || null,
      style: first.strStyle || null,
      label: first.strLabel || null,
      sales: first.intSales ? Number(first.intSales) : null,
      url: first.strWikipedia || (first.idAlbum ? `https://www.theaudiodb.com/album/${first.idAlbum}` : 'https://www.theaudiodb.com/'),
    };
  } catch {
    return null;
  }
}

async function audioDbArtist(artist: string) {
  try {
    const res = await axios.get('https://www.theaudiodb.com/api/v1/json/2/search.php', {
      params: { s: artist },
      headers: { 'User-Agent': userAgent() },
    });
    const first = res.data?.artists?.[0];
    if (!first) return null;
    return {
      summary: summarizeText(first.strBiographyFR || first.strBiographyEN || first.strBiography, 240, 2),
      country: first.strCountry || null,
      style: first.strStyle || null,
      genre: first.strGenre || null,
      url: first.strWebsite ? `https://${String(first.strWebsite).replace(/^https?:\/\//, '')}` : null,
    };
  } catch {
    return null;
  }
}

async function musicBrainzAlbum(artist: string, album: string) {
  try {
    const searchRes = await axios.get('https://musicbrainz.org/ws/2/release-group', {
      headers: { 'User-Agent': userAgent() },
      params: {
        query: `releasegroup:"${album}" AND artist:"${artist}"`,
        fmt: 'json',
        limit: 5,
      },
    });
    const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const wantedTitle = normalize(album);
    const ranked = (searchRes.data?.['release-groups'] || [])
      .map((group: any) => {
        const primary = String(group?.['primary-type'] || '').toLowerCase();
        const title = normalize(String(group?.title || ''));
        const exact = title === wantedTitle ? 2 : title.includes(wantedTitle) ? 1 : 0;
        const albumBoost = primary === 'album' ? 3 : 0;
        const year = parseInt(String(group?.['first-release-date'] || '').slice(0, 4), 10);
        return { group, score: albumBoost + exact, year: Number.isNaN(year) ? 9999 : year };
      })
      .sort((a: any, b: any) => (b.score - a.score) || (a.year - b.year));
    const first = ranked[0]?.group || null;
    if (!first) return null;
    return {
      id: first.id,
      firstReleaseDate: first['first-release-date'] || null,
      primaryType: first['primary-type'] || null,
      secondaryTypes: first['secondary-types'] || [],
      tags: (first.tags || []).map((t: any) => t.name).filter(Boolean).slice(0, 5),
      url: `https://musicbrainz.org/release-group/${first.id}`,
    };
  } catch {
    return null;
  }
}

async function lastFmAlbum(artist: string, album: string) {
  const url = `https://www.last.fm/music/${lastFmSegment(artist)}/${lastFmSegment(album)}`;
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': userAgent() },
    });
    const html = String(res.data || '');
    const listeners = /([0-9][0-9,.\s]*)\s+listeners/i.exec(html)?.[1]?.trim() || null;
    const length = /catalogue-metadata-heading">Length<[^]*?catalogue-metadata-description">([^<]+)/i.exec(html)?.[1]?.trim() || null;
    const releaseDate = /catalogue-metadata-heading">Release Date<[^]*?catalogue-metadata-description">([^<]+)/i.exec(html)?.[1]?.trim() || null;
    const tags = Array.from(html.matchAll(/href="\/tag\/([^"]+)"/g))
      .map((m) => m[1].replace(/\+/g, ' ').trim())
      .filter(Boolean)
      .filter((tag, index, arr) => arr.indexOf(tag) === index)
      .slice(0, 5);

    return { url, listeners, length, releaseDate, tags };
  } catch {
    return null;
  }
}

async function discogsGet(url: string, params: any = {}) {
  const res = await axios.get(`${DISCOGS_BASE}${url}`, { headers: discogsHeaders(), params });
  return res.data;
}

// GET /lookup/discogs?q=… — recherche de pressages (avec vignettes de pochette)
router.get('/discogs', async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Paramètre q requis' });
  if (!process.env.DISCOGS_TOKEN) return res.status(503).json({ error: 'DISCOGS_TOKEN non configuré' });

  try {
    const data = await discogsGet('/database/search', {
      q, type: 'release', per_page: 12,
    });
    const results = (data.results || []).map((r: any) => ({
      source: 'discogs',
      discogs_id: r.id,
      title: r.title, // « Artiste - Album »
      year: r.year ? parseInt(r.year) : null,
      country: r.country || null,
      format: Array.isArray(r.format) ? r.format.join(', ') : null,
      label: Array.isArray(r.label) ? cleanName(r.label[0]) : null,
      cover_url: r.cover_image || r.thumb || null,
    }));
    res.json(results);
  } catch (err: any) {
    res.status(502).json({ error: 'Erreur Discogs', detail: err?.response?.status });
  }
});

// GET /lookup/discogs/:id — fiche complète enrichie (master + artiste)
router.get('/discogs/:id', async (req: Request, res: Response) => {
  if (!process.env.DISCOGS_TOKEN) return res.status(503).json({ error: 'DISCOGS_TOKEN non configuré' });
  const { id } = req.params;

  try {
    const r = await discogsGet(`/releases/${id}`, { curr_abbr: 'EUR' });

    // Enrichissements en parallèle : année d'origine (master) + bio artiste
    const artistId = r.artists?.[0]?.id;
    const [masterRes, artistRes] = await Promise.allSettled([
      r.master_id ? discogsGet(`/masters/${r.master_id}`) : Promise.resolve(null),
      artistId ? discogsGet(`/artists/${artistId}`) : Promise.resolve(null),
    ]);
    const master = masterRes.status === 'fulfilled' ? masterRes.value : null;
    const artist = artistRes.status === 'fulfilled' ? artistRes.value : null;

    const tracklist = (r.tracklist || [])
      .filter((t: any) => t.type_ === 'track' || !t.type_)
      .map((t: any) => {
        let length_sec: number | null = null;
        if (t.duration && /^\d+:\d{2}$/.test(t.duration)) {
          const [m, s] = t.duration.split(':').map(Number);
          length_sec = m * 60 + s;
        }
        return { position: t.position, title: t.title, length_sec };
      });
    const duration_total_sec = tracklist.reduce(
      (acc: number, t: any) => acc + (t.length_sec || 0), 0
    ) || null;

    const images: any[] = r.images || [];
    const primary = images.find(i => i.type === 'primary') || images[0];
    const secondary = images.find(i => i.type === 'secondary');

    const barcode = (r.identifiers || []).find((i: any) => i.type === 'Barcode')?.value || null;

    const community = r.community ? {
      have: r.community.have ?? null,
      want: r.community.want ?? null,
      rating: r.community.rating?.average ?? null,
      rating_count: r.community.rating?.count ?? null,
      lowest_price: r.lowest_price ?? null,   // en EUR (curr_abbr)
      num_for_sale: r.num_for_sale ?? null,
    } : null;

    res.json({
      source: 'discogs',
      type: 'music',
      discogs_id: r.id,
      title: r.title,
      artist_or_director: cleanName(r.artists?.[0]?.name) || null,
      year: r.year || (r.released ? parseInt(r.released) : null),
      original_year: master?.year || null,
      country: r.country || null,
      label: cleanName(r.labels?.[0]?.name) || null,
      catalog_no: r.labels?.[0]?.catno || null,
      barcode,
      genres: r.genres || [],
      styles: r.styles || [],
      format_detail: buildFormatDetail(r.formats),
      vinyl_format: deriveVinylFormat(r.formats),
      tracklist,
      duration_total_sec,
      credits: buildCredits(r),
      community,
      videos: (r.videos || []).slice(0, 8).map((v: any) => ({
        title: v.title, url: v.uri, duration: v.duration || null,
      })),
      description: r.notes || null,
      artist_bio: cleanProfile(artist?.profile) || null,
      cover_url: primary?.uri || primary?.resource_url || null,
      back_cover_url: secondary?.uri || null,
    });
  } catch (err: any) {
    res.status(502).json({ error: 'Erreur Discogs', detail: err?.response?.status });
  }
});

router.get('/music-editorial', async (req: Request, res: Response) => {
  const artist = String(req.query.artist || '').trim();
  const album = String(req.query.album || '').trim();
  const discogsId = req.query.discogs_id ? Number(req.query.discogs_id) : null;
  const editionYear = req.query.year ? Number(req.query.year) : null;
  const selectedSources = new Set(parseSources(req.query.sources, ['discogs', 'musicbrainz', 'lastfm', 'wikipedia', 'theaudiodb']));

  if (!artist || !album) {
    return res.status(400).json({ error: 'Paramètres artist et album requis' });
  }

  try {
    let discogsRelease: any = null;
    let discogsMaster: any = null;

    if (selectedSources.has('discogs') && discogsId && process.env.DISCOGS_TOKEN) {
      try {
        discogsRelease = await discogsGet(`/releases/${discogsId}`, { curr_abbr: 'EUR' });
        if (discogsRelease?.master_id) {
          discogsMaster = await discogsGet(`/masters/${discogsRelease.master_id}`);
        }
      } catch {}
    }

    const [albumWiki, artistWiki, audioAlbum, audioArtist, mbAlbum, lastfm] = await Promise.all([
      selectedSources.has('wikipedia') ? wikiSummary(album, 'album', artist) : Promise.resolve(null),
      selectedSources.has('wikipedia') ? wikiSummary(artist, 'artist') : Promise.resolve(null),
      selectedSources.has('theaudiodb') ? audioDbAlbum(artist, album) : Promise.resolve(null),
      selectedSources.has('theaudiodb') ? audioDbArtist(artist) : Promise.resolve(null),
      selectedSources.has('musicbrainz') ? musicBrainzAlbum(artist, album) : Promise.resolve(null),
      selectedSources.has('lastfm') ? lastFmAlbum(artist, album) : Promise.resolve(null),
    ]);

    const community = discogsRelease?.community ? {
      rating: discogsRelease.community.rating?.average ?? null,
      rating_count: discogsRelease.community.rating?.count ?? null,
      have: discogsRelease.community.have ?? null,
      want: discogsRelease.community.want ?? null,
    } : null;

    const albumSummary =
      albumWiki?.extract ||
      audioAlbum?.summary ||
      summarizeText(discogsMaster?.notes || discogsRelease?.notes, 420, 3) ||
      null;

    const artistSummary =
      artistWiki?.extract ||
      audioArtist?.summary ||
      null;

    const mainCredits = buildCredits(discogsRelease || {}).filter((credit) =>
      ['Compositeur', 'Paroles', 'Producteur', 'Co-producteur', 'Chant', 'Featuring', 'Mixage', 'Mastering'].includes(credit.role)
    ).slice(0, 6);

    const anecdotes: { text: string; source: string; url?: string | null }[] = [];

    const originalYear = discogsMaster?.year || audioAlbum?.year || (mbAlbum?.firstReleaseDate ? parseInt(mbAlbum.firstReleaseDate, 10) : null) || null;
    if (originalYear) {
      anecdotes.push({
        text: editionYear && editionYear !== originalYear
          ? `L'album est sorti à l'origine en ${originalYear}; l'édition de ta collection date de ${editionYear}.`
          : `La sortie d'origine remonte à ${originalYear}.`,
        source: discogsMaster?.id ? 'Discogs' : mbAlbum?.id ? 'MusicBrainz' : 'TheAudioDB',
        url: discogsMaster?.id ? `https://www.discogs.com/master/${discogsMaster.id}` : mbAlbum?.url || audioAlbum?.url,
      });
    }

    if (lastfm?.listeners || lastfm?.tags.length) {
      const parts = [];
      if (lastfm.listeners) parts.push(`${lastfm.listeners} auditeurs référencés sur Last.fm`);
      if (lastfm.tags.length) parts.push(`tags fréquents: ${lastfm.tags.slice(0, 3).join(', ')}`);
      anecdotes.push({
        text: `${parts.join(' · ')}.`,
        source: 'Last.fm',
        url: lastfm.url,
      });
    }

    if (audioAlbum?.sales) {
      anecdotes.push({
        text: `TheAudioDB relaie une estimation d'environ ${compactNumber(audioAlbum.sales)} ventes pour cet album.`,
        source: 'TheAudioDB',
        url: audioAlbum.url,
      });
    }

    if (community?.have || community?.want) {
      const have = compactNumber(community.have);
      const want = compactNumber(community.want);
      anecdotes.push({
        text: `Sur Discogs, ${have || '0'} collectionneurs l'ont dans leur bibliothèque et ${want || '0'} le suivent en liste de recherche.`,
        source: 'Discogs',
        url: discogsRelease?.id ? `https://www.discogs.com/release/${discogsRelease.id}` : null,
      });
    }

    if (mbAlbum?.primaryType || (mbAlbum?.tags && mbAlbum.tags.length)) {
      const detail = [mbAlbum.primaryType, ...(mbAlbum.secondaryTypes || [])].filter(Boolean).join(', ');
      const tagText = mbAlbum.tags?.length ? ` Tags associés: ${mbAlbum.tags.slice(0, 3).join(', ')}.` : '';
      anecdotes.push({
        text: `${detail ? `MusicBrainz le classe comme ${detail}.` : 'MusicBrainz référence cet album.'}${tagText}`,
        source: 'MusicBrainz',
        url: mbAlbum.url,
      });
    }

    const sources = [
      albumWiki ? { label: 'Wikipedia', url: albumWiki.url } : null,
      lastfm ? { label: 'Last.fm', url: lastfm.url } : null,
      discogsRelease?.id ? { label: 'Discogs', url: `https://www.discogs.com/release/${discogsRelease.id}` } : null,
      mbAlbum ? { label: 'MusicBrainz', url: mbAlbum.url } : null,
      audioAlbum?.url ? { label: 'TheAudioDB', url: audioAlbum.url } : null,
    ].filter(Boolean);

    res.json({
      album_summary: albumSummary,
      artist_summary: artistSummary,
      main_credits: mainCredits,
      rating: community?.rating ? {
        source: 'Discogs',
        label: 'Note communauté',
        value: community.rating,
        scale: 5,
        count: community.rating_count,
        url: discogsRelease?.id ? `https://www.discogs.com/release/${discogsRelease.id}` : null,
      } : null,
      anecdotes: anecdotes.slice(0, 4),
      sources,
      lastfm_context: lastfm ? {
        listeners: lastfm.listeners,
        release_date: lastfm.releaseDate,
        length: lastfm.length,
        tags: lastfm.tags,
      } : null,
    });
  } catch {
    res.status(500).json({ error: 'Erreur lors de l’enrichissement éditorial' });
  }
});

// POST /lookup/barcode — recherche par code-barres (MusicBrainz ou TMDB)
router.get('/barcode/:code', async (req: Request, res: Response) => {
  const { code } = req.params;

  // Essai MusicBrainz d'abord
  try {
    const mbRes = await axios.get(
      `https://musicbrainz.org/ws/2/release/?query=barcode:${code}&fmt=json`,
      { headers: { 'User-Agent': 'BibliAnalogique/1.0 (benoit.varisellaz@gmail.com)' } }
    );
    const releases = mbRes.data.releases;
    if (releases && releases.length > 0) {
      const r = releases[0];
      const mbid = r.id;
      let coverUrl = null;
      try {
        const caaRes = await axios.get(`https://coverartarchive.org/release/${mbid}`, { maxRedirects: 5 });
        coverUrl = caaRes.data?.images?.[0]?.thumbnails?.large || caaRes.data?.images?.[0]?.image || null;
      } catch {}

      return res.json({
        source: 'musicbrainz',
        type: 'music',
        title: r.title,
        year: r.date ? parseInt(r.date) : null,
        artist_or_director: r['artist-credit']?.[0]?.name || null,
        label: r['label-info']?.[0]?.label?.name || null,
        cover_url: coverUrl,
        mbid,
      });
    }
  } catch {}

  // Fallback TMDB
  const tmdbKey = process.env.TMDB_API_KEY;
  if (tmdbKey) {
    try {
      const tmdbRes = await axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${code}`
      );
      const movies = tmdbRes.data.results;
      if (movies && movies.length > 0) {
        const m = movies[0];
        return res.json({
          source: 'tmdb',
          type: 'video',
          title: m.title,
          year: m.release_date ? parseInt(m.release_date) : null,
          synopsis: m.overview,
          cover_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
          tmdb_id: m.id,
        });
      }
    } catch {}
  }

  res.status(404).json({ error: 'Rien trouvé pour ce code-barres' });
});

// GET /lookup/music?q=... — recherche MusicBrainz
router.get('/music', async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Paramètre q requis' });

  try {
    const mbRes = await axios.get(
      `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(q as string)}&fmt=json&limit=10`,
      { headers: { 'User-Agent': 'BibliAnalogique/1.0 (benoit.varisellaz@gmail.com)' } }
    );
    const releases = mbRes.data.releases || [];
    const results = releases.map((r: any) => ({
      mbid: r.id,
      title: r.title,
      year: r.date ? parseInt(r.date) : null,
      artist_or_director: r['artist-credit']?.[0]?.name || null,
      label: r['label-info']?.[0]?.label?.name || null,
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Erreur MusicBrainz' });
  }
});

// GET /lookup/music/:mbid — détails + tracklist + cover
router.get('/music/:mbid', async (req: Request, res: Response) => {
  const { mbid } = req.params;
  try {
    const [releaseRes, coverRes] = await Promise.allSettled([
      axios.get(
        `https://musicbrainz.org/ws/2/release/${mbid}?inc=recordings+artist-credits+labels&fmt=json`,
        { headers: { 'User-Agent': 'BibliAnalogique/1.0 (benoit.varisellaz@gmail.com)' } }
      ),
      axios.get(`https://coverartarchive.org/release/${mbid}`, { maxRedirects: 5 }),
    ]);

    const r = releaseRes.status === 'fulfilled' ? releaseRes.value.data : null;
    const caa = coverRes.status === 'fulfilled' ? coverRes.value.data : null;

    if (!r) return res.status(404).json({ error: 'Release introuvable' });

    const tracklist = r.media?.[0]?.tracks?.map((t: any) => ({
      position: t.position,
      title: t.title,
      length_sec: t.length ? Math.round(t.length / 1000) : null,
    })) || [];

    res.json({
      mbid,
      title: r.title,
      year: r.date ? parseInt(r.date) : null,
      artist_or_director: r['artist-credit']?.[0]?.name || null,
      label: r['label-info']?.[0]?.label?.name || null,
      tracklist,
      cover_url: caa?.images?.[0]?.thumbnails?.large || caa?.images?.[0]?.image || null,
    });
  } catch {
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// GET /lookup/video?q=... — recherche TMDB
router.get('/video', async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Paramètre q requis' });

  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) return res.status(503).json({ error: 'TMDB_API_KEY non configurée' });

  try {
    const tmdbRes = await axios.get(
      `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(q as string)}&language=fr-FR&include_adult=false`
    );
    const results = (tmdbRes.data.results || [])
      .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 10)
      .map((r: any) => ({
        tmdb_id: r.id,
        media_type: r.media_type,
        title: r.title || r.name,
        year: (r.release_date || r.first_air_date) ? parseInt(r.release_date || r.first_air_date) : null,
        cover_url: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
        synopsis: r.overview,
      }));
    res.json(results);
  } catch {
    res.status(500).json({ error: 'Erreur TMDB' });
  }
});

// GET /lookup/video/:tmdb_id — détails TMDB
router.get('/video/:tmdb_id', async (req: Request, res: Response) => {
  const { tmdb_id } = req.params;
  const { media_type = 'movie' } = req.query;
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) return res.status(503).json({ error: 'TMDB_API_KEY non configurée' });

  try {
    const url = `https://api.themoviedb.org/3/${media_type}/${tmdb_id}?api_key=${tmdbKey}&language=fr-FR&append_to_response=credits`;
    const tmdbRes = await axios.get(url);
    const m = tmdbRes.data;

    const cast = m.credits?.cast?.slice(0, 5).map((c: any) => c.name) || [];
    const genres = m.genres?.map((g: any) => g.name) || [];

    res.json({
      tmdb_id: m.id,
      title: m.title || m.name,
      year: (m.release_date || m.first_air_date) ? parseInt(m.release_date || m.first_air_date) : null,
      synopsis: m.overview,
      duration_min: m.runtime || null,
      cover_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      genres,
      cast_list: cast,
      language: m.original_language,
    });
  } catch {
    res.status(500).json({ error: 'Erreur TMDB' });
  }
});

export default router;
