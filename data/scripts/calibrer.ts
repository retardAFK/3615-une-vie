// Calibrage par simulation (npm run data, dernière étape). Le moteur relie les données
// au jeu par quelques réglages ; on joue des vies en AUTO, on compare à la réalité et on
// ajuste, en plusieurs passes amorties (les réglages interagissent) :
// - correctionMortalite : multiplicateur des cotes de décès, par sexe, décennie et âge,
//   pour que les décès simulés (table Insee et causes modélisées par le jeu) égalent ceux
//   qu'attend la table Insee seule ;
// - facteurFecondite : naissances simulées = naissances qu'auraient les mêmes femmes avec
//   les taux réels de leur année et de leur âge (le jeu ne les applique qu'aux couples) ;
// - pHlm : part de locataires du secteur social de 25 à 79 ans en 2020 (SDES-Insee,
//   enquête Logement 2020, par tranche d'âge) ; la part de propriétaires est affichée en
//   contrôle (elle dépend surtout de l'endettement, pas encore calibré) ;
// - échelles des loyers privés et HLM : taux d'effort médians des locataires du secteur
//   libre et du secteur social (Insee, enquête SRCV, début 2024) ;
// - échelle des héritages : part des héritages venant de la mère inférieurs à 30 000 €
//   de 2015 (Insee, enquête Patrimoine 2014-2015).
// Construit par Vite (SSR) comme le banc d'essai, puis exécuté par Node depuis la racine.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { creerPartie, jouerAnneeAuto } from '../../src/moteur/boucle';
import { AGE_MAXIMAL } from '../../src/moteur/constantes';
import { estAutonome } from '../../src/moteur/modules/argent';
import { loyerDuLogement, montantHeritage } from '../../src/moteur/modules/famille';
import { probabiliteDecesTable } from '../../src/moteur/modules/sante';
import { chercherLigne, periodeDe } from '../../src/moteur/tables';
import type { Donnees, LigneCourbe, Sexe, Table, Tables } from '../../src/moteur/types';
import { contenuDuJeu } from '../../src/ui/donnees';
import { lireSerieSdmx } from './lib/sources.mjs';
import { lireClasseurXls } from './lib/xls.mjs';
import { lireClasseur } from './lib/xlsx.mjs';

const RACINE = process.cwd();
const SORTIE = join(RACINE, 'public', 'data');
const BRUT = join(RACINE, 'data', 'brut');
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

// --- Cibles réelles ---
const nombre = (v: unknown): number => (typeof v === 'number' ? v : Number.NaN);
const logement = lireClasseur(join(BRUT, 'insee', 'FPORSOC25-F23.xlsx'));
/** Statut d'occupation par tranche d'âge en 2020, en parts : [âge min, âge max, propriétaires, social, libre]. */
const TRANCHES_LOGEMENT: [number, number, string][] = [
  [25, 29, 'De 25 à 29 ans'],
  [30, 39, 'De 30 à 39 ans'],
  [40, 49, 'De 40 à 49 ans'],
  [50, 59, 'De 50 à 59 ans'],
  [60, 69, 'De 60 à 69 ans'],
  [70, 79, 'De 70 à 79 ans'],
];
const statuts = TRANCHES_LOGEMENT.map(([min, max, libelle]) => {
  const ligne = logement.get('Figure 1')!.find((l) => l[0] === libelle)!;
  return {
    min,
    max,
    proprietaires: (nombre(ligne[1]) + nombre(ligne[2])) / 100,
    social: nombre(ligne[3]) / 100,
    libre: nombre(ligne[4]) / 100,
  };
});
const effort = logement.get('Figure 3')!;
const effortDe = (debut: string): number =>
  nombre(effort.find((l) => String(l[0] ?? '').startsWith(debut))![5]) / 100;
const EFFORT_LIBRE = effortDe('Locataire du secteur lib');
const EFFORT_SOCIAL = effortDe('Locataire du secteur soc');
const ANNEE_LOGEMENT = 2020;
const ANNEES_EFFORT: readonly [number, number] = [2016, 2024];

const heritages = lireClasseurXls(join(BRUT, 'insee', 'heritages-2015-T3A2.xls')).get('T3a2')!;
const mere = heritages.find((l) => l[0] === 'Mère')!;
const PART_SOUS_30000 = (nombre(mere[1]) + nombre(mere[2])) / 100;
const coefficients = lireSerieSdmx(join(BRUT, 'insee', 'serie-011813530.xml')) as Map<
  number,
  number
