import { describe, expect, it } from 'vitest';
import {
  autreNaissance,
  bilan,
  decisionsDe,
  esperanceGeneration,
  rejouer,
  vieDEnfant,
} from '../../src/moteur/bilan';
import {
  avancerPetiteEnfance,
  creerPartie,
  fermerAnnee,
  jouerAnneeAuto,
  ouvrirAnnee,
} from '../../src/moteur/boucle';
import { AGE_FIN_PETITE_ENFANCE } from '../../src/moteur/constantes';
import { decileDeRevenu } from '../../src/moteur/modules/argent';
import type { ChoixJoueur, EtatPartie } from '../../src/moteur/types';
import { DONNEES } from './donnees';
import { TABLES } from './tables';

/**
 * Joue comme l'interface : petite enfance sans arrêt, puis une année à la fois, en
 * prenant toujours le dernier choix proposé (pas celui du mode AUTO). Renvoie l'état
 * ouvert à l'âge demandé, ou l'état final.
 */
function jouerCommeLInterface(graine: string, ageOuvert?: number): EtatPartie {
  let etat = creerPartie(graine, DONNEES);
  while (etat.personnage.vivant) {
    const ouverture =
      etat.personnage.age < AGE_FIN_PETITE_ENFANCE
        ? avancerPetiteEnfance(etat, DONNEES)
        : ouvrirAnnee(etat, DONNEES);
    if (!ouverture.etat.personnage.vivant) return ouverture.etat;
    if (ageOuvert !== undefined && ouverture.etat.personnage.age >= ageOuvert) {
      return ouverture.etat;
    }
    const choix: ChoixJoueur[] = ouverture.evenements
      .filter((e) => e.choix.length > 0)
      .map((e) => ({ evenementId: e.id, choixId: e.choix.at(-1)!.id }));
    etat = fermerAnnee(ouverture.etat, choix, DONNEES).etat;
  }
  return etat;
}

function vivreAuto(graine: string): EtatPartie {
  let etat = creerPartie(graine, DONNEES);
  while (etat.personnage.vivant) etat = jouerAnneeAuto(etat, DONNEES).etat;
  return etat;
}

describe('rejouer', () => {
  it('reconstruit exactement une vie a partir de sa graine et de ses choix', () => {
    for (let i = 0; i < 20; i++) {
      const vie = jouerCommeLInterface(`rejeu-${i}`);
      expect(rejouer(vie.graine, vie.options, decisionsDe(vie), DONNEES)).toEqual(vie);
    }
  });

  it('s arrete sur l annee que le joueur avait ouverte', () => {
    for (let i = 0; i < 10; i++) {
      const enCours = jouerCommeLInterface(`pause-${i}`, 40);
      if (!enCours.personnage.vivant) continue;
      const age = enCours.personnage.age;
      expect(rejouer(enCours.graine, enCours.options, decisionsDe(enCours), DONNEES, age)).toEqual(
        enCours,
      );
    }
  });

  it('reconstruit aussi une vie jouee en AUTO (meme etat, journal resume en plus)', () => {
    const vie = vivreAuto('auto-rejeu');
    const refaite = rejouer(vie.graine, vie.options, decisionsDe(vie), DONNEES);
    expect(refaite.personnage).toEqual(vie.personnage);
    expect(refaite.parcours).toEqual(vie.parcours);
  });
});

describe('autre naissance', () => {
  it('garde la graine, le sexe, l annee et les traits, et change d origine sociale', () => {
    for (let i = 0; i < 30; i++) {
      const vie = vivreAuto(`autre-${i}`);
      const options = autreNaissance(vie);
      const autre = creerPartie(vie.graine, DONNEES, options);
      const { origine } = vie.personnage;
      expect(autre.personnage.traits).toEqual(vie.personnage.traits);
      expect(autre.personnage.origine.sexe).toBe(origine.sexe);
      expect(autre.personnage.origine.anneeNaissance).toBe(origine.anneeNaissance);
      expect(autre.personnage.origine.region).toBe(origine.region);
      const favorise = (p: string): boolean => p === 'cadre' || p === 'intermediaire';
      if (favorise(origine.pcsParents) || origine.decileRevenuFoyer >= 7) {
        expect(autre.personnage.origine.pcsParents).toBe('ouvrier');
      } else {
        expect(autre.personnage.origine.pcsParents).toBe('cadre');
      }
    }
  });

  it('rejoue les memes choix quand les memes evenements reviennent', () => {
    const vie = jouerCommeLInterface('memes-choix');
    const autre = rejouer(vie.graine, autreNaissance(vie), decisionsDe(vie), DONNEES);
    expect(autre.personnage.vivant).toBe(false);
    const parAge = new Map(decisionsDe(vie).map((d) => [`${d.age}.${d.evenementId}`, d.choixId]));
    for (const d of decisionsDe(autre)) {
      const meme = parAge.get(`${d.age}.${d.evenementId}`);
      if (meme) expect(d.choixId).toBe(meme);
    }
  });
});

