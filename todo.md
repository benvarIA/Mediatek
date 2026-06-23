# BibliAnalogique — TODO

Suivi des tâches. Voir [`specs.md`](specs.md) pour les specs détaillées et [`PLAN.md`](PLAN.md) pour le plan d'origine.

---

## ✅ Fait

### Intégration Discogs + enrichissement « disque » (2026-06-09)
- [x] Discogs comme **source principale** pour la musique (repli MusicBrainz automatique si vide / token absent)
- [x] Routes serveur `GET /lookup/discogs?q=…` (liste + vignettes) et `GET /lookup/discogs/:id` (fiche enrichie : release + master + artiste)
- [x] Migration SQLite non destructive (`ALTER TABLE`) : `catalog_no`, `country`, `styles`, `barcode`, `original_year`, `format_detail`, `credits`, `community`, `videos`, `description`, `artist_bio`, `discogs_id`, `back_cover_url`
- [x] Persistance des nouveaux champs dans `POST`/`PUT /items` + parsing JSON en lecture
- [x] `AddPage` : recherche Discogs prioritaire, résultats **avec pochettes**, pré-remplissage enrichi
- [x] `ItemDetailPage` : blocs **Pressage**, **Crédits**, **Popularité & valeur**, **Vidéos (YouTube)**, **Bio artiste**, **Description**
- [x] Fix `dotenv` : chargement explicite de `.env.local` puis `.env` dans `index.ts` (corrige aussi `TMDB_API_KEY` jamais lue auparavant)
- [x] Token Discogs en place dans `server/.env.local`
- [x] Vérifié : typecheck client + serveur OK, test bout-en-bout recherche → fiche → création → relecture → suppression

---

## 🔜 À faire — enrichissement disque

- [ ] **Durées de pistes** : fusionner MusicBrainz quand Discogs ne fournit pas les durées (fréquent sur vinyles) → tracklist + `duration_total_sec` fiables
- [ ] **Scan code-barres → Discogs** : la route `/lookup/barcode/:code` n'interroge que MusicBrainz ; ajouter Discogs (`?barcode=…`) en priorité pour récupérer le pressage exact
- [ ] (Option) Résumé **Wikipédia** (FR, sans clé) en complément de la bio Discogs pour le contexte / la réception

## 🔜 À faire — autres (roadmap specs)

- [ ] Scan code-barres via caméra (mobile)
- [ ] Statistiques (répartition par genre, décennie, timeline d'ajouts)
- [ ] Export CSV / JSON de la collection
- [ ] PWA / mode hors-ligne

## 🚧 En cours (hors session Discogs)

- [ ] **Scrobbler Last.fm** : `client/src/scrobbler.ts` + bouton « scrobble » dans `ItemDetailPage` (travail en cours, à finaliser/tester)

---

## ⚠️ Notes / limites connues

- **« Ventes »** : aucune API gratuite ne fournit un chiffre de ventes fiable. Le bloc *have / want* de Discogs sert de proxy de popularité & rareté.
- **Prix d'occasion** : `lowest_price` récupéré en EUR (`curr_abbr=EUR`) ; dépend de l'offre marché du moment.
- **Quotas Discogs** : ~60 req/min avec token. Une fiche détail = 3 appels (release + master + artiste).
