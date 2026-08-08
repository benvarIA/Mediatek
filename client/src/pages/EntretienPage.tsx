// Entretien — le compte Last.fm et les artistes à retirer de l'historique.

import { useCallback, useEffect, useRef, useState } from 'react';
import { avatarOf, fetchAuthUrl, searchArtists, type ArtistSuggestion } from '../lastfm/api';
import { useAuth } from '../lastfm/AuthContext';
import { Led } from '../components/parts';
import './EntretienPage.css';

interface Entry {
  id: string;
  type: 'artist' | 'track';
  artist: string;
  title: string | null;
  source: string;
  addedAt: string;
}

interface Job {
  status: 'idle' | 'starting' | 'authenticating' | 'waiting_login' | 'deleting' | 'done' | 'error' | 'cancelled';
  total?: number;
  deleted?: number;
  errors?: number;
  message?: string;
}

const EN_COURS = ['starting', 'authenticating', 'waiting_login', 'deleting'];

function EtatJob({ job }: { job: Job }) {
  if (job.status === 'idle') return null;
  const pct = job.total ? Math.round(((job.deleted ?? 0) / job.total) * 100) : 0;
  return (
    <div className="job" role="status">
      {job.status === 'starting' && <p className="lg lg-dim">Démarrage…</p>}
      {job.status === 'authenticating' && <p className="lg lg-dim">Connexion à Last.fm…</p>}
      {job.status === 'waiting_login' && (
        <p className="lg lg-amber">Un navigateur s'est ouvert — connecte-toi à Last.fm pour continuer</p>
      )}
      {job.status === 'deleting' && (
        <>
          <p className="lg lg-dim num">
            Suppression — {job.deleted} sur {job.total}
            {job.errors ? ` · ${job.errors} en échec` : ''}
          </p>
          <div className="job-bar"><span style={{ transform: `scaleX(${pct / 100})` }} /></div>
        </>
      )}
      {job.status === 'done' && (
        <p className="job-done num">
          Terminé — {job.deleted} artiste(s) retiré(s){job.errors ? `, ${job.errors} en échec` : ''}
        </p>
      )}
      {job.status === 'cancelled' && <p className="lg lg-dim">Interrompu.</p>}
      {job.status === 'error' && <p className="job-err">Échec : {job.message}</p>}
    </div>
  );
}

