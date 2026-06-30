import { Link, useLocation } from 'react-router-dom';
import NowPlayingWidget from './NowPlayingWidget';
import BackendStatus from './BackendStatus';
import './Layout.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const active = (path: string) => loc.pathname === path || loc.pathname.startsWith(path + '/');

  return (
    <div className="layout">
      <nav className="nav">
        <Link to="/" className="nav-brand">
          <span className="nav-brand-mark" aria-hidden="true">BA</span>
          BibliAnalogique
        </Link>
        <div className="nav-right">
          <NowPlayingWidget />
          <div className="nav-links">
            <Link to="/" className={active('/') && loc.pathname === '/' ? 'active' : ''}>Bibliothèque</Link>
            <Link to="/add" className={active('/add') ? 'active' : ''}>Ajouter</Link>
            <Link to="/surprise" className={`nav-surprise ${active('/surprise') ? 'active' : ''}`}>Surprise</Link>
          </div>
        </div>
      </nav>
      <BackendStatus />
      <main className="main">{children}</main>
    </div>
  );
}
