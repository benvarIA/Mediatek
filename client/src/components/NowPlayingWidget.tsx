import { useEffect, useRef, useState } from 'react';
import './NowPlayingWidget.css';

interface VinylTrack {
  title: string;
  status: 'pending' | 'done' | 'error';
  scrobbleAt?: number;
}

interface QueueItem {
  id: string;
  artist: string;
  album: string;
  image: string;
  tracks: VinylTrack[];
  status: 'active' | 'done' | 'cancelled';
}

export default function NowPlayingWidget() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch('/api/scrobble/queue');
      if (!res.ok) return;
      const data: QueueItem[] = await res.json();
      setItems(data.filter(i => i.status === 'active'));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    await fetchQueue();
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="np-wrap" ref={ref}>
      <button className={`np-btn${open ? ' np-btn-open' : ''}`} onClick={handleToggle}>
        <span className="np-dot" />
        <span>Now Playing</span>
      </button>

      {open && (
        <div className="np-panel">
          <div className="np-head">File de scrobble</div>

          {loading ? (
            <div className="np-loader">
              <span className="np-spinner" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="np-empty">Aucun album en file.</div>
          ) : (
            <ul className="np-list">
              {items.map(item => {
                const done = item.tracks.filter(t => t.status === 'done').length;
                const total = item.tracks.length;
                const pct = total ? (done / total) * 100 : 0;
                const nextTrack = item.tracks.find(t => t.status === 'pending');
                const finishAt = [...item.tracks].reverse().find(t => t.scrobbleAt)?.scrobbleAt;
                return (
                  <li key={item.id} className="np-item">
                    {item.image
                      ? <img src={item.image} alt="" className="np-cover" />
                      : <div className="np-cover np-cover-placeholder" />
                    }
                    <div className="np-info">
                      <span className="np-album">{item.album}</span>
                      <span className="np-artist">{item.artist}</span>
                      <div className="np-bar-wrap">
                        <div className="np-bar" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="np-meta">
                        <span>{done}/{total} pistes</span>
                        {finishAt && (
                          <span>
                            fin ~{new Date(finishAt * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {nextTrack && (
                        <span className="np-next">▶ {nextTrack.title}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
