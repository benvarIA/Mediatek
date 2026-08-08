---
name: Mediatek
description: Une chaîne hi-fi qui catalogue les disques et sait lequel tourne en ce moment.
colors:
  chassis: "#17181A"
  panel: "#26282B"
  panel-milled: "#33363A"
  bezel: "#0B0C0D"
  well: "#0E0F10"
  engrave-ink: "#0A0B0C"
  engrave-light: "#6E7378"
  legend: "#A8AEB4"
  legend-dim: "#969CA2"
  legend-strong: "#E4E8EB"
  led-amber: "#FF9A1F"
  led-amber-dim: "#7A4A0F"
  led-green: "#5FD07A"
  led-red: "#E23B2E"
  led-red-text: "#FF6B5C"
typography:
  display:
    fontFamily: "Barlow Condensed, DIN Alternate, Oswald, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "0.06em"
  headline:
    fontFamily: "Barlow Condensed, DIN Alternate, sans-serif"
    fontWeight: 600
    fontSize: "1.25rem"
    lineHeight: 1.05
    letterSpacing: "0.08em"
  label:
    fontFamily: "Barlow Condensed, DIN Alternate, sans-serif"
    fontWeight: 600
    fontSize: "0.6875rem"
    letterSpacing: "0.16em"
  body:
    fontFamily: "Barlow, Helvetica Neue, sans-serif"
    fontWeight: 400
    fontSize: "0.9375rem"
    lineHeight: 1.45
  numeral:
    fontFamily: "Barlow, Helvetica Neue, sans-serif"
    fontWeight: 500
    fontFeature: "tnum"
    letterSpacing: "0.02em"
---

<!-- SEED: monde établi avec l'utilisateur avant implémentation ; relancer /impeccable document une fois le code écrit pour extraire les vrais tokens et générer le sidecar. -->

# Design System: Mediatek

## Overview

**Creative North Star : « La Chaîne »**

Une chaîne hi-fi à éléments séparés, ramenée à un seul châssis. L'application n'est pas
un site qui parle de disques : c'est un appareil qui en contient et qui en joue. Tout ce
qu'on voit est de la matière — panneaux d'aluminium brossé vissés sur un châssis
anodisé noir, légendes gravées, puits encastrés derrière verre, et de l'ambre qui ne
s'allume que sur ce qui vit à l'instant présent.

Le châssis est noir, pas beige. La scène d'usage l'impose : on s'en sert le soir, en
lumière basse, parfois debout devant l'étagère. La façade beige de 1978 vit en plein
jour ; la façade noire anodisée à brossage directionnel — Nakamichi, Revox B215,
Technics de fin de série — est le même monde dans sa version du soir. L'ambre y chante,
le contraste tient sans éblouir.

La tension centrale du système est **métal contre puits**. Le métal est la machine :
panneaux, légendes, contrôles, tout ce qui est de l'interface. Le puits est le contenu :
pochettes, listes, champs de saisie, tout ce qui appartient à la collection est encastré
derrière un liseré sombre, comme la fenêtre de cassette d'une platine. Rien ne flotte.
Une pochette d'album n'est pas une carte posée sur un fond, c'est une plaque montée dans
le panneau. C'est ce qui permet à un mur de 300 pochettes photographiques de vivre sur
une façade en aluminium sans la contredire.

Anti-références confirmées : la médiathèque gris-anthracite à grille de pochettes
flottantes (Plex, Jellyfin, Discogs), et la nostalgie vinyle en papier crème, sérif de
librairie et texture de tampon usé — cette dernière étant l'identité précédente de cette
même application, explicitement remplacée.

**Key Characteristics :**
- Châssis noir anodisé, panneaux d'aluminium brossé, ambre réservé au vivant
- Deux états de relief seulement : panneau en relief, puits en creux
- Légendes gravées en capitales étroites très espacées, jamais en noir pur
- Le contenu est toujours encastré, jamais posé
- Les contrôles sont des bascules, des sélecteurs à positions et des molettes crantées
- Chiffres tabulaires partout ; l'heure est une donnée de premier plan

