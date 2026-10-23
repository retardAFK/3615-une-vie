// Origine sociale à la naissance.
// - region : parts des naissances domiciliées par région (Insee, BDM, depuis 1975 ; DROM
//   depuis 1994, Mayotte depuis 2014). Avant les premières données d'un DROM, ses
//   naissances suivent celles de la métropole au rapport de ses six premières années ;
//   Mayotte compte à partir de sa départementalisation (2011). Les décennies 1950 et 1960,
//   sans données, reprennent la décennie 1970.
// - pcsParents : catégorie socioprofessionnelle des actifs de 25 à 54 ans (recensements
//   1968-2022, en emploi ; les chômeurs ayant déjà travaillé forment « sans emploi »).
// - diplomeParents : diplôme de ces actifs selon leur catégorie (mêmes recensements).
// - origineMigratoire : lieu de naissance des parents des nouveau-nés (Insee, état civil,
//   T37ter, métropole, depuis 1977). « premiere_generation » : deux parents nés à
//   l'étranger ; « deuxieme_generation » : un seul.
// - structureFamiliale : part des enfants mineurs en famille monoparentale (Insee,
//   recensements 1990, 1999, 2016, transcription).
// Une décennie prend la valeur interpolée au milieu de la décennie (1955, 1965...), bornée
// aux observations extrêmes. Les écarts entre territoires gardent les rapports de la table
// provisoire, appliqués aux nouvelles parts nationales.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BRUT,
  PERIODES,
  ecrireTable,
  lireCsv,
  lireTable,
  nombre,
  significatif,
} from './lib/sources.mjs';
import { lireClasseur } from './lib/xlsx.mjs';

const milieu = (periode) => periode.debut + 5;

/** Interpolation linéaire dans une série { annee → vecteur }, bornée aux extrêmes. */
function interpoler(serie, annee) {
  const annees = [...serie.keys()].sort((a, b) => a - b);
  if (annee <= annees[0]) return serie.get(annees[0]);
  if (annee >= annees.at(-1)) return serie.get(annees.at(-1));
  const apres = annees.find((a) => a >= annee);
  const avant = annees[annees.indexOf(apres) - 1];
  const t = (annee - avant) / (apres - avant);
  const [a, b] = [serie.get(avant), serie.get(apres)];
  return Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + t * (b[k] - a[k])]));
}

/** Parts arrondies, la plus grande absorbant l'écart d'arrondi pour sommer à 1. */
function normaliser(vecteur) {
  const total = Object.values(vecteur).reduce((s, v) => s + v, 0);
  const parts = Object.fromEntries(
    Object.entries(vecteur).map(([k, v]) => [k, significatif(v / total, 4)]),
  );
  const plusGrande = Object.keys(parts).reduce((a, b) => (parts[a] >= parts[b] ? a : b));
  const somme = Object.values(parts).reduce((s, v) => s + v, 0);
  parts[plusGrande] = significatif(parts[plusGrande] + 1 - somme, 4);
  return parts;
}

/**
 * Lignes par territoire : les rapports territoire / national de la table existante,
 * appliqués à la nouvelle part nationale de la même décennie (à défaut, de la dernière
 * décennie connue). Le rapport se conserve d'une exécution à l'autre à une constante près,
 * que la normalisation efface.
 */
function lignesTerritoires(existante, nationales) {
  const nationaleExistante = (periode) =>
    existante.lignes.find((l) => l.conditions.periode === periode && !l.conditions.territoire)
      ?.distribution;
  const territoires = [
    ...new Set(existante.lignes.map((l) => l.conditions.territoire).filter(Boolean)),
  ];
  const derniersRapports = new Map();
  const lignes = [];
  for (const periode of PERIODES) {
    for (const territoire of territoires) {
      const provisoire = existante.lignes.find(
        (l) => l.conditions.periode === periode.nom && l.conditions.territoire === territoire,
      );
      if (provisoire) {
        const reference = nationaleExistante(periode.nom);
        derniersRapports.set(
          territoire,
          Object.fromEntries(
            Object.keys(reference).map((k) => [k, provisoire.distribution[k] / reference[k]]),
          ),
        );
      }
      const rapports = derniersRapports.get(territoire);
      if (!rapports) continue;
      const nationale = nationales.get(periode.nom);
      lignes.push({
        conditions: { periode: periode.nom, territoire },
        distribution: normaliser(
          Object.fromEntries(Object.keys(nationale).map((k) => [k, nationale[k] * rapports[k]])),
        ),
      });
    }
  }
  return lignes;
}

