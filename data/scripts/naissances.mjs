// public/data/anneeNaissance.json, sexe.json et prenoms.json.
// - anneeNaissance : naissances vivantes de chaque année (Insee, tableau NAIS1 ; France
//   quand la série existe, France métropolitaine sinon).
// - sexe : part des garçons et des filles parmi les naissances 1950-2010, comptées dans
//   le fichier des prénoms (toutes les naissances y figurent, prénoms rares compris).
// - prenoms : les PRENOMS_GARDES prénoms les plus donnés par sexe et par décennie ;
//   chaque poids est le nombre de bébés sur 1 000 nés de ce sexe dans la décennie.

import { join } from 'node:path';
import { BRUT, PERIODES, ecrireTable, significatif } from './lib/sources.mjs';
import { lireClasseur, lireZip } from './lib/xlsx.mjs';

const PREMIERE = 1950;
const DERNIERE = 2010;
const PRENOMS_GARDES = 100;

// --- Années de naissance ---
const feuille = lireClasseur(join(BRUT, 'insee', '1_Naissances_tnat.xlsx')).get('Nais-tnat');
const distribution = {};
for (const ligne of feuille) {
  const annee = Number(String(ligne[0] ?? '').slice(0, 4));
  if (!Number.isInteger(annee) || annee < PREMIERE || annee > DERNIERE) continue;
  const naissances = typeof ligne[3] === 'number' ? ligne[3] : ligne[1];
  if (typeof naissances !== 'number') throw new Error(`Naissances : ${annee} manquante`);
  distribution[String(annee)] = naissances;
}
if (Object.keys(distribution).length !== DERNIERE - PREMIERE + 1) {
  throw new Error('Naissances : années manquantes');
}
ecrireTable('anneeNaissance', {
  source:
    "Insee, statistiques d'état civil, tableau NAIS1 « Naissances et taux de natalité » : naissances vivantes de chaque année, France (France métropolitaine quand la série France n'existe pas encore).",
  url: 'https://www.insee.fr/fr/statistiques/8999017',
  lignes: [{ conditions: {}, distribution }],
});

// --- Prénoms et sexe ---
const zip = lireZip(join(BRUT, 'insee', 'prenoms-2025-nat_csv.zip'));
const csv = zip.get('prenoms-2025-nat.csv').toString('utf8').split(/\r?\n/);
const SEXES = { 1: 'homme', 2: 'femme' };
/** Effectifs : sexe → période → prénom → nombre ; et naissances par sexe et période. */
const effectifs = { homme: new Map(), femme: new Map() };
const totaux = { homme: new Map(), femme: new Map() };
const totalSexe = { homme: 0, femme: 0 };
for (const ligne of csv.slice(1)) {
  const [codeSexe, prenom, annee, valeur] = ligne.split(';');
  const sexe = SEXES[codeSexe];
  const n = Number(valeur);
  const an = Number(annee);
  if (!sexe || !Number.isFinite(n) || !Number.isInteger(an)) continue;
  if (an >= PREMIERE && an <= DERNIERE) totalSexe[sexe] += n;
  const periode = PERIODES.find((p) => an >= p.debut && an <= p.fin)?.nom;
  if (!periode) continue;
  totaux[sexe].set(periode, (totaux[sexe].get(periode) ?? 0) + n);
  if (prenom.startsWith('_')) continue;
  const parPrenom = effectifs[sexe].get(periode) ?? new Map();
  parPrenom.set(prenom, (parPrenom.get(prenom) ?? 0) + n);
  effectifs[sexe].set(periode, parPrenom);
}

const total = totalSexe.homme + totalSexe.femme;
ecrireTable('sexe', {
  source:
    'Insee, fichier des prénoms (état civil) : naissances de 1950 à 2010 par sexe, tous prénoms confondus (effectifs arrondis à 5 près par prénom).',
  url: 'https://www.insee.fr/fr/statistiques/8595130',
  lignes: [
    {
      conditions: {},
      distribution: {
        homme: significatif(totalSexe.homme / total),
        femme: significatif(totalSexe.femme / total),
      },
    },
  ],
});

