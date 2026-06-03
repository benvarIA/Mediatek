# BibliAnalogique — Specs techniques, UI/UX & fonctionnelles

> Gestion de collection physique multimédia : CDs, Vinyles, DVDs et Blu-rays. Cataloguer, explorer, et choisir quoi écouter ou regarder ce soir.

**Date de rédaction :** 2026-06-03
**Statut :** Fonctionnel
**Stack :** React 19 + TypeScript + Vite + React Router 7 + Axios (client) · Express 5 + TypeScript + better-sqlite3 (serveur) · APIs MusicBrainz + Cover Art Archive + TMDB
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
    db.ts            → initialisation SQLite + schéma (CREATE TABLE + trigger)
    routes/
      items.ts       → CRUD complet + GET /random
      lookup.ts      → recherche par code-barres (MusicBrainz puis TMDB)
    index.ts         → serveur Express
  data/bibli.sqlite  → base SQLite (gitignorée)
```

Le client Vite proxifie `/api` → serveur Express.

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
| watched_or_listened | INTEGER | 0/1 — vu/écouté |
| **Musique** | | |
| label | TEXT? | label / maison de disques |
| tracklist | TEXT | JSON array |
| duration_total_sec | INTEGER? | durée totale en secondes |
| vinyl_format | TEXT? | 33t / 45t / 78t / picture disc… |
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
| GET | `/items` | Liste avec filtres : `type`, `support`, `genre`, `decade`, `state`, `unwatched`, `search`, `sort` |
| GET | `/items/random` | Tirage aléatoire avec les mêmes filtres (sauf `search`/`sort`) |
| GET | `/items/:id` | Détail d'un item |
| POST | `/items` | Création (type + support + title obligatoires) |
| PUT | `/items/:id` | Mise à jour complète |
| DELETE | `/items/:id` | Suppression |

**Tri (`sort`) :** `title` (A-Z) · `year` (décroissant) · `added` (created_at décroissant, défaut)

### Lookup (`/api/lookup`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/lookup/barcode/:code` | Recherche par code-barres — MusicBrainz en priorité, TMDB en fallback |

La route lookup retourne un objet pré-rempli (`source`, `type`, `title`, `year`, `artist_or_director`, `cover_url`, éventuellement `label`, `synopsis`, `mbid`/`tmdb_id`).

---

## 5. Specs fonctionnelles

### 5.1 Bibliothèque (`/`) — `LibraryPage`
- [x] Affichage en grille (pochettes) ou liste (toggle ⊞ / ☰)
- [x] Filtres : support (CD/Vinyle/DVD/Blu-ray), type (musique/vidéo), décennie, non vu/écouté
- [x] Recherche textuelle (titre, artiste, réalisateur)
- [x] Tri : ajout récent (défaut), titre A-Z, année
- [x] Compteur d'items affiché dans le titre

### 5.2 Ajout (`/add`) — `AddPage`
- [x] Formulaire complet : type, support, titre, artiste/réalisateur, année, genres, état, notes
- [x] Champs conditionnels selon le type (musique : label, tracklist, format vinyle · vidéo : synopsis, durée, casting, langue, sous-titres, extras)
- [x] Recherche par **code-barres** (saisie) → auto-remplissage via MusicBrainz ou TMDB
- [x] Upload / URL de couverture manuelle si auto-remplissage échoue

### 5.3 Détail (`/items/:id`) — `ItemDetailPage`
- [x] Grande illustration de couverture
- [x] Toutes les métadonnées
- [x] Tracklist (musique) / Casting (vidéo)
- [x] Notes personnelles éditables
- [x] Marquer comme vu/écouté
- [x] Modification et suppression

### 5.4 Surprise (`/surprise`) — `SurprisePage` ⭐
- [x] Titre : « 🎲 Qu'est-ce qu'on met ce soir ? »
- [x] Filtres applicables avant le tirage : type, support, décennie, non vu/écouté
- [x] Bouton tirage → `GET /api/items/random` avec les filtres actifs
- [x] Résultat affiché avec animation (classe `revealed`)
- [x] Message d'erreur si aucun item ne correspond aux filtres
- [x] Lien vers le détail de l'item tiré

---

## 6. UI / UX

- **Layout** : `Layout.tsx` avec navigation (Bibliothèque / Ajouter / Surprise), `ItemCard.tsx` pour les cartes grille.
- **Responsive** : grille CSS adaptive.
- Pochettes via `cover_url` stockée en base ; fallback placeholder si absente.

---

## 7. Variables d'environnement

```env
# server/.env.local
TMDB_API_KEY=xxx     # optionnel — lookup vidéo par code-barres

# client/.env.local
VITE_API_URL=http://localhost:XXXX   # URL du serveur Express
```

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

- Scan code-barres via caméra (mobile)
- Enrichissement automatique des métadonnées existantes
- Statistiques (répartition par genre, décennie, timeline)
- Export CSV / JSON de la collection
- PWA / mode hors-ligne
