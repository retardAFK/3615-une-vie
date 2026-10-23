// Logement : prix d'achat et écart de loyer entre parc social et parc privé.
// - prixLogement : prix moyen d'un logement ancien de chaque année (IGEDD, J. Friggit :
//   montant des ventes de logements anciens / nombre de ventes, depuis 1967 ; avant, la
//   valeur de 1967 suit l'indice du prix des logements), en euros 2025, moyenne de la
//   décennie, rapporté au salaire de référence. L'écart entre territoires garde les
//   rapports provisoires de la table, ramenés à la moyenne nationale (parts de naissance
//   par territoire) ; il reste à calibrer.
// - loyers : le loyer HLM vaut le loyer privé × (5,6 / 8,8), rapport des loyers moyens au
//   m² des parcs social et privé en 2013 (SDES, transcription). Le niveau des loyers et
//   l'accès au logement sont ensuite ajustés par simulation (calibrer.ts).

import { join } from 'node:path';
import {
  BRUT,
  PERIODES,
  ecrireTable,
  lireCsv,
  lireSerieSdmx,
  lireTable,
  nombre,
  significatif,
} from './lib/sources.mjs';
import { lireClasseurXls } from './lib/xls.mjs';

const coefficients = lireSerieSdmx(join(BRUT, 'insee', 'serie-011813530.xml'));
const enEuros2025 = (euros, annee) => (euros * coefficients.get(2025)) / coefficients.get(annee);

// --- Prix moyen d'un logement ancien ---
const series = lireClasseurXls(join(BRUT, 'igedd', 'valeur-immobilier-depuis-1800.xls')).get(
  'Series',
);
const annees = series.find((l) => l[0] === 'Série');
const ligne = (debut) => series.find((l) => String(l[0] ?? '').startsWith(debut));
const montants = ligne('Montants de transactions de logements anciens');
const nombres = ligne('Nombre de transactions de logements anciens');
const indice = ligne('Indice du prix des logements, France');
const valeur = (l, annee) => {
  const v = l[annees.indexOf(annee)];
  return typeof v === 'number' ? v : null;
};
const PREMIERE_VENTE = 1967;
const prixMoyen = new Map();
for (let annee = 1950; annee <= 2025; annee++) {
  const m = valeur(montants, annee);
  const n = valeur(nombres, annee);
  let prix = m !== null && n ? (m * 1e9) / n : null;
  if (prix === null && annee < PREMIERE_VENTE && valeur(indice, annee) !== null) {
    const base = (valeur(montants, PREMIERE_VENTE) * 1e9) / valeur(nombres, PREMIERE_VENTE);
    prix = (base * valeur(indice, annee)) / valeur(indice, PREMIERE_VENTE);
  }
  if (prix !== null) prixMoyen.set(annee, enEuros2025(prix, annee));
}

const reference = lireTable('salaireReference');
const refDe = (periode) => reference.lignes.find((l) => l.conditions.periode === periode).valeur;
const multiplesNationaux = PERIODES.map((periode) => {
  const prix = [...prixMoyen].filter(([a]) => a >= periode.debut && a <= periode.fin);
  if (prix.length === 0) throw new Error(`Prix des logements : rien pour ${periode.nom}`);
  return prix.reduce((s, [, p]) => s + p, 0) / prix.length / refDe(periode.nom);
});

// Écart entre territoires : rapports de la table provisoire, moyenne nationale ramenée à 1.
const existante = lireTable('prixLogement');
const rapportsProvisoires = new Map(
  existante.lignes
    .filter((l) => l.conditions.territoire)
    .map((l) => [l.conditions.territoire, l.valeur]),
);
// Les rapports provisoires sont lus dans la table d'origine (une ligne par territoire),
// ou dans la décennie 2020 si la table a déjà été produite par ce script.
if (existante.lignes.some((l) => l.conditions.periode)) {
  rapportsProvisoires.clear();
  for (const l of existante.lignes) {
    if (l.conditions.territoire && l.conditions.periode === '2020-2029') {
      rapportsProvisoires.set(l.conditions.territoire, l.valeur);
    }
  }
}
const parts = lireTable('territoire').lignes.find(
  (l) => Object.keys(l.conditions).length === 0,
).distribution;
const moyenneProvisoire = Object.entries(parts).reduce(
  (s, [t, part]) => s + part * rapportsProvisoires.get(t),
  0,
);
const lignesPrix = [];
for (const [territoire, rapport] of rapportsProvisoires) {
  const relatif = rapport / moyenneProvisoire;
  PERIODES.forEach((periode, i) => {
    lignesPrix.push({
      conditions: { territoire, periode: periode.nom },
      valeur: significatif(multiplesNationaux[i] * relatif, 3),
    });
  });
  lignesPrix.push({
    conditions: { territoire },
    valeur: significatif(multiplesNationaux.at(-1) * relatif, 3),
  });
}
lignesPrix.push({ conditions: {}, valeur: significatif(multiplesNationaux.at(-1), 3) });
ecrireTable('prixLogement', {
  source:
    "IGEDD (J. Friggit), valeurs immobilières depuis 1800 : prix moyen d'un logement ancien (montant des ventes / nombre de ventes depuis 1967, indice du prix des logements avant), en euros 2025, moyenne de la décennie, en multiple du salaire de référence. Écart entre territoires : rapports provisoires, ramenés à la moyenne nationale (à calibrer).",
  url: 'https://www.igedd.developpement-durable.gouv.fr/prix-immobilier-evolution-a-long-terme-a1048.html',
  aCalibrer: true,
  lignes: lignesPrix,
});

// --- Loyer HLM / loyer privé ---
const sdes = Object.fromEntries(
  lireCsv(join(BRUT, 'transcriptions', 'sdes-loyers-2013.csv'), { encodage: 'utf8' }).map((l) => [
    l.indicateur,
    nombre(l.valeur),
  ]),
);
const rapportSocial = sdes.loyer_moyen_parc_social / sdes.loyer_moyen_parc_prive;
const loyers = lireTable('loyers');
const priveDe = (territoire) =>
  loyers.lignes.find(
    (l) => l.conditions.logement === 'locataire_prive' && l.conditions.territoire === territoire,
  )?.valeur;
ecrireTable('loyers', {
  ...loyers,
  source: `${loyers.source.replace(/ Loyer HLM :.*$/, '')} Loyer HLM : loyer privé × ${significatif(rapportSocial, 3)}, rapport des loyers moyens au m² des parcs social et privé en 2013 (SDES, Chiffres clés du logement 2022, transcription dans data/brut/transcriptions).`,
  lignes: loyers.lignes.map((l) =>
    l.conditions.logement === 'hlm' && priveDe(l.conditions.territoire) !== undefined
      ? { ...l, valeur: significatif(priveDe(l.conditions.territoire) * rapportSocial, 3) }
      : l,
  ),
});
console.log(
  'prixLogement : multiples nationaux',
  multiplesNationaux.map((m) => m.toFixed(2)).join(' '),
  '| loyer HLM / prive',
  rapportSocial.toFixed(3),
);
