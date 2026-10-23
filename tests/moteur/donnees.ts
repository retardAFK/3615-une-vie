// Données de test : tables de travail, tout le contenu du jeu (événements, contexte, libellés),
// et un fabricant d'événements synthétiques.

import { contenuDuJeu } from '../../src/ui/donnees';
import type { Donnees, Evenement, Tables } from '../../src/moteur/types';
import { TABLES } from './tables';

// Même chargement que le jeu : événements et contexte validés, libellés et récits.
const CONTENU = contenuDuJeu();

export const DONNEES: Donnees = { tables: TABLES, ...CONTENU };

/** Mortalité nulle : seul le plafond d'âge ou un événement mortel termine la vie. */
export const TABLES_IMMORTELS: Tables = {
  ...TABLES,
  mortalite: {
    ...TABLES.mortalite,
    lignes: [{ conditions: {}, qParAge: Array.from({ length: 111 }, () => 0) }],
  },
};

/** Données avec d'autres événements ; le contexte historique et les libellés du jeu restent. */
export function donneesAvec(evenements: Evenement[], tables: Tables = TABLES_IMMORTELS): Donnees {
  return { ...CONTENU, tables, evenements };
}

export function evenement(id: string, partiel: Partial<Evenement> = {}): Evenement {
  return {
    id,
    module: 'test',
    age: [0, 110],
    pBase: 1,
    effets: {},
    gravite: 1,
    tags: [],
    textes: [`${id.toUpperCase()} A {age} ANS.`, `${id.toUpperCase()} EN {annee}.`],
    ...partiel,
  };
}
