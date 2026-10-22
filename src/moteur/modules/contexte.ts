// Contexte historique : point d'accroche minimal. Chaque ligne de la table porte
// une année et des multiplicateurs par tag (crise...). Format complet au jalon 4c.

import type { Tables } from '../types';

/** Produit des multiplicateurs de l'année pour ce tag ; 1 sans contexte. */
export function multiplicateurContexte(tables: Tables, annee: number, tag: string): number {
  const { lignes } = tables.contexte;
  if (lignes.length === 0) return 1;
  const cle = String(annee);
  let m = 1;
  for (const ligne of lignes) {
    if (ligne.conditions.annee === cle) m *= ligne.multiplicateurs[tag] ?? 1;
  }
  return m;
}
