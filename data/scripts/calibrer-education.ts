// Calibrage du module éducation par simulation (npm run data, avant calibrer.ts). Les
// tables d'éducation gardent leurs écarts provisoires (origine sociale, voies, filières) ;
// la table calibrageEducation porte, par décennie, des multiplicateurs de cotes ajustés
// pour que les vies simulées retrouvent les diplômes réels de leur génération :
// - redoublement : part d'élèves en retard à l'entrée au collège (DEPP : plus d'un sur
//   deux en 1960, près de 21 % en 2004 à la fin du primaire ; entrée en sixième depuis
//   2020) ;
// - voies générale, technologique, professionnelle : proportion de bacheliers de chaque
//   série dans une génération (DEPP, session à 18 ans) ; avant le bac professionnel, la
//   voie professionnelle n'est pas ajustée ;
// - sortie en fin de 3e : part sans diplôme (ou brevet seul) de la génération ;
// - frein au supérieur (cotes de l'emploi direct après le bac, de l'abandon en cours
//   d'études, inverse des cotes de réussite aux examens du supérieur) : part des
//   diplômés du supérieur parmi les titulaires d'un bac ou plus de la génération ;
// - master : part des bac+5 parmi les titulaires d'un bac ou plus.
// Le recensement compte aussi les diplômes obtenus à l'âge adulte ou sans bac (il y a,
// dans les générations anciennes, plus de diplômés du supérieur que de bacheliers à
// 18 ans) : on ne lui prend que des parts relatives, la DEPP fixant le bac.
// Diplômes par génération : recensement 2022 (Insee, FOR2), âge quinquennal de 25 à 64
// ans, soit les générations 1958-1997 ; les générations hors champ prennent le groupe
// le plus proche. Une décennie de calibrage regroupe les naissances dont la fin de 3e
// (naissance + 15 ans) tombe dans la décennie, comme les corrections du moteur. On joue les vies jusqu'à 30 ans ; chaque
// passe repart des multiplicateurs neutres, si bien que le résultat ne dépend que des
// tables de base.
// Construit par Vite (SSR) comme le banc d'essai, puis exécuté par Node depuis la racine.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { creerPartie, jouerAnneeAuto } from '../../src/moteur/boucle';
import type { DiplomeJoueur, Donnees, TableValeurs, Tables } from '../../src/moteur/types';
import { contenuDuJeu } from '../../src/ui/donnees';

const RACINE = process.cwd();
const SORTIE = join(RACINE, 'public', 'data');
const BRUT = join(RACINE, 'data', 'brut');
const VIES = 20_000;
const ITERATIONS = 12;
/** Un bac obtenu plus tard (reprise d'études) ne compte pas comme bac de la génération. */
const AGE_BAC_MAXIMAL = 22;
const AGE_FINAL = 30;
const AMORTI = 0.8;
const BORNES: readonly [number, number] = [0.02, 50];
const EFFECTIF_MINIMUM = 300;
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
const periodeDe = (annee: number): string => {
  const debut = Math.floor(annee / 10) * 10;
  return `${debut}-${debut + 9}`;
};
const AGE_FIN_3E = 15;
const AGE_BAC = 18;
const AGE_SIXIEME = 11;

const tablesInitiales = Object.fromEntries(
  Object.entries(
    import.meta.glob<unknown>('../../public/data/*.json', { eager: true, import: 'default' }),
  ).map(([chemin, table]) => [chemin.split('/').at(-1)!.replace('.json', ''), table]),
) as unknown as Tables;
const contenu = contenuDuJeu();

