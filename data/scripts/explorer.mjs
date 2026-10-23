// Affiche le début de chaque feuille d'un classeur xlsx de data/brut/ (pour écrire les
// scripts de calibrage). Usage : node data/scripts/explorer.mjs <fichier.xlsx> [lignes]

import { lireClasseur } from './lib/xlsx.mjs';

const [chemin, nombre = '12'] = process.argv.slice(2);
for (const [nom, lignes] of lireClasseur(chemin)) {
  console.log(`=== ${nom} (${lignes.length} lignes)`);
  for (const ligne of lignes.slice(0, Number(nombre))) {
    console.log(ligne.map((v) => (v === null ? '' : String(v).slice(0, 24))).join(' | '));
  }
}
