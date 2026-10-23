# Architecture

Un site statique. Tout le calcul tourne dans le navigateur : une vie complète se calcule en quelques millisecondes, et les données de calibrage tiennent en quelques centaines de Ko.

## Vue d'ensemble

```
data/brut/ (CSV sources)  ──[npm run data]──▶  public/data/*.json  ─┐
contenu/evenements/*.json  ─────────────────────────────────────────┤
                                                                    ▼
                         src/moteur/  (TypeScript pur, testé)
                                │
                 ┌──────────────┴───────────────┐
                 ▼                              ▼
        src/ui/  (Svelte, écrans 3615)   src/worker/  (simulations en masse)
                 │
                 ▼
        src/stockage/  (IndexedDB : parties sauvegardées)
```

## Arborescence

```
3615-une-vie/
├── CLAUDE.md
├── docs/
│   ├── regles-du-jeu.md
│   ├── architecture.md
│   ├── design-minitel.md
│   ├── roadmap.md
│   └── maquettes/               captures des écrans de référence
├── data/
│   ├── brut/                    CSV téléchargés (INSEE, DREES...), non modifiés
│   └── scripts/                 pipeline : brut → public/data
├── public/
│   └── data/                    tables JSON générées, versionnées
├── contenu/
│   ├── evenements/              un fichier JSON par module
│   ├── contexte/                actualités, crises, lois, mouvements datés et sourcés
│   └── textes/                  modèles de récit et variantes
├── src/
│   ├── moteur/
│   │   ├── rng.ts               générateur à graine
│   │   ├── cotes.ts             formule des cotes, effet des traits
│   │   ├── tables.ts            recherche dans les tables, repli vers une table moins précise
│   │   ├── conditions.ts        conditions sur l'origine et les états (événements, contexte)
│   │   ├── constantes.ts        paramètres de jeu (âge maximal, valeurs initiales...)
│   │   ├── types.ts             Personnage, Evenement, Choix...
│   │   ├── naissance.ts         tirage de l'origine
│   │   ├── boucle.ts            ouvrirAnnee(), fermerAnnee(), jouerAnneeAuto()
│   │   ├── evenements.ts        sélection et application des événements
│   │   ├── validation.ts        validation de contenu/evenements/ et contenu/contexte/
│   │   ├── modules/             education, emploi, argent, aides, jeux, addictions,
│   │   │                        sante, famille, contexte
│   │   └── recit.ts             remplissage des modèles de texte
│   ├── ui/
│   │   ├── ecrans/              Connexion, Accueil, Reglages, Naissance, Tour,
│   │   │                        Journal, Bilan
│   │   ├── composants/          BarreTitre, BoutonNumerote, Touche, Jauge,
│   │   │                        LigneValeur, Avis, Legende, TexteMinitel, Mosaique
│   │   ├── styles/              tokens.css, base.css
│   │   ├── App.svelte           composant racine, enchaînement des écrans
│   │   ├── texte.ts             format Minitel (majuscules sans accents), montants
│   │   ├── graine.ts            génération et validation des graines
│   │   ├── donnees.ts           chargement des tables de public/data/
│   │   ├── clavier.ts           raccourcis clavier
│   │   ├── reglages.ts          vitesse d'affichage et sons (stockage du navigateur)
│   │   ├── revelation.ts        révélation des textes caractère par caractère
│   │   ├── pictos.ts            pictogrammes en mosaïque
│   │   └── sons.ts              sons générés en WebAudio
│   ├── worker/
│   │   └── simulation.worker.ts
│   ├── stockage/
│   │   └── parties.ts
│   └── main.ts
└── tests/
    ├── moteur/
    ├── ui/                      fonctions pures de l'interface
    └── perf/banc.ts             banc d'essai local (npm run perf), hors de Vitest
```

## Contrat du moteur

Le moteur expose peu de fonctions, toutes pures :

```ts
creerPartie(graine: string, donnees: Donnees): EtatPartie
ouvrirAnnee(etat: EtatPartie, donnees: Donnees): ResultatOuverture
fermerAnnee(etat: EtatPartie, choix: ChoixJoueur[], donnees: Donnees): ResultatFermeture
jouerAnneeAuto(etat: EtatPartie, donnees: Donnees): ResultatFermeture
choisirAuto(etat: EtatPartie, evenement: EvenementTire, donnees: Donnees): ChoixJoueur
bilan(etat: EtatPartie): Bilan
```

