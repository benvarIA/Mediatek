import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemsApi, lookupApi, type Item, type State, type Support } from '../api';
import { Sleeve } from '../components/Plate';
import './AddPage.css';

type Etape = 'nature' | 'recherche' | 'fiche';

const GENRES_MUSIQUE = ['Rock', 'Pop', 'Jazz', 'Classique', 'Électronique', 'Hip-Hop', 'Soul', 'Metal', 'Blues', 'Folk', 'R&B', 'Reggae'];
const GENRES_VIDEO = ['Action', 'Comédie', 'Drame', 'Thriller', 'Horreur', 'Sci-Fi', 'Animation', 'Documentaire', 'Romance', 'Fantastique', 'Historique'];

const SUPPORT_NOM: Record<Support, string> = { cd: 'CD', vinyl: '33 tours', dvd: 'DVD', bluray: 'Blu-ray' };

const VIERGE: Partial<Item> = {
  type: 'music', support: 'cd', title: '', genres: [],
  artist_or_director: '', notes: '', state: 'bon_etat',
};

export default function AddPage() {
  const navigate = useNavigate();
  const [etape, setEtape] = useState<Etape>('nature');
  const [form, setForm] = useState<Partial<Item>>(VIERGE);
  const [requete, setRequete] = useState('');
  const [resultats, setResultats] = useState<any[]>([]);
  const [cherche, setCherche] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState('');

  const champ = (key: keyof Item, value: any) => setForm(p => ({ ...p, [key]: value }));

  const basculerGenre = (g: string) => setForm(p => {
    const genres = p.genres ?? [];
    return { ...p, genres: genres.includes(g) ? genres.filter(x => x !== g) : [...genres, g] };
  });

  async function chercher() {
    if (!requete.trim()) return;
    setCherche(true);
    setErreur('');
    try {
      let r: any[];
      if (form.type === 'video') {
        r = await lookupApi.searchVideo(requete);
      } else {
        // Discogs d'abord — c'est lui qui a les pressages. MusicBrainz en secours.
        try { r = await lookupApi.searchDiscogs(requete); } catch { r = []; }
        if (!r.length) r = await lookupApi.searchMusic(requete);
      }
      setResultats(r);
      if (!r.length) setErreur('Rien trouvé. Change les mots, ou saisis la fiche à la main.');
    } catch {
      setErreur('La recherche a échoué. Le serveur ou la source distante ne répond pas.');
    } finally {
      setCherche(false);
    }
  }

  async function choisir(r: any) {
    setErreur('');
    try {
      let d: any = r;
      if (r.discogs_id) d = await lookupApi.getDiscogsDetail(r.discogs_id);
      else if (r.mbid) d = await lookupApi.getMusicDetail(r.mbid);
      else if (r.tmdb_id) d = await lookupApi.getVideoDetail(r.tmdb_id, r.media_type || 'movie');

      setForm(p => ({
        ...p,
        title: d.title || p.title,
        year: d.year || p.year,
        artist_or_director: d.artist_or_director || p.artist_or_director,
        cover_url: d.cover_url || p.cover_url,
        genres: d.genres?.length ? d.genres : (p.genres ?? []),
        label: d.label ?? p.label,
        tracklist: d.tracklist ?? p.tracklist,
        duration_total_sec: d.duration_total_sec ?? p.duration_total_sec,
        vinyl_format: d.vinyl_format ?? p.vinyl_format,
        catalog_no: d.catalog_no ?? p.catalog_no,
        country: d.country ?? p.country,
        styles: d.styles ?? p.styles,
        barcode: d.barcode ?? p.barcode,
        original_year: d.original_year ?? p.original_year,
        format_detail: d.format_detail ?? p.format_detail,
        credits: d.credits ?? p.credits,
        community: d.community ?? p.community,
        videos: d.videos ?? p.videos,
        description: d.description ?? p.description,
        artist_bio: d.artist_bio ?? p.artist_bio,
        discogs_id: d.discogs_id ?? p.discogs_id,
        back_cover_url: d.back_cover_url ?? p.back_cover_url,
        synopsis: d.synopsis ?? p.synopsis,
        duration_min: d.duration_min ?? p.duration_min,
        cast_list: d.cast_list ?? p.cast_list,
        language: d.language ?? p.language,
      }));
      setEtape('fiche');
    } catch {
      setErreur('Impossible de charger cette fiche depuis la source.');
    }
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title?.trim()) { setErreur('Le titre est obligatoire.'); return; }
    setEnregistre(true);
    setErreur('');
    try {
      const cree = await itemsApi.create(form);
      navigate(`/item/${cree.id}`);
    } catch {
      setErreur("L'enregistrement a échoué. Le serveur ne répond pas.");
      setEnregistre(false);
    }
  }

  const genres = form.type === 'music' ? GENRES_MUSIQUE : GENRES_VIDEO;
  const supports: Support[] = form.type === 'music' ? ['cd', 'vinyl'] : ['dvd', 'bluray'];

  return (
    <div className="add">
      <section className="panel add-head">
        <h1 className="display">Saisie</h1>
        <p className="lg lg-dim">
          {etape === 'nature' ? 'Nature et support'
            : etape === 'recherche' ? 'Recherche dans les sources'
            : 'Fiche'}
        </p>
      </section>

      {erreur && <p className="add-error" role="alert">{erreur}</p>}

      {etape === 'nature' && (
        <section className="panel add-bloc">
          <div className="bank">
            <span className="lg lg-dim">Nature</span>
            <div className="selector">
              {(['music', 'video'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  className={`position${form.type === t ? ' position-sel' : ''}`}
                  aria-pressed={form.type === t}
                  onClick={() => setForm(p => ({ ...p, type: t, support: t === 'music' ? 'cd' : 'dvd' }))}
                >
                  <span className={`led${form.type === t ? ' led-on' : ''}`} aria-hidden="true" />
                  {t === 'music' ? 'Musique' : 'Vidéo'}
                </button>
              ))}
            </div>
          </div>

          <div className="bank">
            <span className="lg lg-dim">Support</span>
            <div className="selector">
              {supports.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`position${form.support === s ? ' position-sel' : ''}`}
                  aria-pressed={form.support === s}
                  onClick={() => champ('support', s)}
                >
                  <span className={`led${form.support === s ? ' led-on' : ''}`} aria-hidden="true" />
                  {SUPPORT_NOM[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="add-keys">
            <button className="key key-primary" onClick={() => setEtape('recherche')}>
              Chercher dans les sources
            </button>
            <button className="key" onClick={() => setEtape('fiche')}>Saisir à la main</button>
          </div>
        </section>
      )}

      {etape === 'recherche' && (
        <section className="panel add-bloc">
          <button className="add-back lg lg-dim" onClick={() => setEtape('nature')}>← Nature</button>

          <div className="add-search">
            <input
              type="search"
              value={requete}
              onChange={e => setRequete(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && chercher()}
              placeholder={form.type === 'music' ? 'Album, artiste…' : 'Titre du film ou de la série…'}
              aria-label="Recherche"
            />
            <button className="key key-primary" onClick={chercher} disabled={cherche}>
              {cherche ? 'Recherche…' : 'Chercher'}
            </button>
          </div>

          {resultats.length > 0 && (
            <div className="add-results">
              {resultats.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  className="plate well seat add-result"
                  style={{ animationDelay: `${Math.min(i, 20) * 18}ms` }}
                  onClick={() => choisir(r)}
                >
                  <Sleeve src={r.cover_url} alt="" fallback={form.type === 'music' ? '33T' : 'DVD'} />
                  <div className="plate-label">
                    <div className="plate-title">{r.title}</div>
                    <div className="plate-sub">
                      {[r.artist_or_director, r.label, r.country].filter(Boolean).slice(0, 2).join(' · ') || '—'}
                    </div>
                    <div className="plate-meta">
                      <span className="lg lg-dim">
                        {[r.format, r.year].filter(Boolean).join(' · ') || (r.media_type ?? '')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button className="key" onClick={() => setEtape('fiche')}>Saisir à la main</button>
        </section>
      )}

      {etape === 'fiche' && (
        <form className="panel add-bloc" onSubmit={enregistrer}>
          <button type="button" className="add-back lg lg-dim" onClick={() => setEtape('recherche')}>
            ← Recherche
          </button>

          <div className="add-preview">
            <div className="add-cover well">
              <Sleeve src={form.cover_url} alt="" fallback={form.type === 'music' ? '33T' : 'DVD'} />
            </div>
            <div className="add-fields">
              <label className="field">
                <span className="lg lg-dim">Titre — obligatoire</span>
                <input required value={form.title ?? ''} onChange={e => champ('title', e.target.value)} />
              </label>
              <div className="field-row">
                <label className="field">
                  <span className="lg lg-dim">{form.type === 'music' ? 'Artiste' : 'Réalisateur'}</span>
                  <input
                    value={form.artist_or_director ?? ''}
                    onChange={e => champ('artist_or_director', e.target.value)}
                  />
                </label>
                <label className="field field-sm">
                  <span className="lg lg-dim">Année</span>
                  <input
                    type="number" min={1900} max={2100}
                    value={form.year ?? ''}
                    onChange={e => champ('year', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
              </div>
              <label className="field">
                <span className="lg lg-dim">URL de la pochette</span>
                <input type="url" value={form.cover_url ?? ''} onChange={e => champ('cover_url', e.target.value)} />
              </label>
            </div>
          </div>

          <div className="field">
            <span className="lg lg-dim">Genres</span>
            <div className="chips">
              {genres.map(g => (
                <button
                  key={g}
                  type="button"
                  className={`chip${form.genres?.includes(g) ? ' chip-on' : ''}`}
                  aria-pressed={form.genres?.includes(g)}
                  onClick={() => basculerGenre(g)}
                >{g}</button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <label className="field field-sm">
              <span className="lg lg-dim">État</span>
              <select value={form.state ?? 'bon_etat'} onChange={e => champ('state', e.target.value as State)}>
                <option value="neuf">Neuf</option>
                <option value="bon_etat">Bon état</option>
                <option value="use">Usagé</option>
              </select>
            </label>

            {form.type === 'music' && (
              <label className="field">
                <span className="lg lg-dim">Label</span>
                <input value={form.label ?? ''} onChange={e => champ('label', e.target.value)} />
              </label>
            )}
            {form.type === 'music' && form.support === 'vinyl' && (
              <label className="field field-sm">
                <span className="lg lg-dim">Format</span>
                <select value={form.vinyl_format ?? ''} onChange={e => champ('vinyl_format', e.target.value)}>
                  <option value="">—</option>
                  <option value="33t">33 tours</option>
                  <option value="45t">45 tours</option>
                  <option value="78t">78 tours</option>
                  <option value="picture">Picture disc</option>
                </select>
              </label>
            )}
          </div>

          {form.type === 'video' && (
            <>
              <label className="field">
                <span className="lg lg-dim">Synopsis</span>
                <textarea rows={3} value={form.synopsis ?? ''} onChange={e => champ('synopsis', e.target.value)} />
              </label>
              <div className="field-row">
                <label className="field field-sm">
                  <span className="lg lg-dim">Durée — minutes</span>
                  <input
                    type="number" min={1}
                    value={form.duration_min ?? ''}
                    onChange={e => champ('duration_min', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label className="field">
                  <span className="lg lg-dim">Langue d'origine</span>
                  <input value={form.language ?? ''} onChange={e => champ('language', e.target.value)} />
                </label>
              </div>
            </>
          )}

          <label className="field">
            <span className="lg lg-dim">Notes personnelles</span>
            <textarea rows={3} value={form.notes ?? ''} onChange={e => champ('notes', e.target.value)} />
          </label>

          <button type="submit" className="key key-primary key-wide" disabled={enregistre}>
            {enregistre ? 'Enregistrement…' : 'Ranger dans les rayons'}
          </button>
        </form>
      )}
    </div>
  );
}
