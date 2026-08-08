// Le logement de lecture.
//
// Permanent : il ne disparaît dans aucun mode. C'est la réponse à « les trois
// gestes à égalité » — on parcourt et on surveille dans le même regard, sans
// jamais changer d'écran.
//
// La conduite de pistes porte la donnée que rien d'autre n'a : l'heure réelle
// à laquelle chaque piste est partie, et l'heure prévue de celles qui suivent.

import { Link } from 'react-router-dom';
import { avancement, duree, heure, heureSec, pisteEnCours, type QueueAlbum } from '../platine/api';
import { usePlatine } from '../platine/PlatineContext';
import { useAuth } from '../lastfm/AuthContext';
import { Ladder, Led, Readout, useNow } from './parts';
import { Sleeve } from './Plate';
import './Deck.css';

function Conduite({ album, now }: { album: QueueAlbum; now: number }) {
  const courante = pisteEnCours(album, now);
  return (
    <ol className="conduite">
      {album.tracks.map(t => {
        const live = t.status === 'pending' && courante?.position === t.position;
        const cls = t.status === 'done' ? ' trow-done' : t.status === 'error' ? ' trow-err' : live ? ' trow-live' : '';
        return (
          <li key={t.position} className={`trow${cls}`}>
            <span className="tnum lg lg-dim num">{String(t.position).padStart(2, '0')}</span>
            <span className="ttitle">{t.title}</span>
            <span className="ttime num">
              {t.status === 'done' ? heureSec(t.scrobbledAt)
                : t.status === 'error' ? <span title={t.error ?? ''}>échec</span>
                : heure(t.scrobbleAt)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Deck({ compact = false }: { compact?: boolean }) {
  const { actifs, courant, configured, connected, retirer, loading } = usePlatine();
  const { configured: authConfigured } = useAuth();
  const now = useNow();

  const enAttente = actifs.slice(1);
  const piste = courant ? pisteEnCours(courant, now) : null;
  const faites = courant ? courant.tracks.filter(t => t.status === 'done').length : 0;
  const total = courant?.tracks.length ?? 0;

  return (
    <section className={`deck panel${compact ? ' deck-compact' : ''}`} aria-label="Logement de lecture">
      <header className="deck-head">
        <h2 className="lg lg-on">Logement de lecture</h2>
        {courant ? (
          <span className="deck-state"><Led on /><span className="lg lg-amber">En marche</span></span>
        ) : (
          <span className="deck-state"><Led /><span className="lg lg-dim">Arrêt</span></span>
        )}
      </header>

      {!courant ? (
        <div className="deck-empty well">
          {/* Le plateau vide, dessiné : pas un rectangle gris. */}
          <svg viewBox="0 0 120 120" className="platter" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#2C3034" strokeWidth="1" />
            <circle cx="60" cy="60" r="38" fill="none" stroke="#23272B" strokeWidth="1" />
            <circle cx="60" cy="60" r="22" fill="none" stroke="#23272B" strokeWidth="1" />
            <circle cx="60" cy="60" r="3.5" fill="#2C3034" />
          </svg>
          <p className="lg lg-dim">La platine est libre</p>
          {!configured && !loading && (
            <p className="deck-note">Clés Last.fm absentes du serveur — le scrobble est hors service.</p>
          )}
          {configured && !connected && (
            <p className="deck-note">
              <Link to="/entretien" className="deck-link">Connecte ton compte Last.fm</Link> pour poser un disque.
            </p>
          )}
          {(connected || (!authConfigured && loading)) && (
            <Link to="/" className="key">Choisir un disque</Link>
          )}
        </div>
      ) : (
        <>
          <div className="window">
            <div className="window-sleeve">
              <Sleeve src={courant.image} alt={courant.album} fallback="33T" />
            </div>

            <div className="window-id">
              <div className="window-album">{courant.album}</div>
              <div className="window-artist">{courant.artist}</div>
            </div>

            <div className="window-gauge">
              <Ladder value={total ? faites / total : 0} label={`${faites} pistes sur ${total} envoyées`} />
              <span className="lg lg-dim num">{faites} / {total}</span>
              <Readout value={heure(courant.finishAt) || '--:--'} size={15} title="Fin estimée" />
            </div>

            {piste && piste.status === 'pending' && (
              <div className="window-live">
                <span className="lg lg-amber">En cours</span>
                <span className="window-live-title">{piste.title}</span>
                {/* Interpolé depuis l'heure de départ : la barre avance
                    réellement entre deux sondages, elle ne saute pas. */}
                <span className="window-live-bar">
                  <span style={{ transform: `scaleX(${avancement(piste, now)})` }} />
                </span>
                {piste.duration ? <span className="lg lg-dim num">{duree(piste.duration)}</span> : null}
              </div>
            )}

            <Conduite album={courant} now={now} />
          </div>

          <div className="deck-keys">
            {courant.itemId != null && (
              <Link to={`/item/${courant.itemId}`} className="key">Fiche</Link>
            )}
            <button className="key key-rec" onClick={() => void retirer(courant.id)}>
              Retirer
            </button>
          </div>
        </>
      )}

      {enAttente.length > 0 && (
        <div className="deck-next">
          <h3 className="lg lg-dim">À suivre — {enAttente.length} disque{enAttente.length > 1 ? 's' : ''}</h3>
          <ul>
            {enAttente.map(a => (
              <li key={a.id}>
                <span className="next-cover well"><Sleeve src={a.image} alt="" fallback="33T" /></span>
                <span className="next-id">
                  <span className="next-album">{a.album}</span>
                  <span className="next-artist">{a.artist}</span>
                </span>
                <span className="lg lg-dim num">{heure(a.tracks[0]?.scrobbleAt)}</span>
                <button
                  className="next-drop"
                  onClick={() => void retirer(a.id)}
                  aria-label={`Retirer ${a.album} de la file`}
                >✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