// --- Lecture des sources ---
const nombre = (texte: string | undefined): number =>
  Number(
    String(texte ?? '')
      .replace(/"/g, '')
      .replace(',', '.')
      .trim(),
  );
function lignesCsv(chemin: string): string[][] {
  return readFileSync(chemin, 'utf8')
    .trimStart()
    .split(/\r?\n/)
    .map((l) => l.split(';').map((v) => v.replace(/^"|"$/g, '').trim()));
}
/** Interpolation linéaire d'une série annuelle, bornée aux extrêmes. */
function interpoler(serie: Map<number, number>, annee: number): number {
  const annees = [...serie.keys()].sort((a, b) => a - b);
  if (annee <= annees[0]!) return serie.get(annees[0]!)!;
  if (annee >= annees.at(-1)!) return serie.get(annees.at(-1)!)!;
  const apres = annees.find((a) => a >= annee)!;
  const avant = annees[annees.indexOf(apres) - 1]!;
  const t = (annee - avant) / (apres - avant);
  return serie.get(avant)! + t * (serie.get(apres)! - serie.get(avant)!);
}

// Bacheliers dans une génération, par série et session (DEPP).
type Serie = 'general' | 'technologique' | 'professionnel';
const bacheliers: Record<Serie, Map<number, number>> = {
  general: new Map(),
  technologique: new Map(),
  professionnel: new Map(),
};
for (const l of lignesCsv(join(BRUT, 'transcriptions', 'depp-bacheliers-1946-1969.csv')).slice(1)) {
  if (!l[0]) continue;
  bacheliers.general.set(Number(l[0]), nombre(l[1]) / 100);
  bacheliers.technologique.set(Number(l[0]), nombre(l[2]) / 100);
  bacheliers.professionnel.set(Number(l[0]), nombre(l[3]) / 100);
}
const SERIES_DEPP: Record<string, Serie> = {
  'Bac général': 'general',
  'Bac technologique': 'technologique',
  'Bac professionnel': 'professionnel',
};
const ANNEE_CHAMP_ELARGI = 2010; // France hors DROM jusqu'en 2009, hors Mayotte ensuite
for (const l of lignesCsv(
  join(BRUT, 'depp', 'fr-en-proportion-de-bacheliers-dans-une-generation.csv'),
).slice(1)) {
  const serie = SERIES_DEPP[l[2] ?? ''];
  const annee = Number(l[0]);
  if (!serie) continue;
  const champ = annee < ANNEE_CHAMP_ELARGI ? 'France hors DROM' : 'France hors Mayotte';
  if (l[1] === champ) bacheliers[serie].set(annee, nombre(l[6]) / 100);
}
// Le bac professionnel n'existe pas avant ses premières données : 0.
const premierBacPro = Math.min(
  ...[...bacheliers.professionnel].filter(([, v]) => v > 0).map(([a]) => a),
);

// Diplôme le plus élevé par génération (recensement 2022).
type Niveau = 'aucun' | 'cap_bep' | 'bac' | 'superieur' | 'bac_5';
const for2 = lignesCsv(join(BRUT, 'insee', 'rp2022_td_for2.csv'));
const debutFor2 = for2.findIndex((l) => l[0]?.includes('Âge quinquennal - Sexe : Ensemble'));
const ANNEE_RECENSEMENT = 2022;
const niveauxParGroupe: { naissance: [number, number]; parts: Record<Niveau, number> }[] = [];
for (const l of for2.slice(debutFor2 + 2)) {
  const m = /^(\d+) à (\d+) ans$/.exec(l[0] ?? '');
  if (!m) break;
  const [ageMin, ageMax] = [Number(m[1]), Number(m[2])];
  if (ageMin < 25 || ageMax > 64) continue;
  const v = l.slice(1, 9).map(nombre);
  const total = v[7]!;
  niveauxParGroupe.push({
    naissance: [ANNEE_RECENSEMENT - ageMax, ANNEE_RECENSEMENT - ageMin],
    parts: {
      aucun: (v[0]! + v[1]!) / total,
      cap_bep: v[2]! / total,
      bac: v[3]! / total,
      superieur: (v[4]! + v[5]! + v[6]!) / total,
      bac_5: v[6]! / total,
    },
  });
}
if (niveauxParGroupe.length < 8) throw new Error('rp2022_td_for2.csv : groupes d’âge illisibles');
function niveauxDeGeneration(naissance: number): Record<Niveau, number> {
  const groupe =
    niveauxParGroupe.find((g) => naissance >= g.naissance[0] && naissance <= g.naissance[1]) ??
    niveauxParGroupe.reduce((a, b) =>
      Math.abs((a.naissance[0] + a.naissance[1]) / 2 - naissance) <
      Math.abs((b.naissance[0] + b.naissance[1]) / 2 - naissance)
        ? a
        : b,
    );
  return groupe.parts;
}

// Retard à l'entrée au collège : repères de fin de primaire, puis entrée en sixième.
const retard = new Map<number, number>();
for (const l of lignesCsv(join(BRUT, 'transcriptions', 'depp-retard-fin-primaire.csv')).slice(1)) {
  if (l[0]) retard.set(Number(l[0]), nombre(l[1]) / 100);
}
const sixieme = new Map<number, { retard: number; total: number }>();
for (const l of lignesCsv(join(BRUT, 'depp', 'fr-en-age-eleves-entree-sixieme.csv')).slice(1)) {
  const annee = Number(l[0]);
  if (!annee) continue;
  const s = sixieme.get(annee) ?? { retard: 0, total: 0 };
  s.retard += nombre(l[10]);
  s.total += nombre(l[11]);
  sixieme.set(annee, s);
}
for (const [annee, s] of sixieme) retard.set(annee, s.retard / s.total);

// --- Cibles par décennie de fin de 3e ---
interface Cible {
  retard: number;
  general: number;
  technologique: number;
  professionnel: number;
  aucun: number;
  capBep: number;
  /** Parts parmi les titulaires d'un bac ou plus. */
  superieur: number;
  bac5: number;
}
const naissancesDe = (periode: string): number[] => {
  const debut = Number(periode.slice(0, 4)) - AGE_FIN_3E;
  return Array.from({ length: 10 }, (_, i) => debut + i).filter((n) => n >= 1950 && n <= 2010);
};
const moyenne = (valeurs: number[]): number => valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
const cibles = new Map<string, Cible>();
for (const periode of PERIODES) {
  const naissances = naissancesDe(periode);
  if (naissances.length === 0) continue;
  const niveaux = naissances.map(niveauxDeGeneration);
  cibles.set(periode, {
    retard: moyenne(naissances.map((n) => interpoler(retard, n + AGE_SIXIEME))),
    general: moyenne(naissances.map((n) => interpoler(bacheliers.general, n + AGE_BAC))),
    technologique: moyenne(
      naissances.map((n) => interpoler(bacheliers.technologique, n + AGE_BAC)),
    ),
    professionnel: moyenne(
      naissances.map((n) =>
        n + AGE_BAC < premierBacPro ? 0 : interpoler(bacheliers.professionnel, n + AGE_BAC),
      ),
    ),
    aucun: moyenne(niveaux.map((n) => n.aucun)),
    capBep: moyenne(niveaux.map((n) => n.cap_bep)),
    superieur: moyenne(niveaux.map((n) => n.superieur / (n.bac + n.superieur))),
    bac5: moyenne(niveaux.map((n) => n.bac_5 / (n.bac + n.superieur))),
  });
}

// --- Simulation ---
const NOMS = [
  'redoublement',
  'generale',
  'technologique',
  'professionnelle',
  'apprentissage',
  'sortie',
  'freinSuperieur',
  'master',
] as const;
type Reglage = Record<(typeof NOMS)[number], number>;
const neutre = (): Reglage => Object.fromEntries(NOMS.map((n) => [n, 1])) as Reglage;

function tableCalibrage(reglages: Map<string, Reglage>, source: string): TableValeurs {
  const lignes = PERIODES.map((periode) => ({
    conditions: { periode },
    valeurs: reglages.get(periode) ?? neutre(),
  }));
  return {
    table: 'calibrageEducation',
    source,
    url: null,
    aCalibrer: false,
    lignes: [...lignes, { conditions: {}, valeurs: lignes.at(-1)!.valeurs }],
  };
}

type Mesure = Cible & { effectif: number; bacOuPlus: number };
const BACS: readonly DiplomeJoueur[] = ['bac_general', 'bac_techno', 'bac_pro'];

function mesurer(tables: Tables): Map<string, Mesure> {
  const donnees: Donnees = { tables, ...contenu };
  const totaux = new Map<string, Mesure>();
  const retardMesures = new Map<string, { retard: number; n: number }>();
  for (let i = 0; i < VIES; i++) {
    let etat = creerPartie(`calibrage-education-${i}`, donnees);
    const naissance = etat.personnage.origine.anneeNaissance;
    const periode = periodeDe(naissance + AGE_FIN_3E);
    let bac: DiplomeJoueur | null = null;
    let retardSixieme: number | null = null;
    while (etat.personnage.vivant && etat.personnage.age < AGE_FINAL) {
      const avant = etat.personnage.etats.scolarite;
      etat = jouerAnneeAuto(etat, donnees).etat;
      const { education, scolarite } = etat.personnage.etats;
      if (avant === 'primaire' && scolarite === 'college') retardSixieme = education.retard;
      if (
        bac === null &&
        etat.personnage.age <= AGE_BAC_MAXIMAL &&
        BACS.includes(education.diplome)
      ) {
        bac = education.diplome;
      }
    }
    if (!etat.personnage.vivant) continue;
    const m =
      totaux.get(periode) ??
      ({
        retard: 0,
        general: 0,
        technologique: 0,
        professionnel: 0,
        aucun: 0,
        capBep: 0,
        superieur: 0,
        bac5: 0,
        effectif: 0,
        bacOuPlus: 0,
      } satisfies Mesure);
    const diplome = etat.personnage.etats.education.diplome;
    m.effectif++;
    if (bac === 'bac_general') m.general++;
    if (bac === 'bac_techno') m.technologique++;
    if (bac === 'bac_pro') m.professionnel++;
    if (diplome === 'aucun') m.aucun++;
    if (diplome === 'cap_bep') m.capBep++;
    if (diplome === 'bac_2_3' || diplome === 'bac_5') m.superieur++;
    if (diplome === 'bac_5') m.bac5++;
    if (BACS.includes(diplome) || diplome === 'bac_2_3' || diplome === 'bac_5') m.bacOuPlus++;
    totaux.set(periode, m);
    if (retardSixieme !== null) {
      const r = retardMesures.get(periode) ?? { retard: 0, n: 0 };
      r.retard += retardSixieme > 0 ? 1 : 0;
      r.n++;
      retardMesures.set(periode, r);
    }
  }
  for (const [periode, m] of totaux) {
    m.superieur /= Math.max(1, m.bacOuPlus);
    m.bac5 /= Math.max(1, m.bacOuPlus);
    for (const k of ['general', 'technologique', 'professionnel', 'aucun', 'capBep'] as const) {
      m[k] /= m.effectif;
    }
    const r = retardMesures.get(periode);
    m.retard = r && r.n > 0 ? r.retard / r.n : 0;
  }
  return totaux;
}

const ajuster = (valeur: number, cible: number, mesure: number): number => {
  if (!(cible > 0) || !(mesure > 0)) return valeur;
  const v = valeur * (cible / mesure) ** AMORTI;
  return Math.min(BORNES[1], Math.max(BORNES[0], v));
};
const pourcent = (v: number): string => (v * 100).toFixed(1);

let reglages = new Map<string, Reglage>(PERIODES.map((p) => [p, neutre()]));
const avecReglages = (r: Map<string, Reglage>): Tables => ({
  ...tablesInitiales,
  calibrageEducation: tableCalibrage(r, ''),
});
for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
  const mesures = mesurer(avecReglages(reglages));
  const suivants = new Map<string, Reglage>();
  for (const periode of PERIODES) {
    const r = { ...reglages.get(periode)! };
    const m = mesures.get(periode);
    const c = cibles.get(periode);
    if (m && c && m.effectif >= EFFECTIF_MINIMUM) {
      r.redoublement = ajuster(r.redoublement, c.retard, m.retard);
      r.generale = ajuster(r.generale, c.general, m.general);
      r.technologique = ajuster(r.technologique, c.technologique, m.technologique);
      if (c.professionnel > 0) {
        r.professionnelle = ajuster(r.professionnelle, c.professionnel, m.professionnel);
      }
      r.sortie = ajuster(r.sortie, c.aucun, m.aucun);
      // Moins d'emploi direct après le bac, plus de diplômés du supérieur.
      r.freinSuperieur = ajuster(r.freinSuperieur, m.superieur, c.superieur);
      r.master = ajuster(r.master, c.bac5, m.bac5);
    }
    suivants.set(periode, r);
  }
  reglages = suivants;
  console.log(`passe ${iteration}`);
}

