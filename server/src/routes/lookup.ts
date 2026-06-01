import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

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
