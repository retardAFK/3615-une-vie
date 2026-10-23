// Affiche le début de chaque feuille d'un classeur xlsx ou xls de data/brut/ (pour écrire
// les scripts de calibrage). Usage : node data/scripts/explorer.mjs <fichier> [lignes]

import { lireClasseurXls } from './lib/xls.mjs';
import { lireClasseur } from './lib/xlsx.mjs';

const [chemin, nombre = '12'] = process.argv.slice(2);
const classeur = chemin.endsWith('.xls') ? lireClasseurXls(chemin) : lireClasseur(chemin);
for (const [nom, lignes] of classeur) {
  console.log(`=== ${nom} (${lignes.length} lignes)`);
  for (const ligne of lignes.slice(0, Number(nombre))) {
    console.log(ligne.map((v) => (v === null ? '' : String(v).slice(0, 24))).join(' | '));
  }
}
