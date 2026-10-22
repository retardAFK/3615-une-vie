# 3615 UNE VIE

Jeu de simulation de vie dans le navigateur. Le joueur naît en France avec une origine tirée au hasard (année entre 1950 et 2010, région, milieu social, famille) et vit un tour par année jusqu'à sa mort. Le hasard fixe le point de départ et les événements ; les choix du joueur déplacent des probabilités, jamais des résultats. L'interface imite un Minitel.

Inspiration : *1 sur 8 milliards* (1in8b.life), recentré sur la France avec des données réelles (INSEE, DREES, OFDT, ANJ...).

## Documents de référence (à lire avant toute tâche qui les concerne)

- `docs/regles-du-jeu.md` : les règles complètes. Modèle du personnage, tirage à la naissance, moteur de probabilités, modules (éducation, emploi, argent, jeux d'argent, addictions, santé, famille, contexte historique 1950–2026), bilan, garde-fous. **C'est la source de vérité du gameplay.**
- `docs/architecture.md` : stack, arborescence, contrats entre modules, pipeline de données, déploiement.
- `docs/design-minitel.md` : direction visuelle 3615, couleurs, typographie, composants, écrans, clavier.
- `docs/roadmap.md` : jalons dans l'ordre, avec critères de fin.
- `docs/maquettes/` : captures des écrans de référence.

En cas de contradiction entre un document et le code, signale-la au lieu de trancher seul.

## Stack

- Vite + TypeScript (strict) + Svelte 5
- Vitest pour les tests
- Site 100 % statique, déployé sur GitHub Pages par GitHub Actions
- Aucun serveur, aucune API, aucun modèle de langage à l'exécution

## Commandes

Node 24 (voir `.nvmrc`).

- `npm run dev` : serveur de développement
- `npm run build` : build de production dans `dist/`
- `npm run preview` : sert le build de production en local
- `npm test` : tests Vitest
- `npm run lint` : ESLint puis vérification Prettier
- `npm run format` : formate le code avec Prettier
- `npm run check` : vérification des types (svelte-check, avertissements bloquants)
- `npm run data` : régénère les tables JSON à partir de `data/brut/` (jalon 8, pas encore disponible)

## Principes non négociables

1. **Le moteur est pur.** `src/moteur/` ne dépend ni de Svelte, ni du DOM, ni de `window`, ni de `localStorage`. Il prend un état et renvoie un nouvel état. Il doit tourner tel quel dans un Web Worker et dans Vitest.
2. **Jamais `Math.random()`.** Tout tirage passe par le générateur à graine de `src/moteur/rng.ts`. Une même graine et les mêmes choix redonnent exactement la même vie.
3. **Une seule formule de probabilité** : la correction par cotes décrite dans les règles (section 4). Pas de calcul de probabilité ad hoc dans un module.
4. **Les chiffres réels viennent des données, pas du code.** Aucune statistique réelle écrite en dur dans le code ou dans les textes. Une valeur pas encore calibrée s'écrit `[N]` dans les textes et porte `"aCalibrer": true` dans les JSON. Chaque table de `public/data/` cite sa source.
5. **Contenu séparé du code.** Les événements et leurs textes vivent dans `contenu/` (JSON). Ajouter un événement ne doit pas demander de modifier le moteur.
6. **Argent en euros constants**, entiers (centimes inutiles). Affichage en francs avant 2002 seulement dans l'interface.

## Garde-fous de contenu (voir règles, section 13)

- Pas de scène de suicide. Pas de détail graphique sur les violences ou les surdoses.
- Drogues : effets et conséquences uniquement, jamais de doses ni de modes de consommation.
- Jeux d'argent : jamais présentés comme gagnants ; le total misé et récupéré reste visible.
- Ressources d'aide affichées aux moments sensibles (Joueurs Info Service, Drogues Info Service, Tabac Info Service, Alcool Info Service, 3114, 3919).
- L'origine migratoire ne sert qu'à modéliser des discriminations mesurées (embauche, logement), jamais des comportements.

## Conventions

- Code, noms de variables, commentaires et commits en français, sauf les termes techniques usuels.
- Textes du jeu en majuscules sans accents, dans le style Minitel (voir `docs/design-minitel.md`).
- Fonctions du moteur testées avec une graine fixe. Toute correction de bug du moteur ajoute un test qui la reproduit.
- Petits commits, un sujet par commit.
- Avant de créer un nouveau fichier ou dossier, vérifier qu'il s'inscrit dans l'arborescence de `docs/architecture.md`.

## Façon de travailler

- Avancer jalon par jalon (`docs/roadmap.md`). Ne pas anticiper les jalons suivants.
- Pour une tâche de plus de quelques fichiers, proposer d'abord un plan court.
- Après un changement du moteur : lancer `npm test`. Après un changement d'interface : vérifier le rendu à 390 px de large.
