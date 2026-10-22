import { describe, expect, it } from 'vitest';
import {
  creerPartie,
  deriverJauges,
  fermerAnnee,
  jouerAnneeAuto,
  ouvrirAnnee,
  probabiliteDeces,
} from '../../src/moteur/boucle';
import { AGE_MAXIMAL, JAUGES_INITIALES } from '../../src/moteur/constantes';
import type { Donnees, EtatPartie, OptionsPartie } from '../../src/moteur/types';
import { DONNEES, TABLES_IMMORTELS, donneesAvec } from './donnees';
import { TABLES } from './tables';

function vivreAuto(
  graine: string,
  donnees: Donnees = DONNEES,
  options: OptionsPartie = {},
): EtatPartie {
  let etat = creerPartie(graine, donnees, options);
  while (etat.personnage.vivant) etat = jouerAnneeAuto(etat, donnees).etat;
  return etat;
}

/** Vie jouée « à la main » : toujours la première option proposée. */
function vivrePremierChoix(graine: string): EtatPartie {
  let etat = creerPartie(graine, DONNEES);
  while (etat.personnage.vivant) {
    const ouverture = ouvrirAnnee(etat, DONNEES);
    if (!ouverture.etat.personnage.vivant) return ouverture.etat;
    const choix = ouverture.choixProposes.map((c) => ({
      evenementId: c.evenementId,
      choixId: c.options[0]!.id,
    }));
    etat = fermerAnnee(ouverture.etat, choix, DONNEES).etat;
  }
  return etat;
}

