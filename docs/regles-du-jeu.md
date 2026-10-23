# Une vie en France — Règles du jeu

Oct 22, 2026 · @Maxime

## 1. Principes et boucle de jeu

Le joueur naît en France avec une origine tirée au hasard, puis vit un tour par année, de 0 an jusqu'au décès. Le hasard fixe le point de départ et les événements ; les choix du joueur ne garantissent rien, ils déplacent des probabilités.

**Trois règles d'or**

1. Aucun tirage n'est « à plat » : chaque probabilité dépend de l'origine, des traits, des jauges et de l'historique.
2. Un choix modifie une probabilité, jamais un résultat. Reprendre ses études augmente les chances de mieux gagner sa vie, sans les assurer.
3. Les inégalités sont réelles et visibles : deux joueurs qui font les mêmes choix n'ont pas la même vie.

**Rythme**

| Âge | Type de tour | Choix du joueur |
| --- | --- | --- |
| 0–10 ans | Passif : tout est subi | Aucun, ou 1 choix symbolique par an |
| 11–17 ans | Semi-actif | 1 à 2 choix par an (loisirs, effort scolaire, fréquentations) |
| 18–64 ans | Actif | 1 à 3 choix par an selon les événements |
| 65 ans et + | Ralenti | 1 choix par an (santé, transmission, entourage) |

**Ordre d'un tour (1 an)**

1. Revenus et dépenses de l'année : calcul du solde, mise à jour de l'épargne et des dettes.
2. Test de mortalité (section 10), à l'âge vécu pendant l'année (la valeur à 0 an sert donc la première année). En cas de décès, fin de partie.
3. Tirage des événements de l'année (0 à 3), selon leurs probabilités conditionnelles.
4. Choix du joueur, proposés par les événements ou par l'étape de vie.
5. Mise à jour des jauges et des états (emploi, addictions, couple). Certains événements (accident grave, surdose, maladie déclarée) peuvent aussi provoquer le décès à cette étape : il est alors enregistré à l'âge vécu, comme pour le test de mortalité.
6. Journal de l'année : 1 à 3 lignes de récit.
7. Vieillissement : âge + 1, les traits liés à l'âge évoluent.

Un mode « choix automatique » joue les décisions à la place du joueur, selon ses traits. Une partie complète doit tenir en 30 à 60 minutes.

## 2. Modèle du personnage

Un personnage se décrit en quatre blocs : l'origine (figée), les traits (quasi figés), les jauges (0 à 100, évoluent chaque année) et les états (variables discrètes qui changent par transitions).

**Origine (tirée une fois, jamais modifiée)**

| Champ | Valeurs |
| --- | --- |
| anneeNaissance | 1950 à 2010 |
| sexe | femme, homme |
| territoire | grande métropole, ville moyenne, périurbain, rural, quartier prioritaire, DROM |
| region | 13 régions métropolitaines + 5 DROM |
| pcsParents | cadre, profession intermédiaire, employé, ouvrier, artisan-commerçant, agriculteur, sans emploi |
| decileRevenuFoyer | D1 à D10 |
| diplomeParents | aucun, CAP/BEP, bac, bac+2/3, bac+5 et + |
| logementFamilial | propriétaire, locataire privé, HLM, précaire |
| structureFamiliale | couple, monoparentale, recomposée, placement ASE |
| fratrie | 0 à 5+ |
| origineMigratoire | aucune, 1re génération, 2e génération |
| santeNaissance | normale, prématurité, handicap |

**Traits (0 à 100, tirés à la naissance, dérive lente)**

| Trait | Sert à |
| --- | --- |
| facilite | réussite scolaire, apprentissage |
| impulsivite | jeux d'argent, addictions, dépenses, accidents |
| sociabilite | couple, réseau, accès à l'emploi |
| resilience | santé mentale, sortie d'addiction, rebond après un choc |
| ambition | choix d'études et de carrière en mode auto |
| vulnerabiliteGenetique | maladies chroniques, risque de dépendance |

Les traits suivent une loi normale centrée sur 50 (écart-type 15), bornée entre 5 et 95. Un événement majeur peut les décaler de 5 points au plus.

**Jauges (0 à 100, mises à jour chaque année)**

- santePhysique
- santeMentale
- bienEtre (jauge affichée comme « bonheur », moyenne pondérée des autres)
- liens (famille, amis, couple)
- competences (diplôme + expérience)

L'argent n'est pas une jauge : il est tenu en euros (revenus annuels, épargne, dettes, patrimoine).

**États (variables discrètes)**

