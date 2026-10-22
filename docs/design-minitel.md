# Direction visuelle : 3615 UNE VIE

L'interface imite un écran de Minitel : fond noir, police pixel, couleurs pures, texte en majuscules, touches de fonction en bas. Chaque couleur a un sens fixe ; on ne l'utilise jamais pour décorer.

## Couleurs

| Jeton | Valeur | Sens |
| --- | --- | --- |
| `--fond` | `#000000` | fond unique |
| `--texte` | `#FFFFFF` | texte courant |
| `--texte-discret` | `#AAAAAA` | précisions, sources, statistiques |
| `--accent` | `#00FFFF` | interface : barre de titre, touches, années du journal |
| `--valeur` | `#FFFF00` | grands titres et valeurs importantes |
| `--alerte` | `#FF55FF` | jeux d'argent, avertissements |
| `--choc` | `#FF3333` | chocs de vie dans le journal |
| `--bien` | `#55FF55` | jauge en bon état |
| `--piste` | `#333333` | fond des jauges, séparateurs |
| `--pointilles` | `#555555` | lignes de points entre libellé et valeur |

L'accent est réglable (cyan par défaut ; jaune ou vert possibles). Tous ces textes passent le contraste 4,5:1 sur fond noir.

## Typographie

- Police unique : **VT323**, auto-hébergée via @fontsource/vt323, repli `'Courier New', monospace`.
- Tailles : 64 px (titre d'accueil), 40–44 px (année, nom), 24 px (barre de titre), 22 px (texte courant), 19–17 px (précisions).
- Interligne 1,15.
- Textes en **majuscules sans accents**, comme sur les maquettes. Choix de style assumé, à revalider en test si la lecture devient pénible.
- Symboles autorisés : `·` `→` `▶` `*`. Pas d'émoji.

## Mise en page

Deux dispositions, mêmes composants, même contenu. Le passage de
l'une à l'autre se fait uniquement en CSS (media query), sans
dupliquer les composants.

### Mobile (moins de 900 px de large)
- Une colonne, marges de 18 px, largeur pleine jusqu'à 480 px puis
  centrée.
- Touches de fonction collées en bas de l'écran.

### Ordinateur (900 px et plus)
- Un écran Minitel paysage au rapport 4:3, comme l'original
  (40 colonnes × 25 lignes), centré dans la fenêtre.
- Largeur : min(1040 px, 100vw − 48 px). Hauteur : rapport 4:3,
  plafonnée à 100vh − 48 px ; si le contenu dépasse, défilement à
  l'intérieur de l'écran.
- Fond de page #000, écran bordé de 2 px #333.
- Barre de titre et touches de fonction sur toute la largeur de
  l'écran.
- Zone centrale en grille de deux colonnes (5fr / 7fr), écart 32 px :
  - Accueil : titre et accroche à gauche ; menu et champ graine à
    droite.
  - Naissance : lignes de l'origine à gauche ; prénom, statistique et
    traits cachés à droite.
  - Tour : identité, jauges et ligne jeux d'argent à gauche ; encadré
    Avis et choix à droite.
  - Journal : une seule colonne pleine largeur (liste plus lisible).
  - Bilan : identité et moral par décennie à gauche ; valeurs, jeux
    d'argent et « autre naissance » à droite.
- Tailles de police agrandies : texte 26 px, titres 52 px, barre de
  titre 28 px, accueil 76 px (jetons dédiés dans tokens.css).
- Sur ordinateur uniquement, les touches affichent leur raccourci :
  « ENVOI (ENTREE) », « RETOUR (ECHAP) », « AUTO (A) »...

## Composants

| Composant | Description |
| --- | --- |
| **BarreTitre** | bandeau plein couleur accent, texte noir 24 px : `3615 UNE VIE` à gauche, nom de l'écran ou `TOUR 38` à droite |
| **BoutonNumerote** | bordure blanche 1 px, hauteur 44 px minimum, pastille blanche avec le chiffre en noir, puis le libellé |
| **Touche** | touche de fonction en bas : contour accent, ou plein accent pour l'action principale (ENVOI) |
| **Jauge** | libellé (96 px), piste segmentée, valeur à droite. Segments de 18 px séparés de 4 px : `repeating-linear-gradient(90deg, couleur 0 18px, #000 18px 22px)`. Vert si ≥ 50, magenta en dessous |
| **LigneValeur** | `LIBELLE ......... VALEUR` : libellé blanc, pointillés `--pointilles`, valeur en accent ou en jaune |
| **Avis** | encadré bordure 2 px magenta, titre `*** AVIS : EMPLOI ***`, puis le texte de l'événement et sa statistique en discret |
| **Legende** | petits carrés de couleur + libellé, en tête du journal |
| **ChampGraine** | libellé accent, saisie jaune sur soulignement pointillé |

## Écrans

| Écran | Contenu |
| --- | --- |
| **Accueil** (sommaire) | titre UNE VIE EN FRANCE, 3 lignes d'accroche, menu 1 NOUVELLE VIE / 2 REPRENDRE / 3 VIES PASSEES, champ graine, mention « déconseillé aux moins de 15 ans », touches GUIDE · ENVOI |
| **Naissance** | `TU ES NEE.`, puis l'origine révélée ligne par ligne dans l'ordre du tirage (année, sexe, région, commune, parents, revenu, logement, fratrie), encadré prénom + statistique, touches RETOUR · ENVOI COMMENCER |
| **Tour** | barre `TOUR N`, année, identité, jauges, encadré Avis, 1 à 3 choix numérotés, ligne jeux d'argent si pertinent, touches SOMMAIRE · AUTO · ENVOI |
| **Journal** | légende, liste année / âge / événement colorée selon le type, pagination, touches RETOUR · SUITE · REPRENDRE |
| **Bilan** | barre `FIN DE CONNEXION`, dates et cause du décès, moral par décennie en barres mosaïque, lignes de valeur (déciles, chômage, patrimoine), encadré jeux d'argent sur toute la vie, « mêmes choix, autre naissance », touches PARTAGER · JOURNAL · REVIVRE |

La révélation ligne par ligne (naissance, avis) peut s'animer comme un affichage Minitel, environ 30 ms par caractère, désactivée si `prefers-reduced-motion`.

## Clavier

| Touche | Action |
| --- | --- |
| `1` à `9` | choisir l'option correspondante |
| `Entrée` | ENVOI (valider, année suivante) |
| `Échap` | RETOUR |
| `S` | SOMMAIRE |
| `A` | AUTO |
| `G` | GUIDE |

Raccourcis actifs seulement quand le focus n'est pas dans un champ de saisie.

## Accessibilité

- Vrais `<button>`, `<a>`, `<input>` avec `<label>`.
- Cible tactile de 44 px minimum.
- Jauges : `role="meter"` avec `aria-valuenow`, `aria-valuemin`, `aria-valuemax` et un libellé.
- La couleur n'est jamais le seul porteur de sens : le journal garde aussi des mots (CDI, CONFINEMENT...).
- Le texte de l'événement est annoncé aux lecteurs d'écran à chaque nouvelle année (`aria-live="polite"`).
