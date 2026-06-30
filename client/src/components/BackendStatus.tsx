import { useState, useEffect, useCallback } from 'react';
import api from '../api';

type Status = 'ok' | 'down' | 'restarting' | 'unknown';

export default function BackendStatus() {
  const [status, setStatus] = useState<Status>('unknown');
  const [retryCount, setRetryCount] = useState(0);

  const check = useCallback(async () => {
    try {
      await api.get('/health', { timeout: 3000 });
      setStatus('ok');
    } catch {
      setStatus((s) => s === 'restarting' ? 'restarting' : 'down');
    }
  }, []);

  // Poll toutes les 10s quand down/restarting, toutes les 30s quand ok
  useEffect(() => {
    check();
    const interval = setInterval(check, status === 'ok' ? 30_000 : 5_000);
    return () => clearInterval(interval);
  }, [check, status, retryCount]);

  async function restart() {
    setStatus('restarting');
    try {
      await api.post('/restart', {}, { timeout: 3000 });
    } catch {
      // expected — le serveur coupe la connexion en redémarrant
    }
    // Poll accéléré pour détecter le retour
    setRetryCount((c) => c + 1);
  }

  if (status === 'ok' || status === 'unknown') return null;

  return (
    <div className="backend-status-bar">
      {status === 'restarting' ? (
        <>
          <span className="backend-status-dot restarting" />
          <span>Redémarrage du serveur…</span>
        </>
      ) : (
        <>
          <span className="backend-status-dot down" />
          <span>Serveur indisponible</span>
          <button className="backend-restart-btn" onClick={restart}>
            Relancer
          </button>
        </>
      )}
    </div>
  );
}
