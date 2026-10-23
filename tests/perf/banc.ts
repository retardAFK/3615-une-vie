// Banc d'essai local (npm run perf) : temps réels du moteur seul, hors de Vitest.
// Construit par Vite en mode SSR (tables et contenu chargés comme dans le jeu),
// puis exécuté par Node. Voir docs/architecture.md, section « Budgets ».

import { creerPartie, jouerAnneeAuto } from '../../src/moteur/boucle';
import type { Donnees, Tables } from '../../src/moteur/types';
import { contenuDuJeu } from '../../src/ui/donnees';

/** Objectifs bloquants. */
const MS_PAR_VIE = 5; // fluidité : une vie en AUTO, en moyenne
const MS_POUR_1000_VIES = 1000; // bilan comparatif dans le worker

const tables = Object.fromEntries(
  Object.entries(
    import.meta.glob<unknown>('../../public/data/*.json', { eager: true, import: 'default' }),
  ).map(([chemin, table]) => [chemin.split('/').at(-1)!.replace('.json', ''), table]),
) as unknown as Tables;
const donnees: Donnees = { tables, ...contenuDuJeu() };

/** Joue `nombre` vies complètes en AUTO ; renvoie la durée en millisecondes. */
function vies(nombre: number, prefixe: string): number {
  const debut = performance.now();
  for (let i = 0; i < nombre; i++) {
    let etat = creerPartie(`${prefixe}-${i}`, donnees);
    while (etat.personnage.vivant) etat = jouerAnneeAuto(etat, donnees).etat;
  }
  return performance.now() - debut;
}

vies(300, 'chauffe'); // compilation à la volée du moteur avant de mesurer

const mille = vies(1000, 'mille');
const parVie = mille / 1000;
const dixMille = vies(10_000, 'dix-mille');

const ok = (valide: boolean): string => (valide ? 'OK   ' : 'ECHEC');
console.log(
  `${ok(parVie < MS_PAR_VIE)} une vie en AUTO : ${parVie.toFixed(2)} ms (objectif < ${MS_PAR_VIE} ms)`,
);
console.log(
  `${ok(mille < MS_POUR_1000_VIES)} 1 000 vies : ${Math.round(mille)} ms (objectif < ${MS_POUR_1000_VIES} ms)`,
);
console.log(`INFO  10 000 vies : ${Math.round(dixMille)} ms (equilibrage, sans objectif bloquant)`);

if (parVie >= MS_PAR_VIE || mille >= MS_POUR_1000_VIES) {
  throw new Error('Objectifs de performance non tenus (voir docs/architecture.md, Budgets).');
}
