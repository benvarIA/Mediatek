import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  itemsApi, lookupApi,
  type EnrichmentSourceKey, type Item, type MusicEditorial, type MusicEditorialSourceKey,
} from '../api';
import { Sleeve, SUPPORT_LABEL } from '../components/Plate';
import PoserKey from '../components/PoserKey';
import { Led } from '../components/parts';
import { usePlatine } from '../platine/PlatineContext';
import './ItemDetailPage.css';

const SUPPORT_LONG: Record<string, string> = { cd: 'CD', vinyl: '33 tours', dvd: 'DVD', bluray: 'Blu-ray' };
const ETAT: Record<string, string> = { neuf: 'Neuf', bon_etat: 'Bon état', use: 'Usagé' };

const nf = new Intl.NumberFormat('fr-FR');
const duree = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const total = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
};

const SOURCES_MUSIQUE: { key: MusicEditorialSourceKey; label: string }[] = [
  { key: 'discogs', label: 'Discogs' },
  { key: 'musicbrainz', label: 'MusicBrainz' },
  { key: 'lastfm', label: 'Last.fm' },
  { key: 'wikipedia', label: 'Wikipédia' },
  { key: 'theaudiodb', label: 'TheAudioDB' },
];
const SOURCES_VIDEO: { key: EnrichmentSourceKey; label: string }[] = [{ key: 'tmdb', label: 'TMDB' }];

type ModeImage = 'recherche' | 'url' | 'fichier';
type Msg = { ok: boolean; text: string } | null;

