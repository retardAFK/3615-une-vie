// Calibrage par simulation (npm run data, dernière étape) : le moteur ajoute à la table
// de mortalité ses propres causes (maladies, addictions, santé, événements mortels) et
// n'applique la fécondité qu'aux couples. On joue des vies en AUTO, on compare à la
// réalité, et on ajuste :
// - correctionMortalite : multiplicateur des cotes de décès, par sexe, décennie et âge,
//   pour que les décès simulés égalent ceux qu'attend la table Insee ;
// - facteurFecondite (parametresFamille) : pour que les naissances simulées égalent
//   celles qu'auraient les mêmes femmes avec les taux réels de leur année et de leur âge.
// Construit par Vite (SSR) comme le banc d'essai, puis exécuté par Node.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { creerPartie, jouerAnneeAuto } from '../../src/moteur/boucle';
import { AGE_MAXIMAL } from '../../src/moteur/constantes';
import { probabiliteDecesTable } from '../../src/moteur/modules/sante';
import { chercherLigne, periodeDe } from '../../src/moteur/tables';
import type { Donnees, LigneCourbe, Sexe, Table, Tables } from '../../src/moteur/types';
import { contenuDuJeu } from '../../src/ui/donnees';

const SORTIE = join(process.cwd(), 'public', 'data');
const VIES = 15_000;
const ITERATIONS = 6;
/** Tranches d'âge de la correction : assez de décès par tranche pour un rapport stable. */
const LARGEUR_TRANCHE = 5;
const DECES_MINIMUM = 15;
const BORNES: readonly [number, number] = [0.05, 5];
const FUTUR = 'futur';
const PERIODES = [
  '1950-1959',
  '1960-1969',
  '1970-1979',
  '1980-1989',
  '1990-1999',
  '2000-2009',
  '2010-2019',
  '2020-2029',
];
const SEXES: readonly Sexe[] = ['femme', 'homme'];

const tablesInitiales = Object.fromEntries(
  Object.entries(
    import.meta.glob<unknown>('../../public/data/*.json', { eager: true, import: 'default' }),
  ).map(([chemin, table]) => [chemin.split('/').at(-1)!.replace('.json', ''), table]),
) as unknown as Tables;
const contenu = contenuDuJeu();

const tranches = Math.floor(AGE_MAXIMAL / LARGEUR_TRANCHE) + 1;
const periodeCalibree = (annee: number): string => {
  const p = periodeDe(annee);
  return PERIODES.includes(p) ? p : FUTUR;
};

/** Correction courante : sexe → période (ou futur) → multiplicateur par tranche d'âge. */
type Correction = Record<Sexe, Record<string, number[]>>;
const neutre = (): Correction =>
  Object.fromEntries(
    SEXES.map((s) => [
      s,
      Object.fromEntries([...PERIODES, FUTUR].map((p) => [p, Array(tranches).fill(1)])),
    ]),
  ) as Correction;

function tableCorrection(correction: Correction, source: string): Table<LigneCourbe> {
  const parAge = (parTranche: number[]): number[] =>
    Array.from({ length: AGE_MAXIMAL + 1 }, (_, age) =>
      Number(parTranche[Math.floor(age / LARGEUR_TRANCHE)]!.toPrecision(3)),
    );
  return {
    table: 'correctionMortalite',
    source,
    url: null,
    aCalibrer: false,
    lignes: SEXES.flatMap((sexe) => [
      ...PERIODES.map((periode) => ({
        conditions: { sexe, periode },
        parAnnee: parAge(correction[sexe][periode]!),
      })),
      { conditions: { sexe }, parAnnee: parAge(correction[sexe][FUTUR]!) },
    ]),
  };
}

function avecReglages(correction: Correction, facteur: number): Tables {
  const famille = tablesInitiales.parametresFamille;
  return {
    ...tablesInitiales,
    correctionMortalite: tableCorrection(correction, 'calibrage en cours'),
    parametresFamille: {
      ...famille,
      lignes: [
        {
          conditions: {},
          valeurs: { ...famille.lignes[0]!.valeurs, facteurFecondite: facteur },
        },
      ],
    },
  };
}

interface Mesure {
  /** Décès attendus (table Insee) et observés, par sexe, période et tranche. */
  attendus: Correction;
  observes: Correction;
  naissancesAttendues: number;
  naissancesObservees: number;
  ageMoyen: Record<Sexe, number>;
}

function mesurer(tables: Tables): Mesure {
  const donnees: Donnees = { tables, ...contenu };
  const attendus = neutre();
  const observes = neutre();
  for (const s of SEXES) {
    for (const p of [...PERIODES, FUTUR]) {
      attendus[s][p]!.fill(0);
      observes[s][p]!.fill(0);
    }
  }
  let naissancesAttendues = 0;
  let naissancesObservees = 0;
  const ages: Record<Sexe, number[]> = { femme: [], homme: [] };
  for (let i = 0; i < VIES; i++) {
    let etat = creerPartie(`calibrage-${i}`, donnees);
    const { sexe } = etat.personnage.origine;
    while (etat.personnage.vivant) {
      const { age } = etat.personnage;
      const { annee } = etat;
      const periode = periodeCalibree(annee);
      const tranche = Math.floor(age / LARGEUR_TRANCHE);
      attendus[sexe][periode]![tranche]! += probabiliteDecesTable(age, sexe, annee, tables);
      const enfants = etat.personnage.etats.famille.enfants.length;
      if (sexe === 'femme' && age >= 15 && age <= 50) {
        naissancesAttendues +=
          chercherLigne(tables.fecondite, { periode: periodeDe(annee) }, ['periode']).parAnnee[
            age
          ] ?? 0;
      }
      etat = jouerAnneeAuto(etat, donnees).etat;
      if (!etat.personnage.vivant) observes[sexe][periode]![tranche]! += 1;
      else if (sexe === 'femme') {
        naissancesObservees += etat.personnage.etats.famille.enfants.length - enfants;
      }
    }
    ages[sexe].push(etat.personnage.age);
  }
  const moyenne = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
  return {
    attendus,
    observes,
    naissancesAttendues,
    naissancesObservees,
    ageMoyen: { femme: moyenne(ages.femme), homme: moyenne(ages.homme) },
  };
}

