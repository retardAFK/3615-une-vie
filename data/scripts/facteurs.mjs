// mortaliteFacteurs, lignes par catégorie sociale : multiplicateur des cotes de décès des
// adultes. Source : Insee, espérance de vie à 35 ans par catégorie socioprofessionnelle
// (échantillon démographique permanent), de 1976-1984 à 2020-2022. Pour chaque période et
// chaque sexe, on cherche le multiplicateur qui, appliqué à la table de mortalité de la
// décennie (mortalite.json), redonne l'espérance de vie de la catégorie ; on le rapporte à
// celui de l'ensemble, puis on fait la moyenne géométrique des périodes et des sexes.
// Les lignes des addictions (risques relatifs) gardent leurs valeurs de travail.

import { join } from 'node:path';
import { BRUT, ecrireTable, lireTable, significatif } from './lib/sources.mjs';
import { lireClasseur } from './lib/xlsx.mjs';

const CATEGORIES = {
  Agriculteurs: 'agriculteur',
  Artisans: 'artisan_commercant',
  Cadres: 'cadre',
  'Professions intermédiaires': 'intermediaire',
  Employés: 'employe',
  Ouvriers: 'ouvrier',
  'Inactifs non retraités': 'sans_emploi',
  Ensemble: 'ensemble',
};
/** Période de l'enquête → décennie de la table de mortalité (milieu de la période). */
const decennie = (periode) => {
  const [debut, fin] = periode.split('-').map(Number);
  const milieu = Math.floor((debut + fin) / 2 / 10) * 10;
  return `${milieu}-${milieu + 9}`;
};

const mortalite = lireTable('mortalite');
const table = (sexe, periode) =>
  mortalite.lignes.find((l) => l.conditions.sexe === sexe && l.conditions.periode === periode)
    ?.qParAge;

/** Espérance de vie à 35 ans avec les cotes de décès multipliées par m. */
function esperance35(q, m) {
  let survie = 1;
  let esperance = 0.5;
  for (let age = 35; age < q.length; age++) {
    const cotes = (q[age] / (1 - Math.min(q[age], 0.999999))) * m;
    survie *= 1 - cotes / (1 + cotes);
    esperance += survie;
  }
  return esperance;
}

/** Multiplicateur qui donne l'espérance visée (bissection sur log m). */
function multiplicateur(q, cible) {
  let bas = Math.log(0.05);
  let haut = Math.log(20);
  for (let i = 0; i < 60; i++) {
    const milieu = (bas + haut) / 2;
    if (esperance35(q, Math.exp(milieu)) > cible) bas = milieu;
    else haut = milieu;
  }
  return Math.exp((bas + haut) / 2);
}

const feuille = lireClasseur(join(BRUT, 'insee', 'demo-deces-esp-35-csp-diplome.xlsx')).get(
  'Figure 1',
);
const entetePeriodes = feuille.find((l) => String(l[0] ?? '').startsWith('Catégorie'));
const entetesSexes = feuille[feuille.indexOf(entetePeriodes) + 1];
const colonnes = [];
let periode = null;
entetePeriodes.forEach((v, i) => {
  if (typeof v === 'string' && /^\d{4}-\d{4}$/.test(v.trim())) periode = v.trim();
  else if (typeof v === 'string' && v.startsWith('Écart')) periode = null;
  const sexe =
    entetesSexes[i] === 'Femmes' ? 'femme' : entetesSexes[i] === 'Hommes' ? 'homme' : null;
  if (periode && sexe) colonnes.push({ i, periode, sexe });
});

/** m[pcs] = liste des multiplicateurs relatifs à l'ensemble (périodes × sexes). */
const relatifs = {};
const lignesCategories = new Map();
for (const ligne of feuille) {
  const libelle = String(ligne[0] ?? '');
  const cle = Object.keys(CATEGORIES).find((c) => libelle.startsWith(c));
  if (cle) lignesCategories.set(CATEGORIES[cle], ligne);
}
for (const { i, periode: p, sexe } of colonnes) {
  const q = table(sexe, decennie(p));
  if (!q) continue;
  const mEnsemble = multiplicateur(q, lignesCategories.get('ensemble')[i]);
  for (const [pcs, ligne] of lignesCategories) {
    if (pcs === 'ensemble' || typeof ligne[i] !== 'number') continue;
    (relatifs[pcs] ??= []).push(multiplicateur(q, ligne[i]) / mEnsemble);
  }
}
const facteurs = Object.fromEntries(
  Object.entries(relatifs).map(([pcs, liste]) => [
    pcs,
    significatif(Math.exp(liste.reduce((s, m) => s + Math.log(m), 0) / liste.length), 3),
  ]),
);

const existante = lireTable('mortaliteFacteurs');
ecrireTable('mortaliteFacteurs', {
  ...existante,
  source:
    "Catégories sociales : Insee, espérance de vie à 35 ans par catégorie socioprofessionnelle (échantillon démographique permanent, France métropolitaine, 1976-1984 à 2020-2022), convertie en multiplicateur des cotes de décès rapporté à l'ensemble (moyenne géométrique des périodes et des sexes). Addictions : valeurs de travail, à calibrer.",
  url: 'https://www.insee.fr/fr/statistiques/2383438',
  aCalibrer: true,
  lignes: existante.lignes.map((l) =>
    l.conditions.pcs && facteurs[l.conditions.pcs] !== undefined
      ? { ...l, valeur: facteurs[l.conditions.pcs] }
      : l,
  ),
});
console.log('mortaliteFacteurs', JSON.stringify(facteurs));
