import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import api from '../api';
import { Led } from './parts';

type Status = 'ok' | 'down' | 'restarting' | 'unknown';

// App-Manager : UI sur le port 3000 (qui proxy /api → 8000), sur le même host.
const APP_MANAGER_URL = `http://${window.location.hostname}:3000`;

export default function BackendStatus() {
  const [status, setStatus] = useState<Status>('unknown');
  const [retryCount, setRetryCount] = useState(0);

  const check = useCallback(async () => {
    try {
      await api.get('/health', { timeout: 3000 });
      setStatus(prev => {
        // Serveur revenu — on recharge pour que les rayons se repeuplent.
        if (prev === 'restarting' || prev === 'down') window.location.reload();
        return 'ok';
      });
    } catch {
      setStatus(s => (s === 'restarting' ? 'restarting' : 'down'));
    }
  }, []);

  // 30 s quand tout va bien, 15 s quand c'est tombé (évite le spam du proxy Vite).
  useEffect(() => {
    void check();
    const interval = setInterval(check, status === 'ok' ? 30_000 : 15_000);
    return () => clearInterval(interval);
  }, [check, status, retryCount]);

  async function restart() {
    setStatus('restarting');
    const port = window.location.port || '80';
    try {
      // App-Manager peut démarrer l'app même si le serveur est complètement arrêté.
      await axios.post(`${APP_MANAGER_URL}/api/apps/start-by-port/${port}`, {}, { timeout: 5000 });
    } catch {
      try { await api.post('/restart', {}, { timeout: 2000 }); } catch { /* ignoré */ }
    }
    setRetryCount(c => c + 1);
  }

  if (status === 'ok' || status === 'unknown') return null;

  return (
    <div className="backend-bar" role="status">
      <Led on tone={status === 'restarting' ? 'amber' : 'red'} />
      {status === 'restarting' ? (
        <p>Redémarrage du serveur…</p>
      ) : (
        <>
          <p>Serveur injoignable. La collection et la platine sont hors ligne.</p>
          <button className="key" onClick={restart}>Relancer</button>
        </>
      )}
    </div>
  );
}
