// Connexion Last.fm — disponible partout, bloquante nulle part.
//
// ScrobblerVari plaçait un <Navigate to="/login"> devant toute l'application :
// il fallait un compte Last.fm pour consulter sa propre collection de DVD.
// Ici la connexion ne conditionne qu'une seule chose, l'envoi vers Last.fm.

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
