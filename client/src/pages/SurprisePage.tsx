import { useState } from 'react';
import { Link } from 'react-router-dom';
import { itemsApi, type Item, type ItemFilters } from '../api';
import { Sleeve, SUPPORT_LABEL } from '../components/Plate';
import PoserKey from '../components/PoserKey';
import './SurprisePage.css';

const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
type Filtres = Omit<ItemFilters, 'search' | 'sort'>;

export default function SurprisePage() {
  const [result, setResult] = useState<Item | null>(null);
  const [filters, setFilters] = useState<Filtres>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof Filtres>(key: K, value: Filtres[K]) =>
    setFilters(f => ({ ...f, [key]: value || undefined }));

  async function tirer() {
    setLoading(true);
    setError('');
    try {
      setResult(await itemsApi.random(filters));
    } catch {
      setResult(null);
      setError("Rien ne correspond à cette sélection. Élargis les critères.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surprise">
      <section className="panel surprise-console">
        <div className="surprise-title">
          <h1 className="display">Qu'est-ce qu'on met&nbsp;?</h1>
          <p className="lg lg-dim">Le hasard pioche dans les rayons</p>
        </div>

        <div className="surprise-controls">
          <label className="bank">
            <span className="lg lg-dim">Nature</span>
            <select value={filters.type ?? ''} onChange={e => set('type', e.target.value)}>
              <option value="">Musique ou vidéo</option>
              <option value="music">Musique</option>
              <option value="video">Vidéo</option>
            </select>
          </label>
          <label className="bank">
            <span className="lg lg-dim">Support</span>
            <select value={filters.support ?? ''} onChange={e => set('support', e.target.value)}>
              <option value="">Tous</option>
              <option value="cd">CD</option>
              <option value="vinyl">33 tours</option>
              <option value="dvd">DVD</option>
              <option value="bluray">Blu-ray</option>
            </select>
          </label>
          <label className="bank">
            <span className="lg lg-dim">Décennie</span>
            <select
              value={filters.decade ?? ''}
              onChange={e => set('decade', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Toutes</option>
              {DECADES.map(d => <option key={d} value={d}>{d}s</option>)}
            </select>
          </label>
          <button className="key key-primary surprise-draw" onClick={tirer} disabled={loading}>
            {loading ? 'Tirage…' : result ? 'Un autre' : 'Tirer au sort'}
          </button>
        </div>
      </section>

      {error && <p className="surprise-msg">{error}</p>}

      {result && (
        <article className="panel surprise-result" key={result.id}>
          <div className="surprise-sleeve well seat">
            <Sleeve src={result.cover_url} alt={result.title} fallback={SUPPORT_LABEL[result.support]} />
          </div>

          <div className="surprise-body">
            <span className="lg lg-dim">
              {SUPPORT_LABEL[result.support]}
              {result.year ? ` · ${result.year}` : ''}
              {result.type === 'video' && result.duration_min ? ` · ${result.duration_min} min` : ''}
            </span>
            <h2 className="display surprise-name">{result.title}</h2>
            {result.artist_or_director && <p className="surprise-artist">{result.artist_or_director}</p>}

            {result.genres.length > 0 && (
              <p className="surprise-genres">{result.genres.join(' · ')}</p>
            )}
            {result.synopsis && <p className="prose surprise-synopsis">{result.synopsis}</p>}

            <div className="surprise-keys">
              <PoserKey item={result} />
              <Link to={`/item/${result.id}`} className="key">Voir la fiche</Link>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
