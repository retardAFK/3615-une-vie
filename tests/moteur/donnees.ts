// Données de test : tables de travail, tous les événements de contenu/, libellés,
// et un fabricant d'événements synthétiques.

import libelles from '../../contenu/textes/libelles.json';
import { validerEvenements } from '../../src/moteur/validation';
import type { Donnees, Evenement, Tables } from '../../src/moteur/types';
import { TABLES } from './tables';

const fichiers = import.meta.glob<unknown>('../../contenu/evenements/*.json', {
  eager: true,
  import: 'default',
});
const validation = validerEvenements(
  Object.entries(fichiers).map(([chemin, contenu]) => ({
    nom: chemin.split('/').at(-1)!,
    contenu,
  })),
);
if (validation.erreurs.length > 0) throw new Error(validation.erreurs.join('\n'));

export const DONNEES: Donnees = { tables: TABLES, evenements: validation.evenements, libelles };

/** Mortalité nulle : seul le plafond d'âge ou un événement mortel termine la vie. */
export const TABLES_IMMORTELS: Tables = {
  ...TABLES,
  mortalite: {
    ...TABLES.mortalite,
    lignes: [{ conditions: {}, qParAge: Array.from({ length: 111 }, () => 0) }],
  },
};

export function donneesAvec(evenements: Evenement[], tables: Tables = TABLES_IMMORTELS): Donnees {
  return { tables, evenements, libelles };
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