describe('boucle', () => {
  it('cree une partie a la naissance', () => {
    const etat = creerPartie('7F3A21C9', DONNEES);
    expect(etat.personnage.age).toBe(0);
    expect(etat.personnage.vivant).toBe(true);
    expect(etat.annee).toBe(etat.personnage.origine.anneeNaissance);
    expect(etat.historique).toEqual([{ annee: etat.annee, age: 0, type: 'naissance' }]);
    expect(etat.anneeEnCours).toBeNull();
  });

  it("ouvre puis ferme une annee sans muter l'etat recu", () => {
    const etat = creerPartie('7F3A21C9', DONNEES);
    const copie = structuredClone(etat);
    const ouverte = ouvrirAnnee(etat, DONNEES).etat;
    expect(ouverte.anneeEnCours).not.toBeNull();
    expect(() => ouvrirAnnee(ouverte, DONNEES)).toThrow('deja ouverte');
    const { etat: suivant } = fermerAnnee(ouverte, [], DONNEES);
    expect(etat).toEqual(copie);
    expect(suivant.personnage.age).toBe(1);
    expect(suivant.annee).toBe(etat.annee + 1);
    expect(suivant.anneeEnCours).toBeNull();
    expect(() => fermerAnnee(suivant, [], DONNEES)).toThrow('Aucune annee ouverte');
  });

  it('redonne exactement la meme vie pour la meme graine et les memes choix', () => {
    for (const graine of ['7F3A21C9', 'A', 'vie-42']) {
      expect(vivreAuto(graine)).toEqual(vivreAuto(graine));
      expect(vivrePremierChoix(graine)).toEqual(vivrePremierChoix(graine));
    }
  });

  it("redonne la meme vie quand on impose l'annee que le hasard aurait tiree", () => {
    for (const graine of ['7F3A21C9', 'annee-1', 'annee-2']) {
      const tiree = vivreAuto(graine);
      const imposee = vivreAuto(graine, DONNEES, {
        anneeNaissance: tiree.personnage.origine.anneeNaissance,
      });
      expect(imposee.personnage).toEqual(tiree.personnage);
      expect(imposee.historique).toEqual(tiree.historique);
      expect(imposee.options).toEqual({ anneeNaissance: tiree.personnage.origine.anneeNaissance });
    }
  });

  it("impose l'annee de naissance et refuse une annee hors bornes", () => {
    expect(creerPartie('annee', DONNEES, { anneeNaissance: 1962 }).annee).toBe(1962);
    for (const anneeNaissance of [1949, 2011, 1980.5, Number.NaN]) {
      expect(() => creerPartie('annee', DONNEES, { anneeNaissance })).toThrow(RangeError);
    }
  });

  it('donne des vies differentes pour des graines differentes', () => {
    const vies = new Set(
      Array.from({ length: 100 }, (_, i) => JSON.stringify(vivreAuto(`diff-${i}`))),
    );
    expect(vies.size).toBe(100);
  });

  it("termine toute vie, au plus tard a l'age maximal", () => {
    const etat = vivreAuto('immortel', donneesAvec([]));
    expect(etat.personnage.vivant).toBe(false);
    expect(etat.personnage.age).toBe(AGE_MAXIMAL);
    expect(etat.historique.at(-1)).toEqual({
      annee: etat.annee,
      age: AGE_MAXIMAL,
      type: 'deces',
      cause: 'mortalite',
    });
    expect(() => ouvrirAnnee(etat, donneesAvec([]))).toThrow();
  });

  it("teste la mortalite a l'age vecu : la valeur a 0 an sert", () => {
    // Décès certain la première année, aucun ensuite.
    const qParAge = Array.from({ length: 111 }, (_, age) => (age === 0 ? 1 : 0));
    const fragiles = donneesAvec([], {
      ...TABLES,
      mortalite: { ...TABLES.mortalite, lignes: [{ conditions: {}, qParAge }] },
    });
    const naissance = creerPartie('nourrisson', fragiles);
    const { etat, journal } = ouvrirAnnee(naissance, fragiles);
    expect(etat.personnage.vivant).toBe(false);
    expect(etat.personnage.age).toBe(0);
    expect(etat.annee).toBe(naissance.annee);
    expect(journal).toEqual([
      { annee: naissance.annee, age: 0, type: 'deces', cause: 'mortalite' },
    ]);
  });

  it('fait deriver les jauges avec l age, de facon deterministe et bornee', () => {
    const depart = {
      santePhysique: 70,
      santeMentale: 70,
      bienEtre: 70,
      liens: 70,
      competences: 70,
    };
    expect(deriverJauges(depart, 20).santePhysique).toBe(70);
    expect(deriverJauges(depart, 50).santePhysique).toBeLessThan(70);
    expect(deriverJauges(depart, 50)).toEqual(deriverJauges(depart, 50));
    const usees = { ...depart, santePhysique: 0.5, liens: 0.1 };
    const apres = deriverJauges(usees, 90);
    expect(apres.santePhysique).toBe(0);
    expect(apres.liens).toBe(0);
    const { santePhysique, santeMentale, liens, competences } = apres;
    expect(apres.bienEtre).toBeCloseTo((santePhysique + santeMentale + liens + competences) / 4);
  });

  it('garde les jauges dans [0, 100] au fil d une vie longue', () => {
    const immortels = { ...DONNEES, tables: TABLES_IMMORTELS };
    let etat = creerPartie('immortel', immortels);
    while (etat.personnage.vivant && etat.personnage.age < 80) {
      etat = jouerAnneeAuto(etat, immortels).etat;
      for (const valeur of Object.values(etat.personnage.jauges)) {
        expect(valeur).toBeGreaterThanOrEqual(0);
        expect(valeur).toBeLessThanOrEqual(100);
      }
    }
    if (etat.personnage.vivant) {
      expect(etat.personnage.jauges.santePhysique).toBeLessThan(JAUGES_INITIALES.santePhysique);
    }
  });

  it('borne la probabilite de deces par la formule des cotes', () => {
    const q = probabiliteDeces(40, 'homme', 1990, TABLES);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(1);
  });

  it('joue 10 000 vies completes en AUTO avec des ordres de grandeur plausibles', () => {
    const deces = { femme: [] as number[], homme: [] as number[] };
    let evenements = 0;
    for (let i = 0; i < 10_000; i++) {
      const etat = vivreAuto(`perf-${i}`);
      expect(etat.personnage.vivant).toBe(false);
      expect(etat.personnage.age).toBeLessThanOrEqual(AGE_MAXIMAL);
      deces[etat.personnage.origine.sexe].push(etat.personnage.age);
      evenements += etat.historique.filter((e) => e.type === 'evenement').length;
    }
    const moyenne = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
    console.log(
      `10 000 vies en AUTO : ${(evenements / 10_000).toFixed(1)} ` +
        `evenements par vie ; age moyen de deces : femmes ${moyenne(deces.femme).toFixed(1)} ans, ` +
        `hommes ${moyenne(deces.homme).toFixed(1)} ans`,
    );
    // Ordres de grandeur seulement : tables et événements de travail.
    expect(moyenne(deces.femme)).toBeGreaterThan(78);
    expect(moyenne(deces.femme)).toBeLessThan(90);
    expect(moyenne(deces.homme)).toBeGreaterThan(72);
    expect(moyenne(deces.homme)).toBeLessThan(84);
  }, 60_000);

  // Non-régression seulement : les objectifs réels (5 ms par vie, 1 000 vies en 1 s)
  // sont vérifiés par npm run perf, sur le moteur seul (docs/architecture.md, Budgets).
  it('ne regresse pas : 1 000 vies en AUTO', () => {
    for (let i = 0; i < 200; i++) vivreAuto(`chauffe-${i}`);
    const debut = performance.now();
    for (let i = 0; i < 1000; i++) vivreAuto(`regression-${i}`);
    const duree = performance.now() - debut;
    // Annotation GitHub : rend le temps mesuré sur la CI lisible sans les journaux.
    console.log(`::notice title=Performance::1 000 vies en AUTO en ${Math.round(duree)} ms`);
    // Limite provisoire, en attendant la mesure sur la CI.
    expect(duree).toBeLessThan(3000);
  }, 30_000);
});
