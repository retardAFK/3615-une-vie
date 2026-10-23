import { describe, expect, it } from 'vitest';
import { creerPartie, jouerAnneeAuto } from '../../src/moteur/boucle';
import type { EntreeJournal } from '../../src/moteur/types';
import { LIGNES_PAR_PAGE, lignesJournal, nombreDePages, page } from '../../src/ui/journal';
import { lienDePartage, lireLien } from '../../src/ui/partage';
import { DONNEES } from '../moteur/donnees';

describe('journal', () => {
  it('donne une ligne lisible par entree d une vie entiere', () => {
    let etat = creerPartie('journal', DONNEES);
    while (etat.personnage.vivant) etat = jouerAnneeAuto(etat, DONNEES).etat;
    const lignes = lignesJournal(etat.historique, DONNEES.evenements);
    expect(lignes[0]).toMatchObject({ texte: 'NAISSANCE.', age: 0 });
    expect(lignes.at(-1)).toMatchObject({ texte: 'FIN DE LA VIE.', categorie: 'choc' });
    for (const ligne of lignes) {
      expect(ligne.texte.trim()).not.toBe('');
      expect(ligne.texte).toBe(ligne.texte.toUpperCase());
    }
  });

  it('montre la mise et le gain de chaque annee de jeu, pas les totaux', () => {
    const historique: EntreeJournal[] = [
      { annee: 2010, age: 30, type: 'jeu', totalMise: 1000, totalRecupere: 600 },
      { annee: 2011, age: 31, type: 'jeu', totalMise: 1500, totalRecupere: 700 },
    ];
    const lignes = lignesJournal(historique, []);
    expect(lignes.map((l) => l.texte)).toEqual([
      'JEU : MISE 1 000 EUR, GAIN 600 EUR.',
      'JEU : MISE 500 EUR, GAIN 100 EUR.',
    ]);
    expect(lignes.every((l) => l.categorie === 'jeu')).toBe(true);
  });

  it('colore les evenements selon leurs tags et leur gravite', () => {
    const evenement = (id: string, tags: string[], gravite: 1 | 2 | 3 = 1) => ({
      id,
      module: 'test',
      age: [0, 110] as const,
      pBase: 0.1,
      effets: {},
      gravite,
      tags,
      textes: ['X'],
    });
    const historique: EntreeJournal[] = ['a', 'b', 'c', 'd'].map((id) => ({
      annee: 2000,
      age: 20,
      type: 'evenement',
      texte: 'X',
      evenementId: id,
    }));
    const lignes = lignesJournal(historique, [
      evenement('a', ['jeux_argent']),
      evenement('b', ['dettes']),
      evenement('c', ['emploi'], 3),
      evenement('d', ['quotidien']),
    ]);
    expect(lignes.map((l) => l.categorie)).toEqual(['jeu', 'argent', 'choc', 'neutre']);
  });

  it('decoupe en pages', () => {
    const lignes = Array.from({ length: LIGNES_PAR_PAGE * 2 + 1 }, (_, i) => i);
    expect(nombreDePages(lignes.length)).toBe(3);
    expect(nombreDePages(0)).toBe(1);
    expect(page(lignes, 2)).toEqual([LIGNES_PAR_PAGE * 2]);
  });
});

describe('partage', () => {
  it('fabrique et relit un lien de graine', () => {
    const lien = lienDePartage('https://exemple.fr/3615/?x=1#a', '7F3A21C9', {
      anneeNaissance: 1985,
    });
    expect(lien).toBe('https://exemple.fr/3615/?graine=7F3A21C9&annee=1985');
    expect(lireLien(new URL(lien).search)).toEqual({ graine: '7F3A21C9', annee: '1985' });
    expect(lienDePartage('https://exemple.fr/', 'ABCD', {})).toBe(
      'https://exemple.fr/?graine=ABCD',
    );
  });

  it('ignore une graine invalide et une annee mal formee', () => {
    expect(lireLien('?graine=!!')).toBeNull();
    expect(lireLien('')).toBeNull();
    expect(lireLien('?graine=abcd&annee=85')).toEqual({ graine: 'ABCD', annee: '' });
  });
});
