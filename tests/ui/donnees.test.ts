import { describe, expect, it } from 'vitest';
import { chargerTables, evenementsDuContenu, type Recuperer } from '../../src/ui/donnees';

describe('chargerTables', () => {
  it('charge chaque table sous le chemin de base', async () => {
    const demandes: string[] = [];
    const recuperer: Recuperer = async (url) => {
      demandes.push(url);
      return { ok: true, status: 200, json: async () => ({ table: url }) };
    };
    const tables = await chargerTables('/3615-une-vie/', recuperer);
    expect(demandes).toHaveLength(14);
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
