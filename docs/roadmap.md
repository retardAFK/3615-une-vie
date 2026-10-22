# Feuille de route

Un jalon à la fois. Un jalon est fini quand tous ses critères sont vrais et que `npm test` passe.

## Jalon 0 — Socle

- Projet Vite + TypeScript strict + Svelte 5, Vitest, ESLint, Prettier.
- Arborescence de `docs/architecture.md` créée (dossiers vides avec `.gitkeep` si besoin).
- `src/ui/styles/tokens.css` avec les jetons de `docs/design-minitel.md`, police VT323.
- GitHub Actions : tests à chaque push, déploiement GitHub Pages sur `main`.

**Fini quand** : la page déployée affiche une barre de titre 3615 sur fond noir, et la CI est verte.

## Jalon 1 — Moteur minimal

- `rng.ts` : générateur à graine, sous-générateurs dérivés de `(graine, age, id)`.
- `cotes.ts` : formule des cotes et effet des traits (règles, section 4).
- `naissance.ts` : tirage de l'origine dans l'ordre des règles (section 3), avec des tables de travail marquées `aCalibrer`.
- `boucle.ts` : vieillissement, test de mortalité par table, fin de partie.

**Fini quand** : un test fait naître un personnage avec une graine fixe, le fait vivre jusqu'à sa mort, et retrouve exactement la même vie au second lancement ; 10 000 vies passent en moins de 5 s.

## Jalon 2 — Écrans Accueil, Naissance, Tour (vide)

- Composants BarreTitre, BoutonNumerote, Touche, Jauge, LigneValeur.
- Écrans Accueil et Naissance conformes aux maquettes.
- Écran Tour sans événement : l'année avance avec ENVOI, les jauges bougent, la mort mène à un écran de fin provisoire.
- Raccourcis clavier.

**Fini quand** : on joue une vie complète en appuyant sur Entrée, sur mobile et au clavier.

## Jalon 3 — Événements et choix

- Format d'événement de `docs/architecture.md`, chargement depuis `contenu/evenements/`.
- Sélection annuelle (au plus 3 événements, cooldowns), choix qui posent des modificateurs.
- Encadré Avis, journal de l'année, modèles de texte avec variantes.
- Mode AUTO.

## Jalon 4a — Éducation, emploi, bilan d'argent simple

Modules des sections 5 et 6 des règles, et bilan annuel simple de la section 7 : revenus moins une dépense de vie provisoire, solde vers l'épargne ou en dettes. Retraite à l'âge légal de la génération.

## Jalon 4b — Vie et animation

Séquence de connexion, révélation des textes caractère par caractère avec curseur, transition d'année façon rafraîchissement Minitel, jauges animées avec écart affiché, grands moments en double hauteur, Avis qui clignote pour un événement grave, pictogrammes en mosaïque, sons optionnels générés en WebAudio (désactivés par défaut), réglage de vitesse, respect de `prefers-reduced-motion`.

**Fini quand** : une vie jouée donne une impression de mouvement à chaque année, sans ralentir le mode AUTO ni gêner la lecture.

## Jalon 4c — Actualités, lois et contexte historique

Trois types de contexte datés et sourcés, de 1950 à 2026 : actualités françaises et internationales avec bandeau FLASH INFO, crises qui modulent les modules selon le profil, lois qui changent les règles à leur date d'entrée en vigueur. Mouvements sociaux avec choix de participation. Chaque entrée historique porte une source ; les effets chiffrés sont `aCalibrer`.

**Fini quand** : deux vies nées à 30 ans d'écart traversent des contextes visiblement différents, et chaque entrée a sa source.

## Jalon 4d — Argent complet

Suite de la section 7 : aides sociales, dettes, surendettement.

## Jalon 5 — Jeux d'argent et addictions

Modules des sections 8 et 9. Chaîne d'états commune, taux de retour réels, chasse aux pertes, ressources d'aide affichées.

## Jalon 6 — Santé, famille, logement

Sections 10 et 11 : maladies, couple, enfants, logement.

## Jalon 7 — Journal, bilan, sauvegarde, partage

Écrans Journal et Bilan, IndexedDB, partage par graine, « mêmes choix, autre naissance » via le worker.

## Jalon 8 — Calibrage

Pipeline `data/scripts/`, remplacement des tables `aCalibrer` par les données réelles, statistiques `[N]` remplies dans les textes.

## Jalon 9 — Finitions

PWA, équilibrage sur 10 000 vies.
