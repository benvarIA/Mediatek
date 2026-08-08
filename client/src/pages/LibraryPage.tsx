import { useEffect, useMemo, useState } from 'react';
import { itemsApi, type Item, type ItemFilters } from '../api';
import Plate from '../components/Plate';
import { Readout } from '../components/parts';
import { usePlatine } from '../platine/PlatineContext';
import './LibraryPage.css';

const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

const SUPPORTS: { value: string; label: string }[] = [
  { value: '', label: 'Tout' },
  { value: 'cd', label: 'CD' },
  { value: 'vinyl', label: '33T' },
  { value: 'dvd', label: 'DVD' },
  { value: 'bluray', label: 'BD' },
];

const TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Tout' },
  { value: 'music', label: 'Musique' },
  { value: 'video', label: 'Vidéo' },
];

const SORTS: { value: NonNullable<ItemFilters['sort']>; label: string }[] = [
  { value: 'added', label: 'Ajout' },
  { value: 'title', label: 'Titre' },
  { value: 'year', label: 'Année' },
];

/** Une rangée de positions avec diode — jamais un menu déroulant. */
function Bank<T extends string>({
  legend, value, options, onChange,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="bank">
      <span className="lg lg-dim bank-legend">{legend}</span>
      <div className="selector">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            className={`position${value === o.value ? ' position-sel' : ''}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            <span className={`led${value === o.value ? ' led-on' : ''}`} aria-hidden="true" />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState<ItemFilters>({ sort: 'added' });
  const { itemsEnFile } = usePlatine();
  // Sur téléphone le pupitre est replié : debout devant l'étagère, on veut
  // voir des pochettes tout de suite, pas dérouler cinq rangées de réglages.
  const [pupitreOuvert, setPupitreOuvert] = useState(false);

  // Recherche : on laisse retomber la frappe avant d'interroger le serveur.
  const [search, setSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setFilters(f => ({ ...f, search: search.trim() || undefined })), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    itemsApi.list(filters)
      .then(r => { if (alive) setItems(r); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filters]);

  const set = <K extends keyof ItemFilters>(key: K, value: ItemFilters[K]) =>
    setFilters(f => ({ ...f, [key]: value || undefined }));

  const vide = !loading && !failed && items.length === 0;
  const filtre = Boolean(filters.support || filters.type || filters.decade || filters.search);
  const actifsCount = [filters.support, filters.type, filters.decade].filter(Boolean).length;
  const compte = useMemo(() => String(items.length).padStart(3, '0'), [items.length]);

  return (
    <div className="library">
      <section className={`panel library-console${pupitreOuvert ? ' console-ouvert' : ''}`}>
        <div className="console-tete">
          <label className="bank library-search">
            <span className="lg lg-dim bank-legend">Chercher</span>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="titre, artiste, réalisateur…"
            />
          </label>
          <div className="bank library-count">
            <span className="lg lg-dim bank-legend">Au catalogue</span>
            <Readout value={compte} size={17} off={loading} />
          </div>
          <button
            type="button"
            className="key console-bascule"
            aria-expanded={pupitreOuvert}
            onClick={() => setPupitreOuvert(o => !o)}
          >
            {pupitreOuvert ? 'Masquer' : 'Filtrer'}{actifsCount ? ` · ${actifsCount}` : ''}
          </button>
        </div>

        <Bank
          legend="Support"
          value={filters.support ?? ''}
          options={SUPPORTS}
          onChange={v => set('support', v)}
        />
        <Bank
          legend="Nature"
          value={filters.type ?? ''}
          options={TYPES}
          onChange={v => set('type', v)}
        />
        <Bank
          legend="Tri"
          value={filters.sort ?? 'added'}
          options={SORTS}
          onChange={v => set('sort', v)}
        />

        <label className="bank library-decade">
          <span className="lg lg-dim bank-legend">Décennie</span>
          <select
            value={filters.decade ?? ''}
            onChange={e => set('decade', e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Toutes</option>
            {DECADES.map(d => <option key={d} value={d}>{d}s</option>)}
          </select>
        </label>

      </section>

      {failed ? (
        <p className="library-msg">Impossible de lire la collection. Le serveur ne répond pas.</p>
      ) : loading ? (
        <div className="library-grid" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="plate well">
              <div className="sleeve skeleton" />
              <div className="plate-label">
                <div className="skeleton skel-line" />
                <div className="skeleton skel-line skel-short" />
              </div>
            </div>
          ))}
        </div>
      ) : vide ? (
        <div className="library-msg">
          {filtre ? (
            <>
              <p>Aucune pièce ne correspond à cette sélection.</p>
              <button className="key" onClick={() => { setSearch(''); setFilters({ sort: 'added' }); }}>
                Tout afficher
              </button>
            </>
          ) : (
            <>
              <p>Les rayons sont vides.</p>
              <a className="key key-primary" href="/add">Saisir un disque</a>
            </>
          )}
        </div>
      ) : (
        <div className="library-grid">
          {items.map((item, i) => (
            <Plate key={item.id} item={item} index={i} live={itemsEnFile.has(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
