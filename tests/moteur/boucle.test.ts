import { describe, expect, it } from 'vitest';
import { creerPartie, jouerAnnee, probabiliteDeces } from '../../src/moteur/boucle';
import { AGE_MAXIMAL } from '../../src/moteur/constantes';
import type { EtatPartie, Tables } from '../../src/moteur/types';
import { TABLES } from './tables';

function vivre(graine: string, tables: Tables = TABLES): EtatPartie {
  let etat = creerPartie(graine, tables);
  while (etat.personnage.vivant) etat = jouerAnnee(etat, null, tables).etat;
  return etat;
}

describe('boucle', () => {
  it('cree une partie a la naissance', () => {
    const etat = creerPartie('7F3A21C9', TABLES);
    expect(etat.personnage.age).toBe(0);
    expect(etat.personnage.vivant).toBe(true);
    expect(etat.annee).toBe(etat.personnage.origine.anneeNaissance);
    expect(etat.historique).toEqual([{ annee: etat.annee, age: 0, type: 'naissance' }]);
  });

  it("fait vieillir d'un an par tour sans muter l'etat recu", () => {
    const etat = creerPartie('7F3A21C9', TABLES);
    const copie = structuredClone(etat);
    const { etat: suivant } = jouerAnnee(etat, null, TABLES);
    expect(etat).toEqual(copie);
    expect(suivant.personnage.age).toBe(1);
    expect(suivant.annee).toBe(etat.annee + 1);
  });

  it('redonne exactement la meme vie pour la meme graine', () => {
    for (const graine of ['7F3A21C9', 'A', 'vie-42']) {
      expect(vivre(graine)).toEqual(vivre(graine));
    }
  });

  it('donne des vies differentes pour des graines differentes', () => {
    const vies = new Set(Array.from({ length: 100 }, (_, i) => JSON.stringify(vivre(`diff-${i}`))));
    expect(vies.size).toBe(100);
  });

  it("termine toute vie, au plus tard a l'age maximal", () => {
    // Mortalité nulle : seul le plafond met fin à la vie.
    const immortels: Tables = {
      ...TABLES,
      mortalite: {
        ...TABLES.mortalite,
        lignes: [{ conditions: {}, qParAge: Array.from({ length: 111 }, () => 0) }],
      },
    };
    const etat = vivre('immortel', immortels);
    expect(etat.personnage.vivant).toBe(false);
    expect(etat.personnage.age).toBe(AGE_MAXIMAL);
    expect(etat.historique.at(-1)).toEqual({ annee: etat.annee, age: AGE_MAXIMAL, type: 'deces' });
    expect(() => jouerAnnee(etat, null, immortels)).toThrow();
  });

  it("teste la mortalite a l'age vecu : la valeur a 0 an sert", () => {
    // Décès certain la première année, aucun ensuite.
    const qParAge = Array.from({ length: 111 }, (_, age) => (age === 0 ? 1 : 0));
    const fragiles: Tables = {
      ...TABLES,
      mortalite: { ...TABLES.mortalite, lignes: [{ conditions: {}, qParAge }] },
    };
    const naissance = creerPartie('nourrisson', fragiles);
    const { etat, journal } = jouerAnnee(naissance, null, fragiles);
    expect(etat.personnage.vivant).toBe(false);
    expect(etat.personnage.age).toBe(0);
    expect(etat.annee).toBe(naissance.annee);
    expect(journal).toEqual([{ annee: naissance.annee, age: 0, type: 'deces' }]);
  });

  it('borne la probabilite de deces par la formule des cotes', () => {
    const q = probabiliteDeces(40, 'homme', 1990, TABLES);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(1);
  });

  it('joue 10 000 vies completes en moins de 5 secondes', () => {
    const debut = performance.now();
    const deces = { femme: [] as number[], homme: [] as number[] };
    for (let i = 0; i < 10_000; i++) {
      const { personnage } = vivre(`perf-${i}`);
      expect(personnage.vivant).toBe(false);
      expect(personnage.age).toBeLessThanOrEqual(AGE_MAXIMAL);
      deces[personnage.origine.sexe].push(personnage.age);
    }
    const duree = performance.now() - debut;
    const moyenne = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
    console.log(
      `10 000 vies en ${Math.round(duree)} ms ; age moyen de deces : ` +
        `femmes ${moyenne(deces.femme).toFixed(1)} ans (${deces.femme.length}), ` +
        `hommes ${moyenne(deces.homme).toFixed(1)} ans (${deces.homme.length})`,
    );
    expect(duree).toBeLessThan(5000);
    // Ordres de grandeur seulement : la table est une table de travail.
    expect(moyenne(deces.femme)).toBeGreaterThan(80);
    expect(moyenne(deces.femme)).toBeLessThan(90);
    expect(moyenne(deces.homme)).toBeGreaterThan(74);
    expect(moyenne(deces.homme)).toBeLessThan(84);
  }, 30_000);
});