## Colors

Une façade métallique achromatique, percée par une seule couleur vivante. Le système est
volontairement presque monochrome pour que l'ambre porte toute l'information d'état.

### Primary
- **Ambre LED** (`#FF9A1F`) : l'unique couleur d'accent. Elle ne signale qu'une chose,
  l'activité en cours — la piste qui part, l'album dans la file, le mode sélectionné,
  l'échelle qui grimpe. Elle n'est jamais décorative, jamais une marque, jamais un survol.
- **Ambre éteint** (`#7A4A0F`) : la même diode non alimentée. Les segments d'échelle non
  atteints, les positions non sélectionnées d'un sélecteur.

### Secondary
- **Vert transport** (`#5FD07A`) : uniquement l'état « en marche » et la confirmation —
  la piste scrobblée, le serveur joignable. Jamais un bouton.
- **Rouge REC** (`#E23B2E`) : uniquement le destructif — retirer un disque de la
  collection, supprimer des scrobbles, annuler une file. C'est le bouton d'enregistrement
  d'une platine : le seul qu'on regarde deux fois avant d'appuyer. En **aplat uniquement** :
  à 3,2:1 sur le panneau il est illisible en texte, d'où le rouge clair ci-dessous.
- **Rouge de texte** (`#FF6B5C`) : le même rôle, quand c'est du texte ou une icône de
  trait. 4,95:1 sur le panneau.

### Neutral
- **Châssis** (`#17181A`) : le corps de l'appareil, fond de page, bords et entretoises.
- **Panneau** (`#26282B`) : l'aluminium brossé des plaques, avec un dégradé directionnel
  de `#33363A` en haut à `#1E2023` en bas simulant le brossage horizontal.
- **Liseré** (`#0B0C0D`) : le bord noir d'un puits, toujours 1px, toujours net.
- **Puits** (`#0E0F10`) : le fond encastré qui reçoit le contenu.
- **Légende** (`#A8AEB4`) : la sérigraphie au repos. 6,2:1 sur le panneau.
- **Légende sourde** (`#969CA2`) : les légendes secondaires et les valeurs de second plan.
  5,0:1 sur le panneau — c'est le plancher, on ne descend pas en dessous. La première
  version de ce système utilisait `#6E7378`, qui tombait à 2,9:1 et rendait illisible la
  moitié des étiquettes de contrôle.
- **Légende vive** (`#E4E8EB`) : l'élément sélectionné ou survolé.

### Named Rules

**La règle de l'ambre.** L'ambre n'éclaire que ce qui se passe *maintenant*. Si l'élément
serait identique dans une capture d'écran prise dans une heure, il n'est pas ambre. Sur
un écran donné, l'ambre ne dépasse jamais 5 % de la surface — sa rareté est l'information.

**La règle du rouge.** Le rouge est le bouton REC : destructif, et rien d'autre. Une
erreur de saisie n'est pas rouge, elle est ambre clignotante. Un champ obligatoire n'est
pas rouge.

**La règle de la sérigraphie.** Sur une façade noire anodisée, une légende n'est pas
gravée en creux, elle est **sérigraphiée par-dessus** : encre claire (`#A8AEB4`) doublée
d'une ombre sombre d'1px vers le **haut** (`rgba(0,0,0,.65)`), qui l'assoit dans le métal.
C'est ce liseré sombre supérieur qui fait la différence entre du métal sérigraphié et du
texte gris posé sur un aplat.

**La règle de l'afficheur.** Un témoin LED — compteur, horloge, heure de fin — est
toujours encastré dans un puits. La trame de points qui le rend crédible n'est lisible que
si la couleur des points est celle du fond du puits ; posé à plat sur une plaque, un
afficheur devient un rectangle sombre illisible. Contrôlé au rendu : aucun `.lcd` ne doit
exister hors d'un `.readout`.

