# Mediatek

Le catalogue d'une collection physique — CD, vinyles, DVD, Blu-ray — qui sait aussi
quel disque tourne en ce moment et le fait remonter sur Last.fm, piste par piste.

Anciennement **BibliAnalogique**, fusionné avec **ScrobblerVari** en août 2026.

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
    db.ts         schéma, migrations non destructives, reprise des JSON de ScrobblerVari
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

La boucle vit dans le serveur Express. Dans ScrobblerVari elle était déclarée dans un
plugin Vite, ce qui gelait la file en silence dès que le front s'arrêtait.

Au démarrage, tout ce qui était en attente est replanifié séquentiellement à partir de
maintenant : un serveur arrêté deux heures n'envoie pas au réveil toutes les pistes en
retard d'un coup.

## Design

Le monde visuel — châssis noir anodisé, plaques d'aluminium brossé, ambre réservé à ce
qui vit maintenant — est consigné dans [`DESIGN.md`](DESIGN.md), avec ses règles nommées
et ses interdits. La vérité produit est dans [`PRODUCT.md`](PRODUCT.md).

## Mise en production

La prod tourne sur le Mac Mini (`100.117.225.90`). Elle fait encore tourner
**trois** processus : le client `:3005`, l'API `:8002`, et l'ancien ScrobblerVari
`:3008`. La bascule retire le troisième — **dans cet ordre**, sinon le bouton scrobble
de la version en place casse entre les deux étapes :

```bash
# 1. depuis ce poste, une fois les changements poussés
git push

# 2. sur le Mac Mini
ssh benvari@100.117.225.90
cd /Users/benvari/Apps/MAISON/BibliAnalogique && git pull origin main
cp ~/Apps/MAISON/ScrobblerVari/scrobblervari/.env.local /tmp/lastfm.env   # les clés
# → reporter LASTFM_API_KEY / LASTFM_SECRET / LASTFM_USERNAME dans server/.env.local
#   (sans le préfixe VITE_), puis retirer SCROBBLER_URL qui ne sert plus
npm run install:all && (redémarrer l'app depuis App Manager)

# 3. seulement une fois Mediatek vérifié : retirer l'ancien
#    - arrêter scrobblervari depuis App Manager (:3008)
#    - retirer son entrée de App-Manager-V3/data/apps.json
```

Deux points à traiter à la main sur le Mac Mini, hors périmètre de ce dépôt :

- **Une entrée de crontab morte** appelle `scripts/clean.mjs` toutes les 6 heures depuis
  `/Volumes/NAS/MAIN CODEX PROJECTS/ScrobblerVari/…`, un chemin qui n'existe plus. Elle
  échoue en silence depuis longtemps et le script a été abandonné à la fusion :
  `crontab -e`, supprimer la ligne.
- **La bascule doit se faire platine vide.** Un album en cours au moment du `git pull`
  serait perdu : la reprise depuis les JSON ne s'exécute qu'une fois, et seulement si les
  tables sont vides.

## Limites connues

- La suppression d'artistes sur Last.fm pilote le site web avec Playwright : l'API n'offre
  aucune suppression. C'est fragile par construction, le HTML de Last.fm peut changer.
- `TMDB_API_KEY` n'a jamais été renseignée : le lookup vidéo est inopérant.
- Pas de statistiques, pas d'import Spotify — retirés lors de la fusion.
