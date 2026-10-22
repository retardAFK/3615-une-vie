import { describe, expect, it } from 'vitest';
import { actionClavier, type Touche } from '../../src/ui/clavier';

const touche = (key: string, modificateurs: Partial<Touche> = {}): Touche => ({
  key,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...modificateurs,
});

describe('actionClavier', () => {
  it('traduit les chiffres 1 a 9 en choix', () => {
    expect(actionClavier(touche('1'), false)).toEqual({ type: 'choix', numero: 1 });
    expect(actionClavier(touche('9'), false)).toEqual({ type: 'choix', numero: 9 });
    expect(actionClavier(touche('0'), false)).toBeNull();
  });

  it('traduit les touches de fonction, en minuscules comme en majuscules', () => {
    expect(actionClavier(touche('Enter'), false)).toEqual({ type: 'envoi' });
    expect(actionClavier(touche('Escape'), false)).toEqual({ type: 'retour' });
    expect(actionClavier(touche('s'), false)).toEqual({ type: 'sommaire' });
    expect(actionClavier(touche('A'), false)).toEqual({ type: 'auto' });
    expect(actionClavier(touche('g'), false)).toEqual({ type: 'guide' });
    expect(actionClavier(touche('x'), false)).toBeNull();
  });

  it('reste inactif dans un champ de saisie', () => {
    expect(actionClavier(touche('Enter'), true)).toBeNull();
    expect(actionClavier(touche('1'), true)).toBeNull();
  });

  it('ignore les combinaisons avec Ctrl, Alt ou Cmd', () => {
    expect(actionClavier(touche('s', { ctrlKey: true }), false)).toBeNull();
    expect(actionClavier(touche('a', { metaKey: true }), false)).toBeNull();
    expect(actionClavier(touche('1', { altKey: true }), false)).toBeNull();
  });
});
