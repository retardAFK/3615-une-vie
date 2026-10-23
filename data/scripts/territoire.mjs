// Territoire de naissance selon la région et la décennie.
// Chaque commune métropolitaine reçoit la catégorie de son aire d'attraction (zonage
// 2020, géographie 2026) : grande métropole = pôle d'une aire de 700 000 habitants ou
// plus (Paris compris), ville moyenne = pôle d'une aire plus petite. Hors des pôles, une
// commune est rurale si elle compte moins de 2 000 habitants au recensement (seuil de
// l'ancienne définition Insee de la commune rurale) ; sinon, elle est périurbaine en
// couronne et ville moyenne hors attraction des villes. Les populations communales des recensements
// (1954 à 2023, géographie 2025) donnent le poids de chaque catégorie par région ; une
// décennie prend la population interpolée au milieu de la décennie. Le zonage reste celui
// de 2020 pour toutes les années.
// Quartiers prioritaires : la population en QPV (2020) est retirée de la catégorie de sa
// commune, et la même part de cette catégorie est retirée aux autres décennies.
// Les DROM restent entièrement « drom ».

import { join } from 'node:path';
import { BRUT, PERIODES, ecrireTable, lireTable, significatif } from './lib/sources.mjs';
import { lireClasseur, lireZip } from './lib/xlsx.mjs';

const REGIONS = {
  11: 'ile_de_france',
  24: 'centre_val_de_loire',
  27: 'bourgogne_franche_comte',
  28: 'normandie',
  32: 'hauts_de_france',
  44: 'grand_est',
  52: 'pays_de_la_loire',
  53: 'bretagne',
  75: 'nouvelle_aquitaine',
  76: 'occitanie',
  84: 'auvergne_rhone_alpes',
  93: 'provence_alpes_cote_d_azur',
  94: 'corse',
};
const TERRITOIRES = ['grande_metropole', 'ville_moyenne', 'periurbain', 'rural'];
const TAILLE_GRANDE_AIRE = 4; // tranche TAAV2017 : 700 000 habitants ou plus (5 : Paris)

// --- Catégorie de chaque commune ---
const [classeurAav] = lireZip(join(BRUT, 'insee', 'AAV2020_au_01-01-2026.zip')).values();
const aav = lireClasseur(classeurAav, {
  feuilles: (nom) => nom === 'AAV2020' || nom === 'Composition_communale',
});
const ligneEntete = (feuille, code) => feuille.findIndex((l) => l[0] === code);
const aires = aav.get('AAV2020');
const tailleAire = new Map(
  aires.slice(ligneEntete(aires, 'AAV2020') + 1).map((l) => [String(l[0]), Number(l[2])]),
);
const composition = aav.get('Composition_communale');
const categorieCommune = new Map();
for (const l of composition.slice(ligneEntete(composition, 'CODGEO') + 1)) {
  if (!l[0]) continue;
  const categorie = Number(l[4]);
  let territoire;
  if (categorie === 30) territoire = 'hors_attraction';
  else if (categorie === 20) territoire = 'couronne';
  else {
    territoire =
      tailleAire.get(String(l[2])) >= TAILLE_GRANDE_AIRE ? 'grande_metropole' : 'ville_moyenne';
  }
  categorieCommune.set(String(l[0]), territoire);
}
const SEUIL_RURAL = 2000;
/** Territoire d'une commune hors pôle selon sa population de l'année. */
function territoireDe(categorie, population) {
  if (categorie !== 'couronne' && categorie !== 'hors_attraction') return categorie;
  if (population < SEUIL_RURAL) return 'rural';
  return categorie === 'couronne' ? 'periurbain' : 'ville_moyenne';
}
/** Paris est découpé en arrondissements dans les populations, pas dans le zonage. */
const communeDuZonage = (code) => (/^751\d\d$/.test(code) ? '75056' : code);

// --- Populations communales par recensement ---
const historique = lireClasseur(join(BRUT, 'insee', 'base-pop-historiques-1876-2023.xlsx'), {
  feuilles: (nom) => nom.startsWith('pop_'),
});
const [populations] = historique.values();
const iEntete = ligneEntete(populations, 'CODGEO');
const colonnes = populations[iEntete]
  .map((nom, i) => ({ annee: Number(/^P(?:MUN|SDC|TOT)(\d{4})$/.exec(nom)?.[1]), i }))
  .filter((c) => c.annee >= 1954);
const parRegion = new Map(); // région → année → territoire → population
let sansCategorie = 0;
for (const l of populations.slice(iEntete + 1)) {
  const region = REGIONS[Number(l[1])];
  if (!region) continue;
  const categorie = categorieCommune.get(communeDuZonage(String(l[0])));
  if (!categorie) {
    sansCategorie++;
    continue;
  }
  const annees = parRegion.get(region) ?? new Map();
  for (const { annee, i } of colonnes) {
    const totaux = annees.get(annee) ?? Object.fromEntries(TERRITOIRES.map((t) => [t, 0]));
    const population = typeof l[i] === 'number' ? l[i] : 0;
    totaux[territoireDe(categorie, population)] += population;
    annees.set(annee, totaux);
  }
  parRegion.set(region, annees);
}
if (sansCategorie > 20) throw new Error(`${sansCategorie} communes sans catégorie d'aire`);