// --- Région de naissance ---
const REGIONS = {
  R11: 'ile_de_france',
  R24: 'centre_val_de_loire',
  R27: 'bourgogne_franche_comte',
  R28: 'normandie',
  R32: 'hauts_de_france',
  R44: 'grand_est',
  R52: 'pays_de_la_loire',
  R53: 'bretagne',
  R75: 'nouvelle_aquitaine',
  R76: 'occitanie',
  R84: 'auvergne_rhone_alpes',
  R93: 'provence_alpes_cote_d_azur',
  R94: 'corse',
  D971: 'guadeloupe',
  D972: 'martinique',
  D973: 'guyane',
  D974: 'la_reunion',
  D976: 'mayotte',
};
const DEPARTEMENTALISATION_MAYOTTE = 2011;
const xml = readFileSync(join(BRUT, 'insee', 'naissances-regions.xml'), 'utf8');
const series = new Map();
for (const m of xml.matchAll(/<Series ([^>]*)>(.*?)<\/Series>/gs)) {
  const zone = /REF_AREA="([^"]+)"/.exec(m[1])[1];
  const serie = new Map();
  for (const o of m[2].matchAll(/<Obs ([^>]*)\/>/g)) {
    const annee = Number(/TIME_PERIOD="(\d{4})"/.exec(o[1])?.[1]);
    const valeur = Number(/OBS_VALUE="([^"]+)"/.exec(o[1])?.[1]);
    if (Number.isFinite(annee) && Number.isFinite(valeur)) serie.set(annee, valeur);
  }
  series.set(zone, serie);
}
const metropole = series.get('FM');
function naissancesRegion(zone, annee) {
  const serie = series.get(zone);
  if (serie.has(annee)) return serie.get(annee);
  if (zone === 'D976' && annee < DEPARTEMENTALISATION_MAYOTTE) return 0;
  // DROM avant ses premières données : rapport à la métropole de ses six premières années.
  const premieres = [...serie.keys()].sort((a, b) => a - b).slice(0, 6);
  const rapport =
    premieres.reduce((s, a) => s + serie.get(a), 0) /
    premieres.reduce((s, a) => s + metropole.get(a), 0);
  return metropole.get(annee) * rapport;
}
const anneesRegions = [...metropole.keys()].sort((a, b) => a - b);
const regionParPeriode = new Map();
for (const periode of PERIODES) {
  const annees = anneesRegions.filter((a) => a >= periode.debut && a <= periode.fin);
  if (annees.length === 0) continue;
  regionParPeriode.set(
    periode.nom,
    normaliser(
      Object.fromEntries(
        Object.entries(REGIONS).map(([zone, region]) => [
          region,
          annees.reduce((s, a) => s + naissancesRegion(zone, a), 0),
        ]),
      ),
    ),
  );
}
const premiereRegion = regionParPeriode.get(PERIODES.find((p) => regionParPeriode.has(p.nom)).nom);
const lignesRegion = PERIODES.map((p) => ({
  conditions: { periode: p.nom },
  distribution: regionParPeriode.get(p.nom) ?? premiereRegion,
}));
lignesRegion.push({ conditions: {}, distribution: lignesRegion.at(-1).distribution });
ecrireTable('region', {
  source:
    "Insee, BDM, naissances domiciliées par région (depuis 1975) et par département d'outre-mer (depuis 1994, Mayotte depuis 2014), API SDMX, somme de la décennie. Avant ses premières données, un DROM suit la métropole au rapport de ses six premières années ; Mayotte compte depuis 2011. Les décennies 1950 et 1960 reprennent la décennie 1970.",
  url: 'https://bdm.insee.fr/series/sdmx/data/NAISSANCES-FECONDITE/A...NAISS-DOM.R11+R24+R27+R28+R32+R44+R52+R53+R75+R76+R84+R93+R94+D971+D972+D973+D974+D976+FM....',
  lignes: lignesRegion,
});

// --- Catégorie socioprofessionnelle et diplôme des parents ---
const CS = {
  1: 'agriculteur',
  2: 'artisan_commercant',
  3: 'cadre',
  4: 'intermediaire',
  5: 'employe',
  6: 'ouvrier',
};
const RECENSEMENT = join(BRUT, 'insee', 'recensement');

/** Somme des départements, par recensement : année → { colonne → effectif }. */
function totauxParAnnee(fichier) {
  const totaux = new Map();
  for (const ligne of lireCsv(join(RECENSEMENT, fichier), { encodage: 'utf8' })) {
    const annee = Number(ligne.annee);
    const total = totaux.get(annee) ?? {};
    for (const [colonne, texte] of Object.entries(ligne)) {
      if (colonne.startsWith('csx_')) total[colonne] = (total[colonne] ?? 0) + (nombre(texte) ?? 0);
    }
    totaux.set(annee, total);
  }
  return totaux;
}

