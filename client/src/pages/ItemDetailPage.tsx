import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { itemsApi, type Item } from '../api';
import './ItemDetailPage.css';

const SUPPORT_LABEL: Record<string, string> = { cd: 'CD', vinyl: 'Vinyle', dvd: 'DVD', bluray: 'Blu-ray' };
const STATE_LABEL: Record<string, string> = { neuf: 'Neuf', bon_etat: 'Bon état', use: 'Usagé' };

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    itemsApi.get(parseInt(id)).then(item => {
      setItem(item);
      setNotes(item.notes || '');
      setLoading(false);
    });
  }, [id]);

  async function toggleWatched() {
    if (!item) return;
    const updated = await itemsApi.update(item.id, { watched_or_listened: !item.watched_or_listened });
    setItem(updated);
  }

  async function saveNotes() {
    if (!item) return;
    setSaving(true);
    const updated = await itemsApi.update(item.id, { notes });
    setItem(updated);
    setEditingNotes(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!item) return;
    if (!window.confirm(`Supprimer "${item.title}" de la collection ?`)) return;
    setDeleting(true);
    await itemsApi.delete(item.id);
    navigate('/');
  }

  if (loading) return <div className="detail-loading">Chargement...</div>;
  if (!item) return <div className="detail-loading">Introuvable.</div>;

  const watchedLabel = item.type === 'music' ? 'Écouté' : 'Vu';

  return (
    <div className="detail">
      <div className="detail-nav">
        <Link to="/" className="detail-back">← Bibliothèque</Link>
        <div className="detail-actions">
          <button
            className={`btn-watched ${item.watched_or_listened ? 'done' : ''}`}
            onClick={toggleWatched}
          >
            {item.watched_or_listened ? `✓ ${watchedLabel}` : `Marquer comme ${watchedLabel.toLowerCase()}`}
          </button>
          <button className="btn-delete" onClick={handleDelete} disabled={deleting}>
            🗑 Supprimer
          </button>
        </div>
      </div>

      <div className="detail-hero">
        <div className="detail-cover">
          {item.cover_url
            ? <img src={item.cover_url} alt={item.title} />
            : <div className="detail-no-cover">{item.type === 'music' ? '🎵' : '🎬'}</div>
          }
        </div>
        <div className="detail-info">
          <div className="detail-badges">
            <span className="badge-support">{SUPPORT_LABEL[item.support]}</span>
            <span className="badge-state">{STATE_LABEL[item.state]}</span>
            {item.watched_or_listened && <span className="badge-seen">✓ {watchedLabel}</span>}
          </div>
          <h1 className="detail-title">{item.title}</h1>
          {item.artist_or_director && (
            <p className="detail-artist">{item.artist_or_director}</p>
          )}
          <div className="detail-meta-row">
            {item.year && <span>{item.year}</span>}
            {item.type === 'video' && item.duration_min && <span>{item.duration_min} min</span>}
            {item.label && <span>{item.label}</span>}
            {item.vinyl_format && <span>{item.vinyl_format}</span>}
            {item.language && <span>🌐 {item.language}</span>}
          </div>
          {item.genres.length > 0 && (
            <div className="detail-genres">
              {item.genres.map(g => <span key={g} className="detail-genre">{g}</span>)}
            </div>
          )}
          {item.synopsis && <p className="detail-synopsis">{item.synopsis}</p>}
          {item.cast_list && item.cast_list.length > 0 && (
            <p className="detail-cast">Avec : {item.cast_list.join(', ')}</p>
          )}
        </div>
      </div>

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
