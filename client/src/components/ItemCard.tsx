import { Link } from 'react-router-dom';
import type { Item } from '../api';
import './ItemCard.css';

const SUPPORT_LABEL: Record<string, string> = {
  cd: 'CD', vinyl: 'Vinyle', dvd: 'DVD', bluray: 'Blu-ray',
};
const SUPPORT_SHORT: Record<string, string> = {
  cd: 'CD', vinyl: 'LP', dvd: 'DVD', bluray: 'BD',
};

export default function ItemCard({ item }: { item: Item }) {
  return (
    <Link to={`/item/${item.id}`} className="item-card">
      <div className="item-card-cover">
        {item.cover_url
          ? <img src={item.cover_url} alt={item.title} loading="lazy" />
          : <div className="item-card-no-cover">{SUPPORT_SHORT[item.support]}</div>
        }

      </div>
      <div className="item-card-info">
        <div className="item-card-title">{item.title}</div>
        {item.artist_or_director && (
          <div className="item-card-sub">{item.artist_or_director}</div>
        )}
        <div className="item-card-meta">
          <span className="item-card-support">{SUPPORT_LABEL[item.support]}</span>
          {item.year && <span>{item.year}</span>}
        </div>
      </div>
    </Link>
  );
}