## Typography

**Display / légendes :** Barlow Condensed (repli DIN Alternate, Oswald)
**Corps / valeurs :** Barlow (repli Helvetica Neue)
**Chiffres :** Barlow en chiffres tabulaires (`font-variant-numeric: tabular-nums`)

**Character :** Une seule famille, deux chasses, une discipline stricte de rôle. Barlow
Condensed est de lignée DIN — la norme industrielle allemande qui a légendé des décennies
de matériel audio ; elle porte les capitales étroites, très espacées, des sérigraphies de
façade. Barlow en chasse normale porte tout ce qui est du contenu réel : titres d'album,
noms d'artiste, métadonnées Discogs denses. La tension ne vient pas d'un contraste de
familles mais du contraste **capitale gravée / valeur imprimée**.

### Hierarchy
- **Display** (700, `clamp(1.75rem, 4vw, 3rem)`, interlignage 0.92, +0.06em, capitales) :
  le bloc de marque et le titre du mode courant. Jamais plus d'un par écran.
- **Headline** (600, 1.25rem, +0.08em, capitales) : titres de panneau — RAYONS, PLATINE,
  FILE D'ATTENTE, PRESSAGE.
- **Label** (600, 0.6875rem, +0.16em, capitales) : toute légende de contrôle. C'est la
  voix par défaut de l'interface — sous chaque bascule, chaque sélecteur, chaque colonne.
- **Body** (400, 0.9375rem, 1.45) : titres d'album, artistes, synopsis, crédits,
  description de pressage. Longueur de ligne maximale 68ch.
- **Numeral** (500, tabulaire) : durées, heures, compteurs, années, n° de catalogue.

### Named Rules

**La règle de la légende.** Tout ce qui décrit un contrôle est en capitales étroites
espacées à +0.16em, taille 11px, jamais plus grand. Une légende qui grossit cesse d'être
une sérigraphie et devient un titre : c'est le premier symptôme d'une façade qui se
dissout en page web.

**La règle des chiffres.** Toute donnée numérique est tabulaire, sans exception. Une
colonne d'heures qui tremble d'une ligne à l'autre trahit l'appareil.

## Layout

Un châssis fixe en trois bandeaux horizontaux, identique dans tous les modes :

1. **Rail de marque** (hauteur fixe, ~64px) : bloc de marque à gauche, **sélecteur de
   mode** au centre, état Last.fm et alimentation à droite. Le sélecteur de mode n'est pas
   une barre d'onglets : c'est un sélecteur à positions, comme le TYPE I / II / IV d'une
   platine, avec une diode ambre sur la position active.
2. **Grand puits** : la zone encastrée qui reçoit le contenu du mode courant. C'est la
   seule zone qui défile.
3. **Bandeau de transport** (hauteur fixe, ~88px, toujours visible) : ce qui tourne en ce
   moment — pochette miniature derrière verre, titre, échelle ambre, compteur, heure de
   fin. Vide, il affiche `— — : — —` et la mention ARRÊT. C'est ce bandeau qui remplace
   intégralement l'ancien menu déroulant « Now Playing ».

Le grand puits utilise une grille de panneaux à gouttières fraisées (2px de châssis
visible entre deux plaques), pas des marges. Les panneaux se touchent presque : la densité
est celle d'une façade, pas celle d'une page.

**Responsive.** Le châssis se restructure en plaques boulonnées empilées. Sous 768px, le
sélecteur de mode quitte le rail de marque et fusionne avec le bandeau de transport en bas
d'écran — le pouce trouve les quatre modes et l'état de lecture au même endroit. Le grand
puits passe en pleine largeur. Aucune fonction ne dépend du survol : toute action
accessible au survol sur grand écran a une contrepartie tactile permanente.

## Elevation & Depth

Le système n'a que **deux reliefs**, et ils sont exactement inverses l'un de l'autre.