const pcsParAnnee = new Map();
for (const [annee, total] of totauxParAnnee('pop-act2554-csp-dep.csv')) {
  const vecteur = { sans_emploi: 0 };
  for (const [code, pcs] of Object.entries(CS)) {
    vecteur[pcs] = total[`csx_rec${code}taxtypac_rec1`];
    vecteur.sans_emploi += total[`csx_rec${code}taxtypac_rec2`];
  }
  pcsParAnnee.set(annee, vecteur);
}
const pcsNationales = new Map(
  PERIODES.map((p) => [p.nom, normaliser(interpoler(pcsParAnnee, milieu(p)))]),
);
ecrireTable('pcsParents', {
  source:
    'Insee, recensements de la population 1968-2022, actifs de 25 à 54 ans selon la catégorie socioprofessionnelle (en emploi ; les chômeurs ayant déjà travaillé forment « sans emploi »), feuilles départementales sommées, interpolées au milieu de chaque décennie (avant 1968 : 1968). Écarts entre territoires : rapports provisoires (à calibrer).',
  url: 'https://www.insee.fr/fr/statistiques/1893185',
  aCalibrer: true,
  lignes: [
    ...PERIODES.map((p) => ({
      conditions: { periode: p.nom },
      distribution: pcsNationales.get(p.nom),
    })),
    ...lignesTerritoires(lireTable('pcsParents'), pcsNationales),
    { conditions: {}, distribution: pcsNationales.get(PERIODES.at(-1).nom) },
  ],
});

// Diplômes : 0 aucun, 1 CEP, 2 BEPC, 3 CAP-BEP, 4 bac, 5 premier cycle universitaire,
// 6 deuxième ou troisième cycle ; 7 supérieur au bac (1968 et 1975 seulement), réparti
// entre 5 et 6 au rapport du premier recensement qui les distingue.
const diplomesParAnnee = totauxParAnnee('pop-act2554-csp-dipl-dep.csv');
const anneesDiplomes = [...diplomesParAnnee.keys()].sort((a, b) => a - b);
const lignesDiplome = [];
for (const [code, pcs] of Object.entries(CS)) {
  const v = (total, d) => total[`csx_rec${code}dpx_rec${d}`] ?? 0;
  const detaille = diplomesParAnnee.get(
    anneesDiplomes.find((a) => v(diplomesParAnnee.get(a), 5) > 0),
  );
  const partCourt = v(detaille, 5) / (v(detaille, 5) + v(detaille, 6));
  const serie = new Map(
    anneesDiplomes.map((annee) => {
      const t = diplomesParAnnee.get(annee);
      return [
        annee,
        {
          aucun: v(t, 0) + v(t, 1) + v(t, 2),
          cap_bep: v(t, 3),
          bac: v(t, 4),
          bac_2_3: v(t, 5) + v(t, 7) * partCourt,
          bac_5: v(t, 6) + v(t, 7) * (1 - partCourt),
        },
      ];
    }),
  );
  for (const p of PERIODES) {
    lignesDiplome.push({
      conditions: { pcsParents: pcs, periode: p.nom },
      distribution: normaliser(interpoler(serie, milieu(p))),
    });
  }
  lignesDiplome.push({
    conditions: { pcsParents: pcs },
    distribution: lignesDiplome.at(-1).distribution,
  });
}
// « Sans emploi » : le recensement ne donne pas le diplôme des chômeurs à part, les lignes
// provisoires restent.
lignesDiplome.push(
  ...lireTable('diplomeParents').lignes.filter(
    (l) => l.conditions.pcsParents === 'sans_emploi' || Object.keys(l.conditions).length === 0,
  ),
);
ecrireTable('diplomeParents', {
  source:
    'Insee, recensements de la population 1968-2022, actifs de 25 à 54 ans selon la catégorie socioprofessionnelle et le diplôme, feuilles départementales sommées, interpolées au milieu de chaque décennie. Aucun = sans diplôme, CEP ou BEPC ; bac+2/3 = premier cycle universitaire ; bac+5 = deuxième ou troisième cycle ; en 1968 et 1975, le supérieur est réparti au rapport de 1982. « Sans emploi » : valeurs provisoires (à calibrer).',
  url: 'https://www.insee.fr/fr/statistiques/1893185',
  aCalibrer: true,
  lignes: lignesDiplome,
});

