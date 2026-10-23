import { describe, expect, it } from 'vitest';
import { creerPartie } from '../../src/moteur/boucle';
import {
  rediger,
  remplir,
  resumerPetiteEnfance,
  valeursRecit,
  variablesDe,
} from '../../src/moteur/recit';
import { DONNEES, evenement } from './donnees';

const valeurs = {
  prenom: 'CAMILLE',
  age: '38',
  annee: '2023',
  region: 'HAUTS-DE-FRANCE',
  territoire: 'CAMPAGNE',
  e: 'E',
};

describe('recit', () => {
  it('remplit les variables', () => {
    expect(remplir('{prenom}, {age} ANS, TU ES NE{e} EN {region}.', valeurs)).toBe(
      'CAMILLE, 38 ANS, TU ES NEE EN HAUTS-DE-FRANCE.',
    );
  });

  it('refuse une variable inconnue', () => {
    expect(() => remplir('{inconnue}', valeurs)).toThrow('Variable de texte inconnue');
  });

  it('ecrit la periode d un resume, sans « 0 A 0 ANS » pour une seule annee', () => {
    const etat = creerPartie('resume', DONNEES);
    const { libelles } = DONNEES;
    expect(resumerPetiteEnfance(etat, 0, 0, libelles)).toMatch(/^0 AN : ENFANCE /);
    expect(resumerPetiteEnfance(etat, 3, 3, libelles)).toMatch(/^3 ANS : ENFANCE /);
    expect(resumerPetiteEnfance(etat, 0, 5, libelles)).toMatch(/^0 A 5 ANS : ENFANCE /);
    expect(resumerPetiteEnfance(etat, 0, 1, libelles)).toMatch(/^0 A 1 AN : ENFANCE /);
  });

  it('liste les variables d un modele', () => {
    expect(variablesDe('{annee} : {prenom} A {age} ANS')).toEqual(['annee', 'prenom', 'age']);
  });

  it('prend le prenom au format Minitel et accorde au feminin', () => {
    const etat = creerPartie('recit', DONNEES);
    const v = valeursRecit(etat, DONNEES.libelles);
    expect(v.prenom()).toMatch(/^[A-Z' -]+$/);
    expect(v.e()).toBe(etat.personnage.origine.sexe === 'femme' ? 'E' : '');
    expect(v.region()).toBe(DONNEES.libelles.region![etat.personnage.origine.region]);
  });

  it('choisit la variante de facon deterministe, et les varie selon les graines', () => {
    const ev = evenement('texte', {
      textes: ['VARIANTE UN.', 'VARIANTE DEUX.', 'VARIANTE TROIS.'],
    });
    const etat = creerPartie('recit', DONNEES);
    expect(rediger(ev, etat, DONNEES.libelles)).toBe(rediger(ev, etat, DONNEES.libelles));
    const vues = new Set(
      Array.from({ length: 50 }, (_, i) =>
        rediger(ev, creerPartie(`recit-${i}`, DONNEES), DONNEES.libelles),
      ),
    );
    expect(vues.size).toBe(3);
  });
});