- `donnees` regroupe tout ce que le moteur reçoit en plus de l'état : `{ tables, evenements, libelles, contexte }`.
- Une année se joue en deux temps. `ouvrirAnnee` passe le test de mortalité puis tire les événements de l'année ; elle renvoie l'état avec `anneeEnCours`, les événements tirés (avec la probabilité finale qui a servi au tirage) et les choix proposés. `fermerAnnee` applique les choix, les effets, écrit le journal et fait vieillir le personnage.
- `jouerAnneeAuto` enchaîne les deux avec `choisirAuto` : mode AUTO, worker et tests de performance.

Esquisse des types principaux (le détail suit `docs/regles-du-jeu.md`, section 2) :

```ts
interface Personnage {
  prenom: string
  origine: Origine          // figée à la naissance
  traits: Traits            // 0–100, dérive lente, cachés au joueur
  jauges: Jauges            // santePhysique, santeMentale, bienEtre, liens, competences
  finances: Finances        // euros constants : revenuAnnuel, epargne, dettes, patrimoine,
                            // aides de l'année, niveau d'endettement, plan d'apurement,
                            // crédit immobilier (capital restant, annuité)
  etats: Etats              // scolarite, emploi, couple, logement, addictions, maladies,
                            // education (diplôme, voie, filière), travail (métier, salaire, retraite),
                            // justice (gardes à vue, condamnations, casier : règles, section 14),
                            // debutEtatAddiction (âge d'entrée dans l'état de chaque produit),
                            // jeu (jeu, budget, totaux misés et récupérés, chasse, interdiction),
                            // famille (âges du joueur à la naissance des enfants, parents
                            // en vie, achat possible)
  age: number
  vivant: boolean
}

interface EtatPartie {
  graine: string
  annee: number
  personnage: Personnage
  historique: EntreeJournal[]
  cooldowns: number[]                 // âge de reprise, indexé par le rang de l'événement
  modificateursActifs: ModificateurTemporaire[]
  anneeEnCours: AnneeEnCours | null   // événements tirés, en attente des choix
  reportes: string[]                  // événements écartés, à passer l'an prochain
}

interface Evenement {
  id: string
  module: string
  age: [number, number]
  requiert?: Conditions      // sur l'origine, et sur emploi, scolarite, diplome, pcs, justice,
                            // logement, endettement, état de chaque produit d'addiction
                            // (tabac, alcool...), pertesJeu, budgetJeu, maladies, couple,
                            // enfants, achatPossible du joueur
  pBase: number | { source: string; par: string[] }
  modificateurs: Modificateur[]   // { trait, k }, { jauge, k } ou { si, m }
  effets: Effets            // jauges, états, deces (probabilité), revenu [min, max], argent,
                            // justice, surendettement (ouvre un plan d'apurement), maladie
  choix?: ChoixPossible[]   // effets directs limités aux actes du joueur : accepter une
                            // opportunité, choisir un jeu et un budget, se refaire,
                            // demander l'interdiction volontaire de jeux, acheter son logement
  cooldown?: number
  unique?: boolean          // au plus une fois dans une vie (incompatible avec cooldown)
  gravite: 1 | 2 | 3        // au-delà de 3 événements dans l'année, les plus graves passent
  tags: string[]            // cibles des modificateurs posés par les choix
  textes: string[]          // variantes, avec {variables}
  ressources?: string[]     // ressources d'aide affichées (contenu/textes/ressources.json)
  annees?: [number, number] // années calendaires d'éligibilité
  regle?: string            // règle du contexte qui doit être en vigueur
}
```

## Aléatoire reproductible

- Générateur : sfc32, initialisé par un hachage cyrb128 de la graine.
- Chaque tirage dépend seulement de `(graine, age, idDuTirage)`. Ainsi, un choix différent une année ne décale pas tous les tirages suivants, et chaque événement garde son propre tirage indépendant (deux événements rares peuvent arriver la même année).
- Tirage simple (un événement, la mortalité) : le nombre est pris directement dans le hachage de `graine|age|idDuTirage`. Tirage à plusieurs valeurs (naissance, voies, transitions) : un sous-générateur sfc32 est créé à partir de ce hachage.
- Performance du tirage annuel : les événements sont indexés par âge, puis rangés selon la valeur acceptée de leur première condition (seuls ceux dont cette condition correspond sont examinés) ; la probabilité d'un événement qui ne dépend que de l'origine et des traits est calculée une fois par vie. Cette liste est déduite des dépendances déclarées (modificateurs, conditions, tags visés par le contexte historique), jamais établie à la main. Le facteur des addictions actives sur les tags des autres modules s'applique à part, à chaque tirage.
- Addictions et jeux : les tables des addictions sont lues une fois par jeu de tables (une configuration par produit) ; les identifiants de tirage dérivés (`id.texte`, `id.auto`, `education.x`...) sont hachés une fois.
- Conséquence voulue : on peut rejouer une vie, la partager par sa graine, et comparer « mêmes choix, autre naissance » dans le bilan.

