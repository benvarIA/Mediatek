import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '../api';

type Status = 'ok' | 'down' | 'restarting' | 'unknown';

// App-Manager tourne toujours sur le port 3003 sur le même host.
const APP_MANAGER_URL = `http://${window.location.hostname}:3003`;

export default function BackendStatus() {
  const [status, setStatus] = useState<Status>('unknown');
  const [retryCount, setRetryCount] = useState(0);

  const check = useCallback(async () => {
    try {
      await api.get('/health', { timeout: 3000 });
      setStatus((prev) => {
        if (prev === 'restarting' || prev === 'down') {
          // Backend revenu — recharge la page pour que la bibliothèque se peuple
          window.location.reload();
        }
        return 'ok';
      });
    } catch {
      setStatus((s) => s === 'restarting' ? 'restarting' : 'down');
    }
  }, []);

  // Poll toutes les 30s quand ok, toutes les 15s quand down (évite le spam Vite proxy)
  useEffect(() => {
    check();
    const interval = setInterval(check, status === 'ok' ? 30_000 : 15_000);
    return () => clearInterval(interval);
  }, [check, status, retryCount]);

  async function restart() {
    setStatus('restarting');
    const port = window.location.port || '80';
    try {
      // Demande à App-Manager de démarrer l'app sur ce port (backend peut être complètement arrêté)
      await axios.post(
        `${APP_MANAGER_URL}/api/apps/start-by-port/${port}`,
        {},
        { timeout: 5000 },
      );
    } catch {
      // Si App-Manager aussi injoignable, on essaie quand même l'endpoint local au cas où
      try { await api.post('/restart', {}, { timeout: 2000 }); } catch { /* ignoré */ }
    }
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
