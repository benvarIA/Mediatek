# BibliAnalogique — Specs techniques, UI/UX & fonctionnelles

> Gestion de collection physique multimédia : CDs, Vinyles, DVDs et Blu-rays. Cataloguer, explorer, et choisir quoi écouter ou regarder ce soir.

**Date de rédaction :** 2026-06-03 · **Dernière mise à jour :** 2026-06-13 (Now Playing widget · suppression Écouté/Vu)
**Statut :** Fonctionnel
**Stack :** React 19 + TypeScript + Vite + React Router 7 + Axios (client) · Express 5 + TypeScript + better-sqlite3 (serveur) · APIs **Discogs** (musique, source principale) + MusicBrainz / Cover Art Archive (secours) + TMDB (vidéo)
**Structure :** monorepo `client/` + `server/`

---

## 1. Contexte & Problème

Une collection physique de musique et de films éparpillée sur des étagères est difficile à exploiter : on ne sait plus ce qu'on possède, et choisir « quoi mettre ce soir » prend trop de temps. **BibliAnalogique** est une app web locale pour **cataloguer**, **explorer** et **piocher** dans sa collection, avec toutes les infos et illustrations au même endroit.

Son cas d'usage signature : la page **« Qu'est-ce qu'on met ce soir ? »** — tirage aléatoire avec filtres.

---

## 2. Architecture

```
client/              → React 19 + TypeScript + Vite + React Router 7
  src/
    api.ts           → toutes les fonctions d'appel API (axios)
    pages/           → LibraryPage, AddPage, ItemDetailPage, SurprisePage
    components/      → ItemCard, Layout
server/              → Express 5 + TypeScript + better-sqlite3
  src/
    db.ts            → schéma SQLite (CREATE TABLE + trigger) + migrations ALTER TABLE non destructives
    routes/
      items.ts       → CRUD complet + GET /random
      lookup.ts      → recherche musique (Discogs principal, MusicBrainz secours) + vidéo (TMDB) + code-barres
    index.ts         → serveur Express (charge `.env.local` puis `.env`)
  data/bibli.sqlite  → base SQLite (gitignorée)
```

Le client Vite proxifie `/api` → serveur Express.

> **Chargement env** : `index.ts` appelle `dotenv.config()` explicitement sur `.env.local` (prioritaire) puis `.env`. `dotenv` ne lit **que `.env`** par défaut — d'où le chargement manuel pour que `DISCOGS_TOKEN` / `TMDB_API_KEY` placés dans `.env.local` soient bien lus.

---

## 3. Modèle de données (SQLite — `server/src/db.ts`)

Table `items` :

| Champ | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| type | TEXT | `music` · `video` |
| support | TEXT | `cd` · `vinyl` · `dvd` · `bluray` |
| title | TEXT | |
| year | INTEGER? | |
| genres | TEXT | JSON array `["Rock", "Jazz"…]` |
| cover_url | TEXT? | URL pochette |
| artist_or_director | TEXT? | |
| notes | TEXT | notes personnelles |
| state | TEXT | `neuf` · `bon_etat` · `use` |
| **Musique** | | |
| label | TEXT? | label / maison de disques |
| tracklist | TEXT | JSON array |
| duration_total_sec | INTEGER? | durée totale en secondes |
| vinyl_format | TEXT? | 33t / 45t / 78t / picture disc… |
| **Musique — enrichissement disque (Discogs)** | | |
| catalog_no | TEXT? | n° de catalogue du pressage |
| country | TEXT? | pays de pressage |
| styles | TEXT | JSON array — styles fins (Hard Bop, French House…) |
| barcode | TEXT? | code-barres du pressage |
| original_year | INTEGER? | année de sortie originale (master Discogs) |
| format_detail | TEXT? | format détaillé (« 2×Vinyl, LP, Album, Gatefold ») |
| credits | TEXT | JSON array `[{role, names[]}]` — compositeur, producteur, mixage… |
| community | TEXT? | JSON `{have, want, rating, rating_count, lowest_price, num_for_sale}` |
| videos | TEXT | JSON array `[{title, url, duration}]` — liens YouTube |
| description | TEXT? | notes / description du pressage |
| artist_bio | TEXT? | résumé / bio de l'artiste |
| discogs_id | INTEGER? | id de la release Discogs |
| back_cover_url | TEXT? | verso de la pochette |
| **Vidéo** | | |
| synopsis | TEXT? | |
| duration_min | INTEGER? | durée en minutes |
| cast_list | TEXT | JSON array |
| language | TEXT? | |
| subtitles | TEXT? | |
| extras | TEXT? | bonus |
| created_at / updated_at | TEXT | trigger auto-update |

