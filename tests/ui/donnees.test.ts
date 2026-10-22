import { describe, expect, it } from 'vitest';
import {
  NOMS_TABLES,
  chargerTables,
  evenementsDuContenu,
  type Recuperer,
} from '../../src/ui/donnees';

describe('chargerTables', () => {
  it('charge chaque table sous le chemin de base', async () => {
    const demandes: string[] = [];
    const recuperer: Recuperer = async (url) => {
      demandes.push(url);
      return { ok: true, status: 200, json: async () => ({ table: url }) };
    };
    const tables = await chargerTables('/3615-une-vie/', recuperer);
    expect(demandes).toHaveLength(NOMS_TABLES.length);
    expect(demandes).toContain('/3615-une-vie/data/mortalite.json');
    expect(tables.sexe).toEqual({ table: '/3615-une-vie/data/sexe.json' });
  });

  it('signale une table introuvable', async () => {
    const recuperer: Recuperer = async () => ({ ok: false, status: 404, json: async () => null });
    await expect(chargerTables('/', recuperer)).rejects.toThrow('erreur HTTP 404');
  });
});

describe('evenementsDuContenu', () => {
  it('charge et valide les evenements de contenu/evenements/', () => {
    expect(evenementsDuContenu().length).toBeGreaterThanOrEqual(10);
  });

  it('refuse un contenu invalide', () => {
    expect(() => evenementsDuContenu({ '/x/faux.json': { module: 'x' } })).toThrow(
      'Contenu invalide',
    );
  });
});

describe('NOMS_TABLES', () => {
  it('charge toutes les tables de public/data/, et seulement elles', () => {
    const fichiers = Object.keys(import.meta.glob('../../public/data/*.json')).map((chemin) =>
      chemin.split('/').at(-1)!.replace('.json', ''),
    );
    expect([...NOMS_TABLES].sort()).toEqual(fichiers.sort());
  });
});
