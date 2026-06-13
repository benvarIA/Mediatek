import { useState, useEffect } from 'react';
import { itemsApi, type Item, type ItemFilters } from '../api';
import ItemCard from '../components/ItemCard';
import './LibraryPage.css';

const DECADES = [1950,1960,1970,1980,1990,2000,2010,2020];

export default function LibraryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ItemFilters>({ sort: 'added' });
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    setLoading(true);
    itemsApi.list(filters)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [filters]);

  function setFilter(key: keyof ItemFilters, value: any) {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
  }

  return (
    <div className="library">
      <div className="library-header">
        <h1 className="library-title">
          Ma Bibliothèque
          {!loading && <span className="library-count">{items.length}</span>}
        </h1>
        <div className="library-view-toggle">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>⊞</button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰</button>
        </div>
      </div>

      <div className="library-filters">
        <input
          type="search"
          placeholder="Rechercher titre, artiste, réalisateur..."
          value={filters.search || ''}
          onChange={e => setFilter('search', e.target.value)}
          className="library-search"
        />
        <select value={filters.support || ''} onChange={e => setFilter('support', e.target.value)}>
          <option value="">Tous les supports</option>
          <option value="cd">CD</option>
          <option value="vinyl">Vinyle</option>
          <option value="dvd">DVD</option>
          <option value="bluray">Blu-ray</option>
        </select>
        <select value={filters.type || ''} onChange={e => setFilter('type', e.target.value)}>
          <option value="">Musique & Vidéo</option>
          <option value="music">Musique</option>
          <option value="video">Vidéo</option>
        </select>
        <select value={filters.decade || ''} onChange={e => setFilter('decade', e.target.value ? parseInt(e.target.value) : undefined)}>
          <option value="">Toutes décennies</option>
          {DECADES.map(d => <option key={d} value={d}>{d}s</option>)}
        </select>
        <select value={filters.sort || 'added'} onChange={e => setFilter('sort', e.target.value as ItemFilters['sort'])}>
          <option value="added">Ajout récent</option>
          <option value="title">Titre A-Z</option>
          <option value="year">Année</option>
        </select>
      </div>

      {loading ? (
        <div className="library-loading">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="library-empty">
          <div className="library-empty-icon">📦</div>
          <p>Aucun élément trouvé.</p>
          <p>Commence par <a href="/add">ajouter quelque chose</a> !</p>
        </div>
      ) : view === 'grid' ? (
        <div className="library-grid">
          {items.map(item => <ItemCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="library-list">
          {items.map(item => <ListRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function ListRow({ item }: { item: Item }) {
  const SUPPORT_LABEL: Record<string, string> = { cd: 'CD', vinyl: 'Vinyle', dvd: 'DVD', bluray: 'Blu-ray' };
  return (
    <a href={`/item/${item.id}`} className="library-list-row">
      <div className="list-row-cover">
        {item.cover_url
          ? <img src={item.cover_url} alt="" />
          : <div className="list-row-no-cover" />
        }
      </div>
      <div className="list-row-info">
        <span className="list-row-title">{item.title}</span>
        {item.artist_or_director && <span className="list-row-sub">{item.artist_or_director}</span>}
      </div>
      <div className="list-row-meta">
        <span className="list-row-support">{SUPPORT_LABEL[item.support]}</span>
        {item.year && <span>{item.year}</span>}
      </div>
    </a>
  );
}