---

## 4. API serveur (`/api/…`)

### Items (`/api/items`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/items` | Liste avec filtres : `type`, `support`, `genre`, `decade`, `state`, `search`, `sort` |
| GET | `/items/random` | Tirage aléatoire avec les mêmes filtres (sauf `search`/`sort`) |
| GET | `/items/:id` | Détail d'un item |
| POST | `/items` | Création (type + support + title obligatoires) |
| PUT | `/items/:id` | Mise à jour complète |
| DELETE | `/items/:id` | Suppression |

**Tri (`sort`) :** `title` (A-Z) · `year` (décroissant) · `added` (created_at décroissant, défaut)

### Lookup (`/api/lookup`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/lookup/discogs?q=…` | **Musique — source principale.** Recherche de pressages (liste avec vignettes de pochette). Nécessite `DISCOGS_TOKEN`. |
| GET | `/lookup/discogs/:id` | Fiche complète enrichie : pressage, crédits, popularité/valeur, vidéos, bio artiste (release + master + artiste Discogs). |
| GET | `/lookup/music?q=…` | Musique — **secours** MusicBrainz (si Discogs vide / token absent). |
| GET | `/lookup/music/:mbid` | Détail MusicBrainz + tracklist + pochette Cover Art Archive. |
| GET | `/lookup/video?q=…` | Vidéo — recherche TMDB. |
| GET | `/lookup/video/:tmdb_id` | Détail TMDB (synopsis, casting, durée…). |
| GET | `/lookup/barcode/:code` | Recherche par code-barres — MusicBrainz en priorité, TMDB en fallback. |
| POST | `/api/scrobble` | Proxy vers ScrobblerVari `POST /api/vinyl/queue` — ajoute un album à la file. |
| GET | `/api/scrobble/queue` | Proxy vers ScrobblerVari `GET /api/vinyl/queue` — lit la file active. |

Les routes lookup retournent un objet pré-rempli (`source`, `type`, `title`, `year`, `artist_or_director`, `cover_url`, + selon la source : `label`, `catalog_no`, `country`, `barcode`, `genres`, `styles`, `tracklist`, `credits`, `community`, `videos`, `artist_bio`, `discogs_id`/`mbid`/`tmdb_id`…).

> **Côté client** (`AddPage`), la recherche musique appelle Discogs en priorité et bascule automatiquement sur MusicBrainz si la réponse est vide.

---

## 5. Specs fonctionnelles

### 5.1 Bibliothèque (`/`) — `LibraryPage`
- [x] Affichage en grille (pochettes) ou liste (toggle ⊞ / ☰)
- [x] Filtres : support (CD/Vinyle/DVD/Blu-ray), type (musique/vidéo), décennie
- [x] Recherche textuelle (titre, artiste, réalisateur)
- [x] Tri : ajout récent (défaut), titre A-Z, année
- [x] Compteur d'items affiché dans le titre

### 5.2 Ajout (`/add`) — `AddPage`
- [x] Formulaire complet : type, support, titre, artiste/réalisateur, année, genres, état, notes
- [x] Champs conditionnels selon le type (musique : label, tracklist, format vinyle · vidéo : synopsis, durée, casting, langue, sous-titres, extras)
- [x] **Recherche automatique** (titre/artiste) → **Discogs** (musique, avec vignettes de pochette) ou TMDB (vidéo), repli MusicBrainz ; pré-remplissage enrichi (pressage, crédits, popularité, vidéos, bio)
- [x] Recherche par **code-barres** (saisie) → auto-remplissage via MusicBrainz ou TMDB
- [x] Upload / URL de couverture manuelle si auto-remplissage échoue

