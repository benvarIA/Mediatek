// Les pièces détachées de la façade : diodes, afficheurs, échelles, vis.
// Tout ce qui suit est de la matière, pas du contenu.

import { useEffect, useState } from 'react';

export function Led({ on, tone = 'amber' }: { on?: boolean; tone?: 'amber' | 'green' | 'red' }) {
  const cls = !on ? '' : tone === 'green' ? ' led-green' : tone === 'red' ? ' led-red' : ' led-on';
  return <span className={`led${cls}`} aria-hidden="true" />;
}

/** Un afficheur LED, toujours encastré. Voir « la règle de l'afficheur ». */
export function Readout({
  value, size = 15, off, title,
}: { value: string; size?: number; off?: boolean; title?: string }) {
  return (
    <span className="readout" title={title}>
      <span className={`lcd${off ? ' lcd-off' : ''}`} style={{ fontSize: size }}>{value}</span>
    </span>
  );
}

/** L'échelle ambre — la seule barre de progression du système. */
export function Ladder({ value, segments = 8, label }: { value: number; segments?: number; label?: string }) {
  const lit = Math.round(Math.min(1, Math.max(0, value)) * segments);
  return (
    <span
      className="ladder"
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Avancement'}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={`seg${i < lit ? ' seg-on' : ''}`} />
      ))}
    </span>
  );
}

export function Screws({ where = 'top' }: { where?: 'top' | 'bottom' | 'both' }) {
  const rows = where === 'both' ? ['top', 'bottom'] : [where];
  return (
    <>
      {rows.map(r => (
        <span key={r}>
          <span className="screw" style={{ left: 7, [r]: 7 } as React.CSSProperties} />
          <span className="screw" style={{ right: 7, [r]: 7 } as React.CSSProperties} />
        </span>
      ))}
    </>
  );
}

/** Horloge partagée — un seul intervalle pour toute l'application. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
