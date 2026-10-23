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
// - fratrie, logementFamilial, santeNaissance, decileRevenuFoyer : voir leurs sections.
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

// --- Fratrie : nombre de frères et sœurs ---
// Répartition des femmes par nombre d'enfants selon la génération (Insee, enquête Famille
// et logements 2011, transcription). Un enfant tiré au hasard appartient à une famille de
// n enfants avec une probabilité proportionnelle à n × part des femmes à n enfants. Les
// familles de 4 enfants ou plus suivent une loi géométrique dont la moyenne redonne le
// nombre moyen d'enfants de la génération. Les naissances d'une année se répartissent
// entre les générations de mères selon la fécondité par âge de la décennie (table
// fecondite) ; hors des générations 1931-1965, la plus proche.
const TAILLE_MAXIMALE = 30;
const generations = lireCsv(
  join(BRUT, 'transcriptions', 'insee-enfants-par-femme-generation.csv'),
  { encodage: 'utf8' },
).map((l) => {
  const [debut, fin] = l.generation.split('-').map(Number);
  const petites = [0, 1, 2, 3].map((n) => nombre(l[`enfants_${n}`]) / 100);
  const grandes = nombre(l.enfants_4_et_plus) / 100;
  const total = petites.reduce((s, v) => s + v, 0) + grandes;
  const moyenneGrandes =
    (nombre(l.nombre_moyen) - petites.reduce((s, v, n) => s + n * v, 0)) / grandes;
  const q = (moyenneGrandes - 4) / (moyenneGrandes - 3);
  const parts = [...petites];
  for (let n = 4; n <= TAILLE_MAXIMALE; n++) parts[n] = grandes * (1 - q) * q ** (n - 4);
  // Fratrie d'un enfant : n − 1 frères et sœurs, plafonnée à « 5 et plus ».
  const fratrie = [0, 0, 0, 0, 0, 0];
  parts.forEach((part, n) => {
    if (n > 0) fratrie[Math.min(n - 1, 5)] += (n * part) / total;
  });
  return { debut, fin, fratrie };
});
const fratrieDeGeneration = (annee) =>
  (
    generations.find((g) => annee >= g.debut && annee <= g.fin) ??
    (annee < generations[0].debut ? generations[0] : generations.at(-1))
  ).fratrie;
const fecondite = lireTable('fecondite');
const lignesFratrie = PERIODES.map((p) => {
  const taux = fecondite.lignes.find((l) => l.conditions.periode === p.nom).parAnnee;
  const somme = [0, 0, 0, 0, 0, 0];
  for (let annee = p.debut; annee <= p.fin; annee++) {
    taux.forEach((t, age) => {
      fratrieDeGeneration(annee - age).forEach((v, k) => (somme[k] += t * v));
    });
  }
  return {
    conditions: { periode: p.nom },
    distribution: normaliser(Object.fromEntries(somme.map((v, k) => [String(k), v]))),
  };
});
lignesFratrie.push({ conditions: {}, distribution: lignesFratrie.at(-1).distribution });
ecrireTable('fratrie', {
  source:
    "Insee, enquête Famille et logements 2011 (France, portrait social 2013, « Avez-vous eu des enfants ? Si oui, combien ? », annexe 1, transcription) : répartition des femmes par nombre d'enfants, générations 1931-1965, pondérée par le nombre d'enfants (point de vue de l'enfant) ; familles de 4 enfants ou plus en loi géométrique de même moyenne ; générations de mères pondérées par la fécondité par âge de la décennie (table fecondite), générations hors champ ramenées à la plus proche.",
  url: 'https://www.insee.fr/fr/statistiques/1288287',
  lignes: lignesFratrie,
});