## Données

- `data/brut/` garde les fichiers sources tels que téléchargés, avec un `SOURCES.md` qui donne l'URL et la date de chaque fichier.
- `data/scripts/` agrège et produit `public/data/*.json`. Ces scripts tournent en local, jamais chez le joueur.
- Chaque table JSON porte ses métadonnées :

```json
{
  "table": "pcsParents",
  "source": "INSEE, ...",
  "url": "https://...",
  "aCalibrer": false,
  "lignes": [ { "conditions": {}, "distribution": {} } ]
}
```

- Tant qu'une table n'est pas calibrée, elle contient des valeurs de travail plausibles et `"aCalibrer": true`. Le bilan peut alors afficher un avertissement discret.
- Les règles de droit (âge légal de retraite, obligation scolaire) sont des tables à part, sourcées, avec `"aCalibrer": false`.
- Les modules (`src/moteur/modules/`) tirent leurs issues à plusieurs valeurs (voie, orientation, transitions d'emploi) par la formule des cotes appliquée à chaque issue, puis renormalisée (`distributionCorrigee`). Les choix agissent sur ces tirages par des modificateurs visant des tags d'issue (`voie_generale`, `emploi_chomage`...). Un choix ne peut avoir un effet direct que pour accepter une opportunité déjà tirée (`effets: { changerEmploi: true }`).
- Le contexte historique vit dans `contenu/contexte/` : chaque entrée est datée (`debut`, `fin`, années calendaires), sourcée (`source` obligatoire), et de type `actualite`, `crise`, `loi` ou `mouvement`. Une crise porte des multiplicateurs par tag, éventuellement limités à un profil (`profil`, jamais sur l'origine migratoire) ; une loi peut fixer une règle à partir de son année (`regles`, par exemple `bacPro`, ou le nom d'une aide qu'elle crée : `minimumSocial: "LE RSA"`). Un événement peut exiger une règle en vigueur (`regle`, par exemple `surendettement`). Les entrées qui commencent une année entrent au journal et au bandeau FLASH INFO. Les mouvements sociaux sont aussi des événements bornés à des années calendaires (`annees`), avec un choix de participation.
- Chargement paresseux : chaque module charge ses tables quand il devient utile.

## Interface

- Svelte 5, aucune bibliothèque de composants.
- Mise en page mobile et ordinateur : voir `docs/design-minitel.md`, section « Mise en page ».
- Clavier : chiffres 1 à 9 pour les choix, Entrée = ENVOI, Échap = RETOUR (voir `docs/design-minitel.md`).

## Web Worker

`src/worker/simulation.worker.ts` sert au mode automatique rapide et aux simulations en masse (bilan comparatif, équilibrage). Il importe le moteur tel quel.

## Stockage

- IndexedDB pour les parties en cours et les vies passées.
- La graine et la liste des choix suffisent à reconstruire une partie : on stocke ça, pas l'état complet.
- Partage : `?graine=7F3A21C9` dans l'URL.

## Déploiement

- GitHub Pages par GitHub Actions à chaque push sur `main`.
- `vite.config.ts` : `base: '/3615-une-vie/'` (à adapter au nom du repo).
- PWA possible plus tard (jalon final).

## Budgets

| Élément | Cible |
| --- | --- |
| JavaScript compressé | < 300 Ko |
| Données au premier écran | < 200 Ko |
| Une vie complète en AUTO, en moyenne | < 5 ms (fluidité : le mode AUTO et les années qui s'enchaînent ne doivent jamais ramer) |
| 1 000 vies | < 1 s (bilan comparatif « mêmes choix, autre naissance », calculé dans le worker) |
| 10 000 vies | mesuré, sans objectif bloquant (équilibrage sur un grand nombre de vies, hors partie) |

Les trois temps se mesurent avec `npm run perf`, banc d'essai local sur le moteur seul, regroupé hors de Vitest. Les deux premiers sont bloquants : le banc échoue s'ils ne sont pas tenus. La CI ne surveille que les régressions : un test sur 1 000 vies, dont le temps est rapporté à une charge de référence (calcul pur, sans le moteur) mesurée dans le même processus, ce qui annule la vitesse du runner ; la limite vaut environ le double du rapport mesuré. Le temps et le rapport sont republiés en annotation GitHub.
