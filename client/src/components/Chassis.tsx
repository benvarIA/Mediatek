// Le châssis : trois bandeaux fixes, identiques dans tous les modes.
//
// Le sélecteur de mode n'est pas une barre d'onglets. C'est un sélecteur à
// positions, comme le TYPE I / II / IV d'une platine : une diode sur la
// position engagée, les autres éteintes.

import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lastfm/AuthContext';
import { avatarOf } from '../lastfm/api';
import { usePlatine } from '../platine/PlatineContext';
import BackendStatus from './BackendStatus';
import Deck from './Deck';
import { Led, Screws } from './parts';
import './Chassis.css';

const MODES = [
  { to: '/', label: 'Rayons', end: true },
  { to: '/add', label: 'Saisie' },
  { to: '/surprise', label: 'Surprise' },
  { to: '/entretien', label: 'Entretien' },
];

function CompteLastFm() {
  const { loading, configured, connected, username, user } = useAuth();
  if (loading) return <span className="lg lg-dim">…</span>;
  if (!configured) return <span className="rail-account"><Led /><span className="lg lg-dim">Last.fm hors service</span></span>;
  if (!connected) {
    return (
      <NavLink to="/entretien" className="rail-account">
        <Led />
        <span className="lg lg-dim">Non connecté</span>
      </NavLink>
    );
  }
  const avatar = avatarOf(user);
  return (
    <NavLink to="/entretien" className="rail-account">
      <Led on tone="green" />
      {avatar && <img src={avatar} alt="" className="rail-avatar" />}
      <span className="lg lg-dim">
        {username}
        {user?.playcount ? ` · ${Number(user.playcount).toLocaleString('fr-FR')} scrobbles` : ''}
      </span>
    </NavLink>
  );
}

function Selecteur({ variant }: { variant: 'rail' | 'bottom' }) {
  const { courant } = usePlatine();
  return (
    <nav className={variant === 'rail' ? 'selector' : 'bottom-nav'} aria-label="Mode">
      {MODES.map(m => (
        <NavLink
          key={m.to}
          to={m.to}
          end={m.end}
          className={({ isActive }) =>
            variant === 'rail'
              ? `position${isActive ? ' position-sel' : ''}`
              : `bottom-item${isActive ? ' bottom-item-sel' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <Led on={isActive} />
              <span>{m.label}</span>
            </>
          )}
        </NavLink>
      ))}
      {variant === 'bottom' && (
        <NavLink
          to="/platine"
          className={({ isActive }) => `bottom-item${isActive ? ' bottom-item-sel' : ''}`}
        >
          {({ isActive }) => (
            <>
              <Led on={isActive || Boolean(courant)} />
              <span>Platine</span>
            </>
          )}
        </NavLink>
      )}
    </nav>
  );
}

export default function Chassis({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  // La platine a sa propre route sur écran étroit ; sur grand écran elle est
  // toujours dans la colonne de droite, donc cette route redirige vers les rayons.
  const platineSeule = loc.pathname === '/platine';

  return (
    <div className="chassis">
      <header className="rail panel">
        <Screws where="top" />
        <div className="rail-mark">
          <NavLink to="/" className="mark">Mediatek</NavLink>
          <span className="mark-sub">Collection · Platine · Last.fm</span>
        </div>
        <div className="rail-modes"><Selecteur variant="rail" /></div>
        <CompteLastFm />
      </header>

      <BackendStatus />

      <div className={`bay${platineSeule ? ' bay-platine' : ''}`}>
        <main className="bay-main">{children}</main>
        <aside className="bay-deck"><Deck /></aside>
      </div>

      <Selecteur variant="bottom" />
    </div>
  );
}