// --- Logement familial selon le décile ---
// Statut d'occupation des ménages par quartile de niveau de vie en 2017 (Insee, SRCV ;
// hors logés gratuitement). Un décile prend la moyenne des quartiles qu'il recouvre. La
// part « précaire » reste provisoire ; les autres statuts se partagent le reste.
const f35 = lireClasseur(join(BRUT, 'insee', 'RPM2021-F35.xlsx')).get('Figure 1');
const quartiles = [];
for (const l of f35) {
  const libelle = String(l[0] ?? '').trim();
  if (/quartile/i.test(libelle)) quartiles.push({});
  else if (quartiles.length > 0 && quartiles.length <= 4 && typeof l[2] === 'number') {
    const q = quartiles.at(-1);
    if (/secteur libre/.test(libelle)) q.locataire_prive = l[2];
    else if (/secteur social/.test(libelle)) q.hlm = l[2];
    else if (/propriét/i.test(libelle)) q.proprietaire = (q.proprietaire ?? 0) + l[2];
  }
}
if (quartiles.length < 4 || quartiles.slice(0, 4).some((q) => Object.keys(q).length !== 3)) {
  throw new Error('RPM2021-F35 : quartiles illisibles');
}
const logementExistant = lireTable('logementFamilial');
const lignesLogement = [];
for (let d = 1; d <= 10; d++) {
  const [bas, haut] = [(d - 1) / 10, d / 10];
  const statuts = { proprietaire: 0, locataire_prive: 0, hlm: 0 };
  quartiles.slice(0, 4).forEach((q, i) => {
    const recouvrement = Math.max(0, Math.min(haut, (i + 1) / 4) - Math.max(bas, i / 4));
    for (const k of Object.keys(statuts)) statuts[k] += recouvrement * q[k];
  });
  const total = Object.values(statuts).reduce((s, v) => s + v, 0);
  const precaire = logementExistant.lignes.find((l) => l.conditions.decileRevenuFoyer === String(d))
    .distribution.precaire;
  lignesLogement.push({
    conditions: { decileRevenuFoyer: String(d) },
    distribution: normaliser({
      ...Object.fromEntries(
        Object.entries(statuts).map(([k, v]) => [k, (v / total) * (1 - precaire)]),
      ),
      precaire,
    }),
  });
}
lignesLogement.push({
  conditions: {},
  distribution: normaliser(
    Object.fromEntries(
      Object.keys(lignesLogement[0].distribution).map((k) => [
        k,
        lignesLogement.reduce((s, l) => s + l.distribution[k], 0),
      ]),
    ),
  ),
});
ecrireTable('logementFamilial', {
  source:
    "Insee, Revenus et patrimoine des ménages 2021, « Les dépenses en logement des ménages », figure 1 : répartition des ménages par statut d'occupation selon le quartile de niveau de vie en 2017 (SRCV, France métropolitaine, hors logés gratuitement), propriétaires = accédants et non accédants ; un décile prend la moyenne des quartiles qu'il recouvre. Part « précaire » provisoire (à calibrer).",
  url: 'https://www.insee.fr/fr/statistiques/5371269?sommaire=5371304',
  aCalibrer: true,
  lignes: lignesLogement,
});

// --- Santé à la naissance : prématurité ---
// Le taux de prématurité moyen des déciles est ramené au taux de la métropole en 2021
// (DREES) ; l'écart entre déciles et le handicap restent provisoires.
const prematurite =
  nombre(
    lireCsv(join(BRUT, 'transcriptions', 'drees-prematurite-2021.csv'), {
      encodage: 'utf8',
    }).find((l) => l.territoire === 'metropole').taux_prematurite,
  ) / 100;
const santeExistante = lireTable('santeNaissance');
const parDecile = santeExistante.lignes.filter((l) => l.conditions.decileRevenuFoyer);
const moyennePrematurite =
  parDecile.reduce((s, l) => s + l.distribution.prematurite, 0) / parDecile.length;
const echellePrematurite = prematurite / moyennePrematurite;
ecrireTable('santeNaissance', {
  source: `Prématurité : ${(prematurite * 100).toFixed(1)} % des naissances vivantes en France métropolitaine en 2021 (DREES, indicateurs de santé périnatale 2021, transcription), moyenne des déciles ; écart entre déciles et handicap provisoires (à calibrer).`,
  url: 'https://drees.solidarites-sante.gouv.fr/communique-de-presse/indicateurs-de-sante-perinatale-2021-la-mortinatalite-reste-stable-entre-2020',
  aCalibrer: true,
  lignes: santeExistante.lignes.map((l) => {
    const premature = l.distribution.prematurite * echellePrematurite;
    return {
      conditions: l.conditions,
      distribution: normaliser({
        normale: 1 - premature - l.distribution.handicap,
        prematurite: premature,
        handicap: l.distribution.handicap,
      }),
    };
  }),
});

