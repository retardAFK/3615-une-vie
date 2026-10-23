// public/data/mortalite.json : quotients de mortalité par sexe, âge et décennie.
// Source : Insee, tableau DEC3 (quotients pour 100 000), France métropolitaine avant
// 1994, France à partir de 1994. Chaque décennie est la moyenne de ses années connues.
// Au-delà de 100 ans, la table est prolongée par une droite logistique ajustée sur
// 90-100 ans (choix de méthode) ; à 110 ans, âge maximal du jeu, la mort est certaine.

import { join } from 'node:path';
import { BRUT, PERIODES, ecrireTable, significatif } from './lib/sources.mjs';
import { lireClasseur } from './lib/xlsx.mjs';

const FICHIER = join(BRUT, 'insee', '3_Quotients_mortalite.xlsx');
const AGE_MAXIMAL = 110;
const PREMIERE_ANNEE_FRANCE = 1994;

/** Quotients (probabilités) par année : année → q[0..100]. */
function quotientsParAnnee(feuille) {
  const parAnnee = new Map();
  for (const ligne of feuille) {
    const annee = Number(String(ligne[0] ?? '').slice(0, 4));
    if (!Number.isInteger(annee) || annee < 1900) continue;
    const q = ligne.slice(1, 102).map((v) => (typeof v === 'number' ? v / 100000 : null));
    if (q.length === 101 && q.every((v) => v !== null)) parAnnee.set(annee, q);
  }
  return parAnnee;
}

/** Prolonge de 101 à 110 ans : logit(q) linéaire, ajusté sur 90-100 ans. */
function prolonger(q) {
  const ages = [];
  const logits = [];
  for (let age = 90; age <= 100; age++) {
    ages.push(age);
    logits.push(Math.log(q[age] / (1 - q[age])));
  }
  const moyenneAge = ages.reduce((a, b) => a + b) / ages.length;
  const moyenneLogit = logits.reduce((a, b) => a + b) / logits.length;
  let covariance = 0;
  let variance = 0;
  ages.forEach((age, i) => {
    covariance += (age - moyenneAge) * (logits[i] - moyenneLogit);
    variance += (age - moyenneAge) ** 2;
  });
  const pente = covariance / variance;
  const complete = q.slice();
  for (let age = 101; age < AGE_MAXIMAL; age++) {
    const logit = moyenneLogit + pente * (age - moyenneAge);
    complete.push(Math.max(complete[age - 1], 1 / (1 + Math.exp(-logit))));
  }
  complete.push(1);
  return complete;
}

const classeur = lireClasseur(FICHIER);
const lignes = [];
const dernieres = {};
for (const sexe of ['femme', 'homme']) {
  const suffixe = sexe === 'femme' ? 'Femmes' : 'Hommes';
  const metropole = quotientsParAnnee(classeur.get(`FM-${suffixe}`));
  const france = quotientsParAnnee(classeur.get(`FR-${suffixe}`));
  for (const periode of PERIODES) {
    const annees = [];
    for (let annee = periode.debut; annee <= periode.fin; annee++) {
      const q = annee >= PREMIERE_ANNEE_FRANCE ? france.get(annee) : metropole.get(annee);
      if (q) annees.push(q);
    }
    if (annees.length === 0) throw new Error(`Mortalité : aucune année pour ${periode.nom}`);
    const moyenne = annees[0].map(
      (_, age) => annees.reduce((s, q) => s + q[age], 0) / annees.length,
    );
    const qParAge = prolonger(moyenne).map((v) => significatif(v));
    lignes.push({ conditions: { sexe, periode: periode.nom }, qParAge });
    dernieres[sexe] = qParAge;
  }
}
// Années futures (vies qui dépassent 2029) : la dernière décennie connue, sans projection.
for (const sexe of ['femme', 'homme']) {
  lignes.push({ conditions: { sexe }, qParAge: dernieres[sexe] });
}

ecrireTable('mortalite', {
  source:
    "Insee, statistiques et estimations d'état civil, tableau DEC3 « Quotients de mortalité par sexe et âge » (France métropolitaine avant 1994, France ensuite) ; moyenne des années de chaque décennie (2024 et 2025 provisoires). Au-delà de 100 ans : prolongement logistique ajusté sur 90-100 ans ; mort certaine à 110 ans. Après 2029 : décennie 2020, sans projection.",
  url: 'https://www.insee.fr/fr/statistiques/8999019',
  lignes,
});
console.log(`mortalite : ${lignes.length} lignes`);
