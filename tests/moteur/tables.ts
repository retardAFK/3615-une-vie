// Tables de travail de public/data/, assemblées pour les tests.

import type { Tables } from '../../src/moteur/types';

const fichiers = import.meta.glob<unknown>('../../public/data/*.json', {
  eager: true,
  import: 'default',
});

// Chaque fichier porte le nom de sa table : public/data/<nom>.json.
// TypeScript ne peut pas vérifier la forme des JSON : les tests vérifient les valeurs tirées.
export const TABLES = Object.fromEntries(
  Object.entries(fichiers).map(([chemin, table]) => [
    chemin.split('/').at(-1)!.replace('.json', ''),
    table,
  ]),
) as unknown as Tables;
