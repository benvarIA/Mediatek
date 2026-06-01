# BibliAnalogique — Plan de l'application

Application de gestion de collection physique : CDs, Vinyles, DVDs et Blu-rays.

---

## Objectif général

Une app web locale pour cataloguer, explorer et choisir quoi écouter ou regarder ce soir,
avec toutes les infos et illustrations au même endroit.

---

## Types de médias gérés

- **Musique** : CD, Vinyle (33t, 45t, 78t)
- **Vidéo** : DVD, Blu-ray

---

## Fonctionnalités principales

### 1. Ajout d'un élément

- Recherche par code-barres (scan ou saisie manuelle) → auto-remplissage via API
  - Musique : MusicBrainz + Cover Art Archive
  - Films : TheMovieDB (TMDB) ou Open Movie Database (OMDB)
- Ajout manuel complet si introuvable
- Champs communs :
  - Titre, artiste/réalisateur, année, genre(s), support (CD / Vinyle / DVD / Blu-ray)
  - Illustration de couverture (auto ou upload manuel)
  - État (neuf, bon état, usagé)
  - Notes personnelles
- Champs spécifiques musique :
  - Label, tracklist, durée totale, format vinyle (33t / 45t / picture disc…)
- Champs spécifiques film :
  - Synopsis, durée, casting principal, langue(s), sous-titres, bonus

### 2. Vue détail d'un élément

- Grande illustration de couverture
- Toutes les métadonnées
- Synopsis (films) ou description de l'album
- Tracklist (musique)
- Note personnelle éditable

### 3. Bibliothèque / Catalogue

- Vue grille (pochettes) ou liste
- Filtres :
  - Type de support (CD / Vinyle / DVD / Blu-ray)
  - Genre (Rock, Jazz, Classique, Thriller, Comédie…)
  - Décennie / Année
  - État
  - Vu/Écouté ou non
- Recherche textuelle (titre, artiste, réalisateur)
- Tri : alphabétique, année, date d'ajout

### 4. Mode Aléatoire — "Qu'est-ce qu'on met ce soir ?"

- Bouton "Surprise !" qui tire un élément au hasard
- Filtres applicables avant le tirage :
  - Type de média
  - Genre
  - Durée (~90 min pour un film en semaine, etc.)
  - Décennie
  - Pas encore vu/écouté
- Affichage plein écran du résultat avec toutes les infos (vibe "pochette de disque")
- Bouton "Autre" pour re-tirer sans fermer le mode

---

## Stack technique envisagée

- **Frontend** : React + Vite + TypeScript
- **Backend** : Node.js / Express
- **Base de données** : SQLite (local, simple, portable)
- **APIs externes** :
  - MusicBrainz (musique, gratuit, no-key)
  - Cover Art Archive (pochettes musique)
  - TMDB (films, clé API gratuite)
- **Port** : à assigner dans le registre de ports du projet

---

## Structure de données (ébauche)

```
Item {
  id, type (music|video), support (cd|vinyl|dvd|bluray)
  title, year, genres[], cover_url
  artist_or_director, notes, state, watched_or_listened
  -- musique : label, tracklist, vinyl_format
  -- film : synopsis, duration_min, cast[], language, subtitles
  created_at, updated_at
}
```

---

## Priorités de développement (ordre suggéré)

1. Base de données + modèle de données
2. Ajout manuel d'un élément (formulaire)
3. Vue bibliothèque (grille + filtres basiques)
4. Intégration API auto-remplissage (TMDB + MusicBrainz)
5. Vue détail
6. Mode Aléatoire avec filtres
7. Polish UI (animations, mode sombre, responsive)

---

## À décider plus tard

- Authentification (multi-utilisateur ou solo ?)
- Export CSV / JSON de la collection
- Stats (nombre d'items, répartition par genre, timeline d'ajouts)
- Application mobile (PWA ?)
- Scan code-barres depuis téléphone
