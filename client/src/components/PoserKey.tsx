// « Poser sur la platine » — la même action partout : sur la fiche d'un
// disque, sur le résultat d'un tirage. Elle porte elle-même tous ses états,
// y compris celui où l'utilisateur n'est pas connecté à Last.fm : dans ce cas
// elle change de libellé et mène à l'entretien. Il n'y a jamais de mur.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Item } from '../api';
import { usePlatine } from '../platine/PlatineContext';

export default function PoserKey({ item, wide }: { item: Item; wide?: boolean }) {
  const { configured, connected, itemsEnFile, poser } = usePlatine();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (item.type !== 'music') return null;

  const dejaEnFile = itemsEnFile.has(item.id);
  const cls = `key key-primary${wide ? ' key-wide' : ''}`;

  if (!configured) {
    return (
      <p className="poser-note">
        Clés Last.fm absentes du serveur — le scrobble est hors service.
      </p>
    );
  }

  if (!connected) {
    return (
      <button className={cls} onClick={() => navigate('/entretien')}>
        Connecter Last.fm pour scrobbler
      </button>
    );
  }

  async function handle() {
    setBusy(true);
    setMsg(null);
    try {
      const album = await poser({
        artist: item.artist_or_director ?? '',
        album: item.title,
        image: item.cover_url ?? '',
        itemId: item.id,
        tracks: (item.tracklist ?? [])
          .filter(t => t.title?.trim())
          .map(t => ({ title: t.title, duration: t.length_sec })),
      });
      const fin = album.finishAt
        ? new Date(album.finishAt * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : null;
      setMsg({
        ok: true,
        text: album.duplicate
          ? 'Ce disque est déjà sur la platine.'
          : `Posé — ${album.tracks.length} pistes${fin ? `, fin vers ${fin}` : ''}.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const manqueArtiste = !item.artist_or_director?.trim();

  return (
    <div className="poser">
      <button
        className={cls}
        onClick={handle}
        disabled={busy || dejaEnFile || manqueArtiste}
        title={manqueArtiste ? "Il manque le nom de l'artiste sur cette fiche." : undefined}
      >
        {busy ? 'Envoi…' : dejaEnFile ? 'Déjà sur la platine' : 'Poser sur la platine'}
      </button>
      {manqueArtiste && (
        <p className="poser-note">Renseigne l'artiste sur cette fiche pour pouvoir la scrobbler.</p>
      )}
      {msg && (
        <p className={`poser-note${msg.ok ? ' poser-ok' : ' poser-err'}`} role="status">{msg.text}</p>
      )}
    </div>
  );
}