>;
const SEUIL_HERITAGE = (30_000 * coefficients.get(2025)!) / coefficients.get(2015)!;

const tranches = Math.floor(AGE_MAXIMAL / LARGEUR_TRANCHE) + 1;
const periodeCalibree = (annee: number): string => {
  const p = periodeDe(annee);
  return PERIODES.includes(p) ? p : FUTUR;
};

/** Correction de mortalité : sexe → période (ou futur) → multiplicateur par tranche d'âge. */
type Correction = Record<Sexe, Record<string, number[]>>;
const neutre = (valeur = 1): Correction =>
  Object.fromEntries(
    SEXES.map((s) => [
      s,
      Object.fromEntries([...PERIODES, FUTUR].map((p) => [p, Array(tranches).fill(valeur)])),
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

const famille0 = tablesInitiales.parametresFamille.lignes[0]!.valeurs;

/** Réglages ajustés ; les échelles multiplient les tables de départ. */
interface Reglages {
  correction: Correction;
  facteurFecondite: number;
  pHlm: number;
  echelleLoyerPrive: number;
  echelleLoyerHlm: number;
  echelleHeritage: number;
}

function appliquer(r: Reglages): Tables {
  const loyers = tablesInitiales.loyers;
  const heritage = tablesInitiales.heritage;
  return {
    ...tablesInitiales,
    correctionMortalite: tableCorrection(r.correction, 'calibrage en cours'),
    parametresFamille: {
      ...tablesInitiales.parametresFamille,
      lignes: [
        {
          conditions: {},
          valeurs: {
            ...famille0,
            facteurFecondite: r.facteurFecondite,
            pHlm: r.pHlm,
          },
        },
      ],
    },
    loyers: {
      ...loyers,
      lignes: loyers.lignes.map((l) =>
        l.conditions.logement === 'locataire_prive'
          ? { ...l, valeur: l.valeur * r.echelleLoyerPrive }
          : l.conditions.logement === 'hlm'
            ? { ...l, valeur: l.valeur * r.echelleLoyerHlm }
            : l,
      ),
    },
    heritage: {
      ...heritage,
      lignes: heritage.lignes.map((l) => ({ ...l, valeur: l.valeur * r.echelleHeritage })),
    },
  };
}

interface Mesure {
  attendus: Correction;
  observes: Correction;
  naissancesAttendues: number;
  naissancesObservees: number;
  ageMoyen: Record<Sexe, number>;
  /** Logement en 2020 : effectifs simulés et effectifs attendus d'après les parts réelles. */
  logement: { personnes: number; proprietaires: number; social: number; libre: number };
  logementAttendu: { proprietaires: number; social: number; libre: number };
  effortLibre: number;
  effortSocial: number;
  partHeritagesSous: number;
}

const mediane = (v: number[]): number => {
  const tri = [...v].sort((a, b) => a - b);
  return tri.length === 0 ? Number.NaN : tri[Math.floor(tri.length / 2)]!;
};

function mesurer(tables: Tables): Mesure {
  const donnees: Donnees = { tables, ...contenu };
  const attendus = neutre(0);
  const observes = neutre(0);
  let naissancesAttendues = 0;
  let naissancesObservees = 0;
  const ages: Record<Sexe, number[]> = { femme: [], homme: [] };
  const sim = { personnes: 0, proprietaires: 0, social: 0, libre: 0 };
  const attendu = { proprietaires: 0, social: 0, libre: 0 };
  const efforts = { libre: [] as number[], social: [] as number[] };
  let heritagesSous = 0;
  let heritagesTotal = 0;
  for (let i = 0; i < VIES; i++) {
    let etat = creerPartie(`calibrage-${i}`, donnees);
    const { sexe } = etat.personnage.origine;
    while (etat.personnage.vivant) {
      const avant = etat;
      const { age } = avant.personnage;
      const { annee } = avant;
      const periode = periodeCalibree(annee);
      const tranche = Math.floor(age / LARGEUR_TRANCHE);
      attendus[sexe][periode]![tranche]! += probabiliteDecesTable(age, sexe, annee, tables);
      if (sexe === 'femme' && age >= 15 && age <= 50) {
        naissancesAttendues +=
          chercherLigne(tables.fecondite, { periode: periodeDe(annee) }, ['periode']).parAnnee[
            age
          ] ?? 0;
      }
      if (annee === ANNEE_LOGEMENT) {
        const cible = statuts.find((s) => age >= s.min && age <= s.max);
        if (cible) {
          const statut = avant.personnage.etats.logement;
          sim.personnes++;
          if (statut === 'proprietaire') sim.proprietaires++;
          if (statut === 'hlm') sim.social++;
          if (statut === 'locataire_prive') sim.libre++;
          attendu.proprietaires += cible.proprietaires;
          attendu.social += cible.social;
          attendu.libre += cible.libre;
        }
      }
      etat = jouerAnneeAuto(avant, donnees).etat;
      const p = etat.personnage;
      if (!p.vivant) {
        observes[sexe][periode]![tranche]! += 1;
        continue;
      }
      if (sexe === 'femme') {
        naissancesObservees +=
          p.etats.famille.enfants.length - avant.personnage.etats.famille.enfants.length;
      }
      if (avant.personnage.etats.famille.parentsVivants && !p.etats.famille.parentsVivants) {
        const montant = montantHeritage(avant.personnage, annee, tables);
        if (montant > 0) {
          heritagesTotal++;
          if (montant < SEUIL_HERITAGE) heritagesSous++;
        }
      }
      const statut = p.etats.logement;
      if (
        annee >= ANNEES_EFFORT[0] &&
        annee <= ANNEES_EFFORT[1] &&
        estAutonome(p) &&
        (statut === 'locataire_prive' || statut === 'hlm')
      ) {
        const { finances } = p;
        const aides = Object.values(finances.aides).reduce((s, m) => s + (m ?? 0), 0);
        const ressources = finances.revenuAnnuel + aides;
        if (ressources > 0) {
          const taux =
            (loyerDuLogement(p, annee, tables) - (finances.aides.aideLogement ?? 0)) / ressources;
          (statut === 'hlm' ? efforts.social : efforts.libre).push(taux);
        }
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
    logement: sim,
    logementAttendu: attendu,
    effortLibre: mediane(efforts.libre),
    effortSocial: mediane(efforts.social),
    partHeritagesSous: heritagesSous / Math.max(1, heritagesTotal),
  };
}

function decrire(m: Mesure, prefixe: string): void {
  const s = m.logement;
  const a = m.logementAttendu;
  console.log(
    `${prefixe} : deces moyen femmes ${m.ageMoyen.femme.toFixed(1)}, hommes ${m.ageMoyen.homme.toFixed(1)} ; ` +
      `naissances ${(m.naissancesObservees / m.naissancesAttendues).toFixed(3)} ; ` +
      `proprietaires ${(s.proprietaires / s.personnes).toFixed(3)} (reel ${(a.proprietaires / s.personnes).toFixed(3)}), ` +
      `HLM ${(s.social / s.personnes).toFixed(3)} (${(a.social / s.personnes).toFixed(3)}), ` +
      `prive ${(s.libre / s.personnes).toFixed(3)} (${(a.libre / s.personnes).toFixed(3)}) ; ` +
      `effort prive ${m.effortLibre.toFixed(3)} (${EFFORT_LIBRE}), HLM ${m.effortSocial.toFixed(3)} (${EFFORT_SOCIAL}) ; ` +
      `heritages < 30 000 EUR 2015 ${m.partHeritagesSous.toFixed(3)} (${PART_SOUS_30000.toFixed(3)})`,
  );
}

/** Ajustement amorti d'un réglage multiplicatif, borné à un facteur 2 par passe. */
const ajuster = (valeur: number, rapport: number, amorti = 0.7): number =>
  valeur * Math.min(2, Math.max(0.5, Math.pow(Number.isFinite(rapport) ? rapport : 1, amorti)));

let reglages: Reglages = {
  correction: neutre(),
  facteurFecondite: famille0.facteurFecondite!,
  pHlm: famille0.pHlm!,
  echelleLoyerPrive: 1,
  echelleLoyerHlm: 1,
  echelleHeritage: 1,
};
for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
  const m = mesurer(appliquer(reglages));
  decrire(m, `passe ${iteration}`);
  const correction = neutre();
  for (const sexe of SEXES) {
    for (let t = 0; t < tranches; t++) {
      // Toutes décennies confondues : rapport de repli pour les tranches trop minces.
      let attenduTotal = 0;
      let observeTotal = 0;
      for (const periode of [...PERIODES, FUTUR]) {
        attenduTotal += m.attendus[sexe][periode]![t]!;
        observeTotal += m.observes[sexe][periode]![t]!;
      }
      const repli =
        attenduTotal >= DECES_MINIMUM && observeTotal > 0 ? attenduTotal / observeTotal : 1;
      for (const periode of [...PERIODES, FUTUR]) {
        const attenduT = m.attendus[sexe][periode]![t]!;
        const observeT = m.observes[sexe][periode]![t]!;
        const actuel = reglages.correction[sexe][periode]![t]!;
        const rapport = attenduT >= DECES_MINIMUM && observeT > 0 ? attenduT / observeT : repli;
        correction[sexe][periode]![t] = Math.min(BORNES[1], Math.max(BORNES[0], actuel * rapport));
      }
    }
  }
  const s = m.logement;
  const a = m.logementAttendu;
  reglages = {
    correction,
    facteurFecondite:
      reglages.facteurFecondite * (m.naissancesAttendues / Math.max(1, m.naissancesObservees)),
    pHlm: Math.min(0.9, ajuster(reglages.pHlm, a.social / Math.max(1, s.social))),
    echelleLoyerPrive: ajuster(reglages.echelleLoyerPrive, EFFORT_LIBRE / m.effortLibre),
    echelleLoyerHlm: ajuster(reglages.echelleLoyerHlm, EFFORT_SOCIAL / m.effortSocial),
    // Héritages trop souvent petits : on les augmente (et inversement).
    echelleHeritage: ajuster(
      reglages.echelleHeritage,
      Math.pow(m.partHeritagesSous / PART_SOUS_30000, 2),
    ),
  };
}

const finale = mesurer(appliquer(reglages));
decrire(finale, 'final');
// Bilan des décès par âge, toutes décennies confondues.
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
    `  ${t * LARGEUR_TRANCHE}-${t * LARGEUR_TRANCHE + 9} ans : deces observes ${observe}, attendus ${attendu.toFixed(0)}`,
  );
}

// --- Écriture des tables ajustées ---
const ecrire = (nom: string, table: unknown): void =>
  writeFileSync(join(SORTIE, `${nom}.json`), `${JSON.stringify(table, null, 2)}\n`);
const tables = appliquer(reglages);
ecrire(
  'correctionMortalite',
  tableCorrection(
    reglages.correction,
    `Calibrage par simulation (data/scripts/calibrer.ts, ${VIES} vies en AUTO, ${ITERATIONS} passes) : multiplicateur des cotes de décès par sexe, décennie et tranche de ${LARGEUR_TRANCHE} ans, pour que les décès simulés (table Insee et causes modélisées par le jeu) égalent ceux qu'attend la table Insee seule. Après 2029 : années futures.`,
  ),
);
const arrondi = (v: number): number => Number(v.toPrecision(3));
ecrire('parametresFamille', {
  ...tables.parametresFamille,
  lignes: [
    {
      conditions: {},
      valeurs: {
        ...famille0,
        facteurFecondite: arrondi(reglages.facteurFecondite),
        pHlm: arrondi(reglages.pHlm),
      },
    },
  ],
});
const notes = {
  loyers: ` Niveau ajusté par simulation sur les taux d'effort médians des locataires (Insee, enquête SRCV début 2024 : secteur libre ${EFFORT_LIBRE * 100} %, secteur social ${EFFORT_SOCIAL * 100} %).`,
  heritage: ` Niveau ajusté par simulation : part des héritages venant de la mère inférieurs à 30 000 € de 2015 (Insee, enquête Patrimoine 2014-2015, T3A2 : ${(PART_SOUS_30000 * 100).toFixed(1)} %).`,
};
for (const nom of ['loyers', 'heritage'] as const) {
  const table = tables[nom];
  ecrire(nom, {
    ...table,
    source: `${table.source.replace(/ Niveau ajusté par simulation.*$/, '')}${notes[nom]}`,
    lignes: table.lignes.map((l) => ({ ...l, valeur: arrondi(l.valeur) })),
  });
}