- scolarite, emploi, couple, logement
- un état par addiction (tabac, alcool, cannabis, autres drogues, jeux d'argent, écrans)
- maladies : liste des pathologies actives
- historique : liste des événements passés, pour les conditions et le récit

## 3. Tirage à la naissance

L'origine se tire dans un ordre fixe, chaque tirage étant conditionné par les précédents. C'est ce qui rend les vies cohérentes : un enfant de cadre parisien n'a pas la même distribution de logement qu'un enfant d'ouvrier en zone rurale.

1. **anneeNaissance** : pondérée par le nombre de naissances de chaque année (INSEE, état civil). Le joueur peut aussi l'imposer à l'accueil, dans les bornes de la table ; les tirages suivants restent alors conditionnés par cette année, et la partie garde ce choix pour être rejouée à l'identique.
2. **sexe** : environ 51 % de garçons à la naissance.
3. **region**, puis **territoire** : pondérés par la population de l'année tirée.
4. **pcsParents** | annee, territoire : la part des agriculteurs et des ouvriers baisse avec les années, celle des cadres augmente.
5. **diplomeParents** | pcsParents, annee.
6. **decileRevenuFoyer** | pcsParents, diplomeParents, territoire.
7. **structureFamiliale**, **fratrie** | annee, decile.
8. **logementFamilial** | decile, territoire.
9. **origineMigratoire** | annee, territoire.
10. **santeNaissance** : faible probabilité, légèrement plus forte dans les déciles bas.
11. **Traits** : tirés indépendamment, sauf vulnerabiliteGenetique, liée aux antécédents familiaux tirés en même temps.

**Format d'une table conditionnelle**

```json
{
  "table": "pcsParents",
  "conditions": { "periode": "1990-1999", "territoire": "rural" },
  "distribution": { "agriculteur": 0.06, "ouvrier": 0.30, "employe": 0.27, "intermediaire": 0.20, "cadre": 0.09, "artisan": 0.08 }
}
```

Les valeurs ci-dessus sont des exemples de format, pas des chiffres INSEE : elles seront remplacées au calibrage (section 13). Quand une combinaison de conditions n'a pas de table, le moteur retombe sur la table moins précise (sans territoire, puis sans période).

## 4. Moteur de probabilités

Toutes les probabilités du jeu passent par une seule formule : une probabilité de base issue des données réelles, corrigée par des multiplicateurs appliqués sur les cotes (odds). Cette méthode garde toujours un résultat entre 0 et 1, même quand plusieurs facteurs s'additionnent.

```latex
\text{odds} = \frac{p_{base}}{1 - p_{base}} \times \prod_i m_i \qquad p_{final} = \frac{\text{odds}}{1 + \text{odds}}
```

Un multiplicateur m supérieur à 1 augmente le risque, inférieur à 1 le réduit. Exemple : un risque de base de 5 % avec deux facteurs × 2 donne environ 17 %, pas 20 %.

**Effet des traits**

Un trait agit par un multiplicateur exponentiel autour de 50 :

```latex
m_{trait} = e^{k \times (trait - 50) / 50}
```

Avec k = 0,7, un trait à 95 multiplie les cotes par environ 1,9 et un trait à 5 les divise par 1,9. Chaque événement déclare ses propres k.

**Format d'un événement**

```json
{
  "id": "licenciement_economique",
  "age": [20, 64],
  "requiert": { "emploi": ["cdi", "cdd"] },
  "pBase": { "source": "tauxLicenciement", "par": ["secteur", "annee"] },
  "modificateurs": [
    { "si": { "contexte": "crise" }, "m": 2.0 },
    { "jauge": "competences", "k": -0.5 }
  ],
  "effets": { "emploi": "chomage", "santeMentale": -10, "revenus": "indemnites" },
  "choix": ["chercher_meme_metier", "reconversion", "creer_entreprise"],
  "cooldown": 2
}
```

**Règles de tirage**

- Chaque année, on parcourt les événements éligibles (âge, conditions) et on tire chacun selon sa probabilité finale.
- Au plus 3 événements par an. Au-delà, on garde les plus graves, et les autres sont reportés d'un an.
- Un **cooldown** empêche un événement de revenir trop vite.
- Le générateur aléatoire est initialisé par une **graine** (seed) : la même graine rejoue la même vie, ce qui permet de partager une partie et de déboguer.

**Les choix**

Un choix ne produit jamais un résultat direct. Il applique un multiplicateur temporaire ou permanent sur des événements futurs, et un coût immédiat (argent, temps, jauge). Exemple : « reprendre des études » coûte 1 an de revenus, puis multiplie par 1,5 les chances de promotion pendant 10 ans.

Un choix peut accepter une opportunité déjà tirée par le hasard ; c'est la seule exception à la règle des choix sans résultat direct.

## 5. Module éducation

La scolarité est une suite de paliers, chacun tiré selon la facilité, l'origine sociale et l'effort choisi par le joueur. L'origine pèse lourd : c'est ici que le jeu montre la reproduction sociale.

| Âge | Palier | Issues possibles | Facteurs principaux |
| --- | --- | --- | --- |
| 6–11 | Primaire | normal, redoublement, difficultés repérées | facilite, diplomeParents, santeNaissance |
| 15 | Fin de 3e | voie générale, technologique, professionnelle, apprentissage | facilite, pcsParents, effort, redoublements |
| 16–18 | Lycée | bac général/techno/pro, échec, décrochage | voie, effort, santeMentale, addictions |
| 18 | Après le bac | université, BTS/BUT, prépa, école post-bac, emploi direct | mention, pcsParents, territoire, decile |
| 18–25 | Supérieur | bac+2/3, bac+5, grande école, abandon | facilite, ressources (bourse, job étudiant) |

**Choix du joueur**

- Effort scolaire (faible, normal, fort) : agit sur la réussite, coûte du bienEtre s'il est fort trop longtemps.
- Orientation à 15 et 18 ans, parmi les issues rendues accessibles par le tirage.
- Job étudiant : revenus, mais risque d'échec plus élevé.
- Reprise d'études possible à tout âge adulte (formation, VAE, alternance).

**Règles**

- Le diplôme final fixe le niveau de **competences** de départ et la grille de salaire (section 6).
- Le décrochage ouvre l'accès à des événements spécifiques (petits boulots, fréquentations à risque) et augmente l'exposition aux addictions.
- Années de naissance anciennes : moins de bacheliers, entrée plus précoce dans le travail.

## 6. Module emploi et revenus

L'emploi est un état qui change par transitions annuelles, et le salaire se calcule par une formule à partir d'une grille réelle. Le joueur choisit sa stratégie, le hasard décide des opportunités.

**États d'emploi**

etudiant · cdi · cdd · interim · independant · fonctionnaire · chomage · inactif · arret\_longue\_maladie · retraite

Chaque année, une matrice de transition donne la probabilité de passer d'un état à l'autre, selon l'âge, le diplôme, le secteur et le contexte (crise ou non). Exemple : un CDD devient un CDI, reste en CDD ou passe au chômage.

**Calcul du salaire annuel net**

```latex
salaire = grille(metier, diplome, region) \times courbe(anciennete) \times (1 - ecartSexe) \times quotite \times bruit
```

- **grille** : salaire médian du métier pour l'année en cours, en euros constants.
- **courbe** : progression avec l'ancienneté, forte en début de carrière, plate après 50 ans.
- **ecartSexe** : écart de salaire à poste égal, plus un risque de temps partiel plus élevé pour les femmes, surtout après une naissance.
- **quotite** : temps plein, 80 %, mi-temps.
- **bruit** : facteur aléatoire tiré une fois par emploi (loi log-normale autour de 1), pour que deux personnes au même poste ne gagnent pas exactement la même chose.

**Événements d'emploi**

| Événement | Augmenté par | Effet |
| --- | --- | --- |
| Promotion | competences, ambition, ancienneté | salaire + 10 à 25 % |
| Licenciement | crise, secteur exposé, addictions actives | chômage, santeMentale − |
| Burn-out | travail intense, resilience basse | arrêt, santeMentale −− |
| Accident du travail | métiers manuels, alcool | santePhysique −, arrêt |
| Offre extérieure | sociabilite, competences | choix : changer ou rester |
| Faillite (indépendant) | crise, impulsivite | dettes, chômage |

**Chômage et retraite**

- Indemnités chômage : un pourcentage du dernier salaire, sur une durée limitée selon les règles de l'année.
- Retraite : âge légal selon la génération tirée, pension calculée sur les meilleures années et le nombre de trimestres validés. Le chômage et le temps partiel réduisent la pension.

## 7. Module argent, patrimoine et aides

L'argent est tenu en euros constants dans un bilan annuel simple : ce qui rentre, ce qui sort, ce qui reste. C'est le module qui relie l'emploi, le jeu et les addictions entre eux.

**Bilan annuel**

```latex
solde = revenus + aides - impots - logement - viecourante - dettes - depensesAddictions - misesJeu + gainsJeu
```

- Solde positif : versé à l'épargne (Livret A, assurance-vie), ou à un apport immobilier si le joueur le choisit.
- Solde négatif : prélevé sur l'épargne, puis sur un découvert, puis sur un crédit à la consommation.

**Dettes et surendettement**

| Niveau | Condition | Effet |
| --- | --- | --- |
| Sain | remboursements < 33 % des revenus | aucun |
| Tendu | 33 à 50 % | santeMentale − chaque année |
| Critique | > 50 % ou incidents de paiement | risque d'expulsion, conflits de couple |
| Surendettement | dossier déposé (choix ou automatique) | plan d'apurement sur plusieurs années, accès au crédit bloqué |

**Aides sociales (versées automatiquement si éligible)**

RSA, prime d'activité, aides au logement, allocations familiales, AAH, bourses étudiantes, minimum vieillesse. Les montants et plafonds suivent les barèmes de l'année en cours. Un taux de non-recours (aide non demandée) s'applique, plus élevé chez les jeunes et en zone rurale : c'est un fait réel et un ressort de jeu.

**Patrimoine**

- Achat immobilier : choix possible si apport et revenus suffisants ; il remplace le loyer par une mensualité et constitue un patrimoine.
- Héritage : tiré au décès des parents, selon logementFamilial et decileRevenuFoyer.
- Inflation : tout est calculé en euros constants pour simplifier, avec un affichage en francs avant 2002 pour l'ambiance.

**Dans le jeu** (jalon 4d)

- Le bilan commence à la sortie des études. Sous le plancher de dépense de vie, le personnage réduit son train de vie : seule une part de l'écart reste incompressible.
- Soutien familial : avant l'âge du minimum social, la famille couvre le déficit d'un jeune qui vit chez ses parents, sauf après un placement à l'aide sociale à l'enfance.
- Une aide n'existe qu'à partir de la loi du contexte historique qui la crée, et porte le nom de l'époque : minimum vieillesse puis ASPA, allocation de logement puis APL, AAH, RMI puis RSA, prime pour l'emploi puis RSA activité puis prime d'activité. Les aides sont calculées dans cet ordre : AAH, minimum vieillesse, minimum social, complément d'activité, aide au logement ; chacune compte dans les ressources des suivantes. AAH, minimum vieillesse et minimum social complètent les ressources jusqu'au montant du barème ; complément d'activité et aide au logement diminuent avec les ressources jusqu'au plafond. Les allocations familiales (jalon 6) sont calculées en premier : un montant par enfant à charge au-delà du premier, sans condition de ressources. Les bourses viendront avec les études autonomes.
- Non-recours : tiré chaque année et pour chaque aide par la formule des cotes, plus fréquent avant 30 ans et à la campagne. Un choix (faire le point sur ses droits avec une assistante sociale) le réduit pendant quelques années. Une aide non demandée est notée au journal.
- Dettes : les intérêts courent chaque année ; le remboursement de l'année est une part des dettes, avec un minimum. Le déficit est pris sur l'épargne, puis emprunté jusqu'à un plafond de crédit proportionnel aux ressources ; au-delà, le personnage se prive (santé physique −) et c'est un incident de paiement.
- Niveaux : la part des ressources prise par les remboursements fixe le niveau (sain, tendu, critique) ; un incident de paiement rend la situation critique. Tendu et critique font baisser le moral chaque année. En situation critique : relances, huissier, expulsion pour un locataire.
- Surendettement (à partir de la loi Neiertz, 1990) : dossier déposé par choix (les relances le proposent, la commission le juge ensuite recevable) ou d'office après plusieurs années critiques. Pendant le plan d'apurement, pas d'intérêts, un remboursement selon la capacité, pas de crédit. À la fin du plan, les dettes restantes sont effacées si la procédure de rétablissement personnel existe (2004).
- Tous les montants, seuils et taux sont dans `baremesAides`, `nonRecours` et `parametresArgent`, `aCalibrer`.

**Dans le jeu** (jalon 6)

- Charges fixes : le loyer (ou les charges d'un propriétaire), le coût des enfants à charge et l'annuité du crédit immobilier passent d'abord ; la dépense de vie se règle sur ce qui reste. En vie commune, ces charges sont partagées. La dépense de vie ne comprend plus le logement.
- Achat immobilier : quand l'apport est épargné, que la capacité d'emprunt atteint au moins une part du prix moyen du territoire et de la décennie, et que l'endettement reste sain, un événement propose d'acheter. On achète à sa mesure : le prix moyen, ou moins si la capacité d'emprunt est plus faible. L'apport est pris sur l'épargne, le reste emprunté à annuités constantes ; le logement entre au patrimoine.
- Location : dans le privé, on loue à sa mesure, au plus le loyer moyen du territoire et pas plus du revenu du foyer divisé par le multiple exigé par les bailleurs, sans descendre sous une part minimale du loyer moyen. Les loyers HLM sont fixes.
- Héritage : au décès du dernier parent, selon le logement familial et le décile de revenu du foyer ; rien après un placement à l'aide sociale à l'enfance. Il va à l'épargne.
- Valeurs dans `loyers`, `prixLogement`, `heritage` et `parametresFamille`, `aCalibrer`.

## 8. Module jeux d'argent

Chaque jeu est simulé avec ses vraies règles mathématiques : on joue, on perd en moyenne, et parfois on gagne. Le jeu affiche toujours, dans le journal, combien le personnage a misé et récupéré au total : c'est l'outil pédagogique central.

**Les jeux**

| Jeu | Mécanique simulée | Valeur de référence |
| --- | --- | --- |
| Loto | tirage par grille, rangs de gain | jackpot : 1 chance sur 19 068 840 ([FDJ](https://www.fdj.fr/mag/questions/article-chances-gagner-jeux-de-loterie)) |
| EuroMillions | idem | jackpot : 1 chance sur 139 838 160 ([FDJ](https://www.fdj.fr/mag/questions/article-chances-gagner-jeux-de-loterie)) |
| Tickets à grattage | gain tiré selon le barème du ticket | environ 70 % des mises redistribués, selon le ticket ([Presse-citron](https://www.presse-citron.net/fdj-voici-les-8-numeros-qui-tombent-le-plus-souvent-au-tirage-du-loto/)) |
| Paris sportifs en ligne | pari sur une cote, issue tirée | retour aux joueurs plafonné à 85 % des mises par an ([ANJ](https://ressources.anj.fr/regulation/trj/regle_determination_trj.pdf)) |
| Paris hippiques, poker, casino | même principe | à calibrer au taux de retour de chaque jeu |

Le taux de retour est le cœur du calcul : sur 100 € misés en paris sportifs, le personnage récupère en moyenne au plus 85 €, avec une forte variance d'une année à l'autre.

**Profil de joueur (état)**

Le jeu suit la chaîne commune des addictions (section 9, décision du 23 octobre 2026) : jamais\_expose et expose (non-joueur), usage\_occasionnel (occasionnel), usage\_regulier (régulier), dependance (pathologique), sevrage, abstinent. « À risque » n'est pas un état : c'est le signal des pertes élevées (au-delà du seuil de chasse aux pertes), qui ouvre l'événement « se refaire ».

| Transition | Facteurs qui l'augmentent | Facteurs qui la réduisent |
| --- | --- | --- |
| expose → occasionnel | choix de jouer (premier jeu selon l'époque), âge 18+, homme | refuser |
| occasionnel → régulier | impulsivite, gros gain précoce, chômage, miser plus | liens |
| régulier → dépendance | « se refaire » après une perte, dettes, isolement, alcool actif, santeMentale basse | interdiction volontaire de jeu |
| dépendance → sevrage → abstinent | choix « arrêter », « se faire aider », interdiction volontaire | rechute possible (voir section 9) |

**Le piège de la « chasse aux pertes »**

Quand le personnage perd plus de 10 % de ses revenus annuels au jeu, un événement propose de « se refaire ». Accepter double la mise de l'année suivante et augmente fortement la probabilité de passer au stade supérieur. C'est le mécanisme réel du jeu pathologique, rendu jouable.

**Choix du joueur**

- Jouer ou non, à quel jeu, avec quel budget annuel (aucun, petit, moyen, gros).
- S'inscrire à l'interdiction volontaire de jeux (bloque les jeux en ligne et en casino).
- Demander de l'aide (Joueurs Info Service, consultation spécialisée).
- Cacher ses pertes à son conjoint : évite un conflit immédiat, augmente le risque de séparation plus tard.

**Dans le jeu** (jalon 5)

- Chaque jeu a ses règles dans `jeuxArgent` : prix d'une mise et rangs de gain (probabilité, gain). Le nombre de mises gagnantes de chaque rang est tiré chaque année (loi binomiale) ; le taux de retour en découle et reste toujours inférieur à 1.
- Le premier jeu proposé dépend de l'époque : tiercé et casino, puis loto (1976), tickets à grattage (1989), EuroMillions (2004), paris sportifs en ligne (2010).
- La mise annuelle suit le budget choisi, plus lourde en jeu régulier et en dépendance, doublée l'année qui suit un « se refaire ». Mises et gains entrent dans le bilan annuel ; les totaux misés et récupérés de toute la vie restent affichés.
- L'interdiction volontaire bloque les paris en ligne, le poker et le casino, et freine l'escalade.
- Cacher ses pertes à son conjoint (jalon 6) : quand les pertes de l'année sont élevées et que le joueur vit en couple, un événement propose de les cacher (le risque de séparation monte pour plusieurs années) ou de tout dire (une dispute tout de suite, un risque à peine plus haut). Les facteurs « pub sportive », « ennui » et « mises plafonnées » ne sont pas encore modélisés.

## 9. Module addictions

Toutes les addictions partagent la même chaîne d'états ; seuls changent l'âge d'exposition, les probabilités de transition et les effets. Le jeu d'argent (section 8) est une instance de cette chaîne.

**Chaîne commune**

jamais\_expose → expose → usage\_occasionnel → usage\_regulier → dependance → sevrage → abstinent, avec un retour possible de sevrage ou abstinent vers usage\_regulier (rechute).

&#91;embedded content: chaîne d'états des addictions · 7 états, rechute\]

Le joueur n'agit que sur deux transitions : l'initiation et la décision d'arrêter. Toutes les autres sont tirées au hasard.

- **Exposition** : tirée selon l'âge et le milieu (entourage qui consomme, fêtes, milieu professionnel). Elle n'est pas un choix.
- **Initiation** (expose → occasionnel) : premier vrai choix du joueur, proposé par un événement (« on te propose une cigarette »). Refuser est toujours possible, mais refuser plusieurs fois de suite peut coûter un peu de liens à l'adolescence.
- **Escalade** (occasionnel → régulier → dépendance) : tirée chaque année, sans choix direct. Facteurs : impulsivite, vulnerabiliteGenetique, santeMentale basse, chocs de vie (deuil, chômage, séparation).
- **Sortie** : seulement par choix (« arrêter seul », « se faire aider »). Se faire aider double les chances de succès du sevrage.
- **Rechute** : risque élevé la première année d'abstinence, puis décroissant. Facteurs : stress, entourage consommateur.

**Paramètres par produit**

| Addiction | Âge d'exposition typique | Escalade | Coût annuel | Effets principaux |
| --- | --- | --- | --- | --- |
| Tabac | 12–18 | forte | moyen | santePhysique −, risque de cancer et de maladie cardiovasculaire |
| Alcool | 14–20 | moyenne | variable | santePhysique −, accidents, violences, emploi |
| Cannabis | 14–20 | faible à moyenne | moyen | santeMentale −, scolarité, risque judiciaire |
| Autres drogues | 16–30 | forte | élevé | santé, surdose possible, emploi, dettes |
| Jeux d'argent | 18+ | variable | variable | dettes, couple, santeMentale (section 8) |
| Écrans / jeux vidéo | 8–25 | moyenne | faible | sommeil, scolarité, liens |

Les âges et niveaux sont des valeurs de départ pour le prototype ; les probabilités réelles viendront des enquêtes OFDT et Santé publique France (section 13).

**Interactions**

- Une addiction active multiplie le risque d'en développer une autre (alcool et jeu, tabac et cannabis).
- Chaque addiction active pèse sur les événements des autres modules : licenciement, séparation, accident, maladie.
- Les dépenses liées entrent dans le bilan annuel (section 7).

**Dans le jeu** (jalon 5)

- Chaque année, chaque produit fait un tirage selon son état : exposition (à partir de l'âge minimum du produit, selon la période, le sexe et la sociabilité), initiation, escalade, dépendance, arrêt, rechute. Tous passent par la formule des cotes.
- Les risques d'initiation, d'escalade et de rechute décroissent avec les années passées dans l'état : on commence, on s'installe dans un usage et on rechute surtout au début.
- Initiation : des événements de proposition (adolescence et début de l'âge adulte) ; accepter multiplie fortement les cotes de l'initiation, refuser les réduit, à l'adolescence au prix d'un peu de liens. Arrêt : un événement propose d'arrêter seul ou de se faire aider ; se faire aider divise par deux les cotes de rechute pendant le sevrage. Les ressources d'aide s'affichent avec ces événements.
- Effets annuels et coût de chaque état dans `effetsAddictions` ; interactions entre produits dans `interactionsAddictions` ; poids d'une addiction active sur les tags des autres modules (perte d'emploi, accident, violence, police, décrochage, dettes, maladies) dans `addictionsAutresTags`. Une addiction active augmente aussi le risque de séparation (section 11).
- Autres drogues : surdose possible, sans détail, avec Drogues Info Service.
- Toutes les probabilités sont des valeurs de travail `aCalibrer` (enquêtes OFDT et Santé publique France au jalon 8).

## 10. Module santé et mortalité

Chaque année, le personnage passe un test de mortalité basé sur les tables INSEE, corrigé par sa catégorie sociale et ses facteurs de risque. Les maladies sont des événements qui dégradent les jauges et augmentent ce risque.

**Test de mortalité annuel**

```latex
q_{final} = f\left(q_{INSEE}(age, sexe, annee),\ m_{PCS},\ m_{addictions},\ m_{maladies},\ m_{santePhysique}\right)
```

- **q INSEE** : probabilité de décéder dans l'année à cet âge, pour ce sexe et cette année calendaire (tables du moment).
- **m PCS** : l'écart d'espérance de vie entre cadres et ouvriers se reproduit par un multiplicateur sur la mortalité adulte.
- Les autres multiplicateurs passent par la formule des cotes de la section 4.

La table de mortalité couvre toutes les causes de décès. Au calibrage, toute cause modélisée par un événement mortel (accident, surdose, maladie) est retirée de la table, pour ne pas compter deux fois les mêmes décès. Jusque-là, un léger excès de mortalité est accepté.

**Maladies**

| Catégorie | Âge | Facteurs de risque | Effet |
| --- | --- | --- | --- |
| Infections et maladies de l'enfance | 0–10 | décile bas, logement précaire | santePhysique − temporaire |
| Maladies chroniques (diabète, hypertension) | 35+ | alimentation, sédentarité, génétique | santePhysique −, coût, mortalité + |
| Cancers | 40+ | tabac, alcool, génétique, âge | traitement, arrêt de travail, mortalité ++ |
| Maladies cardiovasculaires | 45+ | tabac, stress, alimentation | mortalité ++ |
| Troubles psychiques (dépression, anxiété) | 12+ | chocs de vie, addictions, résilience basse | santeMentale −−, emploi |
| Démence, dépendance | 75+ | âge, génétique | perte d'autonomie, EHPAD |

**Accidents**

Accident de la route (jeunes conducteurs, alcool), accident domestique (enfants, personnes âgées), accident du travail (section 6). Chacun peut être bénin, grave ou mortel.

**Comportements de santé (choix)**

- Activité physique, alimentation, sommeil : un choix de mode de vie tous les 5 ans environ, qui applique des multiplicateurs durables.
- Consulter ou non lors d'un symptôme : consulter tôt améliore le pronostic.

**Accès aux soins**

Le territoire (désert médical), la complémentaire santé et le décile modifient la probabilité de renoncer aux soins, et donc la gravité des maladies.

Le suicide n'est pas un événement du jeu. Une santé mentale très basse déclenche des événements de soutien (proche, médecin) et l'affichage de ressources d'aide (section 13).

**Dans le jeu** (jalon 6)

- Mortalité : la table `mortalite`, corrigée par la formule des cotes avec les multiplicateurs de `mortaliteFacteurs` (PCS à partir de l'âge adulte, addictions actives), ceux des maladies actives (`maladies`) et un terme de santé physique centré (`parametresSante`).
- Vieillissement : dérive annuelle des jauges selon l'âge (`vieillissement`) ; le moral revient chaque année vers une cible, d'autant plus vite que la résilience est haute.
- Maladies : chacune commence par un événement de contenu (effet `maladie`), puis ses effets annuels et son coût (`maladies`) s'appliquent tant qu'elle est active. Cancer, maladie cardiovasculaire et dépression peuvent guérir : le choix proposé au diagnostic (se soigner, attendre) multiplie les cotes de guérison ; la campagne et les revenus modestes les réduisent (accès aux soins). Maladie chronique et démence ne guérissent pas.
- Le tabac et l'alcool pèsent sur le risque de cancer et de maladie cardiovasculaire, l'alcool, les drogues et le jeu sur celui de dépression (`addictionsAutresTags`).
- Mode de vie : un choix environ tous les dix ans (bouger plus, mieux manger) réduit pour cinq ans les cotes de maladie chronique et cardiovasculaire.
- Santé mentale basse : événement de soutien avec les ressources d'aide (3114).
- La table de mortalité compte déjà les décès par maladie : jusqu'au calibrage, l'âge moyen de décès perd environ trois ans. Toutes les valeurs sont `aCalibrer` (DREES, Santé publique France, INSEE au jalon 8).

## 11. Vie affective, famille et logement

Le couple, les enfants et le logement sont des états qui pèsent sur l'argent et le bien-être, et qui servent d'amortisseurs ou d'amplificateurs aux autres modules.

**Couple**

- États : celibataire → en\_couple → cohabitation → pacs / mariage → separation → veuvage.
- Rencontre : tirée chaque année à partir de 16 ans, augmentée par sociabilite et les choix de sortie.
- Séparation : augmentée par les dettes, les addictions actives, le jeu caché, le chômage prolongé ; réduite par liens élevés.
- Effets : un couple stable donne + liens et partage les charges ; une séparation coûte en argent (deux logements) et en santé mentale.

**Enfants**

- Désir d'enfant : choix du joueur, puis tirage de la naissance (fertilité selon l'âge).
- Coût annuel par enfant, compensé en partie par les allocations familiales.
- Effet sur la carrière plus fort pour les femmes (temps partiel, progression ralentie), conformément aux données.
- Les enfants deviennent des personnages secondaires dont la réussite dépend de la situation du joueur : c'est la reproduction sociale vue de l'autre côté.

**Violences conjugales**

Événement rare, réservé aux joueurs de 15 ans et plus, présenté sans détail graphique. Il ouvre un choix de départ et l'affichage de ressources d'aide.

**Logement**

| État | Accès | Coût |
| --- | --- | --- |
| Chez les parents | par défaut jusqu'au départ | nul |
| Locataire privé | revenus ≥ 3 × loyer | loyer de marché selon le territoire |
| HLM | sous plafond de revenus, file d'attente tirée | loyer réduit |
| Propriétaire | apport + crédit (section 7) | mensualité, puis patrimoine |
| Précaire / sans domicile | dettes critiques, rupture, addiction | santé −−, emploi −− |

**Mobilité**

Déménager vers une autre région est un choix : il change la grille de salaire, les loyers et peut coûter des liens.

**Dans le jeu** (jalon 6)

- Couple : rencontre tirée chaque année à partir de 16 ans (courbe par âge, sociabilité, choix de sortir). En couple, une seule avancée par an : vie commune ou mariage direct, puis mariage ou PACS (à partir de la loi de 1999), avec des propensions qui changent selon la décennie (`unions`). Pas de naissance l'année de la rencontre.
- Séparation : tirée chaque année, plus fréquente pour un couple qui ne vit pas ensemble, moins pour un couple marié ou pacsé ; augmentée par les dettes, une addiction active, le chômage prolongé, les choix (cacher ses pertes au jeu, s'éloigner lors d'une dispute) ; réduite par des liens forts. Elle coûte du moral, des liens et, en vie commune, de l'argent la première année.
- Veuvage : mortalité du conjoint, d'âge proche, par la table de mortalité de l'autre sexe.
- Enfants : naissance tirée selon la fécondité à l'âge de la mère, réduite avec le nombre d'enfants et hors vie commune ; un événement de projet d'enfant la multiplie ou la réduit pendant quelques années. À la naissance, une mère salariée passe plus souvent à temps partiel et sa progression ralentit davantage que celle d'un père (`effetsEnfant`).
- Parents : le dernier parent meurt selon la table de mortalité, à partir des 18 ans du joueur. Deuil, puis héritage (section 7).
- Logement : le départ de chez les parents est tiré à partir de 18 ans, plus fréquent pour qui travaille, et forcé par la vie commune, la fin d'un placement ou le décès des parents. La destination dépend des revenus : location si le revenu atteint trois fois le loyer, sinon HLM sous plafond de ressources (file d'attente tirée, accélérée par une demande), sinon on reste, ou, si le départ est forcé, sans logement stable. Sans logement stable : santé physique en baisse et risque de chômage accru chaque année, jusqu'à en sortir.
- Violences conjugales : événement rare à partir de 15 ans, sans détail, avec le 3919 ; partir rend la séparation presque certaine.
- Mobilité : une offre d'emploi dans une autre région (plus fréquente pour les diplômés du supérieur et les chômeurs) propose de déménager ; accepter coûte des liens, donne un CDI et tire une région (hors celle quittée) et un territoire dans `mobilite`. Le lieu de vie (`residence`) remplace alors l'origine pour la grille de salaire, les loyers, la dépense de vie, l'accès aux soins, le non-recours et les conditions sur la région ou le territoire. On quitte ses parents ou son HLM pour une location ; un propriétaire ne se voit pas proposer de partir.
- Discrimination au logement : un refus de location, plus fréquent pour les personnes immigrées ou enfants d'immigrés (discrimination mesurée par les testings), coûte du moral et ralentit pendant deux ans le départ de chez les parents et l'accès au HLM. Le Défenseur des droits est proposé. C'est le seul usage de l'origine migratoire dans ce module (section 14).
- Les enfants ne sont pas encore des personnages secondaires (réussite selon la situation du joueur) : ils viendront avec le bilan (jalon 7).
- Toutes les probabilités sont des valeurs de travail `aCalibrer` (INED, INSEE au jalon 8).

## 12. Contexte historique et événements aléatoires

Le calendrier réel de la France sert de toile de fond : chaque année calendaire porte un contexte qui modifie les probabilités de tous les modules. Deux joueurs nés à 30 ans d'écart ne vivent pas les mêmes crises.

**Chronologie 1950–2026**

| Année | Événement | Qui est touché | Effet de jeu |
| --- | --- | --- | --- |
| 1950–1973 | Trente Glorieuses, plein emploi, exode rural | tous | chômage très bas, départ des campagnes, agriculteurs en baisse |
| 1954–1962 | Guerre d'Algérie | pères des premières générations (appelés) | événement familial au tirage de l'origine |
| 1959 | Réforme Berthoin : école obligatoire jusqu'à 16 ans | enfants nés à partir de 1953 | sortie de scolarité impossible avant 16 ans |
| 1965 | Les femmes mariées peuvent travailler et ouvrir un compte sans l'accord du mari | femmes mariées | débloque l'emploi et l'épargne autonomes |
| 1967 | Loi Neuwirth : contraception autorisée | femmes | le joueur maîtrise davantage les naissances |
| 1968 | Mai 68, accords de Grenelle | salariés | hausse des bas salaires |
| 1970 | Loi du 31 décembre 1970 sur les stupéfiants | consommateurs de drogues | risque judiciaire actif |
| 1973 et 1979 | Chocs pétroliers | tous, surtout l'industrie | fin du plein emploi, licenciements en hausse |
| 1974 | Majorité à 18 ans (au lieu de 21) | jeunes | autonomie légale dès 18 ans |
| 1975 | Loi Veil (IVG), divorce par consentement mutuel, collège unique | femmes, couples, élèves | choix de grossesse, séparation facilitée, tous au collège |
| 1976 | Premier tirage du Loto national (19 mai) | adultes | Loto disponible |
| 1982 | Retraite à 60 ans, 39 heures, 5e semaine de congés payés | salariés | âge légal 60 ans, bienEtre + |
| 1980–1990s | Chômage de masse, désindustrialisation (mines, sidérurgie, textile) | ouvriers, régions industrielles | licenciements +, chômage long + |
| 1980–1990s | Épidémie de VIH, vague d'héroïne | jeunes adultes | risques santé et drogues + |
| 1985 | Création du bac professionnel, objectif de 80 % d'une classe d'âge au niveau bac | élèves | voie pro, bacheliers en forte hausse |
| 1988 | Création du RMI (1er décembre) | personnes sans ressources | premier minimum social général |
| 1990 | Banco, premier jeu à gratter | adultes | grattage disponible |
| 1991 | Loi Évin (publicité tabac et alcool encadrée) | tous | exposition au tabac et à l'alcool en baisse |
| 1993 | Réforme Balladur : 40 ans de cotisation, 25 meilleures années (privé) | salariés du privé | pension en baisse, départ plus tardif |
| jusqu'en 2002 | Service militaire obligatoire, suspendu pour les hommes nés après 1978 (loi de 1997) | hommes nés 1950–1978 | environ 1 an de service vers 18–22 ans |
| 1999 | Création du PACS | couples | état pacs disponible |
| 2000 | Couverture maladie universelle (CMU) | faibles revenus | renoncement aux soins en baisse |
| 2000–2002 | 35 heures | salariés | temps libre + |
| 2001 | Prime pour l'emploi | bas salaires | complément de revenu |
| 2002 | Euro en espèces (1er janvier) | tous | affichage des montants |
| 2003 | Canicule d'août : environ 15 000 décès supplémentaires | personnes âgées, isolées | mortalité des 75 ans et + en forte hausse cet été-là |
| 2003 | Réforme Fillon, départ anticipé pour carrière longue | salariés, fonctionnaires | durée de cotisation +, départ anticipé possible |
| 2004 | Lancement d'EuroMillions (février) | adultes | EuroMillions disponible |
| 2007–2008 | Interdiction de fumer dans les lieux publics (2007), puis cafés et restaurants (2008) | fumeurs | initiation en baisse, arrêt facilité |
| 2008–2012 | Crise financière puis crise de la dette | tous | licenciements +, crédit plus difficile |
| 2009 | Le RSA remplace le RMI (1er juin) | faibles revenus | minimum social et complément d'activité |
| 2010 | Ouverture des paris sportifs et du poker en ligne (loi du 12 mai) | adultes, surtout hommes jeunes | exposition aux jeux d'argent en ligne + |
| 2010 | Réforme Woerth : âge légal porté à 62 ans | nés à partir de 1951 | départ plus tardif |
| 2013 | Mariage ouvert aux couples de même sexe | couples | mariage disponible pour tous les couples |
| 2014 | Réforme Touraine : durée de cotisation portée progressivement à 43 ans | nés à partir de 1958 | durée de cotisation + |
| 2016 | La prime d'activité remplace le RSA activité et la PPE (1er janvier) | bas salaires | complément de revenu |
| 2017 | Paquet de cigarettes neutre | fumeurs | initiation en baisse |
| 2018 | Parcoursup remplace APB | bacheliers | nouvelle procédure d'orientation |
| 2020 | Covid-19 : confinement à partir du 17 mars, chômage partiel | tous | santeMentale −, scolarité perturbée, mortalité des âgés + |
| 2020 | L'ANJ remplace l'ARJEL | joueurs | encadrement des jeux d'argent renforcé |
| 2021 | Premier bac réformé (fin des séries L, ES, S) | lycéens | orientation par spécialités |
| 2022–2023 | Forte inflation | tous, surtout déciles bas | pouvoir d'achat −, dettes + |
| 2023 | Réforme Borne : âge légal porté progressivement à 64 ans (en vigueur le 1er septembre) | nés à partir de 1961 | départ plus tardif |
| 2026 | Suspension partielle de la réforme de 2023 (LFSS 2026), à partir du 1er septembre | nés 1964–1968 | âge légal gelé à 62 ans et 9 mois, 170 trimestres ; 64 ans maintenu pour les nés en 1969 et après |

L'âge légal et le nombre de trimestres requis par génération forment une table à part (génération → âge, trimestres), à reprendre du simulateur officiel de l'Assurance retraite.

**Âge légal de départ par génération** (règles de droit, valeurs officielles)

| Génération | Âge légal | Texte |
| --- | --- | --- |
| 1950 | 60 ans | réforme de 1982 (ordonnance du 26 mars 1982) |
| 1951 | 60 ans et 4 mois | réforme Woerth (loi n° 2010-1330 du 9 novembre 2010, accélérée par la LFSS 2012) |
| 1952 | 60 ans et 9 mois | réforme Woerth |
| 1953 | 61 ans et 2 mois | réforme Woerth |
| 1954 | 61 ans et 7 mois | réforme Woerth |
| 1955 à 1960 | 62 ans | réforme Woerth |
| 1961 | 62 ans et 3 mois | réforme Borne (LFRSS 2023, loi n° 2023-270 du 14 avril 2023) |
| 1962 | 62 ans et 6 mois | réforme Borne |
| 1963 | 62 ans et 9 mois | réforme Borne |
| 1964 à 1968 | 62 ans et 9 mois | suspension partielle de la réforme de 2023 (LFSS 2026) |
| 1969 et après | 64 ans | réforme Borne |

Source : Assurance retraite et textes de loi cités. Le jeu fait partir le personnage l'année où il atteint l'âge légal (âge en années entières, mois ignorés). Le nombre de trimestres requis reste une valeur de travail à calibrer.

Après 2026, le jeu tire un futur plausible (croissance, crise, stabilité) au lieu d'inventer des événements précis.

**Dans le jeu** : chaque entrée de cette chronologie est une entrée de `contenu/contexte/`, datée et sourcée, de quatre types : actualité (française ou internationale, bandeau FLASH INFO), crise (qui module les modules selon le profil : par exemple la désindustrialisation pèse sur les licenciements des ouvriers), loi (qui change une règle à sa date d'entrée en vigueur : par exemple le bac professionnel n'existe qu'à partir de 1987) et mouvement social (avec un choix de participation). Les effets chiffrés sont `aCalibrer`.

**Événements aléatoires de la vie**

Répartis en trois familles, chacune avec sa probabilité conditionnelle (section 4) :

- **Chocs** : deuil d'un proche, maladie d'un parent, cambriolage, catastrophe naturelle selon la région, perte d'emploi du conjoint.
- **Chances** : rencontre décisive, mentor, héritage inattendu, gain au jeu, promotion surprise.
- **Bifurcations** : proposition de partir à l'étranger, de créer une entreprise, de reprendre l'affaire familiale.

Chaque événement a un texte de récit court, avec des variantes selon l'âge et le milieu, pour que le journal se lise comme une histoire.

## 13. Fin de partie, garde-fous et calibrage

La partie se termine au décès par un bilan qui compare la vie jouée à la moyenne française et à ce qu'elle aurait pu être avec une autre origine. C'est ce bilan qui donne son sens au jeu.

**Écran de bilan**

- Âge et cause du décès, comparés à l'espérance de vie de la génération.
- Courbe des jauges sur toute la vie.
- Revenus cumulés, patrimoine transmis, décile atteint par rapport au décile de naissance (mobilité sociale).
- Total misé et récupéré aux jeux d'argent ; années passées en dépendance ; coût total des addictions.
- « Même choix, autre naissance » : rejouer la même graine de choix avec une origine opposée, pour montrer l'effet du hasard de naissance.
- Partage de la partie par sa graine.

**Dans le jeu** (jalon 7)

- Le bilan s'affiche à la mort : cause (événement mortel, ou maladie active la plus mortelle, sinon causes naturelles), espérance de vie de la génération (calculée sur la table de mortalité, année après année), moral moyen par décennie, décile à la naissance et décile du revenu à 60 ans (ou à la dernière année vécue avant), diplôme, métier, années de chômage, revenus de la vie, années en dépendance et coût des addictions, patrimoine transmis, jeux d'argent sur toute la vie. Les seuils de déciles sont dans `seuilsDeciles`, `aCalibrer`.
- « Mêmes choix, autre naissance » : même graine (mêmes traits, mêmes tirages), même sexe, même année, même région ; origine sociale de l'autre bout de l'échelle (enfant de cadres diplômés du supérieur, 9e décile, propriétaires, en grande ville ; ou enfant d'ouvriers, CAP, 2e décile, HLM, en quartier populaire). Chaque événement qui revient au même âge reçoit le même choix ; les autres sont tranchés comme en AUTO. Le joueur peut ensuite vivre cette vie.
- Enfants : chacun naît avec l'origine que lui donne la situation du joueur ce jour-là (lieu de vie, métier, diplôme, décile du revenu du foyer, logement, couple ou famille monoparentale) et vit sa vie en AUTO ; le bilan en donne une ligne. C'est la reproduction sociale vue de l'autre côté.
- Partage : un lien avec la graine (et l'année si elle avait été imposée) ; les vies passées et la partie en cours se reconstruisent par leur graine et leurs choix.

**Garde-fous**

- Âge conseillé : 15 ans et plus, affiché à l'accueil.
- Pas de scène de suicide, pas de détail graphique sur les violences ou les surdoses.
- Jeux d'argent : jamais présentés comme une stratégie gagnante ; le taux de retour et le total perdu sont toujours visibles.
- Drogues : effets et conséquences, aucune information de consommation (doses, modes d'usage).
- Ressources affichées aux moments sensibles : Joueurs Info Service, Drogues Info Service, Tabac Info Service, Alcool Info Service, 3114 (prévention du suicide), 3919 (violences conjugales).
- Origine migratoire : utilisée seulement pour modéliser les discriminations mesurées (embauche, logement), jamais pour des comportements.

**Sources de calibrage**

| Module | Organisme | Données |
| --- | --- | --- |
| Naissance, mortalité, PCS, salaires, revenus | INSEE | tables de mortalité, état civil, enquêtes Emploi, revenus fiscaux |
| Éducation | DEPP (ministère de l'Éducation) | parcours et réussite selon l'origine sociale |
| Santé, aides sociales | DREES, Santé publique France | Baromètre santé, minima sociaux, renoncement aux soins |
| Addictions, jeux d'argent | OFDT, ANJ | prévalences, âges d'initiation, jeu problématique |
| Endettement | Banque de France | surendettement |
| Couples, familles | INED | mise en couple, séparations, fécondité |

**Ordre de construction conseillé**

1. Moteur : personnage, boucle annuelle, formule des cotes, graine.
2. Tirage à la naissance + mortalité INSEE : on obtient déjà une vie complète.
3. Éducation et emploi, puis le bilan annuel d'argent.
4. Jeux d'argent et addictions.
5. Couple, enfants, logement, contexte historique.
6. Récit, bilan final, équilibrage.

**Sources consultées**

- [FDJ – chances de gagner aux jeux de loterie](https://www.fdj.fr/mag/questions/article-chances-gagner-jeux-de-loterie)
- [ANJ – règle de plafonnement du taux de retour aux joueurs](https://ressources.anj.fr/regulation/trj/regle_determination_trj.pdf)
- [Presse-citron – taux de redistribution des tickets FDJ](https://www.presse-citron.net/fdj-voici-les-8-numeros-qui-tombent-le-plus-souvent-au-tirage-du-loto/)
- [FDJ – histoire du Loto](https://www.fdj.fr/mag/coulisses/article-histoire-loto) et [origines de la FDJ](https://www.fdj.fr/mag/coulisses/article-origines-histoire-fdj)
- [FDJ United – lancement d'EuroMillions](https://www.fdjunited.com/history/)
- [DREES – minima sociaux (RMI, RSA, prime d'activité)](https://drees.solidarites-sante.gouv.fr/definitions/definitions-et-baremes-relatifs-aux-minimas-sociaux)
- [INSERM – surmortalité liée à la canicule d'août 2003](https://hal-lara.archives-ouvertes.fr/hal-01571621v1/document)
- [Sénat – loi de 1997 portant réforme du service national](https://www.senat.fr/leg/97-TA3.html)
- [Assemblée nationale – interdiction de fumer dans les lieux publics](https://questions.assemblee-nationale.fr/dyn/13/questions/QANR5L13QE17887.pdf)
- [Quelles aides – suspension de la réforme des retraites 2026](https://quelles-aides.fr/mag/reformes/suspension-reforme-retraites-2026-1er-septembre-generations-1964-1968/)
- [Moneyvox – suspension de la réforme, âge légal et trimestres](https://www.moneyvox.fr/retraite/actualites/107609/combien-de-futurs-retraites-vont-profiter-de-la-suspension-de-la-reforme)

## 14. Sécurité, délinquance et police

Ce module montre la sécurité telle qu'elle est vécue et mesurée : on peut en être victime partout, les contrôles visent certains plus que d'autres, et la délinquance naît de facteurs sociaux, jamais de l'origine. Ton sobre et factuel, aucun détail graphique, aucune valorisation de la délinquance. Toutes les statistiques réelles s'écrivent `[N]` ; les probabilités sont `aCalibrer`.

**Être victime** (vol, agression, harcèlement)

- Probabilité selon le territoire (plus forte en quartier prioritaire), l'âge et le sexe. Possible partout.
- Après une violence subie, le jeu affiche les ressources d'aide : 116 006 (aide aux victimes) et le Défenseur des droits.

**Contrôles d'identité et violences policières**

- Contrôles d'identité : probabilité selon le territoire, l'âge, le sexe et l'origine migratoire. C'est un usage autorisé de l'origine, car il s'agit d'une discrimination mesurée (enquête « Accès aux droits » du Défenseur des droits, 2017).
- Violences policières : rares, plus fréquentes en quartier prioritaire, possibles partout.
- Après une violence ou un contrôle abusif, trois choix : porter plainte, saisir le Défenseur des droits, ou ne rien faire. Chacun a un coût différent sur les jauges, puis des suites possibles (plainte classée ou qui aboutit, réponse du Défenseur, mal-être si rien n'est fait).

**Petite délinquance**

- L'entrée dans la petite délinquance est un choix du joueur, proposé par un événement, et toujours refusable.
- Sa probabilité d'être proposée dépend de facteurs sociaux uniquement : décrochage scolaire, chômage, fréquentations, précarité, impulsivité. **Jamais de l'origine migratoire.**
- Accepter n'apporte aucun gain : cela rend plus probables les suites judiciaires pendant quelques années.

**Conséquences judiciaires**

- Garde à vue, puis condamnation possible pour qui a déjà été placé en garde à vue.
- Une condamnation inscrit un casier judiciaire, qui pèse ensuite sur l'embauche (transitions vers l'emploi moins probables).
- L'état « justice » garde le nombre de gardes à vue, le nombre de condamnations et la présence d'un casier.

**Règle de l'origine migratoire**

Seul un événement tagué `discrimination` peut tester l'origine migratoire, et jamais un événement tagué `delinquance`, même s'il porte aussi `discrimination`. Le validateur de contenu l'interdit partout ailleurs.

