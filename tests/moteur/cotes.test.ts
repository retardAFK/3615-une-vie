import { describe, expect, it } from 'vitest';
import { P_MAX, P_MIN, multiplicateurTrait, probabiliteFinale } from '../../src/moteur/cotes';

describe('cotes', () => {
  it('donne environ 17,4 % pour 5 % avec deux facteurs x 2', () => {
    expect(probabiliteFinale(0.05, [2, 2])).toBeCloseTo(0.1739, 4);
  });

  it('laisse la probabilite inchangee sans multiplicateur', () => {
    expect(probabiliteFinale(0.3)).toBeCloseTo(0.3, 10);
  });

  it('ne renvoie jamais 0 ni 1', () => {
    for (const p of [
      probabiliteFinale(0),
      probabiliteFinale(1),
      probabiliteFinale(0.5, [1e300, 1e300]),
      probabiliteFinale(0.5, [1e-300, 1e-300]),
    ]) {
      expect(p).toBeGreaterThanOrEqual(P_MIN);
      expect(p).toBeLessThanOrEqual(P_MAX);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });

  it('refuse les entrees invalides', () => {
    expect(() => probabiliteFinale(1.2)).toThrow(RangeError);
    expect(() => probabiliteFinale(Number.NaN)).toThrow(RangeError);
    expect(() => probabiliteFinale(0.1, [0])).toThrow(RangeError);
    expect(() => probabiliteFinale(0.1, [-2])).toThrow(RangeError);
  });

  it("applique l'effet des traits autour de 50", () => {
    expect(multiplicateurTrait(50, 0.7)).toBe(1);
    expect(multiplicateurTrait(95, 0.7)).toBeCloseTo(1.88, 2);
    expect(multiplicateurTrait(5, 0.7)).toBeCloseTo(1 / 1.88, 2);
  });
});
