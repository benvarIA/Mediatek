import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemsApi, type Item, type ItemFilters } from '../api';
import './SurprisePage.css';

const DECADES = [1950,1960,1970,1980,1990,2000,2010,2020];

export default function SurprisePage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<Item | null>(null);
  const [filters, setFilters] = useState<Omit<ItemFilters, 'search'|'sort'>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);

  function setFilter(key: keyof typeof filters, value: any) {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
  }

  async function draw() {
    setLoading(true);
    setError('');
    setRevealed(false);
    try {
      const item = await itemsApi.random(filters);
      setResult(item);
      setTimeout(() => setRevealed(true), 100);
    } catch {
      setError('Aucun élément trouvé avec ces filtres. Essaie d\'élargir la sélection !');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surprise">
      <div className="surprise-header">
        <h1>🎲 Qu'est-ce qu'on met ce soir ?</h1>
        <p className="surprise-sub">Laisse le hasard choisir dans ta collection</p>
      </div>

      <div className="surprise-filters">
        <select value={filters.type || ''} onChange={e => setFilter('type', e.target.value)}>
          <option value="">Musique ou vidéo</option>
          <option value="music">Musique</option>
          <option value="video">Vidéo</option>
        </select>
        <select value={filters.support || ''} onChange={e => setFilter('support', e.target.value)}>
          <option value="">Tous les supports</option>
          <option value="cd">CD</option>
          <option value="vinyl">Vinyle</option>
          <option value="dvd">DVD</option>
          <option value="bluray">Blu-ray</option>
        </select>
        <select value={filters.decade || ''} onChange={e => setFilter('decade', e.target.value ? parseInt(e.target.value) : undefined)}>
          <option value="">Toutes décennies</option>
          {DECADES.map(d => <option key={d} value={d}>{d}s</option>)}
        </select>
        <label className="surprise-check">
          <input
            type="checkbox"
            checked={filters.unwatched === true}
            onChange={e => setFilter('unwatched', e.target.checked ? true : undefined)}
          />
          Pas encore vu/écouté
        </label>
      </div>

      <button className="surprise-btn" onClick={draw} disabled={loading}>
        {loading ? '...' : result ? '🔀 Autre !' : '🎲 Tirer au sort'}
      </button>

      {error && <p className="surprise-error">{error}</p>}

      {result && (
        <div className={`surprise-result ${revealed ? 'revealed' : ''}`}>
          <div className="surprise-cover">
            {result.cover_url
              ? <img src={result.cover_url} alt={result.title} />
              : <div className="surprise-no-cover">{result.type === 'music' ? '🎵' : '🎬'}</div>
            }
          </div>
          <div className="surprise-info">
            <div className="surprise-support-badge">
              {result.support === 'cd' ? '💿 CD' : result.support === 'vinyl' ? '🎵 Vinyle' : result.support === 'dvd' ? '📀 DVD' : '🔵 Blu-ray'}
            </div>
            <h2 className="surprise-title">{result.title}</h2>
            {result.artist_or_director && <p className="surprise-artist">{result.artist_or_director}</p>}
            <div className="surprise-meta">
              {result.year && <span>{result.year}</span>}
              {result.type === 'video' && result.duration_min && <span>{result.duration_min} min</span>}
            </div>
            {result.genres.length > 0 && (
              <div className="surprise-genres">
                {result.genres.map(g => <span key={g}>{g}</span>)}
              </div>
            )}
            {result.synopsis && <p className="surprise-synopsis">{result.synopsis}</p>}
            <div className="surprise-cta">
              <button className="btn-primary" onClick={() => navigate(`/item/${result.id}`)}>
                Voir la fiche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