describe('bilan', () => {
  it('resume une vie terminee', () => {
    for (let i = 0; i < 30; i++) {
      const vie = vivreAuto(`bilan-${i}`);
      const b = bilan(vie, DONNEES);
      expect(b.age).toBe(vie.personnage.age);
      expect(b.anneeDeces - b.anneeNaissance).toBe(b.age);
      // La mort survient à l'ouverture d'une année : seules les années closes comptent.
      expect(b.moralParDecennie).toHaveLength(b.age === 0 ? 0 : Math.floor((b.age - 1) / 10) + 1);
      for (const moral of b.moralParDecennie) {
        expect(moral).toBeGreaterThanOrEqual(0);
        expect(moral).toBeLessThanOrEqual(100);
      }
      expect(b.decileFinal).toBeGreaterThanOrEqual(1);
      expect(b.decileFinal).toBeLessThanOrEqual(10);
      expect(b.ageDecileFinal).toBe(b.age > 60 ? 60 : b.age);
      expect(b.patrimoineTransmis).toBeGreaterThanOrEqual(0);
      expect(b.jeu.mise).toBe(vie.personnage.etats.jeu.totalMise);
      expect(b.enfants).toBe(vie.personnage.etats.famille.enfants.length);
      if (b.cause !== 'mortalite') expect(b.causeTexte).not.toBeNull();
    }
  });

  it('compte les annees de chomage du parcours', () => {
    let chomage = 0;
    let etat = creerPartie('chomage', DONNEES);
    while (etat.personnage.vivant) {
      const ouverture = ouvrirAnnee(etat, DONNEES);
      if (!ouverture.etat.personnage.vivant) break;
      if (ouverture.etat.personnage.etats.emploi === 'chomage') chomage++;
      etat = jouerAnneeAuto(etat, DONNEES).etat;
    }
    // Le parcours compte l'état d'emploi en fin d'année : même ordre de grandeur.
    expect(Math.abs(bilan(etat, DONNEES).anneesChomage - chomage)).toBeLessThanOrEqual(chomage);
  });

  it('calcule une esperance de vie de generation plausible, plus longue pour les femmes', () => {
    const femmes = esperanceGeneration(1980, 'femme', TABLES);
    const hommes = esperanceGeneration(1980, 'homme', TABLES);
    expect(femmes).toBeGreaterThan(hommes);
    expect(hommes).toBeGreaterThan(60);
    expect(femmes).toBeLessThan(100);
  });

  it('range les revenus en deciles croissants', () => {
    let precedent = 1;
    for (let revenu = 0; revenu <= 80_000; revenu += 2000) {
      const d = decileDeRevenu(revenu, 2010, TABLES);
      expect(d).toBeGreaterThanOrEqual(precedent);
      precedent = d;
    }
    expect(decileDeRevenu(0, 2010, TABLES)).toBe(1);
    expect(precedent).toBe(10);
  });
});

describe('enfants', () => {
  it('fait vivre chaque enfant avec l origine transmise par le joueur', () => {
    let vus = 0;
    for (let i = 0; vus < 5 && i < 200; i++) {
      const vie = vivreAuto(`parent-${i}`);
      const { enfants } = vie.personnage.etats.famille;
      if (enfants.length === 0) continue;
      vus++;
      const enfant = vieDEnfant(vie, 0, DONNEES);
      const { origine } = enfant.personnage;
      expect(origine.anneeNaissance).toBe(vie.personnage.origine.anneeNaissance + enfants[0]!.age);
      expect(origine.pcsParents).toBe(enfants[0]!.origine.pcsParents);
      expect(origine.decileRevenuFoyer).toBe(enfants[0]!.origine.decileRevenuFoyer);
      expect(enfant.personnage.vivant).toBe(false);
      expect(vieDEnfant(vie, 0, DONNEES)).toEqual(enfant);
    }
    expect(vus).toBe(5);
  });
});
