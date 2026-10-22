import { describe, expect, it } from 'vitest';
import {
  creerGenerateur,
  entier,
  normaleBornee,
  sousGenerateur,
  tirerPondere,
} from '../../src/moteur/rng';

const suite = (g: () => number, n = 5): number[] => Array.from({ length: n }, () => g());

describe('rng', () => {
  it('redonne la meme suite pour la meme graine', () => {
    expect(suite(creerGenerateur('7F3A21C9'))).toEqual(suite(creerGenerateur('7F3A21C9')));
  });

  it('donne des suites differentes pour des graines differentes', () => {
    expect(suite(creerGenerateur('A'))).not.toEqual(suite(creerGenerateur('B')));
  });

  it('produit des flottants dans [0, 1[', () => {
    const g = creerGenerateur('bornes');
    for (let i = 0; i < 10_000; i++) {
      const x = g();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('distingue les sous-generateurs par age et par identifiant', () => {
    const base = suite(sousGenerateur('graine', 30, 'mortalite'));
    expect(suite(sousGenerateur('graine', 31, 'mortalite'))).not.toEqual(base);
    expect(suite(sousGenerateur('graine', 30, 'accident'))).not.toEqual(base);
  });

  it('un tirage ajoute ou retire a un age ne change pas les tirages des autres ages', () => {
    const vie = (tiragesEnPlus: Record<number, string[]>): Map<string, number> => {
      const tirages = new Map<string, number>();
      for (let age = 0; age <= 80; age++) {
        for (const id of ['mortalite', ...(tiragesEnPlus[age] ?? [])]) {
          tirages.set(`${age}|${id}`, sousGenerateur('graine', age, id)());
        }
      }
      return tirages;
    };
    const reference = vie({});
    const modifiee = vie({ 30: ['loto', 'accident'], 31: ['cigarette'] });
    for (const [cle, valeur] of reference) expect(modifiee.get(cle)).toBe(valeur);
  });

  it('tire des entiers dans les bornes, bornes comprises', () => {
    const g = creerGenerateur('entiers');
    const vus = new Set<number>();
    for (let i = 0; i < 1000; i++) vus.add(entier(g, 1, 6));
    expect([...vus].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => entier(g, 3, 1)).toThrow(RangeError);
  });

  it('respecte les poids du tirage pondere et ignore les poids nuls', () => {
    const g = creerGenerateur('pondere');
    const comptes = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10_000; i++) comptes[tirerPondere(g, { a: 1, b: 3, c: 0 })]++;
    expect(comptes.c).toBe(0);
    expect(comptes.b / 10_000).toBeCloseTo(0.75, 1);
    expect(() => tirerPondere(g, { a: 0 })).toThrow(RangeError);
  });

  it('borne la loi normale et se termine toujours', () => {
    const g = creerGenerateur('normale');
    const valeurs = Array.from({ length: 10_000 }, () => normaleBornee(g, 50, 15, 5, 95));
    const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
    expect(Math.min(...valeurs)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...valeurs)).toBeLessThanOrEqual(95);
    expect(moyenne).toBeCloseTo(50, 0);
    // Bornes impossibles à atteindre : repli déterministe sur la moyenne bornée.
    expect(normaleBornee(g, 50, 1, 90, 95)).toBe(90);
  });
});
