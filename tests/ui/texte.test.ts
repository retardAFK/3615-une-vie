import { describe, expect, it } from 'vitest';
import { FRANCS_PAR_EURO, decile, minitel, montant } from '../../src/ui/texte';

describe('minitel', () => {
  it('met en majuscules et retire les accents', () => {
    expect(minitel('Hélène est née à Besançon')).toBe('HELENE EST NEE A BESANCON');
    expect(minitel('Raphaël, Inès, Anaïs, Océane')).toBe('RAPHAEL, INES, ANAIS, OCEANE');
  });

  it('decompose les ligatures et redresse les apostrophes', () => {
    expect(minitel('cœur, Œuvre, ex æquo')).toBe('COEUR, OEUVRE, EX AEQUO');
    expect(minitel('l’école')).toBe("L'ECOLE");
  });

  it('laisse intact un texte deja au format', () => {
    expect(minitel('3615 UNE VIE · ENVOI → SUITE')).toBe('3615 UNE VIE · ENVOI → SUITE');
  });
});

describe('montant', () => {
  it('utilise le taux fixe de 6,55957', () => {
    expect(FRANCS_PAR_EURO).toBe(6.55957);
  });

  it('affiche en francs avant 2002', () => {
    expect(montant(1000, 2001)).toBe('6 560 F');
    expect(montant(12_400, 1985)).toBe('81 339 F');
  });

  it('affiche en euros a partir de 2002', () => {
    expect(montant(1000, 2002)).toBe('1 000 EUR');
    expect(montant(1_234_567, 2030)).toBe('1 234 567 EUR');
  });

  it('gere zero et les montants negatifs', () => {
    expect(montant(0, 1990)).toBe('0 F');
    expect(montant(-6500, 2023)).toBe('- 6 500 EUR');
  });
});

describe('decile', () => {
  it('ecrit le rang a la francaise', () => {
    expect(decile(1)).toBe('1ER DECILE');
    expect(decile(2)).toBe('2E DECILE');
    expect(decile(10)).toBe('10E DECILE');
  });
});
