import { describe, expect, it } from 'vitest';
import {
  avancerPetiteEnfance,
  creerPartie,
  fermerAnnee,
  jouerAnneeAuto,
} from '../../src/moteur/boucle';
import { AGE_FIN_PETITE_ENFANCE } from '../../src/moteur/constantes';
import { DONNEES, TABLES_IMMORTELS, donneesAvec, evenement } from './donnees';
import { TABLES } from './tables';

describe('petite enfance acceleree', () => {
  it("defile jusqu'a 6 ans sans evenement et resume les annees en une ligne", () => {
    const donnees = donneesAvec([], TABLES_IMMORTELS);
    const naissance = creerPartie('calme', donnees);
    const { etat, evenements } = avancerPetiteEnfance(naissance, donnees);
    expect(evenements).toEqual([]);
    expect(etat.personnage.age).toBe(AGE_FIN_PETITE_ENFANCE);
    expect(etat.anneeEnCours).not.toBeNull();
    const resume = etat.historique.find((e) => e.type === 'resume');
    expect(resume).toMatchObject({ age: 5, annee: naissance.annee + 5 });
    expect(resume!.texte).toMatch(/^0 A 5 ANS : ENFANCE [A-Z' -]+\.$/);
  });

  it("s'arrete sur le premier evenement et resume les annees d'avant", () => {
    const donnees = donneesAvec([evenement('trois_ans', { age: [3, 3] })], TABLES_IMMORTELS);
    const { etat, evenements } = avancerPetiteEnfance(creerPartie('trois', donnees), donnees);
    expect(evenements.map((e) => e.id)).toEqual(['trois_ans']);
    expect(etat.personnage.age).toBe(3);
    expect(etat.historique.at(-1)!.texte).toMatch(/^0 A 2 ANS : ENFANCE /);
    // Puis la vie reprend normalement.
    const suite = fermerAnnee(etat, [], donnees).etat;
    expect(suite.personnage.age).toBe(4);
  });

  it("n'ecrit pas de resume quand un evenement arrive des la premiere annee", () => {
    const donnees = donneesAvec([evenement('zero', { age: [0, 0] })], TABLES_IMMORTELS);
    const { etat } = avancerPetiteEnfance(creerPartie('zero', donnees), donnees);
    expect(etat.historique.some((e) => e.type === 'resume')).toBe(false);
  });

  it('place le resume avant un deces survenu pendant le defilement', () => {
    const qParAge = Array.from({ length: 111 }, (_, age) => (age === 2 ? 1 : 0));
    const fragiles = donneesAvec([], {
      ...TABLES,
      mortalite: { ...TABLES.mortalite, lignes: [{ conditions: {}, qParAge }] },
    });
    const { etat } = avancerPetiteEnfance(creerPartie('fragile', fragiles), fragiles);
    expect(etat.personnage.vivant).toBe(false);
    expect(etat.historique.slice(-2).map((e) => e.type)).toEqual(['resume', 'deces']);
  });
});

describe('variete des evenements', () => {
  it('aucun evenement ne commence plus de 25 % des vies (1 000 vies)', () => {
    const premiers = new Map<string, number>();
    let evenements = 0;
    for (let i = 0; i < 1000; i++) {
      let etat = creerPartie(`variete-${i}`, DONNEES);
      while (etat.personnage.vivant) etat = jouerAnneeAuto(etat, DONNEES).etat;
      const vecus = etat.historique.filter((e) => e.type === 'evenement');
      evenements += vecus.length;
      const premier = vecus[0]?.evenementId ?? '(aucun)';
      premiers.set(premier, (premiers.get(premier) ?? 0) + 1);
    }
    const tri = [...premiers].sort((a, b) => b[1] - a[1]);
    console.log(
      `Premiers evenements sur 1 000 vies : ${tri
        .slice(0, 10)
        .map(([id, n]) => `${id} ${(n / 10).toFixed(1)} %`)
        .join(', ')}\nEvenements par vie : ${(evenements / 1000).toFixed(1)} en moyenne`,
    );
    expect(tri[0]![1]).toBeLessThanOrEqual(250);
  }, 60_000);
});
