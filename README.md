# Mediatek

Le catalogue d'une collection physique — CD, vinyles, DVD, Blu-ray — qui sait aussi
quel disque tourne en ce moment et le fait remonter sur Last.fm, piste par piste.

---

## Ce que ça fait

- **Rayons** — la collection en plaques de pochettes, filtrable par support, nature,
  décennie, avec recherche plein texte.
- **Saisie** — recherche Discogs (source principale) ou TMDB, repli MusicBrainz,
  pré-remplissage enrichi : pressage, crédits, popularité, vidéos, bio d'artiste.
- **Fiche** — toutes les métadonnées, la tracklist, l'édition de l'image, le
  réenrichissement à la demande, les notes personnelles.
- **Surprise** — « qu'est-ce qu'on met ce soir ? », tirage au sort filtré.
- **Platine** — poser un disque, et l'ordonnanceur envoie chaque piste à Last.fm à
  l'heure où elle est censée passer.
- **Entretien** — compte Last.fm, et les artistes à retirer de l'historique.

## Démarrer

```bash
npm run install:all
npm run dev
```

Client sur `:3009`, API sur `:8002` (en développement). Le client proxifie `/api` et
`/uploads` vers l'API.

L'installation du serveur télécharge aussi **Chromium pour Playwright** (`postinstall`,
~270 Mo la première fois, instantané ensuite). Sans lui, tout marche sauf la suppression
d'artistes, qui échoue sur `Executable doesn't exist`. Les binaires sont versionnés avec
Playwright : monter la dépendance impose de relancer `npx playwright install chromium`.

## Variables d'environnement

`server/.env.local` — jamais commité :

```env
PORT=8002
DISCOGS_TOKEN=…        # source principale musique, gratuit sur discogs.com
TMDB_API_KEY=…         # optionnel — lookup vidéo
APP_CONTACT_EMAIL=…    # contact du User-Agent, demandé par MusicBrainz et Discogs
LASTFM_API_KEY=…       # sans elles, tout marche sauf la platine
LASTFM_SECRET=…
LASTFM_USERNAME=…      # utilisé par la suppression d'artistes
```

`client/.env.local` — facultatif :

```env
VITE_AMELIORATOR_URL=http://…:3010   # widget de remontées ; absent, il ne charge pas
```

Le **secret Last.fm ne quitte jamais le serveur** : le client demande une URL
d'autorisation, renvoie le jeton, et c'est le serveur qui fait l'échange signé et garde
la clé de session. Rien de sensible n'atteint le navigateur.

## Architecture

```
client/  React 19 + TypeScript + Vite + React Router 7 — CSS maison, aucun framework
  src/
    components/   châssis, logement de lecture, plaques, pièces de façade
    lastfm/       état de connexion, appels via notre API
    platine/      état de la file, partagé par toute l'application
    pages/        rayons, saisie, fiche, surprise, entretien, callback
server/  Express 5 + TypeScript + better-sqlite3
  src/
    db.ts         schéma et migrations non destructives
    lastfm.ts     API Last.fm — signature, session, scrobble
    scrobbler.ts  l'ordonnanceur : il tourne avec le serveur, pas avec le front
    routes/       items, lookup, scrobble, lastfm, blacklist
  scripts/
    delete-scrobbles.mjs   suppression d'artistes via Playwright
  data/           base SQLite, session, cookies — tout est gitignoré
```

### L'ordonnanceur

Une piste part quand la précédente est censée être finie, donc après sa propre durée.
Quand le pressage ne fournit pas la durée — fréquent sur les vinyles Discogs — un repli
de 3 à 5 minutes est tiré **une fois** et figé en base : sans ça l'heure de fin annoncée
changerait à chaque lecture.

La boucle vit dans le serveur Express, pas dans le front : la file avance navigateur
fermé.

Au démarrage, tout ce qui était en attente est replanifié séquentiellement à partir de
maintenant : un serveur arrêté deux heures n'envoie pas au réveil toutes les pistes en
retard d'un coup.

## Design

Le monde visuel — châssis noir anodisé, plaques d'aluminium brossé, ambre réservé à ce
qui vit maintenant — est consigné dans [`DESIGN.md`](DESIGN.md), avec ses règles nommées
et ses interdits. La vérité produit est dans [`PRODUCT.md`](PRODUCT.md).

## Mise en production

La prod tourne sur le Mac Mini (`100.117.225.90`) : client `:3005`, API `:8002`.

```bash
git push                                              # depuis ce poste
ssh benvari@100.117.225.90
cd /Users/benvari/Apps/MAISON/BibliAnalogique && git pull origin main
npm run install:all                                   # puis relancer depuis App Manager
```

`server/data/` n'est pas suivi par git : la base, la session Last.fm et les cookies
survivent au `git pull`. Ne remets jamais ce dossier sous suivi — un fichier qu'un commit
dé-suit est **supprimé du disque** chez celui qui pull.

## Limites connues

- La suppression d'artistes sur Last.fm pilote le site web avec Playwright : l'API n'offre
  aucune suppression. C'est fragile par construction, le HTML de Last.fm peut changer.
- `TMDB_API_KEY` n'a jamais été renseignée : le lookup vidéo est inopérant.