// --- Quartiers prioritaires : part retirée à chaque catégorie, par région ---
const qpv = lireClasseur(join(BRUT, 'insee', 'pop_QPV24.xlsx')).get('Population des QPV');
const ANNEE_QPV = 2020;
const enQpv = new Map(); // région → territoire → population
for (const l of qpv.slice(ligneEntete(qpv, 'codeQPV') + 1)) {
  const region = REGIONS[Number(l[6])];
  if (!region || typeof l[8] !== 'number') continue;
  const commune = String(l[2]).split(/[,;\s]+/)[0];
  const categorie = categorieCommune.get(communeDuZonage(commune));
  if (!categorie) continue;
  // Une commune avec un quartier prioritaire dépasse le seuil rural.
  const territoire = territoireDe(categorie, SEUIL_RURAL);
  const totaux = enQpv.get(region) ?? Object.fromEntries(TERRITOIRES.map((t) => [t, 0]));
  totaux[territoire] += l[8];
  enQpv.set(region, totaux);
}

/** Population de chaque catégorie, interpolée à l'année donnée. */
function populationEn(annees, annee) {
  const connues = [...annees.keys()].sort((a, b) => a - b);
  if (annee <= connues[0]) return annees.get(connues[0]);
  if (annee >= connues.at(-1)) return annees.get(connues.at(-1));
  const apres = connues.find((a) => a >= annee);
  const avant = connues[connues.indexOf(apres) - 1];
  const t = (annee - avant) / (apres - avant);
  return Object.fromEntries(
    TERRITOIRES.map((k) => [
      k,
      annees.get(avant)[k] + t * (annees.get(apres)[k] - annees.get(avant)[k]),
    ]),
  );
}

function distribution(region, annee) {
  const annees = parRegion.get(region);
  const population = populationEn(annees, annee);
  const reference = populationEn(annees, ANNEE_QPV);
  const qpvRegion = enQpv.get(region) ?? {};
  const parts = {};
  let quartiers = 0;
  for (const t of TERRITOIRES) {
    const partQpv = reference[t] > 0 ? (qpvRegion[t] ?? 0) / reference[t] : 0;
    parts[t] = population[t] * (1 - partQpv);
    quartiers += population[t] * partQpv;
  }
  parts.quartier_prioritaire = quartiers;
  const total = Object.values(parts).reduce((s, v) => s + v, 0);
  return Object.fromEntries(
    Object.entries(parts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => [k, significatif(v / total, 4)]),
  );
}

const existante = lireTable('territoire');
const lignes = existante.lignes.filter((l) => l.distribution.drom === 1);
for (const region of Object.values(REGIONS)) {
  for (const periode of PERIODES) {
    lignes.push({
      conditions: { region, periode: periode.nom },
      distribution: distribution(region, periode.debut + 5),
    });
  }
  lignes.push({ conditions: { region }, distribution: distribution(region, 2020) });
}
// Repli national : moyenne des régions métropolitaines pondérée par leur population.
const national = Object.fromEntries([...TERRITOIRES, 'quartier_prioritaire'].map((t) => [t, 0]));
let populationTotale = 0;
for (const region of Object.values(REGIONS)) {
  const population = Object.values(populationEn(parRegion.get(region), 2020)).reduce(
    (s, v) => s + v,
    0,
  );
  for (const [t, part] of Object.entries(distribution(region, 2020))) {
    national[t] += part * population;
  }
  populationTotale += population;
}
lignes.push({
  conditions: {},
  distribution: Object.fromEntries(
    Object.entries(national).map(([t, v]) => [t, significatif(v / populationTotale, 4)]),
  ),
});
ecrireTable('territoire', {
  source:
    "Insee, aires d'attraction des villes 2020 (composition communale au 1er janvier 2026) : grande métropole = pôle d'une aire de 700 000 habitants ou plus, ville moyenne = autre pôle ou commune de 2 000 habitants ou plus hors attraction, périurbain = commune de couronne de 2 000 habitants ou plus, rural = commune hors pôle de moins de 2 000 habitants l'année du recensement ; populations communales des recensements 1954-2023 (séries historiques, géographie 2025), interpolées au milieu de chaque décennie, zonage de 2020 pour toutes les années ; quartiers prioritaires 2024 (populations 2020) retirés de la catégorie de leur commune, à la même part pour toutes les décennies. DROM : « drom ».",
  url: 'https://www.insee.fr/fr/information/4803954',
  lignes,
});
const idf = lignes.find(
  (l) => l.conditions.region === 'ile_de_france' && l.conditions.periode === '2020-2029',
);
console.log(
  'territoire : national',
  JSON.stringify(lignes.at(-1).distribution),
  '| Ile-de-France 2020',
  JSON.stringify(idf.distribution),
);