- **Panneau en relief** : ombre portée basse + liseré clair sur l'arête haute. C'est de
  l'aluminium vissé par-dessus le châssis.
- **Puits en creux** : ombre interne haute + liseré clair sur l'arête basse. C'est une
  découpe dans le panneau.

Il n'existe pas de troisième niveau, pas d'ombre flottante, pas de carte qui lévite au
survol. Une superposition (menu, boîte de dialogue) n'est pas une carte plus haute : c'est
**la porte du logement qui s'ouvre**, une plaque qui bascule et masque le puits derrière
elle.

### Shadow Vocabulary
- **Relief** (`box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 2px 4px rgba(0,0,0,.5)`) :
  toute plaque d'aluminium.
- **Creux** (`box-shadow: inset 0 2px 6px rgba(0,0,0,.75), 0 1px 0 rgba(255,255,255,.05)`) :
  tout puits.
- **Diode** (`box-shadow: 0 0 6px rgba(255,154,31,.55)`) : le halo d'une LED allumée, et
  uniquement d'une LED.

### Named Rules

**La règle du puits.** Tout ce qui n'est pas de la machine est encastré. Une pochette, une
liste, un champ de saisie, un bloc de texte : en creux, derrière un liseré. Si un élément
de contenu est posé à plat sur le panneau, la façade est cassée.

## Shapes

Presque carré. Rayon de 2px sur les plaques, 3px sur les touches, 0px sur l'arête interne
d'un puits — un puits est fraisé, pas arrondi. Les plaques portent des vis apparentes à
leurs angles quand elles délimitent une zone fonctionnelle majeure (rail de marque, grand
puits, bandeau de transport) et n'en portent pas ailleurs : la vis indique une frontière
structurelle, elle n'est pas un motif.

Les touches de transport sont rectangulaires à angles très légèrement adoucis, plus larges
que hautes, avec un biseau haut clair et un biseau bas sombre. Les bascules sont des
rectangles verticaux à deux positions avec la légende à droite. Les sélecteurs à positions
sont une colonne de pastilles avec la légende alignée à droite de chacune.

## Do's and Don'ts

### Do:
- **Do** encastrer tout contenu dans un puits à liseré 1px (`#0B0C0D`).
- **Do** sérigraphier chaque légende : encre claire doublée d'une ombre sombre d'1px vers
  le haut, qui l'assoit dans le métal.
- **Do** encastrer tout afficheur LED dans un puits, sans exception.
- **Do** réserver l'ambre `#FF9A1F` au vivant, sous 5 % de la surface d'un écran.
- **Do** tenir toute donnée numérique en chiffres tabulaires.
- **Do** exprimer un choix parmi 3 à 5 options comme un sélecteur à positions avec diode,
  pas comme un menu déroulant.
- **Do** rendre le brossage de l'aluminium par un dégradé directionnel horizontal, jamais
  par une texture bitmap.
- **Do** garder le bandeau de transport visible dans tous les modes, y compris à l'arrêt.

### Don't:
- **Don't** poser une carte à ombre flottante sur le panneau — le système n'a que deux
  reliefs, et ils sont inverses.
- **Don't** utiliser le rouge pour autre chose que le destructif.
- **Don't** faire clignoter ou pulser une diode pour attirer l'attention ; une diode
  ambre est allumée ou éteinte, et son passage se fait en 80ms sans courbe d'accélération.
- **Don't** agrandir une légende de contrôle au-delà de 11px.
- **Don't** descendre une couleur de texte sous 4,5:1 sur le panneau `#2A2D30` — c'est
  la valeur de référence du système, pas le puits, qui est plus indulgent.
- **Don't** introduire une seconde famille typographique, en particulier un sérif.
- **Don't** ramener du beige, du crème ou du bois : ce monde a une version du soir, c'est
  celle-là.
- **Don't** simuler le métal par une image ; tout le matériau se fait en dégradés et
  ombres CSS, ce qui le garde net à toute densité de pixels.
