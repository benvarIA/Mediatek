// Connexion Last.fm — disponible partout, bloquante nulle part : elle ne
// conditionne que l'envoi vers Last.fm, jamais la consultation de la collection.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchStatus, logout as apiLogout, type LastFmStatus } from './api';

interface AuthValue extends LastFmStatus {
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

const EMPTY: LastFmStatus = { configured: false, connected: false };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LastFmStatus>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchStatus());
    } catch {
      // Serveur injoignable : on reste en « non connecté » plutôt que de
      // prétendre le contraire. BackendStatus dit déjà que l'API est absente.
      setStatus(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    await apiLogout();
    await refresh();
  }, [refresh]);

  const value = useMemo<AuthValue>(
    () => ({ ...status, loading, refresh, logout }),
    [status, loading, refresh, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
