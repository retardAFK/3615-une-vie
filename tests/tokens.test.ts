import { describe, expect, it } from 'vitest';
import tokens from '../src/ui/styles/tokens.css?raw';

// Jetons de couleur de docs/design-minitel.md, noms et valeurs exacts.
const couleurs: Record<string, string> = {
  '--fond': '#000000',
  '--texte': '#FFFFFF',
  '--texte-discret': '#AAAAAA',
  '--accent': '#00FFFF',
  '--valeur': '#FFFF00',
  '--alerte': '#FF55FF',
  '--choc': '#FF3333',
  '--bien': '#55FF55',
  '--piste': '#333333',
  '--pointilles': '#555555',
};

describe('tokens.css', () => {
  it.each(Object.entries(couleurs))('declare %s = %s', (nom, valeur) => {
    const trouve = new RegExp(`${nom}\\s*:\\s*([^;]+);`).exec(tokens);
    expect(trouve?.[1]?.trim().toUpperCase()).toBe(valeur);
  });
});
