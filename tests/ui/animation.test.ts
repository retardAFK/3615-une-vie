import { describe, expect, it } from 'vitest';
import { LARGEUR_MOTIF, HAUTEUR_MOTIF, PICTOS, pictoPour } from '../../src/ui/pictos';
import {
  REGLAGES_PAR_DEFAUT,
  animationsPermises,
  delaiParCaractere,
  ecrireReglages,
  lireReglages,
  vitesseSuivante,
  type Stockage,
} from '../../src/ui/reglages';
import { caracteresVisibles, dureeRevelation } from '../../src/ui/revelation';
import { PARTITIONS } from '../../src/ui/sons';

const memoire = (): Stockage & { valeurs: Map<string, string> } => {
  const valeurs = new Map<string, string>();
  return {
    valeurs,
    getItem: (cle) => valeurs.get(cle) ?? null,
    setItem: (cle, valeur) => void valeurs.set(cle, valeur),
  };
};

describe('reglages', () => {
  it('a des valeurs par defaut : vitesse normale, sons coupes', () => {
    expect(lireReglages(memoire())).toEqual({ vitesse: 'normale', sons: false });
    expect(REGLAGES_PAR_DEFAUT.sons).toBe(false);
  });

  it('enregistre et relit les reglages', () => {
    const stockage = memoire();
    ecrireReglages({ vitesse: 'rapide', sons: true }, stockage);
    expect(lireReglages(stockage)).toEqual({ vitesse: 'rapide', sons: true });
  });

  it('ignore un stockage abime ou indisponible', () => {
    const stockage = memoire();
    stockage.setItem('3615-une-vie.reglages', '{pas du json');
    expect(lireReglages(stockage)).toEqual(REGLAGES_PAR_DEFAUT);
    stockage.setItem('3615-une-vie.reglages', JSON.stringify({ vitesse: 'turbo', sons: 'oui' }));
    expect(lireReglages(stockage)).toEqual(REGLAGES_PAR_DEFAUT);
    const bloque: Stockage = {
      getItem: () => {
        throw new Error('bloque');
      },
      setItem: () => {
        throw new Error('bloque');
      },
    };
    expect(lireReglages(bloque)).toEqual(REGLAGES_PAR_DEFAUT);
    expect(() => ecrireReglages(REGLAGES_PAR_DEFAUT, bloque)).not.toThrow();
  });

  it('fait tourner les vitesses', () => {
    expect(vitesseSuivante('lente')).toBe('normale');
    expect(vitesseSuivante('instantanee')).toBe('lente');
  });

  it('coupe toute animation en AUTO et quand le systeme demande moins de mouvement', () => {
    const reglages = { vitesse: 'lente' as const, sons: false };
    expect(delaiParCaractere(reglages, false, false)).toBeGreaterThan(0);
    expect(delaiParCaractere(reglages, true, false)).toBe(0);
    expect(delaiParCaractere(reglages, false, true)).toBe(0);
    expect(animationsPermises({ vitesse: 'instantanee', sons: false }, false, false)).toBe(false);
  });
});

describe('revelation', () => {
  it('revele les caracteres au fil du temps, puis tout le texte', () => {
    expect(caracteresVisibles(10, 0, 30)).toBe(0);
    expect(caracteresVisibles(10, 95, 30)).toBe(3);
    expect(caracteresVisibles(10, 10_000, 30)).toBe(10);
    expect(dureeRevelation(10, 30)).toBe(300);
  });

  it('affiche tout immediatement sans delai', () => {
    expect(caracteresVisibles(42, 0, 0)).toBe(42);
    expect(dureeRevelation(42, 0)).toBe(0);
  });
});

describe('pictos', () => {
  it('ont tous la meme taille et seulement des blocs # ou .', () => {
    for (const [nom, motif] of Object.entries(PICTOS)) {
      expect(motif, nom).toHaveLength(HAUTEUR_MOTIF);
      for (const ligne of motif) expect(ligne, nom).toMatch(new RegExp(`^[#.]{${LARGEUR_MOTIF}}$`));
    }
  });

  it("choisissent le picto du premier tag connu de l'evenement", () => {
    expect(pictoPour(['inconnu', 'ecole'])).toBe(PICTOS.ecole);
    expect(pictoPour(['police', 'discrimination'])).toBe(PICTOS.police);
    expect(pictoPour(['inconnu'])).toBeNull();
  });
});

describe('sons', () => {
  it('ont des partitions courtes et valides', () => {
    for (const [nom, notes] of Object.entries(PARTITIONS)) {
      expect(notes.length, nom).toBeGreaterThan(0);
      for (const note of notes) {
        expect(note.frequence).toBeGreaterThan(20);
        expect(note.duree).toBeGreaterThan(0);
        expect(note.debut + note.duree).toBeLessThan(1500);
      }
    }
  });
});
