import { describe, expect, it } from 'vitest';
import type { Table } from '../src/moteur/types';

// Toutes les tables de public/data/, avec leurs métadonnées (CLAUDE.md, principe 4).
const tables = Object.entries(
  import.meta.glob<Table<{ valeurs?: Record<string, number> }>>('../public/data/*.json', {
    eager: true,
    import: 'default',
  }),
).map(([chemin, table]) => ({ fichier: chemin.split('/').at(-1)!, table }));

describe('public/data', () => {
  it('chaque table porte son nom, sa source et son etat de calibrage', () => {
    for (const { fichier, table } of tables) {
      expect(`${table.table}.json`, fichier).toBe(fichier);
      expect(table.source.trim(), fichier).not.toBe('');
      expect(typeof table.aCalibrer, fichier).toBe('boolean');
    }
  });

  it('une table calibree ne garde aucune valeur de travail', () => {
    for (const { fichier, table } of tables) {
      if (table.aCalibrer) continue;
      expect(table.source, fichier).not.toMatch(/valeurs de travail/i);
    }
  });

  it('les reglages declares existent et sont justifies', () => {
    for (const { fichier, table } of tables) {
      if (!table.reglages) continue;
      expect(table.reglages.source, fichier).toMatch(/choix de conception/i);
      const noms = new Set(table.lignes.flatMap((l) => Object.keys(l.valeurs ?? {})));
      for (const nom of table.reglages.noms)
        expect(noms.has(nom), `${fichier} : ${nom}`).toBe(true);
    }
  });
});