// Décennies sans assez de vies : celles de la décennie calibrée la plus proche.
const finales = mesurer(avecReglages(reglages));
const calibrees = PERIODES.filter((p) => (finales.get(p)?.effectif ?? 0) >= EFFECTIF_MINIMUM);
for (const periode of PERIODES) {
  if (calibrees.includes(periode)) continue;
  const proche = calibrees.reduce((a, b) =>
    Math.abs(Number(a.slice(0, 4)) - Number(periode.slice(0, 4))) <=
    Math.abs(Number(b.slice(0, 4)) - Number(periode.slice(0, 4)))
      ? a
      : b,
  );
  reglages.set(periode, { ...reglages.get(proche)! });
}
for (const periode of calibrees) {
  const m = finales.get(periode)!;
  const c = cibles.get(periode)!;
  console.log(
    `${periode} (${m.effectif} vies) : retard ${pourcent(m.retard)} (${pourcent(c.retard)}), ` +
      `bac general ${pourcent(m.general)} (${pourcent(c.general)}), ` +
      `techno ${pourcent(m.technologique)} (${pourcent(c.technologique)}), ` +
      `pro ${pourcent(m.professionnel)} (${pourcent(c.professionnel)}), ` +
      `sans diplome ${pourcent(m.aucun)} (${pourcent(c.aucun)}), ` +
      `CAP-BEP ${pourcent(m.capBep)} (${pourcent(c.capBep)}), ` +
      `superieur / bac ou plus ${pourcent(m.superieur)} (${pourcent(c.superieur)}), ` +
      `bac+5 / bac ou plus ${pourcent(m.bac5)} (${pourcent(c.bac5)}) | ` +
      JSON.stringify(reglages.get(periode)),
  );
}

const arrondi = (v: number): number => Number(v.toPrecision(3));
const table = tableCalibrage(
  new Map(
    [...reglages].map(([p, r]) => [
      p,
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, arrondi(v)])) as Reglage,
    ]),
  ),
  "Multiplicateurs de cotes par génération (décennie de ses 15 ans), ajustés par simulation (data/scripts/calibrer-education.ts) pour retrouver, par génération : la part d'élèves en retard à l'entrée au collège (DEPP : fin du primaire en 1960 et 2004, entrée en sixième depuis 2020), la proportion de bacheliers de chaque série dans une génération (DEPP), la part sans diplôme et les parts de diplômés du supérieur et de bac+5 parmi les titulaires d'un bac ou plus (Insee, recensement 2022, FOR2, générations 1958-1997 ; les autres prennent la plus proche).",
);
writeFileSync(join(SORTIE, 'calibrageEducation.json'), `${JSON.stringify(table, null, 2)}\n`);
