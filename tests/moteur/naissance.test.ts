import { describe, expect, it } from 'vitest';
import {
  ETAPES_NAISSANCE,
  frequencePrenom,
  naitre,
  tirerOrigineBrute,
  type OrigineBrute,
} from '../../src/moteur/naissance';
import { chercherLigne, periodeDe } from '../../src/moteur/tables';
import { NOMS_TRAITS, type TableDistribution } from '../../src/moteur/types';
import { TABLES } from './tables';

const N = 10_000;

describe('chercherLigne', () => {
  const table: TableDistribution = {
    table: 'essai',
    source: 'test',
    url: null,
    aCalibrer: true,
    lignes: [
      { conditions: { periode: '1990-1999', territoire: 'rural' }, distribution: { a: 1 } },
      { conditions: { periode: '1990-1999' }, distribution: { b: 1 } },
      { conditions: {}, distribution: { c: 1 } },
    ],
  };
  const repli = ['territoire', 'periode'];

  it('prend la combinaison exacte quand elle existe', () => {
    expect(
      chercherLigne(table, { periode: '1990-1999', territoire: 'rural' }, repli).distribution,
    ).toEqual({ a: 1 });
  });

  it('retombe sans territoire, puis sans periode', () => {
    expect(
      chercherLigne(table, { periode: '1990-1999', territoire: 'drom' }, repli).distribution,
    ).toEqual({ b: 1 });
    expect(
      chercherLigne(table, { periode: '1950-1959', territoire: 'drom' }, repli).distribution,
    ).toEqual({ c: 1 });
  });

  it('signale une table sans ligne de repli', () => {
    const incomplete = { ...table, lignes: table.lignes.slice(0, 1) };
    expect(() => chercherLigne(incomplete, { periode: '2000-2009' }, ['periode'])).toThrow();
  });

  it('decoupe les annees en periodes decennales', () => {
    expect(periodeDe(1987)).toBe('1980-1989');
    expect(periodeDe(2010)).toBe('2010-2019');
  });
});

describe('naissance', () => {
  const graines = Array.from({ length: N }, (_, i) => `naissance-${i}`);
  const brutes = graines.map((g) => tirerOrigineBrute(g, TABLES));

  it('redonne la meme naissance pour la meme graine', () => {
    expect(naitre('7F3A21C9', TABLES)).toEqual(naitre('7F3A21C9', TABLES));
  });

  it('produit des origines valides et coherentes', () => {
    for (const graine of graines.slice(0, 2000)) {
      const { origine } = naitre(graine, TABLES);
      expect(origine.anneeNaissance).toBeGreaterThanOrEqual(1950);
      expect(origine.anneeNaissance).toBeLessThanOrEqual(2010);
      const regionDrom = ['guadeloupe', 'martinique', 'guyane', 'la_reunion', 'mayotte'].includes(
        origine.region,
      );
      expect(origine.territoire === 'drom').toBe(regionDrom);
    }
  });

  it('tire le territoire selon la region et la decennie de naissance', () => {
    const etape = ETAPES_NAISSANCE.find((e) => e.champ === 'territoire')!;
    const brute = { anneeNaissance: '1955', region: 'bretagne' } as OrigineBrute;
    expect(etape.conditions(brute)).toEqual({ region: 'bretagne', periode: '1950-1959' });
    expect(etape.ordreRepli).toEqual(['periode', 'region']);
  });

  // Pour chaque étape, la fréquence observée de chaque valeur doit être proche
  // de la probabilité attendue, moyennée sur les conditions de chaque naissance.
  it.each(ETAPES_NAISSANCE.map((e) => [e.champ, e] as const))(
    'respecte la table %s sur 10 000 naissances',
    (_, etape) => {
      const attendu = new Map<string, number>();
      const observe = new Map<string, number>();
      for (const brute of brutes) {
        const { distribution } = chercherLigne(
          TABLES[etape.table],
          etape.conditions(brute as OrigineBrute),
          etape.ordreRepli,
        );
        const total = Object.values(distribution).reduce((a, b) => a + b, 0);
        for (const [valeur, poids] of Object.entries(distribution)) {
          attendu.set(valeur, (attendu.get(valeur) ?? 0) + poids / total / N);
        }
        const tire = brute[etape.champ];
        observe.set(tire, (observe.get(tire) ?? 0) + 1 / N);
      }
      for (const [valeur, p] of attendu) {
        expect(Math.abs((observe.get(valeur) ?? 0) - p), `${etape.champ} = ${valeur}`).toBeLessThan(
          0.02,
        );
      }
      for (const valeur of observe.keys()) expect(attendu.has(valeur)).toBe(true);
    },
  );

  it('tire des traits entiers dans [5, 95], centres sur 50', () => {
    const naissances = graines.slice(0, 5000).map((g) => naitre(g, TABLES));
    for (const nom of NOMS_TRAITS) {
      const valeurs = naissances.map((n) => n.traits[nom]);
      const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
      const ecartType = Math.sqrt(
        valeurs.reduce((a, v) => a + (v - moyenne) ** 2, 0) / valeurs.length,
      );
      expect(valeurs.every((v) => Number.isInteger(v) && v >= 5 && v <= 95)).toBe(true);
      expect(Math.abs(moyenne - 50)).toBeLessThan(1);
      expect(ecartType).toBeGreaterThan(13.5);
      expect(ecartType).toBeLessThan(15.5);
    }
  });

  it('tire un prenom de la liste du sexe et de la periode', () => {
    for (const graine of graines.slice(0, 500)) {
      const { origine, prenom } = naitre(graine, TABLES);
      const ligne = chercherLigne(
        TABLES.prenoms,
        { sexe: origine.sexe, periode: periodeDe(origine.anneeNaissance) },
        ['periode', 'sexe'],
      );
      expect(Object.keys(ligne.distribution)).toContain(prenom);
    }
  });

  it('donne la frequence du prenom tire, pour 1 000 naissances de la decennie', () => {
    for (let i = 0; i < 50; i++) {
      const { origine, prenom } = naitre(`frequence-${i}`, TABLES);
      const frequence = frequencePrenom(prenom, origine, TABLES);
      expect(frequence).not.toBeNull();
      expect(frequence!).toBeGreaterThan(0);
      expect(frequence!).toBeLessThan(1000);
    }
    const { origine } = naitre('frequence', TABLES);
    expect(frequencePrenom('Inexistant', origine, TABLES)).toBeNull();
  });
});
