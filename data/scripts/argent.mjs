// public/data/salaireReference.json et seuilsDeciles.json, en euros constants de 2025.
// - salaireReference : salaire net annuel moyen des salariés à temps complet du secteur
//   privé (Insee, séries longues, tableau TC01, ensemble), moyenne des années de chaque
//   décennie, convertie en euros 2025 par les coefficients du convertisseur franc-euro.
// - seuilsDeciles : seuils des déciles de niveau de vie (Insee, ERFS) rapportés au
//   salaire de référence de la même année, moyenne des années communes aux deux séries.

import { join } from 'node:path';
import {
  BRUT,
  PERIODES,
  ecrireTable,
  lireCsv,
  lireSerieSdmx,
  nombre,
  significatif,
} from './lib/sources.mjs';
import { lireClasseur } from './lib/xlsx.mjs';

const ANNEE_BASE = 2025;
const coefficients = lireSerieSdmx(join(BRUT, 'insee', 'serie-011813530.xml'));

/** Montant d'une année, en euros (ou francs convertis en euros) de l'année, vers euros 2025. */
export function enEuros2025(montant, annee) {
  const coefficient = coefficients.get(annee);
  if (!coefficient) throw new Error(`Convertisseur : pas de coefficient pour ${annee}`);
  return (montant * coefficients.get(ANNEE_BASE)) / coefficient;
}

// --- Salaire de référence ---
const salaires = new Map();
for (const ligne of lireCsv(join(BRUT, 'insee', 'salaires', 'TC01.csv'))) {
  if (ligne.SEXE !== 'E') continue;
  const annee = Number(ligne.ANNEE2);
  const salaire = nombre(ligne.SALAIRE);
  if (Number.isInteger(annee) && salaire !== null) salaires.set(annee, salaire);
}
const reference = new Map([...salaires].map(([annee, s]) => [annee, enEuros2025(s, annee)]));
const lignesReference = PERIODES.map((periode) => {
  const valeurs = [...reference].filter(([a]) => a >= periode.debut && a <= periode.fin);
  if (valeurs.length === 0) throw new Error(`Salaire de référence : rien pour ${periode.nom}`);
  const moyenne = valeurs.reduce((s, [, v]) => s + v, 0) / valeurs.length;
  return { conditions: { periode: periode.nom }, valeur: Math.round(moyenne / 100) * 100 };
});
// Années futures : la dernière décennie connue.
lignesReference.push({ conditions: {}, valeur: lignesReference.at(-1).valeur });
ecrireTable('salaireReference', {
  source: `Insee, séries longues sur les salaires dans le secteur privé (base Tous salariés), tableau TC01 : salaire net annuel moyen des salariés à temps complet, ensemble. Moyenne des années connues de chaque décennie (${Math.min(...salaires.keys())}-${Math.max(...salaires.keys())}), en euros ${ANNEE_BASE} (convertisseur franc-euro de l'Insee, série 011813530).`,
  url: 'https://www.insee.fr/fr/statistiques/8668548',
  lignes: lignesReference,
});

// --- Seuils de déciles ---
const feuille = lireClasseur(join(BRUT, 'insee', 'reve-niv-vie-decile-individu.xlsx')).get(
  'Données',
);
const entetes = feuille.find((l) => l[0] === 'Indicateur');
const ANNEE_DECILES = 2024; // les montants du tableau sont en euros 2024 constants
const ratios = Array.from({ length: 9 }, () => []);
for (let d = 1; d <= 9; d++) {
  const ligne = feuille.find((l) => String(l[0] ?? '').includes(`(D${d})`));
  if (!ligne) throw new Error(`Déciles : D${d} absent`);
  entetes.forEach((entete, colonne) => {
    const annee = Number(String(entete ?? '').slice(0, 4));
    const seuil = ligne[colonne];
    // Années avec rupture de série (« 2010¹ ») : les deux versions comptent dans la moyenne.
    if (!salaires.has(annee) || typeof seuil !== 'number') return;
    const salaireEuros2024 =
      (salaires.get(annee) * coefficients.get(ANNEE_DECILES)) / coefficients.get(annee);
    ratios[d - 1].push(seuil / salaireEuros2024);
  });
}
const valeurs = Object.fromEntries(
  ratios.map((liste, i) => [
    `d${i + 1}`,
    significatif(liste.reduce((a, b) => a + b) / liste.length, 3),
  ]),
);
ecrireTable('seuilsDeciles', {
  source:
    'Insee-DGI, enquêtes Revenus fiscaux et sociaux (ERFS) : seuils des déciles de niveau de vie, rapportés au salaire net annuel moyen à temps complet de la même année (séries longues sur les salaires, TC01) ; moyenne des années communes (1996-2021). Seuils en multiples du salaire de référence de la période.',
  url: 'https://www.insee.fr/fr/statistiques/2416808',
  lignes: [{ conditions: {}, valeurs }],
});
console.log(
  'salaireReference',
  lignesReference.map((l) => l.valeur).join(' '),
  '| seuils',
  JSON.stringify(valeurs),
);