function Autocompletion({
  value, onChange, onValider,
}: { value: string; onChange: (v: string) => void; onValider: () => void }) {
  const [sugg, setSugg] = useState<ArtistSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [actif, setActif] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) { setSugg([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const r = await searchArtists(value);
      setSugg(r);
      setOpen(r.length > 0);
      setActif(-1);
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value]);

  const choisir = (name: string) => { onChange(name); setSugg([]); setOpen(false); };

  return (
    <div className="auto">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => sugg.length > 0 && setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActif(i => Math.min(i + 1, sugg.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActif(i => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter') {
            if (actif >= 0 && sugg[actif]) choisir(sugg[actif].name);
            else { setOpen(false); onValider(); }
          } else if (e.key === 'Escape') { setOpen(false); setSugg([]); }
        }}
        placeholder="Nom de l'artiste…"
        aria-label="Nom de l'artiste à retirer"
      />
      {open && (
        <ul className="auto-list well">
          {sugg.map((s, i) => (
            <li key={s.name}>
              <button
                type="button"
                className={i === actif ? 'auto-item auto-item-sel' : 'auto-item'}
                onMouseDown={() => choisir(s.name)}
              >
                <span className="auto-name">{s.name}</span>
                {s.listeners > 0 && (
                  <span className="lg lg-dim num">{s.listeners.toLocaleString('fr-FR')} auditeurs</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function EntretienPage() {
  const { configured, connected, username, user, loading, refresh, logout } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [nouveau, setNouveau] = useState('');
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [job, setJob] = useState<Job>({ status: 'idle' });
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try {
      const r = await fetch('/api/blacklist');
      if (r.ok) setEntries(await r.json());
    } catch { /* le bandeau serveur le dit déjà */ }
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  // Le suivi de la suppression n'a de sens que pendant qu'elle tourne.
  const actif = EN_COURS.includes(job.status);
  useEffect(() => {
    const lire = () => fetch('/api/blacklist/job').then(r => r.json()).then(setJob).catch(() => {});
    void lire();
    if (!actif) return;
    const id = setInterval(lire, 2000);
    return () => clearInterval(id);
  }, [actif]);

  async function connecter() {
    setErreur('');
    try {
      window.location.href = await fetchAuthUrl();
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  async function ajouter() {
    const artist = nouveau.trim();
    if (!artist) return;
    setErreur('');
    try {
      const r = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Ajout impossible');
      setNouveau('');
      await charger();
    } catch (e) { setErreur((e as Error).message); }
  }

  async function retirerEntree(id: string) {
    await fetch(`/api/blacklist/${id}`, { method: 'DELETE' });
    setChoisis(s => { const n = new Set(s); n.delete(id); return n; });
    await charger();
  }

  async function lancer() {
    if (!choisis.size) return;
    setErreur('');
    try {
      const r = await fetch('/api/blacklist/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...choisis] }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Lancement impossible');
      setJob({ status: 'starting' });
    } catch (e) { setErreur((e as Error).message); }
  }

  const tousChoisis = entries.length > 0 && choisis.size === entries.length;
  const avatar = avatarOf(user);

  return (
    <div className="entretien">
      {/* ── Compte ─────────────────────────────────────────────────── */}
      <section className="panel bloc">
        <h2 className="headline">Compte Last.fm</h2>

        {loading ? (
          <p className="lg lg-dim">Lecture…</p>
        ) : !configured ? (
          <p className="prose bloc-note">
            Le serveur n'a pas de clés Last.fm. Renseigne <code>LASTFM_API_KEY</code> et
            <code> LASTFM_SECRET</code> dans <code>server/.env.local</code>, puis relance-le.
            Sans elles, la platine ne peut rien envoyer — le reste de l'application fonctionne.
          </p>
        ) : connected ? (
          <div className="compte">
            {avatar && <img src={avatar} alt="" className="compte-avatar" />}
            <div className="compte-id">
              <span className="compte-nom">{user?.realname || username}</span>
              <span className="lg lg-dim num">
                {user?.playcount
                  ? `${Number(user.playcount).toLocaleString('fr-FR')} scrobbles`
                  : (username ?? '')}
              </span>
            </div>
            <span className="compte-etat"><Led on tone="green" /><span className="lg lg-dim">Connecté</span></span>
            <button className="key" onClick={() => void logout().then(refresh)}>Déconnecter</button>
          </div>
        ) : (
          <div className="compte">
            <p className="prose bloc-note">
              Connecte ton compte pour que la platine puisse envoyer les écoutes.
              Le reste de l'application n'en a pas besoin.
            </p>
            <button className="key key-primary" onClick={connecter}>Se connecter à Last.fm</button>
          </div>
        )}
      </section>

      {/* ── Artistes à retirer ─────────────────────────────────────── */}
      <section className="panel bloc">
        <h2 className="headline">Artistes à retirer de l'historique</h2>
        <p className="prose bloc-note">
          L'API Last.fm n'offre aucune suppression : elle passe par le site, piloté par un
          navigateur automatisé. C'est lent, et une fenêtre peut s'ouvrir pour te faire
          reconnecter.
        </p>

        <div className="ajout">
          <Autocompletion value={nouveau} onChange={setNouveau} onValider={() => void ajouter()} />
          <button className="key" onClick={() => void ajouter()} disabled={!nouveau.trim()}>Ajouter</button>
        </div>

        {erreur && <p className="job-err">{erreur}</p>}

        <div className="liste-tete">
          <label className="choix-tout">
            <input
              type="checkbox"
              checked={tousChoisis}
              ref={el => { if (el) el.indeterminate = choisis.size > 0 && !tousChoisis; }}
              onChange={() => setChoisis(tousChoisis ? new Set() : new Set(entries.map(e => e.id)))}
              disabled={!entries.length}
            />
            <span className="lg lg-dim">
              {entries.length === 0
                ? 'Aucun artiste'
                : `${entries.length} artiste${entries.length > 1 ? 's' : ''}${choisis.size ? ` · ${choisis.size} sélectionné${choisis.size > 1 ? 's' : ''}` : ''}`}
            </span>
          </label>
          <button className="key key-rec" onClick={() => void lancer()} disabled={actif || !choisis.size}>
            {actif ? 'En cours…' : 'Supprimer de Last.fm'}
          </button>
        </div>

        {entries.length > 0 && (
          <ul className="liste">
            {entries.map(e => (
              <li key={e.id} className="well">
                <input
                  type="checkbox"
                  checked={choisis.has(e.id)}
                  onChange={() => setChoisis(s => {
                    const n = new Set(s);
                    n.has(e.id) ? n.delete(e.id) : n.add(e.id);
                    return n;
                  })}
                  aria-label={`Sélectionner ${e.artist}`}
                />
                <span className="liste-nom">{e.artist}</span>
                <button
                  className="liste-drop"
                  onClick={() => void retirerEntree(e.id)}
                  aria-label={`Enlever ${e.artist} de la liste`}
                >✕</button>
              </li>
            ))}
          </ul>
        )}

        <EtatJob job={job} />
      </section>
    </div>
  );
}
