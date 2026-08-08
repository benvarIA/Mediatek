// L'état de la platine, partagé par toute l'application.
//
// Un seul sondage pour tout le monde : le logement de lecture, les pastilles
// « sur la platine » des rayons, et la fiche d'un disque lisent la même source.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY_QUEUE, fetchQueue, poser as apiPoser, retirer as apiRetirer,
  type PoserInput, type QueueAlbum, type QueueState,
} from './api';

const POLL_ACTIVE = 4000;
const POLL_IDLE = 20000;

interface PlatineValue extends QueueState {
  loading: boolean;
  /** Albums en cours, du plus ancien au plus récent. */
  actifs: QueueAlbum[];
  /** Celui qui tourne : le premier actif. */
  courant: QueueAlbum | null;
  /** Identifiants de fiches actuellement dans la file. */
  itemsEnFile: Set<number>;
  refresh: () => Promise<void>;
  poser: (input: PoserInput) => Promise<QueueAlbum>;
  retirer: (id: string) => Promise<void>;
}

const Ctx = createContext<PlatineValue | null>(null);

export function PlatineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QueueState>(EMPTY_QUEUE);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await fetchQueue());
    } catch {
      // API injecte joignable : BackendStatus le dit déjà, on ne double pas
      // le message. On garde le dernier état connu plutôt que de tout vider.
    } finally {
      setLoading(false);
    }
  }, []);

  // Le rythme suit l'activité : 4 s quand un disque tourne, 20 s au repos.
  const actifs = useMemo(() => state.albums.filter(a => a.status === 'active'), [state.albums]);
  const busy = actifs.length > 0;

  useEffect(() => {
    let stopped = false;
    const loop = async () => {
      await refresh();
      if (stopped) return;
      timer.current = setTimeout(loop, busy ? POLL_ACTIVE : POLL_IDLE);
    };
    void loop();
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh, busy]);

  const poser = useCallback(async (input: PoserInput) => {
    const album = await apiPoser(input);
    await refresh();
    return album;
  }, [refresh]);

  const retirer = useCallback(async (id: string) => {
    await apiRetirer(id);
    await refresh();
  }, [refresh]);

  const value = useMemo<PlatineValue>(() => ({
    ...state,
    loading,
    actifs,
    courant: actifs[0] ?? null,
    itemsEnFile: new Set(actifs.map(a => a.itemId).filter((n): n is number => n != null)),
    refresh,
    poser,
    retirer,
  }), [state, loading, actifs, refresh, poser, retirer]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlatine(): PlatineValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlatine doit être utilisé dans PlatineProvider');
  return ctx;
}