// --- Décile de revenu du foyer selon la catégorie et le diplôme ---
// Marges par catégorie : répartition des personnes de 18 ans ou plus par tranche de
// niveau de vie selon leur catégorie socioprofessionnelle en 2018 (Insee, ERFS). Les
// lignes par diplôme gardent leurs écarts provisoires et sont ajustées pour que leur
// moyenne, pondérée par les diplômes des parents de la décennie 2010, retrouve la marge.
const f16 = lireClasseur(join(BRUT, 'insee', 'RPM2021-F16.xlsx')).get('Figure 2b');
function ligneF16(debut) {
  const l = f16.find((r) => String(r[0] ?? '').startsWith(debut));
  if (!l) throw new Error(`RPM2021-F16 : ligne « ${debut} » introuvable`);
  return l.slice(2, 12).map((v) => nombre(v));
}
const MARGES = {
  agriculteur: ligneF16('Agriculteur exploitant'),
  artisan_commercant: ligneF16('Agriculteur exploitant'),
  cadre: ligneF16('Cadre'),
  intermediaire: ligneF16('Profession intermédiaire'),
  employe: ligneF16('Employé'),
  ouvrier: ligneF16('Ouvrier'),
  sans_emploi: ligneF16('Autre personne sans activité'),
};
const diplomes = lireTable('diplomeParents');
const decileExistant = lireTable('decileRevenuFoyer');
const vecteurDeciles = (valeurs) => Object.fromEntries(valeurs.map((v, i) => [String(i + 1), v]));
const lignesDecile = [];
for (const [pcs, marge] of Object.entries(MARGES)) {
  const cible = normaliser(vecteurDeciles(marge));
  const poids = (
    diplomes.lignes.find(
      (l) => l.conditions.pcsParents === pcs && l.conditions.periode === '2010-2019',
    ) ??
    diplomes.lignes.find(
      (l) => l.conditions.pcsParents === pcs && Object.keys(l.conditions).length === 1,
    )
  ).distribution;
  let lignes = decileExistant.lignes.filter(
    (l) => l.conditions.pcsParents === pcs && l.conditions.diplomeParents,
  );
  for (let iteration = 0; iteration < 50; iteration++) {
    const moyenne = {};
    for (const d of Object.keys(cible)) {
      moyenne[d] = lignes.reduce(
        (s, l) => s + (poids[l.conditions.diplomeParents] ?? 0) * l.distribution[d],
        0,
      );
    }
    lignes = lignes.map((l) => ({
      conditions: l.conditions,
      distribution: normaliser(
        Object.fromEntries(
          Object.keys(cible).map((d) => [d, (l.distribution[d] * cible[d]) / moyenne[d]]),
        ),
      ),
    }));
  }
  lignesDecile.push(...lignes, { conditions: { pcsParents: pcs }, distribution: cible });
}
lignesDecile.push({ conditions: {}, distribution: normaliser(vecteurDeciles(Array(10).fill(1))) });
ecrireTable('decileRevenuFoyer', {
  source:
    'Insee, Revenus et patrimoine des ménages 2021, « Niveau de vie et pauvreté selon la catégorie socioprofessionnelle », figure 2b : répartition des personnes de 18 ans ou plus par tranche de niveau de vie selon leur catégorie en 2018 (ERFS, France métropolitaine ; agriculteurs et artisans ensemble ; sans emploi = autres personnes sans activité professionnelle). Écarts par diplôme provisoires, ajustés pour retrouver ces marges avec les diplômes des parents de la décennie 2010 (à calibrer).',
  url: 'https://www.insee.fr/fr/statistiques/5371231?sommaire=5371304',
  aCalibrer: true,
  lignes: lignesDecile,
});