function Bloc({ titre, action, children }: { titre: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel bloc">
      <div className="bloc-tete">
        <h2 className="headline">{titre}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Ligne({ legend, children }: { legend: string; children: React.ReactNode }) {
  if (children == null || children === '' || children === false) return null;
  return (
    <div className="fiche-ligne">
      <span className="lg lg-dim">{legend}</span>
      <span className="fiche-valeur">{children}</span>
    </div>
  );
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { itemsEnFile } = usePlatine();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);

  const [notes, setNotes] = useState('');
  const [editNotes, setEditNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [suppr, setSuppr] = useState(false);

  const [editorial, setEditorial] = useState<MusicEditorial | null>(null);
  const [editorialLoading, setEditorialLoading] = useState(false);
  const [editorialSources, setEditorialSources] = useState<MusicEditorialSourceKey[]>(SOURCES_MUSIQUE.map(s => s.key));

  const [enrichOuvert, setEnrichOuvert] = useState(false);
  const [enrichEnCours, setEnrichEnCours] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<Msg>(null);
  const [sourcesChoisies, setSourcesChoisies] = useState<EnrichmentSourceKey[]>(SOURCES_MUSIQUE.map(s => s.key));
  const [majImage, setMajImage] = useState(true);

  const [imgOuvert, setImgOuvert] = useState(false);
  const [imgMode, setImgMode] = useState<ModeImage>('recherche');
  const [imgUrl, setImgUrl] = useState('');
  const [imgRequete, setImgRequete] = useState('');
  const [imgResultats, setImgResultats] = useState<any[]>([]);
  const [imgCherche, setImgCherche] = useState(false);
  const [imgEnregistre, setImgEnregistre] = useState(false);
  const [imgMsg, setImgMsg] = useState<Msg>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setIntrouvable(false);
    itemsApi.get(Number(id))
      .then(it => { setItem(it); setNotes(it.notes || ''); })
      .catch(() => setIntrouvable(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Remise à zéro des panneaux à chaque changement de fiche.
  useEffect(() => {
    if (!item) return;
    setSourcesChoisies(item.type === 'music' ? SOURCES_MUSIQUE.map(s => s.key) : SOURCES_VIDEO.map(s => s.key));
    setEditorialSources(SOURCES_MUSIQUE.map(s => s.key));
    setMajImage(true);
    setEnrichOuvert(false);
    setEnrichMsg(null);
    setImgOuvert(false);
    setImgMode('recherche');
    setImgUrl(item.cover_url || '');
    setImgRequete([item.artist_or_director, item.title].filter(Boolean).join(' '));
    setImgResultats([]);
    setImgMsg(null);
  }, [item?.id, item?.type]);

  useEffect(() => {
    if (!item || item.type !== 'music' || !item.artist_or_director?.trim() || !item.title.trim()) {
      setEditorial(null);
      return;
    }
    setEditorialLoading(true);
    lookupApi.getMusicEditorial({
      artist: item.artist_or_director,
      album: item.title,
      discogs_id: item.discogs_id ?? null,
      year: item.year ?? null,
      sources: editorialSources,
    })
      .then(setEditorial)
      .catch(() => setEditorial(null))
      .finally(() => setEditorialLoading(false));
  }, [item, editorialSources]);

  async function sauverNotes() {
    if (!item) return;
    setSavingNotes(true);
    try {
      setItem(await itemsApi.update(item.id, { notes }));
      setEditNotes(false);
    } finally {
      setSavingNotes(false);
    }
  }

  async function supprimer() {
    if (!item) return;
    if (!window.confirm(`Retirer « ${item.title} » de la collection ? C'est définitif.`)) return;
    setSuppr(true);
    try {
      await itemsApi.delete(item.id);
      navigate('/');
    } catch {
      setSuppr(false);
    }
  }

  async function reenrichir() {
    if (!item || !sourcesChoisies.length) return;
    setEnrichEnCours(true);
    setEnrichMsg(null);
    try {
      const maj = await itemsApi.reEnrich(item.id, { sources: sourcesChoisies, updateImage: majImage });
      setItem(maj);
      if (maj.type === 'music') {
        const s = sourcesChoisies.filter((k): k is MusicEditorialSourceKey => k !== 'tmdb');
        setEditorialSources(s.length ? s : SOURCES_MUSIQUE.map(x => x.key));
      }
      setEnrichMsg({
        ok: true,
        text: majImage ? 'Fiche réenrichie, image comprise.' : "Fiche réenrichie, l'image n'a pas bougé.",
      });
      setEnrichOuvert(false);
    } catch {
      setEnrichMsg({ ok: false, text: "Le réenrichissement a échoué. Les sources n'ont rien renvoyé." });
    } finally {
      setEnrichEnCours(false);
    }
  }

  async function chercherImage() {
    if (!item || !imgRequete.trim()) return;
    setImgCherche(true);
    setImgMsg(null);
    try {
      let r: any[] = [];
      if (item.type === 'music') {
        try { r = await lookupApi.searchDiscogs(imgRequete); } catch { r = []; }
        if (!r.length) r = await lookupApi.searchMusic(imgRequete);
      } else {
        r = await lookupApi.searchVideo(imgRequete);
      }
      const avecImage = r.filter(x => x.cover_url);
      setImgResultats(avecImage);
      if (!avecImage.length) setImgMsg({ ok: false, text: 'Aucune image pour cette recherche.' });
    } catch {
      setImgMsg({ ok: false, text: "La recherche d'image a échoué." });
    } finally {
      setImgCherche(false);
    }
  }

  async function poserImage(url: string) {
    if (!item || !url.trim()) return;
    setImgEnregistre(true);
    setImgMsg(null);
    try {
      const maj = await itemsApi.update(item.id, { cover_url: url.trim() });
      setItem(maj);
      setImgUrl(maj.cover_url || '');
      setImgMsg({ ok: true, text: 'Image mise à jour.' });
      setImgOuvert(false);
    } catch {
      setImgMsg({ ok: false, text: "La mise à jour de l'image a échoué." });
    } finally {
      setImgEnregistre(false);
    }
  }

  async function envoyerImage(file: File | null) {
    if (!item || !file) return;
    setImgEnregistre(true);
    setImgMsg(null);
    try {
      const maj = await itemsApi.uploadCover(item.id, file);
      setItem(maj);
      setImgUrl(maj.cover_url || '');
      setImgMsg({ ok: true, text: 'Image enregistrée.' });
      setImgOuvert(false);
    } catch {
      setImgMsg({ ok: false, text: "L'envoi de l'image a échoué." });
    } finally {
      setImgEnregistre(false);
    }
  }

  if (loading) {
    return (
      <div className="panel fiche-attente"><p className="lg lg-dim">Lecture de la fiche…</p></div>
    );
  }
  if (introuvable || !item) {
    return (
      <div className="panel fiche-attente">
        <p className="headline">Fiche introuvable</p>
        <Link to="/" className="key">Retour aux rayons</Link>
      </div>
    );
  }

  const surLaPlatine = itemsEnFile.has(item.id);
  const creditsPrincipaux = editorial?.main_credits?.length
    ? editorial.main_credits
    : (item.credits ?? [])
      .filter(c => ['Compositeur', 'Paroles', 'Producteur', 'Co-producteur', 'Chant', 'Featuring', 'Mixage', 'Mastering'].includes(c.role))
      .slice(0, 6);

  const note = editorial?.rating ?? (item.community?.rating ? {
    source: 'Discogs',
    label: 'Note de la communauté',
    value: item.community.rating,
    scale: 5,
    count: item.community.rating_count ?? null,
    url: item.discogs_id ? `https://www.discogs.com/release/${item.discogs_id}` : null,
  } : null);

  const videos = (item.videos ?? []).filter((v, i, l) => l.findIndex(c => c.url === v.url) === i);
  const sourcesDispo = item.type === 'music' ? SOURCES_MUSIQUE : SOURCES_VIDEO;
  const pressage = item.type === 'music' && (item.format_detail || item.catalog_no || item.country || item.barcode || item.original_year);

  return (
    <div className="fiche">
      <div className="fiche-nav">
        <Link to="/" className="lg lg-dim fiche-retour">← Rayons</Link>
        <div className="fiche-nav-keys">
          <button className="key" onClick={() => setEnrichOuvert(o => !o)} aria-expanded={enrichOuvert}>
            Réenrichir
          </button>
          <button className="key key-rec" onClick={supprimer} disabled={suppr}>
            {suppr ? 'Retrait…' : 'Retirer de la collection'}
          </button>
        </div>
      </div>

      {enrichMsg && <p className={`fiche-msg${enrichMsg.ok ? ' msg-ok' : ' msg-err'}`} role="status">{enrichMsg.text}</p>}
      {imgMsg && <p className={`fiche-msg${imgMsg.ok ? ' msg-ok' : ' msg-err'}`} role="status">{imgMsg.text}</p>}

      {enrichOuvert && (
        <section className="panel bloc">
          <div className="bloc-tete">
            <h2 className="headline">Réenrichir la fiche</h2>
            <button className="key" onClick={() => setEnrichOuvert(false)}>Fermer</button>
          </div>
          <p className="prose bloc-note">
            Relance les sources choisies et réécrit les métadonnées. Les notes personnelles ne sont jamais touchées.
          </p>
          <div className="chips">
            {sourcesDispo.map(s => (
              <button
                key={s.key}
                type="button"
                className={`chip${sourcesChoisies.includes(s.key) ? ' chip-on' : ''}`}
                aria-pressed={sourcesChoisies.includes(s.key)}
                onClick={() => setSourcesChoisies(p =>
                  p.includes(s.key) ? p.filter(k => k !== s.key) : [...p, s.key])}
              >{s.label}</button>
            ))}
          </div>
          <label className="fiche-coche">
            <input type="checkbox" checked={majImage} onChange={e => setMajImage(e.target.checked)} />
            <span className="lg lg-dim">Autoriser le remplacement de l'image</span>
          </label>
          <button
            className="key key-primary"
            onClick={reenrichir}
            disabled={enrichEnCours || !sourcesChoisies.length}
          >
            {enrichEnCours ? 'Réenrichissement…' : 'Lancer'}
          </button>
        </section>
      )}

      {/* ── Fenêtre principale ────────────────────────────────────────── */}
      <section className="panel fiche-hero">
        <div className="fiche-cover">
          <div className="well fiche-cover-well">
            <Sleeve src={item.cover_url} alt={item.title} fallback={SUPPORT_LABEL[item.support]} />
          </div>
          <button className="key" onClick={() => setImgOuvert(o => !o)} aria-expanded={imgOuvert}>
            Changer l'image
          </button>
        </div>

        <div className="fiche-id">
          <div className="fiche-badges">
            <span className="lg lg-dim">{SUPPORT_LONG[item.support]}</span>
            <span className="lg lg-dim">·</span>
            <span className="lg lg-dim">{ETAT[item.state]}</span>
            {surLaPlatine && (
              <span className="fiche-live"><Led on /><span className="lg lg-amber">Sur la platine</span></span>
            )}
          </div>

          <h1 className="display fiche-titre">{item.title}</h1>
          {item.artist_or_director && <p className="fiche-artiste">{item.artist_or_director}</p>}

          <div className="fiche-meta">
            {item.year && <span className="num">{item.type === 'music' ? (item.original_year || item.year) : item.year}</span>}
            {item.type === 'video' && item.duration_min && <span className="num">{item.duration_min} min</span>}
            {item.type === 'music' && item.duration_total_sec ? <span className="num">{total(item.duration_total_sec)}</span> : null}
            {item.label && <span>{item.label}</span>}
            {item.language && <span>{item.language}</span>}
          </div>

          {(item.genres.length > 0 || (item.styles?.length ?? 0) > 0) && (
            <p className="fiche-genres">
              {[...item.genres, ...(item.styles ?? [])].join(' · ')}
            </p>
          )}

          {item.synopsis && <p className="prose fiche-synopsis">{item.synopsis}</p>}
          {item.cast_list?.length ? <p className="fiche-casting">Avec {item.cast_list.join(', ')}</p> : null}

          <div className="fiche-action"><PoserKey item={item} /></div>
        </div>
      </section>

      {imgOuvert && (
        <section className="panel bloc">
          <div className="bloc-tete">
            <h2 className="headline">Image de la fiche</h2>
            <button className="key" onClick={() => setImgOuvert(false)}>Fermer</button>
          </div>

          <div className="selector fiche-img-modes">
            {([['recherche', 'Recherche'], ['url', 'URL'], ['fichier', 'Fichier']] as const).map(([m, l]) => (
              <button
                key={m}
                type="button"
                className={`position${imgMode === m ? ' position-sel' : ''}`}
                aria-pressed={imgMode === m}
                onClick={() => setImgMode(m)}
              >
                <span className={`led${imgMode === m ? ' led-on' : ''}`} aria-hidden="true" />{l}
              </button>
            ))}
          </div>

          {imgMode === 'recherche' && (
            <>
              <div className="add-search">
                <input
                  value={imgRequete}
                  onChange={e => setImgRequete(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && chercherImage()}
                  placeholder="Titre, artiste, réalisateur…"
                  aria-label="Recherche d'image"
                />
                <button className="key key-primary" onClick={chercherImage} disabled={imgCherche}>
                  {imgCherche ? 'Recherche…' : 'Chercher'}
                </button>
              </div>
              {imgResultats.length > 0 && (
                <div className="fiche-img-results">
                  {imgResultats.map((r, i) => (
                    <button
                      key={`${r.cover_url}-${i}`}
                      type="button"
                      className="plate well fiche-img-result"
                      onClick={() => poserImage(r.cover_url)}
                      disabled={imgEnregistre}
                    >
                      <Sleeve src={r.cover_url} alt="" />
                      <div className="plate-label">
                        <div className="plate-title">{r.title || r.artist_or_director || 'Image'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {imgMode === 'url' && (
            <div className="add-search">
              <input
                type="url"
                value={imgUrl}
                onChange={e => setImgUrl(e.target.value)}
                placeholder="https://…"
                aria-label="URL de l'image"
              />
              <button
                className="key key-primary"
                onClick={() => poserImage(imgUrl)}
                disabled={imgEnregistre || !imgUrl.trim()}
              >
                {imgEnregistre ? 'Enregistrement…' : 'Utiliser'}
              </button>
            </div>
          )}

          {imgMode === 'fichier' && (
            <label className="fiche-fichier well">
              <input
                type="file"
                accept="image/*"
                onChange={e => envoyerImage(e.target.files?.[0] ?? null)}
                disabled={imgEnregistre}
              />
              <span className="lg lg-dim">
                {imgEnregistre ? 'Envoi…' : "Choisir une image sur l'ordinateur"}
              </span>
            </label>
          )}
        </section>
      )}

      {pressage && (
        <Bloc titre="Pressage">
          <div className="fiche-lignes">
            <Ligne legend="Format">{item.format_detail}</Ligne>
            <Ligne legend="N° de catalogue"><span className="num">{item.catalog_no}</span></Ligne>
            <Ligne legend="Pays">{item.country}</Ligne>
            <Ligne legend="Sortie d'origine"><span className="num">{item.original_year}</span></Ligne>
            <Ligne legend="Code-barres"><span className="num">{item.barcode}</span></Ligne>
            <Ligne legend="Discogs">
              {item.discogs_id
                ? <a href={`https://www.discogs.com/release/${item.discogs_id}`} target="_blank" rel="noreferrer" className="fiche-lien">
                    Voir le pressage
                  </a>
                : null}
            </Ligne>
          </div>
        </Bloc>
      )}

      {item.tracklist && item.tracklist.length > 0 && (
        <Bloc titre="Pistes">
          <ol className="fiche-pistes">
            {/* Discogs ne fournit pas toujours la position : elle est absente sur
                certains CD, et c'est une cote de face sur les vinyles (« A1 »,
                « B7 »). On garde ce qu'il donne, on numérote sinon. */}
            {item.tracklist.map((t, i) => (
              <li key={`${t.position ?? ''}-${i}`}>
                <span className="lg lg-dim num fiche-piste-num">
                  {t.position != null && String(t.position).trim()
                    ? String(t.position)
                    : String(i + 1).padStart(2, '0')}
                </span>
                <span className="fiche-piste-titre">{t.title}</span>
                {t.length_sec ? <span className="num fiche-piste-duree">{duree(t.length_sec)}</span> : null}
              </li>
            ))}
          </ol>
        </Bloc>
      )}

      {item.community && (item.community.have || item.community.want || item.community.lowest_price) && (
        <Bloc titre="Popularité & valeur">
          <div className="fiche-lignes">
            <Ligne legend="En possèdent"><span className="num">{item.community.have ? nf.format(item.community.have) : null}</span></Ligne>
            <Ligne legend="En cherchent"><span className="num">{item.community.want ? nf.format(item.community.want) : null}</span></Ligne>
            <Ligne legend="Plus bas prix">
              {item.community.lowest_price ? <span className="num">{nf.format(item.community.lowest_price)} €</span> : null}
            </Ligne>
            <Ligne legend="En vente"><span className="num">{item.community.num_for_sale ?? null}</span></Ligne>
          </div>
        </Bloc>
      )}

      {item.type === 'music' && (editorialLoading || editorial) && (
        <Bloc titre="L'album, en bref">
          {editorialLoading && !editorial ? (
            <p className="lg lg-dim">Lecture des sources…</p>
          ) : (
            <>
              {note && (
                <p className="fiche-note">
                  <span className="num fiche-note-val">{note.value.toFixed(2)}</span>
                  <span className="lg lg-dim">/ {note.scale} · {note.label}
                    {note.count ? ` · ${nf.format(note.count)} avis` : ''}</span>
                </p>
              )}
              {editorial?.album_summary && <p className="prose">{editorial.album_summary}</p>}

              {creditsPrincipaux.length > 0 && (
                <>
                  <h3 className="lg lg-dim fiche-sous">Crédits principaux</h3>
                  <div className="fiche-lignes">
                    {/* Les sources éditoriales peuvent répéter un rôle ou une
                        URL : la position garantit l'unicité de la clé. */}
                    {creditsPrincipaux.map((c, i) => (
                      <Ligne key={`${c.role}-${i}`} legend={c.role}>{c.names.join(', ')}</Ligne>
                    ))}
                  </div>
                </>
              )}

              {editorial?.anecdotes?.length ? (
                <>
                  <h3 className="lg lg-dim fiche-sous">Repères</h3>
                  <ul className="fiche-faits">
                    {editorial.anecdotes.map((f, i) => (
                      <li key={`${f.source}-${i}`}>
                        <p className="prose">{f.text}</p>
                        <span className="lg lg-dim">{f.source}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {editorial?.artist_summary && (
                <>
                  <h3 className="lg lg-dim fiche-sous">L'artiste</h3>
                  <p className="prose">{editorial.artist_summary}</p>
                </>
              )}

              {editorial?.sources?.length ? (
                <>
                  <h3 className="lg lg-dim fiche-sous">Sources</h3>
                  <p className="fiche-sources">
                    {editorial.sources.map((s, i) => (
                      <a key={`${s.url}-${i}`} href={s.url} target="_blank" rel="noreferrer" className="fiche-lien">{s.label}</a>
                    ))}
                  </p>
                </>
              ) : null}
            </>
          )}
        </Bloc>
      )}

      {videos.length > 0 && (
        <Bloc titre="Écouter, regarder">
          <ul className="fiche-videos">
            {videos.map(v => (
              <li key={v.url}>
                <a href={v.url} target="_blank" rel="noreferrer">
                  <span className="fiche-video-play" aria-hidden="true">▶</span>
                  <span className="fiche-video-titre">{v.title}</span>
                  {v.duration ? <span className="num lg lg-dim">{duree(v.duration)}</span> : null}
                </a>
              </li>
            ))}
          </ul>
        </Bloc>
      )}

      <Bloc
        titre="Notes personnelles"
        action={!editNotes && <button className="key" onClick={() => setEditNotes(true)}>Modifier</button>}
      >
        {editNotes ? (
          <>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} autoFocus aria-label="Notes personnelles" />
            <div className="fiche-notes-keys">
              <button className="key key-primary" onClick={sauverNotes} disabled={savingNotes}>
                {savingNotes ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button className="key" onClick={() => { setEditNotes(false); setNotes(item.notes || ''); }}>
                Annuler
              </button>
            </div>
          </>
        ) : item.notes ? (
          <p className="prose fiche-notes">{item.notes}</p>
        ) : (
          <p className="lg lg-dim">Rien de noté sur ce disque.</p>
        )}
      </Bloc>
    </div>
  );
}
