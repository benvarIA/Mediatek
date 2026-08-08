// Retour de Last.fm : on repasse le jeton au serveur, qui fait l'échange signé.
// Le navigateur ne voit jamais ni le secret, ni la clé de session.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeToken } from '../lastfm/api';
import { useAuth } from '../lastfm/AuthContext';

export default function CallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const token = params.get('token');
    if (!token) { navigate('/entretien', { replace: true }); return; }

    exchangeToken(token)
      .then(async () => {
        await refresh();
        navigate('/entretien', { replace: true });
      })
      .catch((e: Error) => setError(e.message));
  }, [params, navigate, refresh]);

  return (
    <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
      {error ? (
        <>
          <p className="headline" style={{ marginBottom: 10 }}>Connexion refusée</p>
          <p className="prose" style={{ margin: '0 auto 18px', color: 'var(--legend-dim)' }}>{error}</p>
          <button className="key" onClick={() => navigate('/entretien', { replace: true })}>Retour</button>
        </>
      ) : (
        <p className="lg lg-dim">Connexion à Last.fm…</p>
      )}
    </div>
  );
}
