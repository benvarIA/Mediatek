# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un foyer, une collection. Le propriétaire de la collection et les personnes qui vivent
avec lui. Pas de comptes, pas de rôles, pas d'invités distants : l'app est servie sur le
réseau local et par Tailscale, et tout le monde qui y accède est de la maison.

Deux scènes d'usage également réelles, confirmées par l'utilisateur :

- **Assis, grand écran, le soir.** Session longue. On saisit une acquisition, on lit une
  fiche de pressage en entier, on parcourt les rayons.
- **Debout devant l'étagère, téléphone en main.** Une main tient une pochette, l'autre
  l'écran. On choisit, on pose un disque, on surveille la file. Rien ne peut dépendre du
  survol ; tout doit être atteignable au pouce.

Ce ne sont pas deux tailles du même écran : ce sont deux usages différents qui méritent
chacun leur traitement.

## Product Purpose

Cataloguer une collection physique de musique et de films (CD, vinyle, DVD, Blu-ray),
aider à décider quoi mettre ce soir, et faire remonter l'écoute physique sur Last.fm
piste par piste, en temps réel.

Succès : on sait ce qu'on possède, on choisit vite, et une écoute de vinyle apparaît sur
Last.fm avec les bons horaires sans qu'on ait rien à faire pendant qu'elle tourne.

## Positioning

Un catalogue d'objets physiques qui **sait ce qui tourne en ce moment**.

Les trois voisins ne font chacun qu'un tiers du travail : Discogs catalogue mais ne joue
rien ; Last.fm enregistre les écoutes mais ignore l'existence d'une étagère ; les
scrobblers d'albums envoient un lot de pistes d'un coup, sans rapport avec le temps réel.
Ici l'ordonnanceur étale les pistes sur la durée réelle de la face, avec des intervalles
variables, à partir d'une fiche de pressage que l'utilisateur possède vraiment.

## Operating Context

Trois gestes, à égalité — aucun ne domine, et le passage de l'un à l'autre doit être
immédiat :

1. **Cataloguer** une acquisition (retour de disquaire ou de vide-grenier) — recherche
   Discogs, pré-remplissage, fiche enrichie.
2. **Choisir** quoi écouter ou regarder — parcours, filtres, ou tirage au sort.
3. **Poser et scrobbler** — l'album part dans une file qui égrène les pistes en temps
   réel vers Last.fm.

Environnement : réseau local + Tailscale, un seul foyer, usage majoritairement le soir.
L'app tourne en continu sur un Mac Mini ; la file doit continuer d'avancer même quand
personne n'a d'onglet ouvert.

## Capabilities and Constraints

**Existant et confirmé**

- React 19 + TypeScript + Vite (client) · Express 5 + TypeScript + better-sqlite3 (serveur).
- Base SQLite `items` : musique et vidéo, plus 13 colonnes d'enrichissement disque
  (n° de catalogue, pays, styles, code-barres, année d'origine, format détaillé, crédits,
  popularité/valeur, vidéos, description, bio artiste, id Discogs, verso de pochette).
- Sources : **Discogs** en principal (token requis), MusicBrainz en secours, TMDB pour la
  vidéo, Cover Art Archive pour les pochettes.
- Last.fm : Web Auth flow (token → session key), clé de session persistée côté serveur
  pour que l'ordonnanceur puisse scrobbler sans navigateur ouvert.
- Ordonnanceur de scrobbles : tick de 5 s, intervalle aléatoire de 20 à 40 s entre pistes,
  replanification séquentielle au redémarrage, anti-doublon par (artiste, album).
- Nettoyage Last.fm : liste d'artistes à retirer, suppression via pilotage Playwright de
  l'interface web de Last.fm (l'API Last.fm n'offre pas de suppression).
- Interface entièrement en français.

**Décidé en négatif** (à ne pas réintroduire sans nouvelle décision)

- Pas d'import Spotify — et donc plus d'OAuth Spotify, plus de certificat auto-signé,
  plus de HTTPS de développement.
- Pas de page Statistiques en v1.
- Pas d'authentification ni de multi-utilisateur.

**Contraintes techniques**

- Un seul port client et un seul port API après fusion (3005 / 8002 en production).
- L'ordonnanceur doit vivre dans le serveur Express, pas dans le serveur de développement
  Vite, sous peine de geler quand le front est arrêté.
- Quotas Discogs : environ 60 requêtes/minute ; une fiche détaillée coûte 3 appels.
- Le scan de code-barres à la caméra, s'il est fait un jour, exigera un contexte sécurisé
  et donc le retour du HTTPS. À anticiper, pas à construire.

**Nom**

- L'application fusionnée s'appelle **Mediatek** (décidé le 7 août 2026).
  « BibliAnalogique » ne survit pas à la fusion. Le nom joue sur « médiathèque » tout en
  se lisant comme un bloc de marque d'équipement audio — le catalogue et la machine dans
  un seul mot.
- À savoir : MediaTek est par ailleurs un fondeur de semi-conducteurs taïwanais. Sans
  conséquence pour une app de foyer servie sur réseau privé et jamais publiée ; à
  reconsidérer uniquement si l'app devait un jour être diffusée hors du foyer.

## Brand Commitments

- Langue d'interface : français, tutoiement, ton de collectionneur — pas de jargon
  logiciel visible.
- Aucune contrainte visuelle héritée. L'identité précédente (vert de bibliothèque
  anglaise, laiton, EB Garamond, grain de papier) est explicitement remplacée et sert
  d'anti-référence, pas d'autorité.
- Aucun logo, aucune charte, aucun actif de marque existant à préserver.

## Evidence on Hand

- La collection réelle en base SQLite (`server/data/bibli.sqlite`, gitignorée) : titres,
  artistes, pochettes, tracklists, données de pressage Discogs authentiques.
- Un compte Last.fm réel avec son historique.
- Une liste d'artistes à retirer réelle (`blacklist.json`, 30+ entrées).
- Aucune donnée à inventer : toute démonstration doit s'appuyer sur la base réelle. Pas
  de témoignages, pas de chiffres de vente, pas de métriques d'usage — ils n'existent pas.

## Product Principles

1. **Le catalogue et la platine sont un seul objet.** Toute frontière visible entre
   « ce que je possède » et « ce qui tourne » est une couture à effacer, pas une
   architecture à défendre.
2. **La connexion Last.fm ne garde que le scrobble.** On consulte, on ajoute et on tire
   au sort sans compte ; seul l'envoi vers Last.fm en demande un.
3. **Le temps est une donnée de première classe.** L'app connaît l'heure de chaque piste,
   passée et à venir. C'est ce qu'elle a d'unique — ça doit se voir, pas se déduire.
4. **Deux scènes, deux traitements.** Le téléphone debout et l'écran assis ne sont pas la
   même app rétrécie.
5. **Rien ne se perd en silence.** Une file qui gèle, un scrobble qui échoue, un serveur
   absent : l'état dégradé se dit, il ne se devine pas.

## Accessibility & Inclusion

- `prefers-reduced-motion` est respecté (déjà en place) et le reste : le mouvement
  continu de la platine doit pouvoir s'arrêter.
- Usage debout à une main : cibles tactiles d'au moins 44 px, aucune fonction accessible
  uniquement au survol.
- Faible luminosité ambiante en usage du soir — le contraste doit tenir sans éblouir.
