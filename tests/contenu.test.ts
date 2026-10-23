import { describe, expect, it } from 'vitest';
import ressources from '../contenu/textes/ressources.json';
import addictionsAutresTags from '../public/data/addictionsAutresTags.json';
import { tagsConnus, validerContexte, validerEvenements } from '../src/moteur/validation';

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

  it('garde tous les champs declares apres validation (annees, ressources...)', () => {
    const valides = validerEvenements(fichiers, { ressources: Object.keys(ressources) }).evenements;
    const bruts = fichiers.flatMap(
      (f) => (f.contenu as { evenements: Record<string, unknown>[] }).evenements,
    );
    expect(bruts.some((e) => 'annees' in e)).toBe(true);
    expect(bruts.some((e) => 'ressources' in e)).toBe(true);
    for (const brut of bruts) {
      const valide = valides.find((e) => e.id === brut.id)!;
      const declares = Object.fromEntries(
        Object.entries(valide).filter(([, valeur]) => valeur !== undefined),
      );
      expect(declares, String(brut.id)).toEqual(brut);
    }
  });
});

describe('contenu/contexte', () => {
  it('passe le validateur du contexte', () => {
    const evenements = validerEvenements(fichiers, {
      ressources: Object.keys(ressources),
    }).evenements;
    const contexte = Object.entries(
      import.meta.glob<unknown>('../contenu/contexte/*.json', { eager: true, import: 'default' }),
    ).map(([chemin, contenu]) => ({ nom: chemin.split('/').at(-1)!, contenu }));
    expect(contexte.length).toBeGreaterThan(0);
    expect(validerContexte(contexte, tagsConnus(evenements)).erreurs).toEqual([]);
  });
});

describe('public/data/addictionsAutresTags', () => {
  it('ne vise que des tags connus du contenu ou des modules', () => {
    const connus = tagsConnus(
      validerEvenements(fichiers, { ressources: Object.keys(ressources) }).evenements,
    );
    for (const ligne of addictionsAutresTags.lignes) {
      expect(connus.has(ligne.conditions.tag), ligne.conditions.tag).toBe(true);
    }
  });
});
