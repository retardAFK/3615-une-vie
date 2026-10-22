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
│   └── textes/                  modèles de récit et variantes
├── src/
│   ├── moteur/
│   │   ├── rng.ts               générateur à graine
│   │   ├── cotes.ts             formule des cotes, effet des traits
│   │   ├── tables.ts            recherche dans les tables, repli vers une table moins précise
│   │   ├── constantes.ts        paramètres de jeu (âge maximal, valeurs initiales...)
│   │   ├── types.ts             Personnage, Evenement, Choix...
│   │   ├── naissance.ts         tirage de l'origine
│   │   ├── boucle.ts            jouerAnnee()
│   │   ├── evenements.ts        sélection et application des événements
│   │   ├── modules/             education, emploi, argent, jeux, addictions,
│   │   │                        sante, famille, contexte
│   │   └── recit.ts             remplissage des modèles de texte
│   ├── ui/
│   │   ├── ecrans/              Accueil, Naissance, Tour, Journal, Bilan
│   │   ├── composants/          BarreTitre, BoutonNumerote, Touche, Jauge,
│   │   │                        LigneValeur, Avis, Legende
│   │   ├── styles/              tokens.css, base.css
│   │   ├── App.svelte           composant racine, enchaînement des écrans
│   │   ├── texte.ts             format Minitel (majuscules sans accents), montants
│   │   ├── graine.ts            génération et validation des graines
│   │   ├── donnees.ts           chargement des tables de public/data/
│   │   └── clavier.ts           raccourcis clavier
│   ├── worker/
│   │   └── simulation.worker.ts
│   ├── stockage/
│   │   └── parties.ts
│   └── main.ts
└── tests/
    ├── moteur/
    └── ui/                      fonctions pures de l'interface
```

## Contrat du moteur

Le moteur expose peu de fonctions, toutes pures :

```ts
creerPartie(graine: string, tables: Tables): EtatPartie
jouerAnnee(etat: EtatPartie, choix: ChoixJoueur | null, tables: Tables): ResultatAnnee
choisirAuto(etat: EtatPartie, evenement: EvenementTire): ChoixJoueur
bilan(etat: EtatPartie): Bilan
```

`ResultatAnnee` contient le nouvel état, les événements tirés (avec la probabilité finale qui a servi au tirage), les choix proposés et les lignes de journal.

Esquisse des types principaux (le détail suit `docs/regles-du-jeu.md`, section 2) :

```ts
interface Personnage {
  prenom: string
  origine: Origine          // figée à la naissance
  traits: Traits            // 0–100, dérive lente, cachés au joueur
  jauges: Jauges            // santePhysique, santeMentale, bienEtre, liens, competences
  finances: Finances        // euros constants : revenuAnnuel, epargne, dettes, patrimoine
  etats: Etats              // scolarite, emploi, couple, logement, addictions, maladies
  age: number
  vivant: boolean
}

interface EtatPartie {
  graine: string
  annee: number
  personnage: Personnage
  historique: EntreeJournal[]
  cooldowns: Record<string, number>
  modificateursActifs: ModificateurTemporaire[]
}

interface Evenement {
  id: string
  module: string
  age: [number, number]
  requiert?: Conditions
  pBase: number | { source: string; par: string[] }
  modificateurs: Modificateur[]
  effets: Effets
  choix?: ChoixPossible[]
  cooldown?: number
  textes: string[]          // variantes, avec {variables}
}
```

## Aléatoire reproductible

- Générateur : sfc32 ou mulberry32, initialisé par un hachage de la graine.
- Chaque tirage utilise un sous-générateur dérivé de `(graine, age, idDuTirage)`. Ainsi, un choix différent une année ne décale pas tous les tirages suivants.
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
| Une vie complète simulée | < 10 ms |
| 10 000 vies dans le worker | < 5 s |
