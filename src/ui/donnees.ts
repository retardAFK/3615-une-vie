// Chargement des données passées au moteur : tables de public/data/ (fetch),
// événements de contenu/evenements/ et libellés (inclus dans le bundle).

import libelles from '../../contenu/textes/libelles.json';
import type { Donnees, Evenement, Tables } from '../moteur/types';
import { validerEvenements } from '../moteur/validation';

const FICHIERS_EVENEMENTS = import.meta.glob<unknown>('../../contenu/evenements/*.json', {
  eager: true,
  import: 'default',
});

export const NOMS_TABLES: readonly (keyof Tables)[] = [
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
  'obligationScolaire',
  'redoublement',
  'voieFin3e',
  'decrochage',
  'reussiteDiplome',
  'orientationPostBac',
  'abandonSup',
  'poursuiteMaster',
  'repriseEtudes',
  'pcsJoueur',
  'insertion',
  'transitionsEmploi',
  'salaireReference',
  'coefficientPcs',
  'coefficientDiplome',
  'coefficientRegion',
  'courbeAnciennete',
  'quotite',
  'parametresEmploi',
  'ageLegalRetraite',
  'depensesVie',
  'parametresArgent',
  'contexte',
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

/** Événements validés ; une erreur de contenu arrête le chargement. */
export function evenementsDuContenu(
  fichiers: Readonly<Record<string, unknown>> = FICHIERS_EVENEMENTS,
): Evenement[] {
  const { erreurs, evenements } = validerEvenements(
    Object.entries(fichiers).map(([chemin, contenu]) => ({
      nom: chemin.split('/').at(-1) ?? chemin,
      contenu,
    })),
  );
  if (erreurs.length > 0) throw new Error(`Contenu invalide :\n${erreurs.join('\n')}`);
  return evenements;
}

export async function chargerDonnees(
  base: string = import.meta.env.BASE_URL,
  recuperer?: Recuperer,
): Promise<Donnees> {
  return {
    tables: await chargerTables(base, recuperer),
    evenements: evenementsDuContenu(),
    libelles,
  };
}