let correction = neutre();
let facteur = tablesInitiales.parametresFamille.lignes[0]!.valeurs.facteurFecondite!;
for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
  const mesure = mesurer(avecReglages(correction, facteur));
  console.log(
    `passe ${iteration} : age moyen de deces femmes ${mesure.ageMoyen.femme.toFixed(1)}, ` +
      `hommes ${mesure.ageMoyen.homme.toFixed(1)} ; naissances simulees / reelles ` +
      `${(mesure.naissancesObservees / mesure.naissancesAttendues).toFixed(3)}`,
  );
  const suivante = neutre();
  for (const sexe of SEXES) {
    for (let t = 0; t < tranches; t++) {
      // Toutes décennies confondues : rapport de repli pour les tranches trop minces.
      let attenduTotal = 0;
      let observeTotal = 0;
      for (const periode of [...PERIODES, FUTUR]) {
        attenduTotal += mesure.attendus[sexe][periode]![t]!;
        observeTotal += mesure.observes[sexe][periode]![t]!;
      }
      const repli =
        attenduTotal >= DECES_MINIMUM && observeTotal > 0 ? attenduTotal / observeTotal : 1;
      for (const periode of [...PERIODES, FUTUR]) {
        const attendu = mesure.attendus[sexe][periode]![t]!;
        const observe = mesure.observes[sexe][periode]![t]!;
        const actuel = correction[sexe][periode]![t]!;
        const rapport = attendu >= DECES_MINIMUM && observe > 0 ? attendu / observe : repli;
        suivante[sexe][periode]![t] = Math.min(BORNES[1], Math.max(BORNES[0], actuel * rapport));
      }
    }
  }
  correction = suivante;
  facteur *= mesure.naissancesAttendues / Math.max(1, mesure.naissancesObservees);
}

const finale = mesurer(avecReglages(correction, facteur));
// Bilan par âge, toutes décennies confondues.
for (let t = 0; t < tranches; t += 2) {
  let attendu = 0;
  let observe = 0;
  for (const sexe of SEXES) {
    for (const periode of [...PERIODES, FUTUR]) {
      for (const u of [t, t + 1]) {
        attendu += finale.attendus[sexe][periode]![u] ?? 0;
        observe += finale.observes[sexe][periode]![u] ?? 0;
      }
    }
  }
  console.log(
    `  ${t * LARGEUR_TRANCHE}-${t * LARGEUR_TRANCHE + 9} ans : observes ${observe}, attendus ${attendu.toFixed(0)}`,
  );
}
// Tranches où la correction reste loin du but : le jeu tue plus que la table à cet âge.
for (const sexe of SEXES) {
  for (const periode of [...PERIODES, FUTUR]) {
    for (let t = 0; t < tranches; t++) {
      const attendu = finale.attendus[sexe][periode]![t]!;
      const observe = finale.observes[sexe][periode]![t]!;
      if (attendu >= DECES_MINIMUM && Math.abs(observe / attendu - 1) > 0.25) {
        console.log(
          `  ecart ${sexe} ${periode} ${t * LARGEUR_TRANCHE}-${t * LARGEUR_TRANCHE + LARGEUR_TRANCHE - 1} ans : ` +
            `observes ${observe}, attendus ${attendu.toFixed(1)}, correction ${correction[sexe][periode]![t]!.toFixed(2)}`,
        );
      }
    }
  }
}
console.log(
  `final : age moyen de deces femmes ${finale.ageMoyen.femme.toFixed(1)}, hommes ` +
    `${finale.ageMoyen.homme.toFixed(1)} ; naissances simulees / reelles ` +
    `${(finale.naissancesObservees / finale.naissancesAttendues).toFixed(3)} ; facteurFecondite ${facteur.toFixed(3)}`,
);

const table = tableCorrection(
  correction,
  `Calibrage par simulation (data/scripts/calibrer.ts, ${VIES} vies en AUTO, ${ITERATIONS} passes) : multiplicateur des cotes de décès par sexe, décennie et tranche de ${LARGEUR_TRANCHE} ans, pour que les décès simulés (table Insee et causes modélisées par le jeu) égalent ceux qu'attend la table Insee seule. Après 2029 : années futures.`,
);
writeFileSync(join(SORTIE, 'correctionMortalite.json'), `${JSON.stringify(table, null, 2)}\n`);
const famille = tablesInitiales.parametresFamille;
writeFileSync(
  join(SORTIE, 'parametresFamille.json'),
  `${JSON.stringify(
    {
      ...famille,
      lignes: [
        {
          conditions: {},
          valeurs: { ...famille.lignes[0]!.valeurs, facteurFecondite: Number(facteur.toFixed(3)) },
        },
      ],
    },
    null,
    2,
  )}\n`,
);
