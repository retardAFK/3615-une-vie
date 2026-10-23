// Chargement des données passées au moteur : tables de public/data/ (fetch),
// événements de contenu/evenements/ et libellés (inclus dans le bundle).

import libellesBruts from '../../contenu/textes/libelles.json';
import recits from '../../contenu/textes/recits.json';
import ressources from '../../contenu/textes/ressources.json';
import type { Donnees, EntreeContexte, Evenement, Tables } from '../moteur/types';
import { tagsConnus, validerContexte, validerEvenements } from '../moteur/validation';

const FICHIERS_EVENEMENTS = import.meta.glob<unknown>('../../contenu/evenements/*.json', {
  eager: true,
  import: 'default',
});
const FICHIERS_CONTEXTE = import.meta.glob<unknown>('../../contenu/contexte/*.json', {
  eager: true,
  import: 'default',
});

const fichiersNommes = (fichiers: Readonly<Record<string, unknown>>) =>
  Object.entries(fichiers).map(([chemin, contenu]) => ({
    nom: chemin.split('/').at(-1) ?? chemin,
    contenu,
  }));

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
  'baremesAides',
  'nonRecours',
  'transitionsAddictions',
  'expositionAddictions',
  'sexeAddictions',
  'effetsAddictions',
  'interactionsAddictions',
  'addictionsAutresTags',
  'parametresAddictions',
  'jeuxArgent',
  'budgetsJeu',
  'vieillissement',
  'maladies',
  'mortaliteFacteurs',
  'parametresSante',
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
/** Libellés affichés et modèles de récit, dans un seul dictionnaire pour le moteur. */
export const libelles = { ...libellesBruts, recits };

/** Ressources d'aide : nom et contact (contenu/textes/ressources.json). */
export const RESSOURCES: Readonly<Record<string, { nom: string; contact: string }>> = ressources;

export function evenementsDuContenu(
  fichiers: Readonly<Record<string, unknown>> = FICHIERS_EVENEMENTS,
): Evenement[] {
  const { erreurs, evenements } = validerEvenements(fichiersNommes(fichiers), {
    ressources: Object.keys(RESSOURCES),
  });
  if (erreurs.length > 0) throw new Error(`Contenu invalide :\n${erreurs.join('\n')}`);
  return evenements;
}

/** Contexte historique validé ; ses multiplicateurs visent les tags des événements. */
export function contexteDuContenu(
  evenements: readonly Evenement[],
  fichiers: Readonly<Record<string, unknown>> = FICHIERS_CONTEXTE,
): EntreeContexte[] {
  const { erreurs, entrees } = validerContexte(fichiersNommes(fichiers), tagsConnus(evenements));
  if (erreurs.length > 0) throw new Error(`Contexte invalide :\n${erreurs.join('\n')}`);
  return entrees;
}

/** Tout le contenu du jeu, inclus dans le bundle : événements, contexte, libellés. */
export function contenuDuJeu(): Omit<Donnees, 'tables'> {
  const evenements = evenementsDuContenu();
  return { evenements, contexte: contexteDuContenu(evenements), libelles };
}

export async function chargerDonnees(
  base: string = import.meta.env.BASE_URL,
  recuperer?: Recuperer,
): Promise<Donnees> {
  return { tables: await chargerTables(base, recuperer), ...contenuDuJeu() };
}
