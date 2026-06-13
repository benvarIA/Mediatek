import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemsApi, lookupApi, type Item, type Support, type State } from '../api';
import './AddPage.css';

type Step = 'choose' | 'lookup' | 'form';

const GENRES_MUSIC = ['Rock', 'Pop', 'Jazz', 'Classique', 'Électronique', 'Hip-Hop', 'Soul', 'Metal', 'Blues', 'Folk', 'R&B', 'Reggae'];
const GENRES_VIDEO = ['Action', 'Comédie', 'Drame', 'Thriller', 'Horreur', 'Sci-Fi', 'Animation', 'Documentaire', 'Romance', 'Fantastique', 'Historique'];

const DEFAULT_FORM: Partial<Item> = {
  type: 'music',
  support: 'cd',
  title: '',
  year: undefined,
  genres: [],
  artist_or_director: '',
  notes: '',
  state: 'bon_etat',
};

export default function AddPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('choose');
  const [form, setForm] = useState<Partial<Item>>(DEFAULT_FORM);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField(key: keyof Item, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleGenre(genre: string) {
    setForm(prev => {
      const genres = prev.genres || [];
      return {
        ...prev,
        genres: genres.includes(genre) ? genres.filter(g => g !== genre) : [...genres, genre],
      };
    });
  }

  async function handleLookup() {
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    setError('');
    try {
      let results: any[];
      if (form.type === 'video') {
        results = await lookupApi.searchVideo(lookupQuery);
      } else {
        // Musique : Discogs en priorité, repli MusicBrainz si vide / token absent
        try {
          results = await lookupApi.searchDiscogs(lookupQuery);
        } catch {
          results = [];
        }
        if (!results.length) {
          results = await lookupApi.searchMusic(lookupQuery);
        }
      }
      setLookupResults(results);
      if (!results.length) setError('Aucun résultat. Essaie une autre recherche ou saisis à la main.');
    } catch {
      setError('Erreur lors de la recherche');
    } finally {
      setLookupLoading(false);
    }
  }

  async function selectLookupResult(result: any) {
    try {
      let detail: any = result;
      if (result.discogs_id) {
        detail = await lookupApi.getDiscogsDetail(result.discogs_id);
      } else if (result.mbid) {
        detail = await lookupApi.getMusicDetail(result.mbid);
      } else if (result.tmdb_id) {
        detail = await lookupApi.getVideoDetail(result.tmdb_id, result.media_type || 'movie');
      }
      setForm(prev => ({
        ...prev,
        title: detail.title || prev.title,
        year: detail.year || prev.year,
        artist_or_director: detail.artist_or_director || prev.artist_or_director,
        cover_url: detail.cover_url || prev.cover_url,
        genres: detail.genres?.length ? detail.genres : (prev.genres || []),
        label: detail.label ?? prev.label,
        tracklist: detail.tracklist ?? prev.tracklist,
        duration_total_sec: detail.duration_total_sec ?? prev.duration_total_sec,
        vinyl_format: detail.vinyl_format ?? prev.vinyl_format,
        // enrichissement disque
        catalog_no: detail.catalog_no ?? prev.catalog_no,
        country: detail.country ?? prev.country,
        styles: detail.styles ?? prev.styles,
        barcode: detail.barcode ?? prev.barcode,
        original_year: detail.original_year ?? prev.original_year,
        format_detail: detail.format_detail ?? prev.format_detail,
        credits: detail.credits ?? prev.credits,
        community: detail.community ?? prev.community,
        videos: detail.videos ?? prev.videos,
        description: detail.description ?? prev.description,
        artist_bio: detail.artist_bio ?? prev.artist_bio,
        discogs_id: detail.discogs_id ?? prev.discogs_id,
        back_cover_url: detail.back_cover_url ?? prev.back_cover_url,
        // vidéo
        synopsis: detail.synopsis,
        duration_min: detail.duration_min,
        cast_list: detail.cast_list,
        language: detail.language,
      }));
      setStep('form');
    } catch {
      setError('Erreur lors de la récupération des détails');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title?.trim()) { setError('Le titre est requis'); return; }
    setSaving(true);
    setError('');
    try {
      const created = await itemsApi.create(form);
      navigate(`/item/${created.id}`);
    } catch {
      setError('Erreur lors de la sauvegarde');
      setSaving(false);
    }
  }

  const GENRES = form.type === 'music' ? GENRES_MUSIC : GENRES_VIDEO;

  return (
    <div className="add-page">
      <h1 className="add-title">Ajouter un élément</h1>

      {step === 'choose' && (
        <div className="add-choose">
          <div className="add-type-row">
            <label>Type</label>
            <div className="add-type-btns">
              {(['music', 'video'] as const).map(t => (
                <button
                  key={t}
                  className={form.type === t ? 'active' : ''}
                  onClick={() => { setField('type', t); setField('support', t === 'music' ? 'cd' : 'dvd'); }}
                >
                  {t === 'music' ? 'Musique' : 'Vidéo'}
                </button>
              ))}
            </div>
          </div>

          <div className="add-support-row">
            <label>Support</label>
            <div className="add-support-btns">
              {(form.type === 'music' ? ['cd', 'vinyl'] : ['dvd', 'bluray'] as Support[]).map(s => (
                <button
                  key={s}
                  className={form.support === s ? 'active' : ''}
                  onClick={() => setField('support', s)}
                >
                  {s === 'cd' ? 'CD' : s === 'vinyl' ? 'Vinyle' : s === 'dvd' ? 'DVD' : 'Blu-ray'}
                </button>
              ))}
            </div>
          </div>

          <div className="add-choose-actions">
            <button className="btn-primary" onClick={() => setStep('lookup')}>
              Rechercher automatiquement
            </button>
            <button className="btn-secondary" onClick={() => setStep('form')}>
              Saisie manuelle
            </button>
          </div>
        </div>
      )}

      {step === 'lookup' && (
        <div className="add-lookup">
          <button className="add-back" onClick={() => setStep('choose')}>← Retour</button>
          <div className="lookup-search">
            <input
              type="text"
              placeholder={form.type === 'music' ? 'Titre album, artiste...' : 'Titre du film ou série...'}
              value={lookupQuery}
              onChange={e => setLookupQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
            />
            <button className="btn-primary" onClick={handleLookup} disabled={lookupLoading}>
              {lookupLoading ? '...' : 'Rechercher'}
            </button>
          </div>
          {error && <p className="add-error">{error}</p>}
          <div className="lookup-results">
            {lookupResults.map((r, i) => (
              <div key={i} className="lookup-result" onClick={() => selectLookupResult(r)}>
                {r.cover_url
                  ? <img src={r.cover_url} alt="" />
              : <div className="lookup-result-noimg">{form.type === 'music' ? 'Audio' : 'Film'}</div>}
                <div>
                  <div className="lookup-result-title">{r.title}</div>
                  <div className="lookup-result-sub">
                    {[r.artist_or_director, r.format, r.country, r.label, r.media_type]
                      .filter(Boolean).slice(0, 2).join(' · ')}
                    {r.year ? ` — ${r.year}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-secondary" style={{marginTop: '16px'}} onClick={() => setStep('form')}>
            Remplir manuellement
          </button>
        </div>
      )}

      {step === 'form' && (
        <form className="add-form" onSubmit={handleSubmit}>
          <button type="button" className="add-back" onClick={() => setStep('lookup')}>← Retour</button>

          {error && <p className="add-error">{error}</p>}

          <div className="form-preview">
            {form.cover_url
              ? <img src={form.cover_url} alt="" className="form-cover-preview" />
              : <div className="form-cover-placeholder">{form.type === 'music' ? 'Audio' : 'Film'}</div>
            }
            <div className="form-preview-fields">
              <div className="form-group">
                <label>Titre *</label>
                <input
                  type="text" required
                  value={form.title || ''}
                  onChange={e => setField('title', e.target.value)}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{form.type === 'music' ? 'Artiste' : 'Réalisateur'}</label>
                  <input
                    type="text"
                    value={form.artist_or_director || ''}
                    onChange={e => setField('artist_or_director', e.target.value)}
                  />
                </div>
                <div className="form-group form-group-sm">
                  <label>Année</label>
                  <input
                    type="number" min="1900" max="2030"
                    value={form.year || ''}
                    onChange={e => setField('year', e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>URL de la pochette</label>
                <input
                  type="url"
                  value={form.cover_url || ''}
                  onChange={e => setField('cover_url', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Genres</label>
            <div className="form-genres">
              {GENRES.map(g => (
                <button
                  type="button" key={g}
                  className={`genre-chip ${form.genres?.includes(g) ? 'active' : ''}`}
                  onClick={() => toggleGenre(g)}
                >{g}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>État</label>
            <select value={form.state || 'bon_etat'} onChange={e => setField('state', e.target.value as State)}>
              <option value="neuf">Neuf</option>
              <option value="bon_etat">Bon état</option>
              <option value="use">Usagé</option>
            </select>
          </div>

          {form.type === 'music' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Label</label>
                  <input type="text" value={form.label || ''} onChange={e => setField('label', e.target.value)} />
                </div>
                {form.support === 'vinyl' && (
                  <div className="form-group">
                    <label>Format vinyle</label>
                    <select value={form.vinyl_format || ''} onChange={e => setField('vinyl_format', e.target.value)}>
                      <option value="">—</option>
                      <option value="33t">33 tours</option>
                      <option value="45t">45 tours</option>
                      <option value="78t">78 tours</option>
                      <option value="picture">Picture disc</option>
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          {form.type === 'video' && (
            <>
              <div className="form-group">
                <label>Synopsis</label>
                <textarea rows={3} value={form.synopsis || ''} onChange={e => setField('synopsis', e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group form-group-sm">
                  <label>Durée (min)</label>
                  <input
                    type="number" min="1"
                    value={form.duration_min || ''}
                    onChange={e => setField('duration_min', e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
                <div className="form-group">
                  <label>Langue originale</label>
                  <input type="text" value={form.language || ''} onChange={e => setField('language', e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Notes personnelles</label>
            <textarea rows={3} value={form.notes || ''} onChange={e => setField('notes', e.target.value)} />
          </div>

          <button type="submit" className="btn-primary btn-submit" disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Ajouter à la collection'}
          </button>
        </form>
      )}
    </div>
  );
}
