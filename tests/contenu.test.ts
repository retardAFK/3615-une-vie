import { describe, expect, it } from 'vitest';
import ressources from '../contenu/textes/ressources.json';
import { validerEvenements } from '../src/moteur/validation';

// Tous les fichiers de contenu/evenements/, tels que l'interface les charge.
const fichiers = Object.entries(
  import.meta.glob<unknown>('../contenu/evenements/*.json', { eager: true, import: 'default' }),
).map(([chemin, contenu]) => ({ nom: chemin.split('/').at(-1)!, contenu }));

describe('contenu/evenements', () => {
  it('contient au moins un fichier', () => {
    expect(fichiers.length).toBeGreaterThan(0);
  });

  it('passe le validateur', () => {
    expect(validerEvenements(fichiers, { ressources: Object.keys(ressources) }).erreurs).toEqual(
      [],
    );
  });
});