// --- Origine migratoire : lieu de naissance des parents ---
const t37 = lireClasseur(join(BRUT, 'insee', 'T37ter.xlsx')).get('FM');
const origineParAnnee = new Map();
for (const l of t37) {
  const annee = Number(l[0]);
  if (!Number.isInteger(annee) || typeof l[1] !== 'number') continue;
  const [, , ff, ef, fe, ee, , meresFrance, meresEtranger] = l;
  // Père inconnu (avant 1998) : réparti selon le lieu de naissance de la mère, aux
  // proportions observées quand le père est connu.
  const inconnusMereFrance = meresFrance - ff - ef;
  const inconnusMereEtranger = meresEtranger - fe - ee;
  origineParAnnee.set(annee, {
    aucune: ff + (inconnusMereFrance * ff) / (ff + ef),
    premiere_generation: ee + (inconnusMereEtranger * ee) / (fe + ee),
    deuxieme_generation:
      ef + fe + (inconnusMereFrance * ef) / (ff + ef) + (inconnusMereEtranger * fe) / (fe + ee),
  });
}
const anneesOrigine = [...origineParAnnee.keys()].sort((a, b) => a - b);
const PREMIERES = anneesOrigine.slice(0, 3);
const DERNIERES = anneesOrigine.slice(-3);
function origineDe(periode) {
  let annees = anneesOrigine.filter((a) => a >= periode.debut && a <= periode.fin);
  if (annees.length === 0) annees = periode.fin < anneesOrigine[0] ? PREMIERES : DERNIERES;
  const somme = { aucune: 0, premiere_generation: 0, deuxieme_generation: 0 };
  for (const a of annees) {
    for (const k of Object.keys(somme)) somme[k] += origineParAnnee.get(a)[k];
  }
  return normaliser(somme);
}
const lignesOrigine = PERIODES.map((p) => ({
  conditions: { periode: p.nom },
  distribution: origineDe(p),
}));
lignesOrigine.push({ conditions: {}, distribution: lignesOrigine.at(-1).distribution });
ecrireTable('origineMigratoire', {
  source: `Insee, statistiques de l'état civil, T37ter « Nés vivants selon le lieu de naissance des parents », France métropolitaine, ${anneesOrigine[0]}-${anneesOrigine.at(-1)}, somme de la décennie : premiere_generation = deux parents nés à l'étranger, deuxieme_generation = un seul (les parents nés à l'étranger comptent aussi les Français de naissance, rapatriés compris). Père inconnu (avant 1998) réparti selon le lieu de naissance de la mère. Avant ${anneesOrigine[0]} : ${PREMIERES[0]}-${PREMIERES.at(-1)}.`,
  url: 'https://www.insee.fr/fr/statistiques/6524900',
  lignes: lignesOrigine,
});

// --- Structure familiale : familles monoparentales ---
const monoparentales = new Map(
  lireCsv(join(BRUT, 'transcriptions', 'insee-familles-monoparentales.csv'), {
    encodage: 'utf8',
  }).map((l) => [Number(l.annee), { part: nombre(l.part_mineurs_famille_monoparentale) / 100 }]),
);
const structures = lireTable('structureFamiliale').lignes.filter((l) => l.conditions.periode);
const lignesStructure = PERIODES.map((p) => {
  const provisoire = structures.find((l) => l.conditions.periode === p.nom) ?? structures.at(-1);
  const monoparentale = interpoler(monoparentales, milieu(p)).part;
  const { recomposee, placement_ase } = provisoire.distribution;
  return {
    conditions: { periode: p.nom },
    distribution: normaliser({
      couple: 1 - monoparentale - recomposee - placement_ase,
      monoparentale,
      recomposee,
      placement_ase,
    }),
  };
});
lignesStructure.push({ conditions: {}, distribution: lignesStructure.at(-1).distribution });
ecrireTable('structureFamiliale', {
  source:
    'Familles monoparentales : part des enfants mineurs vivant en famille monoparentale (Insee, recensements 1990, 1999 et 2016, France portrait social 2019, « Ménages et familles », transcription), interpolée au milieu de chaque décennie (avant 1990 : 1990). Familles recomposées et placements : valeurs provisoires (à calibrer).',
  url: 'https://www.insee.fr/fr/statistiques/4238371?sommaire=4238781',
  aCalibrer: true,
  lignes: lignesStructure,
});

console.log(
  'origine : Ile-de-France',
  lignesRegion.map((l) => l.distribution.ile_de_france).join(' '),
  '| cadres',
  PERIODES.map((p) => pcsNationales.get(p.nom).cadre).join(' '),
  '| deux parents nes a l etranger',
  lignesOrigine.map((l) => l.distribution.premiere_generation).join(' '),
);
