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
| **Accueil** (sommaire) | titre UNE VIE EN FRANCE, 3 lignes d'accroche, menu 1 NOUVELLE VIE / 2 REPRENDRE (prénom et âge de la partie sauvegardée) / 3 VIES PASSEES (nombre de vies) / 4 REGLAGES, champ « REJOUER UN SEED » (« VIDE = NOUVEAU SEED » ; Entrée dans le champ lance NOUVELLE VIE), mention « déconseillé aux moins de 15 ans », touches GUIDE · ENVOI |
| **Année** | après NOUVELLE VIE : « EN QUELLE ANNEE NAIS-TU ? », 1 LAISSER LE HASARD (pondéré par les naissances réelles) / 2 CHOISIR MON ANNEE (champ, bornes de la table des naissances, 1950 à 2010) ; ouvert sur le champ rempli quand un lien partagé donne l'année ; touches RETOUR · ENVOI (hasard, ou naître l'année saisie) |
| **Naissance** | ligne discrète « TIRAGE EN COURS · SEED 7F3A21C9 », `TU ES NEE.`, puis l'origine révélée ligne par ligne dans l'ordre du tirage (année, sexe, région, commune, parents, revenu, logement, fratrie), encadré prénom + statistique, touches RETOUR · ENVOI COMMENCER |
| **Tour** | barre `TOUR N`, bandeau FLASH INFO (étiquette jaune) quand une entrée du contexte historique commence cette année, année, identité, jauges, lignes SITUATION (scolarité ou emploi et métier), REVENU, EPARGNE, AIDES (si versées), DETTES, ENDETTEMENT (hors niveau sain, ou années restantes du plan), une ligne par addiction en usage régulier, en dépendance ou en sevrage (produit et état), JEU · MISE et JEU · RECUPERE (totaux de la vie, toujours visibles dès la première mise), nouvelles de l'année (aide touchée ou non demandée, dettes, changements d'addiction), encadré Avis, 1 à 3 choix numérotés, touches SOMMAIRE · AUTO · JOURNAL · ENVOI |
| **Journal** | légende, liste année / âge / événement colorée selon le type (argent en jaune, jeu en magenta, choc en rouge, actualités en discret), mise et gain de chaque année de jeu, pagination ; ouvert sur les dernières années depuis le Tour, sur la première page depuis le Bilan ; touches RETOUR (page précédente) · SUITE (page suivante) · REPRENDRE |
| **Connexion** | au lancement, pendant le chargement : lignes « APPEL DU 3615... », « CONNEXION AU SERVICE UNE VIE... », puis « CONNECTE. » ; passable avec ENVOI |
| **Réglages** | depuis l'accueil (4 REGLAGES) : vitesse d'affichage (lente, normale, rapide, instantanée) et sons (non par défaut), touche RETOUR |
| **Bilan** | barre `FIN DE CONNEXION`, dates et cause du décès, espérance de vie de la génération, moral par décennie en barres (vert à 50 et plus, magenta en dessous), lignes de valeur (déciles à la naissance et à 60 ans, diplôme, métier, chômage, revenus de la vie, dépendance et coût des addictions s'il y en a, patrimoine transmis), encadré jeux d'argent sur toute la vie (mise, récupéré, solde), vies des enfants (une ligne chacun), « mêmes choix, autre naissance » (bouton 1 pour la vivre, lignes TOI et AUTRE), graine et mention des chiffres provisoires, touches PARTAGER · JOURNAL · REVIVRE |
| **Vies passées** | depuis l'accueil (3 VIES PASSEES) : les 30 dernières vies, numérotées (prénom, années, âge) ; chacune rouvre son bilan ; touche RETOUR |

## Animation et sons

- **Révélation** : textes des avis et titre de naissance affichés caractère par caractère, avec un curseur (environ 28 ms par caractère en vitesse normale) ; lignes de l'origine révélées une à une.
- **Transition d'année** : l'encadré Avis se redessine de haut en bas, comme un écran Minitel qui se rafraîchit.
- **Jauges** : remplissage par à-coups et écart affiché (+3, -5) pendant 1,5 s.
- **Grands moments** (gravité 3, ou tag `etape` : diplômes, premier emploi, retraite) : titre de l'Avis en double hauteur. Le nom de l'écran de fin est aussi en double hauteur.
- **Événement grave** (gravité 3) : le cadre de l'Avis clignote trois fois.
- **Pictogrammes** en mosaïque (blocs 8 × 6) devant le titre de l'Avis, choisis d'après les tags de l'événement.
- **Sons** générés en WebAudio, sans fichier, désactivés par défaut : touche, connexion, événement grave, fin de vie.
- **Jamais en AUTO** : aucune révélation ni animation, pour ne pas ralentir le défilement.
- **`prefers-reduced-motion`** : textes affichés d'un coup, aucune animation, quel que soit le réglage de vitesse.

## Clavier

| Touche | Action |
| --- | --- |
| `1` à `9` | choisir l'option correspondante |
| `Entrée` | ENVOI (valider, année suivante) |
| `Échap` | RETOUR |
| `S` | SOMMAIRE |
| `A` | AUTO |
| `G` | GUIDE |
| `J` | JOURNAL (ouvrir depuis le Tour ou le Bilan, puis REPRENDRE) |
| `P` | PARTAGER (Bilan) |

À l'accueil, `2` reprend la partie sauvegardée, `3` ouvre les vies passées et `4` les réglages ; dans les réglages, `1` change la vitesse et `2` les sons. Dans le journal, Entrée passe à la page suivante et Échap revient à la précédente (sur la dernière ou la première page, elles referment le journal). Au bilan, `1` fait vivre l'autre naissance.

Raccourcis actifs seulement quand le focus n'est pas dans un champ de saisie.

## Accessibilité

- Vrais `<button>`, `<a>`, `<input>` avec `<label>`.
- Cible tactile de 44 px minimum.
- Jauges : `role="meter"` avec `aria-valuenow`, `aria-valuemin`, `aria-valuemax` et un libellé.
- La couleur n'est jamais le seul porteur de sens : le journal garde aussi des mots (CDI, CONFINEMENT...).
- Le texte de l'événement est annoncé aux lecteurs d'écran à chaque nouvelle année (`aria-live="polite"`).