### 5.3 Détail (`/items/:id`) — `ItemDetailPage`
- [x] Grande illustration de couverture
- [x] Toutes les métadonnées (dont année d'origine vs pressage, pays, durée totale, styles)
- [x] Bloc **Pressage** (musique) : format détaillé, n° catalogue, label, pays, sortie originale, code-barres, lien Discogs
- [x] Tracklist (musique) / Casting (vidéo)
- [x] Bloc **Crédits** : compositeur, producteur, chant, mixage, mastering…
- [x] Bloc **Popularité & valeur** : have / want, note moyenne, prix d'occasion (€)
- [x] Bloc **Écouter / regarder** : liens YouTube · **Bio artiste** · **Description du disque**
- [x] Notes personnelles éditables
- [x] Bouton **Scrobbler sur Last.fm** (musique) → proxy vers ScrobblerVari
- [x] Modification et suppression

### 5.4 Surprise (`/surprise`) — `SurprisePage` ⭐
- [x] Titre : « 🎲 Qu'est-ce qu'on met ce soir ? »
- [x] Filtres applicables avant le tirage : type, support, décennie
- [x] Bouton tirage → `GET /api/items/random` avec les filtres actifs
- [x] Résultat affiché avec animation (classe `revealed`)
- [x] Message d'erreur si aucun item ne correspond aux filtres
- [x] Lien vers le détail de l'item tiré

### 5.5 Now Playing — `NowPlayingWidget` (bandeau)
- [x] Bouton permanent dans la barre de navigation
- [x] Clic → fetch `GET /api/scrobble/queue` avec loader spinner
- [x] Dropdown : liste des albums actifs dans ScrobblerVari (pochette, artiste, album, barre de progression pistes, heure de fin estimée, piste en cours)
- [x] État vide si la file est vide
- [x] Fermeture au clic en dehors du panel

---

## 6. UI / UX

- **Layout** : `Layout.tsx` avec navigation (Bibliothèque / Ajouter / Surprise) + widget Now Playing, `ItemCard.tsx` pour les cartes grille.
- **Responsive** : grille CSS adaptive.
- Pochettes via `cover_url` stockée en base ; fallback placeholder si absente.

---

## 7. Variables d'environnement

```env
# server/.env.local
DISCOGS_TOKEN=xxx          # source principale musique (Settings → Developers sur discogs.com, gratuit)
TMDB_API_KEY=xxx           # optionnel — lookup vidéo (recherche + code-barres)
APP_CONTACT_EMAIL=xxx      # contact pour le User-Agent des API publiques (recommandé par MusicBrainz/Discogs)

# client/.env.local
VITE_API_URL=http://localhost:XXXX   # URL du serveur Express
```

> Sans `DISCOGS_TOKEN`, la recherche musique bascule automatiquement sur MusicBrainz (pochettes/infos de pressage plus limitées).

---

## 8. Commandes

```bash
# Client
cd client && npm run dev

# Serveur
cd server && npm run dev    # nodemon + tsx
```

---

## 9. Hors scope / roadmap

- [x] ~~Enrichissement automatique des métadonnées (Discogs : pochette, pressage, crédits, popularité, vidéos, bio)~~
- [ ] Fusion MusicBrainz pour récupérer les **durées de pistes** souvent absentes de Discogs (vinyles)
- [ ] Brancher le **scan code-barres** (`/lookup/barcode`) sur Discogs en plus de MusicBrainz
- [ ] Scan code-barres via caméra (mobile)
- [ ] Statistiques (répartition par genre, décennie, timeline)
- [ ] Export CSV / JSON de la collection
- [ ] PWA / mode hors-ligne

> Détail des tâches en cours / restantes : voir [`todo.md`](todo.md).
