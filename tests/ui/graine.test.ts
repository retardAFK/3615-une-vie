import { describe, expect, it } from 'vitest';
import { lireAnnee, normaliserGraine, nouvelleGraine } from '../../src/ui/graine';

describe('nouvelleGraine', () => {
  it('produit 8 caracteres hexadecimaux majuscules', () => {
    for (let i = 0; i < 100; i++) expect(nouvelleGraine()).toMatch(/^[0-9A-F]{8}$/);
  });

  it('convertit les octets de la source', () => {
    const source = (octets: Uint8Array<ArrayBuffer>): Uint8Array =>
      octets.map((_, i) => [0x7f, 0x3a, 0x21, 0xc9][i]!);
    expect(nouvelleGraine(source)).toBe('7F3A21C9');
  });
});

describe('normaliserGraine', () => {
  it('accepte 4 a 16 caracteres A-Z et 0-9, en majuscules', () => {
    expect(normaliserGraine(' 7f3a21c9 ')).toBe('7F3A21C9');
    expect(normaliserGraine('ABCD')).toBe('ABCD');
    expect(normaliserGraine('A'.repeat(16))).toBe('A'.repeat(16));
  });

  it('refuse les graines trop courtes, trop longues ou avec d autres caracteres', () => {
    expect(normaliserGraine('ABC')).toBeNull();
    expect(normaliserGraine('A'.repeat(17))).toBeNull();
    expect(normaliserGraine('7F3A-21C9')).toBeNull();
    expect(normaliserGraine('ÉTÉ1')).toBeNull();
    expect(normaliserGraine('')).toBeNull();
  });
});

describe('lireAnnee', () => {
  it('lit une annee dans les bornes, vide = hasard', () => {
    expect(lireAnnee('', 1950, 2010)).toBe('hasard');
    expect(lireAnnee(' 1985 ', 1950, 2010)).toBe(1985);
    expect(lireAnnee('1950', 1950, 2010)).toBe(1950);
  });

  it('refuse une annee hors bornes ou mal ecrite', () => {
    expect(lireAnnee('1949', 1950, 2010)).toBeNull();
    expect(lireAnnee('2011', 1950, 2010)).toBeNull();
    expect(lireAnnee('85', 1950, 2010)).toBeNull();
    expect(lireAnnee('19A5', 1950, 2010)).toBeNull();
  });
});
