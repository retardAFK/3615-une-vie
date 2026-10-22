import { describe, expect, it } from 'vitest';
import { validerEvenements } from '../../src/moteur/validation';
import { evenement } from './donnees';

const fichier = (evenements: unknown[]): { nom: string; contenu: unknown } => ({
  nom: 'essai.json',
  contenu: { module: 'essai', source: 'test', aCalibrer: true, evenements },
});
const erreurs = (evenements: unknown[]): string[] =>
  validerEvenements([fichier(evenements)]).erreurs;

describe('validerEvenements', () => {
  it('accepte un evenement complet', () => {
    expect(erreurs([evenement('correct')])).toEqual([]);
  });

  it('signale les champs obligatoires manquants', () => {
    const sansTextes: Partial<ReturnType<typeof evenement>> = { ...evenement('incomplet') };
    delete sansTextes.textes;
    expect(erreurs([sansTextes]).join()).toContain('variantes de texte');
    expect(validerEvenements([{ nom: 'vide.json', contenu: {} }]).erreurs.join()).toContain(
      'module absent',
    );
  });

  it('signale les ids en double, entre fichiers aussi', () => {
    const r = validerEvenements([fichier([evenement('meme')]), fichier([evenement('meme')])]);
    expect(r.erreurs.join()).toContain('id en double');
  });

  it('signale des ages incoherents et une gravite hors bornes', () => {
    expect(erreurs([evenement('ages', { age: [30, 20] })]).join()).toContain('age doit etre');
    expect(erreurs([evenement('ages', { age: [0, 140] })]).join()).toContain('age doit etre');
    expect(erreurs([{ ...evenement('grave'), gravite: 4 }]).join()).toContain('gravite');
  });

  it('signale des cibles de modificateurs inexistantes', () => {
    const avecCible = (cible: unknown): unknown =>
      evenement('choix', {
        choix: [
          { id: 'a', libelle: 'A', modificateurs: [{ cible, m: 2 }] } as never,
          { id: 'b', libelle: 'B' },
        ],
      });
    expect(erreurs([avecCible({ evenement: 'fantome' })]).join()).toContain(
      'evenement cible inconnu',
    );
    expect(erreurs([avecCible({ tag: 'fantome' })]).join()).toContain('tag cible inconnu');
    expect(erreurs([avecCible({ evenement: 'choix' })])).toEqual([]);
  });

  it('signale les variables inconnues et les textes hors format Minitel', () => {
    expect(erreurs([evenement('var', { textes: ['{nom} EST LA.', 'OK.'] })]).join()).toContain(
      'variable inconnue {nom}',
    );
    expect(erreurs([evenement('acc', { textes: ['Tu es né.', 'OK.'] })]).join()).toContain(
      'format Minitel',
    );
  });

  it('interdit unique avec cooldown, un choix sur un evenement mortel, un cout positif', () => {
    expect(erreurs([evenement('u', { unique: true, cooldown: 3 })]).join()).toContain(
      'incompatibles',
    );
    const deuxChoix = [
      { id: 'a', libelle: 'A' },
      { id: 'b', libelle: 'B' },
    ];
    expect(
      erreurs([evenement('m', { effets: { deces: 0.1 }, choix: deuxChoix })]).join(),
    ).toContain('mortel');
    expect(
      erreurs([
        evenement('c', {
          choix: [{ id: 'a', libelle: 'A', cout: { jauges: { liens: 5 } } }, deuxChoix[1]!],
        }),
      ]).join(),
    ).toContain('un cout ne peut pas augmenter');
  });
});
