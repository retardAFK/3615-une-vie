// Salaires par catégorie (Insee, séries longues sur les salaires, tableau EQTP02 :
// salaire net annuel moyen en équivalent temps plein, par sexe et catégorie, 1996-).
// - coefficientPcs : salaire moyen de chaque catégorie salariée rapporté à l'ensemble,
//   moyenne des années. Les non-salariés (artisans, agriculteurs) et les sans-emploi
//   gardent leurs valeurs de travail.
// - parametresEmploi.ecartSexe : écart de salaire femmes-hommes à catégorie égale (le jeu
//   applique déjà la catégorie), moyenne des catégories et des années.

import { join } from 'node:path';
import { BRUT, ecrireTable, lireCsv, lireTable, nombre, significatif } from './lib/sources.mjs';

const lignes = lireCsv(join(BRUT, 'insee', 'salaires', 'EQTP02.csv'));
const CATEGORIES = { PCS1: 'cadre', PCS2: 'intermediaire', PCS3: 'employe', PCS4: 'ouvrier' };
/** salaire[annee][sexe][pcs] */
const salaire = new Map();
for (const ligne of lignes) {
  const annee = Number(ligne.ANNEE1);
  const valeur = nombre(ligne.SALAIRE);
  if (!Number.isInteger(annee) || valeur === null) continue;
  const parSexe = salaire.get(annee) ?? {};
  parSexe[ligne.SEXE] = { ...(parSexe[ligne.SEXE] ?? {}), [ligne.PCS]: valeur };
  salaire.set(annee, parSexe);
}
const annees = [...salaire.keys()].sort((a, b) => a - b);
const moyenne = (liste) => liste.reduce((a, b) => a + b, 0) / liste.length;

// --- coefficientPcs ---
const existante = lireTable('coefficientPcs');
const calibres = Object.fromEntries(
  Object.entries(CATEGORIES).map(([code, pcs]) => [
    pcs,
    significatif(moyenne(annees.map((a) => salaire.get(a).E[code] / salaire.get(a).E.E)), 3),
  ]),
);
ecrireTable('coefficientPcs', {
  source: `Insee, séries longues sur les salaires dans le secteur privé, tableau EQTP02 : salaire net moyen en équivalent temps plein de chaque catégorie salariée rapporté à l'ensemble, moyenne ${annees[0]}-${annees.at(-1)}. Artisans et commerçants, agriculteurs, sans emploi : valeurs de travail (revenus des non-salariés à calibrer).`,
  url: 'https://www.insee.fr/fr/statistiques/8668548',
  aCalibrer: true,
  lignes: existante.lignes.map((l) =>
    l.conditions.pcs && calibres[l.conditions.pcs] !== undefined
      ? { ...l, valeur: calibres[l.conditions.pcs] }
      : l,
  ),
});

// --- Écart femmes-hommes à catégorie égale ---
const ecarts = annees.flatMap((a) =>
  Object.keys(CATEGORIES).map((code) => 1 - salaire.get(a).F[code] / salaire.get(a).H[code]),
);
const ecartSexe = significatif(moyenne(ecarts), 3);
const emploi = lireTable('parametresEmploi');
ecrireTable('parametresEmploi', {
  ...emploi,
  source: `${emploi.source.replace(/ ?ecartSexe :.*$/, '')} ecartSexe : Insee, EQTP02, écart de salaire femmes-hommes à catégorie égale, moyenne ${annees[0]}-${annees.at(-1)}.`,
  lignes: emploi.lignes.map((l) => ({ ...l, valeurs: { ...l.valeurs, ecartSexe } })),
});
console.log('coefficientPcs', JSON.stringify(calibres), '| ecartSexe', ecartSexe);
