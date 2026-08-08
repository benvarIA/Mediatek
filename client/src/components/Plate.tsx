import { Link } from 'react-router-dom';
import type { Item } from '../api';
import { Led } from './parts';

export const SUPPORT_LABEL: Record<string, string> = {
  cd: 'CD', vinyl: '33T', dvd: 'DVD', bluray: 'BD',
};

export function Sleeve({ src, alt, fallback }: { src?: string | null; alt?: string; fallback?: string }) {
  return (
    <div className={`sleeve${src ? '' : ' sleeve-empty'}`}>
      {src ? <img src={src} alt={alt ?? ''} loading="lazy" /> : (fallback ?? '—')}
    </div>
  );
}

/**
 * Une pochette montée dans le panneau, avec son étiquette sérigraphiée.
 * Ce n'est pas une carte posée sur un fond : c'est une plaque encastrée.
 */
export default function Plate({ item, index = 0, live }: { item: Item; index?: number; live?: boolean }) {
  return (
    <Link
      to={`/item/${item.id}`}
      className={`plate well seat${live ? ' plate-live' : ''}`}
      style={{ animationDelay: `${Math.min(index, 24) * 18}ms` }}
    >
      <Sleeve src={item.cover_url} alt={item.title} fallback={SUPPORT_LABEL[item.support]} />
      <div className="plate-label">
        <div className="plate-title">{item.title}</div>
        {item.artist_or_director && <div className="plate-sub">{item.artist_or_director}</div>}
        <div className="plate-meta">
          {live ? (
            <>
              <Led on />
              <span className="lg lg-amber">Sur la platine</span>
            </>
          ) : (
            <span className="lg lg-dim">
              {SUPPORT_LABEL[item.support]}{item.year ? ` · ${item.year}` : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