/** « JEAN-PIERRE » → « Jean-Pierre », « LÉO » → « Léo ». */
const nomPropre = (prenom) =>
  prenom
    .toLowerCase()
    .replace(/(^|[-' ])(\p{L})/gu, (_, sep, lettre) => sep + lettre.toUpperCase());

const lignes = [];
for (const sexe of ['femme', 'homme']) {
  let derniere = null;
  for (const periode of PERIODES) {
    const parPrenom = effectifs[sexe].get(periode.nom);
    const naissances = totaux[sexe].get(periode.nom);
    if (!parPrenom || !naissances) throw new Error(`Prénoms : ${sexe} ${periode.nom} absent`);
    const premiers = [...parPrenom].sort((a, b) => b[1] - a[1]).slice(0, PRENOMS_GARDES);
    const distribution = Object.fromEntries(
      premiers.map(([prenom, n]) => [nomPropre(prenom), significatif((1000 * n) / naissances, 3)]),
    );
    lignes.push({ conditions: { sexe, periode: periode.nom }, distribution });
    derniere = distribution;
  }
  // Enfants du joueur nés après 2029 : les prénoms de la dernière décennie.
  lignes.push({ conditions: { sexe }, distribution: derniere });
}
ecrireTable('prenoms', {
  source: `Insee, fichier des prénoms (état civil, naissances en France) : les ${PRENOMS_GARDES} prénoms les plus donnés par sexe et par décennie (2020-2025 pour la dernière). Poids : nombre de bébés sur 1 000 nés de ce sexe dans la décennie.`,
  url: 'https://www.insee.fr/fr/statistiques/8595130',
  lignes,
});
console.log(
  `anneeNaissance, sexe (${significatif(totalSexe.homme / total)} garcons), prenoms : ${lignes.length} lignes`,
);

// --- Fécondité ---
// Taux de fécondité par âge (Insee, NAIS2, pour 10 000 femmes), moyenne des années de
// chaque décennie : probabilité qu'une femme de cet âge ait un enfant dans l'année.
const fecondite = lireClasseur(join(BRUT, 'insee', '2_Taux_fecondite_femmes.xlsx'));
/** Taux par année : année → probabilité par âge (indice = âge, de 0 à 50). */
function tauxParAnnee(feuilleTaux) {
  const parAnnee = new Map();
  const entete = feuilleTaux.find((l) => String(l[1] ?? '').trim() === '15 ans');
  for (const ligne of feuilleTaux) {
    const annee = Number(String(ligne[0] ?? '').slice(0, 4));
    if (!Number.isInteger(annee) || annee < 1900) continue;
    const parAge = Array.from({ length: 51 }, () => 0);
    entete.forEach((libelle, colonne) => {
      const age = Number.parseInt(String(libelle ?? ''), 10);
      if (Number.isInteger(age) && age <= 50 && typeof ligne[colonne] === 'number') {
        parAge[age] = ligne[colonne] / 10000;
      }
    });
    parAnnee.set(annee, parAge);
  }
  return parAnnee;
}
const metropole = tauxParAnnee(fecondite.get('FM - âge détaillé'));
const france = tauxParAnnee(fecondite.get('FR - âge détaillé'));
const lignesFecondite = PERIODES.map((periode) => {
  const annees = [];
  for (let annee = periode.debut; annee <= periode.fin; annee++) {
    const taux = france.get(annee) ?? metropole.get(annee);
    if (taux) annees.push(taux);
  }
  const parAnnee = annees[0].map((_, age) =>
    significatif(annees.reduce((s, t) => s + t[age], 0) / annees.length, 3),
  );
  return { conditions: { periode: periode.nom }, parAnnee };
});
lignesFecondite.push({ conditions: {}, parAnnee: lignesFecondite.at(-1).parAnnee });
ecrireTable('fecondite', {
  source:
    "Insee, statistiques d'état civil, tableau NAIS2 « Taux de fécondité des femmes par âge détaillé » (pour 10 000 femmes ; France, ou France métropolitaine avant 1994) : moyenne des années de chaque décennie, en probabilité annuelle par âge.",
  url: 'https://www.insee.fr/fr/statistiques/8999017',
  lignes: lignesFecondite,
});
console.log(
  'fecondite : ICF par decennie',
  lignesFecondite
    .slice(0, -1)
    .map((l) => l.parAnnee.reduce((a, b) => a + b, 0).toFixed(2))
    .join(' '),
);
