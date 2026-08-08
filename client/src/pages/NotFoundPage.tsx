import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="panel" style={{ padding: '64px 24px', textAlign: 'center' }}>
      <p className="display" style={{ marginBottom: 12 }}>Pas de signal</p>
      <p className="prose" style={{ margin: '0 auto 20px', color: 'var(--legend-dim)' }}>
        Cette adresse ne correspond à aucun mode de l'appareil.
      </p>
      <Link to="/" className="key key-primary">Retour aux rayons</Link>
    </div>
  );
}
