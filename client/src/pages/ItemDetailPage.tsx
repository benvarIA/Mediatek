import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  itemsApi,
  lookupApi,
  type EnrichmentSourceKey,
  type Item,
  type MusicEditorial,
  type MusicEditorialSourceKey,
} from '../api';
import { scrobbleAlbum } from '../scrobbler';
import './ItemDetailPage.css';

const SUPPORT_LABEL: Record<string, string> = { cd: 'CD', vinyl: 'Vinyle', dvd: 'DVD', bluray: 'Blu-ray' };
const STATE_LABEL: Record<string, string> = { neuf: 'Neuf', bon_etat: 'Bon état', use: 'Usagé' };

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTotal(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')}` : `${m} min`;
}

const nf = new Intl.NumberFormat('fr-FR');
const MUSIC_SOURCES: { key: MusicEditorialSourceKey; label: string }[] = [
  { key: 'discogs', label: 'Discogs' },
  { key: 'musicbrainz', label: 'MusicBrainz' },
  { key: 'lastfm', label: 'Last.fm' },
  { key: 'wikipedia', label: 'Wikipedia' },
  { key: 'theaudiodb', label: 'TheAudioDB' },
];
const VIDEO_SOURCES: { key: EnrichmentSourceKey; label: string }[] = [
  { key: 'tmdb', label: 'TMDB' },
];
type CoverEditorMode = 'search' | 'url' | 'upload';

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editorial, setEditorial] = useState<MusicEditorial | null>(null);
  const [editorialLoading, setEditorialLoading] = useState(false);
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);
  const [reEnriching, setReEnriching] = useState(false);
  const [enrichmentMsg, setEnrichmentMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [selectedSources, setSelectedSources] = useState<EnrichmentSourceKey[]>(MUSIC_SOURCES.map((source) => source.key));
  const [editorialSources, setEditorialSources] = useState<MusicEditorialSourceKey[]>(MUSIC_SOURCES.map((source) => source.key));
  const [updateImage, setUpdateImage] = useState(true);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [coverMode, setCoverMode] = useState<CoverEditorMode>('search');
  const [coverUrlDraft, setCoverUrlDraft] = useState('');
  const [coverSearchQuery, setCoverSearchQuery] = useState('');
  const [coverSearchResults, setCoverSearchResults] = useState<any[]>([]);
  const [coverSearching, setCoverSearching] = useState(false);
  const [coverSaving, setCoverSaving] = useState(false);
  const [coverMsg, setCoverMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    itemsApi.get(parseInt(id)).then(item => {
      setItem(item);
      setNotes(item.notes || '');
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!item || item.type !== 'music' || !item.artist_or_director?.trim() || !item.title.trim()) {
      setEditorial(null);
      return;
    }

    loadEditorial(item, editorialSources);
  }, [item, editorialSources]);

  useEffect(() => {
    if (!item) return;
    setSelectedSources(item.type === 'music'
      ? MUSIC_SOURCES.map((source) => source.key)
      : VIDEO_SOURCES.map((source) => source.key)
    );
    setEditorialSources(MUSIC_SOURCES.map((source) => source.key));
    setUpdateImage(true);
    setEnrichmentOpen(false);
    setEnrichmentMsg(null);
    setCoverEditorOpen(false);
    setCoverMode('search');
    setCoverUrlDraft(item.cover_url || '');
    setCoverSearchQuery([item.artist_or_director, item.title].filter(Boolean).join(' '));
    setCoverSearchResults([]);
    setCoverMsg(null);
  }, [item?.id, item?.type]);

  function loadEditorial(currentItem: Item, sources: MusicEditorialSourceKey[]) {
    if (currentItem.type !== 'music' || !currentItem.artist_or_director?.trim() || !currentItem.title.trim()) {
      setEditorial(null);
      return;
    }

    setEditorialLoading(true);
    lookupApi.getMusicEditorial({
      artist: currentItem.artist_or_director,
      album: currentItem.title,
      discogs_id: currentItem.discogs_id ?? null,
      year: currentItem.year ?? null,
      sources,
    })
      .then(setEditorial)
      .catch(() => setEditorial(null))
      .finally(() => setEditorialLoading(false));
  }

  async function saveNotes() {
    if (!item) return;
    setSaving(true);
    const updated = await itemsApi.update(item.id, { notes });
    setItem(updated);
    setEditingNotes(false);
    setSaving(false);
  }

  const [scrobbling, setScrobbling] = useState(false);
  const [scrobbleMsg, setScrobbleMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleScrobble() {
    if (!item) return;
    setScrobbling(true);
    setScrobbleMsg(null);
    const r = await scrobbleAlbum(item);
    if (r.ok) {
      const heure = r.finishAt
        ? new Date(r.finishAt * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : null;
      setScrobbleMsg({
        ok: true,
        text: r.duplicate
          ? 'Déjà dans la file ScrobblerVari.'
          : `Ajouté à la file ScrobblerVari${r.trackCount ? ` — ${r.trackCount} pistes` : ''}${heure ? `, fin vers ${heure}` : ''}.`,
      });
    } else {
      setScrobbleMsg({ ok: false, text: r.error || 'Échec du scrobble' });
    }
    setScrobbling(false);
  }

  async function handleDelete() {
    if (!item) return;
    if (!window.confirm(`Supprimer "${item.title}" de la collection ?`)) return;
    setDeleting(true);
    await itemsApi.delete(item.id);
    navigate('/');
  }

  function toggleSource(source: EnrichmentSourceKey) {
    setSelectedSources((prev) => (
      prev.includes(source) ? prev.filter((entry) => entry !== source) : [...prev, source]
    ));
  }

  async function handleReEnrich() {
    if (!item || !selectedSources.length) return;
    setReEnriching(true);
    setEnrichmentMsg(null);
    try {
      const updated = await itemsApi.reEnrich(item.id, { sources: selectedSources, updateImage });
      setItem(updated);
      if (updated.type === 'music') {
        const editorialSources = selectedSources.filter((source): source is MusicEditorialSourceKey => source !== 'tmdb');
        setEditorialSources(editorialSources.length ? editorialSources : MUSIC_SOURCES.map((source) => source.key));
      }
      setEnrichmentMsg({
        ok: true,
        text: updateImage
          ? 'La fiche a été réenrichie, image incluse.'
          : 'La fiche a été réenrichie sans toucher à l’image.',
      });
      setEnrichmentOpen(false);
    } catch {
      setEnrichmentMsg({ ok: false, text: 'Le réenrichissement a échoué.' });
    } finally {
      setReEnriching(false);
    }
  }

  async function handleCoverSearch() {
    if (!item || !coverSearchQuery.trim()) return;
    setCoverSearching(true);
    setCoverMsg(null);
    try {
      let results: any[] = [];
      if (item.type === 'music') {
        try {
          results = await lookupApi.searchDiscogs(coverSearchQuery);
        } catch {
          results = [];
        }
        if (!results.length) {
          results = await lookupApi.searchMusic(coverSearchQuery);
        }
      } else {
        results = await lookupApi.searchVideo(coverSearchQuery);
      }
      setCoverSearchResults(results.filter((result) => result.cover_url));
      if (!results.some((result) => result.cover_url)) {
        setCoverMsg({ ok: false, text: 'Aucune image trouvée avec cette recherche.' });
      }
    } catch {
      setCoverMsg({ ok: false, text: 'La recherche d’image a échoué.' });
    } finally {
      setCoverSearching(false);
    }
  }

  async function saveCoverUrl(url: string) {
    if (!item || !url.trim()) return;
    setCoverSaving(true);
    setCoverMsg(null);
    try {
      const updated = await itemsApi.update(item.id, { cover_url: url.trim() });
      setItem(updated);
      setCoverUrlDraft(updated.cover_url || '');
      setCoverMsg({ ok: true, text: 'L’image de la fiche a été mise à jour.' });
      setCoverEditorOpen(false);
    } catch {
      setCoverMsg({ ok: false, text: 'La mise à jour de l’image a échoué.' });
    } finally {
      setCoverSaving(false);
    }
  }

  async function handleCoverUpload(file: File | null) {
    if (!item || !file) return;
    setCoverSaving(true);
    setCoverMsg(null);
    try {
      const updated = await itemsApi.uploadCover(item.id, file);
      setItem(updated);
      setCoverUrlDraft(updated.cover_url || '');
      setCoverMsg({ ok: true, text: 'L’image envoyée a été enregistrée.' });
      setCoverEditorOpen(false);
    } catch {
      setCoverMsg({ ok: false, text: 'L’envoi de l’image a échoué.' });
    } finally {
      setCoverSaving(false);
    }
  }

  if (loading) return <div className="detail-loading">Chargement...</div>;
  if (!item) return <div className="detail-loading">Introuvable.</div>;

  const mainCredits = editorial?.main_credits?.length
    ? editorial.main_credits
    : (item.credits || [])
      .filter((credit) => ['Compositeur', 'Paroles', 'Producteur', 'Co-producteur', 'Chant', 'Featuring', 'Mixage', 'Mastering'].includes(credit.role))
      .slice(0, 6);
  const displayedRating = editorial?.rating || (
    item.community?.rating
      ? {
        source: 'Discogs',
        label: 'Note communauté',
        value: item.community.rating,
        scale: 5,
        count: item.community.rating_count ?? null,
        url: item.discogs_id ? `https://www.discogs.com/release/${item.discogs_id}` : null,
      }
      : null
  );
  const videos = (item.videos || []).filter((video, index, list) =>
    list.findIndex((candidate) => candidate.url === video.url) === index
  );
  const availableSources = item.type === 'music' ? MUSIC_SOURCES : VIDEO_SOURCES;

  return (
    <div className="detail">
      <div className="detail-nav">
        <Link to="/" className="detail-back">← Bibliothèque</Link>
        <div className="detail-actions">
          {item.type === 'music' && (
            <button className="btn-scrobble" onClick={handleScrobble} disabled={scrobbling}>
              {scrobbling ? 'Envoi…' : 'Scrobbler sur Last.fm'}
            </button>
          )}
          <button className="btn-edit" onClick={() => setEnrichmentOpen((open) => !open)}>
            Réenrichir
          </button>
          <button className="btn-delete" onClick={handleDelete} disabled={deleting}>
            Supprimer
          </button>
        </div>
      </div>

      {scrobbleMsg && (
        <div className={`scrobble-msg ${scrobbleMsg.ok ? 'ok' : 'err'}`}>
          {scrobbleMsg.ok ? '✓ ' : '⚠ '}{scrobbleMsg.text}
        </div>
      )}

      {enrichmentMsg && (
        <div className={`scrobble-msg ${enrichmentMsg.ok ? 'ok' : 'err'}`}>
          {enrichmentMsg.ok ? '✓ ' : '⚠ '}{enrichmentMsg.text}
        </div>
      )}

      {coverMsg && (
        <div className={`scrobble-msg ${coverMsg.ok ? 'ok' : 'err'}`}>
          {coverMsg.ok ? '✓ ' : '⚠ '}{coverMsg.text}
        </div>
      )}

      {enrichmentOpen && (
        <div className="detail-enrichment-panel">
          <div className="detail-enrichment-head">
            <h2 className="detail-section-title">Réenrichir cette fiche</h2>
            <button className="btn-secondary detail-enrichment-close" onClick={() => setEnrichmentOpen(false)}>
              Fermer
            </button>
          </div>
          <p className="detail-prose">
            Choisis les sources à relancer et indique si la pochette peut aussi être remplacée.
          </p>
          <div className="detail-enrichment-sources">
            {availableSources.map((source) => (
              <label key={source.key} className={`detail-source-toggle ${selectedSources.includes(source.key) ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedSources.includes(source.key)}
                  onChange={() => toggleSource(source.key)}
                />
                <span>{source.label}</span>
              </label>
            ))}
          </div>
          <label className="detail-image-toggle">
            <input
              type="checkbox"
              checked={updateImage}
              onChange={(e) => setUpdateImage(e.target.checked)}
            />
            <span>Autoriser la mise à jour de l’image</span>
          </label>
          <div className="detail-enrichment-actions">
            <button
              className="btn-primary"
              onClick={handleReEnrich}
              disabled={reEnriching || selectedSources.length === 0}
            >
              {reEnriching ? 'Réenrichissement...' : 'Lancer le réenrichissement'}
            </button>
          </div>
        </div>
      )}

      <div className="detail-hero">
        <div className="detail-cover">
          {item.cover_url
            ? <img src={item.cover_url} alt={item.title} />
            : <div className="detail-no-cover">{item.type === 'music' ? 'Audio' : 'Film'}</div>
          }
          <button className="btn-edit detail-cover-edit" onClick={() => setCoverEditorOpen((open) => !open)}>
            Modifier l’image
          </button>
        </div>
        <div className="detail-info">
          <div className="detail-badges">
            <span className="badge-support">{SUPPORT_LABEL[item.support]}</span>
            <span className="badge-state">{STATE_LABEL[item.state]}</span>

          </div>
          <h1 className="detail-title">{item.title}</h1>
          {item.artist_or_director && (
            <p className="detail-artist">{item.artist_or_director}</p>
          )}
          <div className="detail-meta-row">
            {item.year && (
              <span>
                {item.type === 'music' ? (item.original_year || item.year) : item.year}
              </span>
            )}
            {item.type === 'video' && item.duration_min && <span>{item.duration_min} min</span>}
            {item.type === 'music' && item.duration_total_sec
              ? <span>{formatTotal(item.duration_total_sec)}</span> : null}
            {item.label && <span>{item.label}</span>}
            {item.type === 'video' && item.country && <span>{item.country}</span>}
            {item.language && <span>{item.language}</span>}
          </div>
          {(item.genres.length > 0 || (item.styles && item.styles.length > 0)) && (
            <div className="detail-genres">
              {item.genres.map(g => <span key={g} className="detail-genre">{g}</span>)}
              {item.styles?.map(s => <span key={s} className="detail-genre detail-style">{s}</span>)}
            </div>
          )}
          {item.synopsis && <p className="detail-synopsis">{item.synopsis}</p>}
          {item.cast_list && item.cast_list.length > 0 && (
            <p className="detail-cast">Avec : {item.cast_list.join(', ')}</p>
          )}
        </div>
      </div>

      {coverEditorOpen && (
        <div className="detail-cover-panel">
          <div className="detail-enrichment-head">
            <h2 className="detail-section-title">Image de la fiche</h2>
            <button className="btn-secondary detail-enrichment-close" onClick={() => setCoverEditorOpen(false)}>
              Fermer
            </button>
          </div>
          <div className="detail-cover-modes">
            {([
              ['search', 'Recherche'],
              ['url', 'URL'],
              ['upload', 'Upload'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                className={`detail-cover-mode ${coverMode === mode ? 'active' : ''}`}
                onClick={() => setCoverMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {coverMode === 'search' && (
            <>
              <div className="lookup-search detail-cover-search">
                <input
                  type="text"
                  value={coverSearchQuery}
                  onChange={(e) => setCoverSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCoverSearch()}
                  placeholder="Titre, artiste, réalisateur..."
                />
                <button className="btn-primary" onClick={handleCoverSearch} disabled={coverSearching}>
                  {coverSearching ? 'Recherche...' : 'Chercher'}
                </button>
              </div>
              <div className="detail-cover-results">
                {coverSearchResults.map((result, index) => (
                  <button
                    key={`${result.cover_url}-${index}`}
                    className="detail-cover-result"
                    onClick={() => saveCoverUrl(result.cover_url)}
                    disabled={coverSaving}
                  >
                    <img src={result.cover_url} alt={result.title || 'Résultat'} />
                    <span>{result.title || result.artist_or_director || 'Image'}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {coverMode === 'url' && (
            <div className="detail-cover-url">
              <input
                type="url"
                value={coverUrlDraft}
                onChange={(e) => setCoverUrlDraft(e.target.value)}
                placeholder="https://…"
              />
              <button className="btn-primary" onClick={() => saveCoverUrl(coverUrlDraft)} disabled={coverSaving || !coverUrlDraft.trim()}>
                {coverSaving ? 'Enregistrement...' : 'Utiliser cette URL'}
              </button>
            </div>
          )}

          {coverMode === 'upload' && (
            <label className="detail-cover-upload">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleCoverUpload(e.target.files?.[0] || null)}
                disabled={coverSaving}
              />
              <span>{coverSaving ? 'Envoi...' : 'Choisir une image depuis l’ordinateur'}</span>
            </label>
          )}
        </div>
      )}

      {item.tracklist && item.tracklist.length > 0 && (
        <div className="detail-section">
          <h2 className="detail-section-title">Tracklist</h2>
          <div className="tracklist">
            {item.tracklist.map(t => (
              <div key={t.position} className="track">
                <span className="track-num">{t.position}</span>
                <span className="track-title">{t.title}</span>
                {t.length_sec && <span className="track-dur">{formatDuration(t.length_sec)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {item.type === 'music' && (editorialLoading || editorial) && (
        <div className="detail-section">
          <h2 className="detail-section-title">L'album, en bref</h2>
          {editorialLoading && !editorial ? (
            <p className="detail-prose">Chargement des sources…</p>
          ) : (
            <>
              {displayedRating && (
                <div className="editorial-rating">
                  <span className="editorial-rating-value">
                    {displayedRating.value.toFixed(2)} / {displayedRating.scale}
                  </span>
                  <span className="editorial-rating-label">
                    {displayedRating.label}
                    {displayedRating.count ? ` · ${nf.format(displayedRating.count)} avis` : ''}
                  </span>
                </div>
              )}

              {editorial?.album_summary && <p className="detail-prose">{editorial.album_summary}</p>}

              {mainCredits.length ? (
                <>
                  <h3 className="detail-subtitle">Crédits principaux</h3>
                  <div className="credits-grid">
                    {mainCredits.map((credit) => (
                      <div key={credit.role} className="credit">
                        <span className="credit-role">{credit.role}</span>
                        <span className="credit-names">{credit.names.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {editorial?.anecdotes?.length ? (
                <>
                  <h3 className="detail-subtitle">Repères & anecdotes</h3>
                  <div className="editorial-facts">
                    {editorial.anecdotes.map((fact, index) => (
                      <div key={`${fact.source}-${index}`} className="editorial-fact">
                        <p className="detail-prose">{fact.text}</p>
                        <span className="editorial-fact-source">{fact.source}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {editorial?.artist_summary && (
                <>
                  <h3 className="detail-subtitle">L'artiste</h3>
                  <p className="detail-prose">{editorial.artist_summary}</p>
                </>
              )}

              {editorial?.sources?.length ? (
                <>
                  <h3 className="detail-subtitle">Sources</h3>
                  <div className="editorial-sources">
                    {editorial.sources.map((source) => (
                      <a key={source.url} className="editorial-source" href={source.url} target="_blank" rel="noreferrer">
                        {source.label}
                      </a>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      )}

      {videos.length > 0 && (
        <div className="detail-section">
          <h2 className="detail-section-title">Écouter / regarder</h2>
          <div className="videos-list">
            {videos.map(v => (
              <a key={v.url} className="video-link" href={v.url} target="_blank" rel="noreferrer">
                <span className="video-play">▶</span>
                <span className="video-title">{v.title}</span>
                {v.duration ? <span className="video-dur">{formatDuration(v.duration)}</span> : null}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section">
        <div className="detail-section-header">
          <h2 className="detail-section-title">Notes personnelles</h2>
          {!editingNotes && (
            <button className="btn-edit" onClick={() => setEditingNotes(true)}>Modifier</button>
          )}
        </div>
        {editingNotes ? (
          <div className="notes-edit">
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} autoFocus />
            <div className="notes-edit-actions">
              <button className="btn-primary" onClick={saveNotes} disabled={saving}>
                {saving ? '...' : 'Sauvegarder'}
              </button>
              <button className="btn-secondary" onClick={() => { setEditingNotes(false); setNotes(item.notes || ''); }}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <p className="notes-display">
            {item.notes || <span className="notes-empty">Aucune note. Clique sur Modifier pour en ajouter.</span>}
          </p>
        )}
      </div>
    </div>
  );
}
