// Extraction des feuilles départementales des recensements 1968-2022 (Insee, population
// active de 25 à 54 ans par catégorie socioprofessionnelle, et par catégorie et diplôme).
// Les archives de l'Insee pèsent 28 et 46 Mo (toutes les communes) : elles restent hors
// du dépôt, dans data/brut/insee/recensement/ (ignoré par git). Ce script, lancé à la
// main quand elles sont là, recopie les feuilles « DEP_<année> » sans toucher aux
// chiffres, dans deux CSV versionnés que lit origine.mjs.
//
//   node data/scripts/extraire-recensement.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRUT } from './lib/sources.mjs';
import { lireClasseur, lireZip } from './lib/xlsx.mjs';

const DOSSIER = join(BRUT, 'insee', 'recensement');

/** Feuilles DEP_<année> du classeur contenu dans l'archive. */
function feuillesDepartementales(archive) {
  const [classeur] = lireZip(join(DOSSIER, archive)).values();
  return lireClasseur(classeur, { feuilles: (nom) => nom.startsWith('DEP_') });
}

/**
 * Une ligne par département et recensement. Les colonnes de valeurs sont nommées par les
 * codes de la ligne d'en-tête technique (« csx_rec1taxtypac_rec1rpop1968 ») sans le
 * suffixe de l'année, pour être les mêmes d'un recensement à l'autre. Les diplômes du
 * supérieur sont détaillés à partir de 1982 : une colonne absente d'un recensement reste
 * vide.
 */
function extraire(archive, sortie) {
  const feuilles = [];
  for (const [nom, feuille] of feuillesDepartementales(archive)) {
    const iEntete = feuille.findIndex((l) => l[0] === 'RR24');
    if (iEntete < 0) throw new Error(`${archive}, ${nom} : en-tête introuvable`);
    const codes = feuille[iEntete].slice(3).map((c) => String(c).replace(/rpop\d{4}$/, ''));
    feuilles.push({ annee: nom.slice('DEP_'.length), codes, lignes: feuille.slice(iEntete + 1) });
  }
  const colonnes = [...new Set(feuilles.flatMap((f) => f.codes))].sort();
  const lignes = [];
  for (const { annee, codes, lignes: donnees } of feuilles) {
    for (const l of donnees) {
      if (l[1] === null || l[1] === undefined) continue;
      const valeurs = colonnes.map((c) =>
        codes.includes(c) ? (l[3 + codes.indexOf(c)] ?? '') : '',
      );
      lignes.push([annee, l[0], l[1], String(l[2]).replace(/;/g, ','), ...valeurs].join(';'));
    }
  }
  const entete = ['annee', 'region', 'departement', 'libelle', ...colonnes].join(';');
  writeFileSync(join(DOSSIER, sortie), `${[entete, ...lignes].join('\n')}\n`);
  console.log(`${sortie} : ${lignes.length} lignes, ${colonnes.length} colonnes`);
}

extraire('pop-act2554-csp-cd-6822.zip', 'pop-act2554-csp-dep.csv');
extraire('pop-act2554-csp-dipl-cd-6822.zip', 'pop-act2554-csp-dipl-dep.csv');
