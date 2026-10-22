// Recherche d'une ligne dans une table conditionnelle, avec repli
// vers une table moins précise quand une combinaison manque (règles, section 3).

import type { Conditions, Table } from './types';

/** Période décennale d'une année : 1987 → « 1980-1989 ». */
export function periodeDe(annee: number): string {
  const debut = Math.floor(annee / 10) * 10;
  return `${debut}-${debut + 9}`;
}

function memesConditions(a: Conditions, b: Conditions): boolean {
  const clesA = Object.keys(a);
  return clesA.length === Object.keys(b).length && clesA.every((cle) => a[cle] === b[cle]);
}

/**
 * Cherche la ligne dont les conditions sont exactement `conditions`.
 * À défaut, retire les conditions une à une dans l'ordre de `ordreRepli`
 * et recommence, jusqu'à la ligne sans condition.
 */
export function chercherLigne<L extends { conditions: Conditions }>(
  table: Table<L>,
  conditions: Conditions,
  ordreRepli: readonly string[],
): L {
  const courantes: Record<string, string> = { ...conditions };
  for (let i = 0; i <= ordreRepli.length; i++) {
    const ligne = table.lignes.find((l) => memesConditions(l.conditions, courantes));
    if (ligne) return ligne;
    const cle = ordreRepli[i];
    if (cle !== undefined) delete courantes[cle];
  }
  throw new Error(`Table ${table.table} : aucune ligne pour ${JSON.stringify(conditions)}`);
}
