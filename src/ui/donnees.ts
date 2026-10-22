// Chargement des tables de public/data/, passées ensuite au moteur.

import type { Tables } from '../moteur/types';

const NOMS_TABLES: readonly (keyof Tables)[] = [
  'anneeNaissance',
  'sexe',
  'region',
  'territoire',
  'pcsParents',
  'diplomeParents',
  'decileRevenuFoyer',
  'structureFamiliale',
  'fratrie',
  'logementFamilial',
  'origineMigratoire',
  'santeNaissance',
  'prenoms',
  'mortalite',
];

export type Recuperer = (
  url: string,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export async function chargerTables(
  base: string = import.meta.env.BASE_URL,
  recuperer: Recuperer = (url) => fetch(url),
): Promise<Tables> {
  const entrees = await Promise.all(
    NOMS_TABLES.map(async (nom) => {
      const reponse = await recuperer(`${base}data/${nom}.json`);
      if (!reponse.ok) throw new Error(`Table ${nom} : erreur HTTP ${reponse.status}`);
      return [nom, await reponse.json()] as const;
    }),
  );
  return Object.fromEntries(entrees) as unknown as Tables;
}
