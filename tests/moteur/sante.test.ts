import { describe, expect, it } from 'vitest';
import { creerPartie, fermerAnnee, ouvrirAnnee } from '../../src/moteur/boucle';
import { estEligible, evenementParId, probabiliteEvenement } from '../../src/moteur/evenements';
import {
  commencerMaladie,
  depensesSante,
  evoluerSante,
  probabiliteDecesPersonnage,
  probabiliteDecesTable,
} from '../../src/moteur/modules/sante';
import type {
  EtatPartie,
  Maladie,
  ModificateurTemporaire,
  Personnage,
} from '../../src/moteur/types';
import { DONNEES, donneesAvec, evenement } from './donnees';
import { parametre } from '../../src/moteur/tables';
import { TABLES } from './tables';

/** Personnage de 50 ans (ou de l'âge donné), employé, avec des maladies actives. */
function avec(
  maladies: Maladie[],
  graine: string,
  options: { age?: number; modificateurs?: ModificateurTemporaire[] } = {},
): EtatPartie {
  const { age = 50, modificateurs = [] } = options;
  const base = creerPartie(graine, DONNEES, { anneeNaissance: 1960 });
  const { etats } = base.personnage;
  return {
    ...base,
    annee: 1960 + age,
    modificateursActifs: modificateurs,
    personnage: {
      ...base.personnage,
      age,
      jauges: { ...base.personnage.jauges, santePhysique: 50 },
      etats: {
        ...etats,
        scolarite: 'sortie',
        emploi: 'cdi',
        travail: { ...etats.travail, pcs: 'employe' },
        maladies,
      },
    },
  };
}

/** Part des vies où la maladie guérit dans l'année. */
function tauxGuerison(
  maladie: Maladie,
  options: Parameters<typeof avec>[2] = {},
  vies = 2000,
): number {
  let n = 0;
  for (let i = 0; i < vies; i++) {
    const etat = avec([maladie], `guerison-${maladie}-${i}`, options);
    if (!evoluerSante(etat, DONNEES).etat.personnage.etats.maladies.includes(maladie)) n++;
  }
  return n / vies;
}

const consulter = (m: number): ModificateurTemporaire[] => [
  { cible: { tag: 'guerison_cancer' }, m, debut: 0, fin: null },
];

describe('sante', () => {
  it('ne change rien sans maladie active', () => {
    const etat = avec([], 'sain');
    expect(evoluerSante(etat, DONNEES)).toEqual({ etat, journal: [] });
  });

  it('applique les effets annuels d une maladie, de facon deterministe', () => {
    const etat = avec(['chronique'], 'chronique');
    const apres = evoluerSante(etat, DONNEES).etat.personnage;
    expect(apres.jauges.santePhysique).toBeLessThan(50);
    // Pas de guérison pour une maladie chronique.
    expect(apres.etats.maladies).toEqual(['chronique']);
    expect(evoluerSante(etat, DONNEES)).toEqual(evoluerSante(etat, DONNEES));
  });

  it('guerit plus souvent quand le joueur a choisi de se soigner', () => {
    const sans = tauxGuerison('cancer');
    expect(sans).toBeGreaterThan(0);
    expect(tauxGuerison('cancer', { modificateurs: consulter(2) })).toBeGreaterThan(sans);
    expect(tauxGuerison('cancer', { modificateurs: consulter(0.5) })).toBeLessThan(sans);
    expect(tauxGuerison('chronique')).toBe(0);
  });

  it('ecrit la guerison au journal', () => {
    for (let i = 0; i < 50; i++) {
      const { etat, journal } = evoluerSante(avec(['depression'], `journal-${i}`), DONNEES);
      if (etat.personnage.etats.maladies.length > 0) continue;
      expect(journal).toHaveLength(1);
      expect(journal[0]!.type).toBe('sante');
      expect(journal[0]!.texte).toContain('DEPRESSION');
      return;
    }
    throw new Error('aucune guerison en 50 essais');
  });

  it('ne commence une maladie qu une fois', () => {
    const { personnage } = avec([], 'debut');
    const malade = commencerMaladie(personnage, 'cancer');
    expect(malade.etats.maladies).toEqual(['cancer']);
    expect(commencerMaladie(malade, 'cancer')).toBe(malade);
  });

  it('commence une maladie par un evenement de contenu', () => {
    const donnees = donneesAvec([
      evenement('diagnostic', { age: [50, 50], effets: { maladie: 'cardiovasculaire' } }),
    ]);
    const depart = avec([], 'evenement');
    const ouverte = ouvrirAnnee(depart, donnees);
    const fermee = fermerAnnee(ouverte.etat, [], donnees);
    expect(fermee.etat.personnage.etats.maladies).toContain('cardiovasculaire');
  });

  it('coute de l argent tant que la maladie est active', () => {
    expect(depensesSante(avec([], 'cout').personnage, TABLES)).toBe(0);
    const un = depensesSante(avec(['chronique'], 'cout').personnage, TABLES);
    const deux = depensesSante(avec(['chronique', 'demence'], 'cout').personnage, TABLES);
    expect(un).toBeGreaterThan(0);
    expect(deux).toBeGreaterThan(un);
  });

  describe('mortalite', () => {
    const q = (personnage: Personnage): number =>
      probabiliteDecesPersonnage(personnage, 2010, TABLES);

    it('part de la table et reste une probabilite', () => {
      // Santé physique au centre de la correction : seule la PCS employé (1) s'applique.
      const base = avec([], 'table').personnage;
      const centre = parametre(TABLES.parametresSante, 'centreSantePhysique');
      const personnage = { ...base, jauges: { ...base.jauges, santePhysique: centre } };
      const table = probabiliteDecesTable(50, personnage.origine.sexe, 2010, TABLES);
      expect(q(personnage)).toBeGreaterThan(0);
      expect(q(personnage)).toBeLessThan(1);
      expect(q(personnage)).toBeCloseTo(table, 6);
    });

    it('augmente avec les maladies, les addictions et une sante physique basse', () => {
      const { personnage } = avec([], 'facteurs');
      const base = q(personnage);
      expect(q(avec(['cancer'], 'facteurs').personnage)).toBeGreaterThan(base);
      const fumeur = {
        ...personnage,
        etats: {
          ...personnage.etats,
          addictions: { ...personnage.etats.addictions, tabac: 'dependance' as const },
        },
      };
      expect(q(fumeur)).toBeGreaterThan(base);
      expect(
        q({ ...personnage, jauges: { ...personnage.jauges, santePhysique: 10 } }),
      ).toBeGreaterThan(base);
    });

    it('reproduit l ecart entre cadres et ouvriers a l age adulte seulement', () => {
      const { personnage } = avec([], 'pcs');
      const pcs = (p: 'cadre' | 'ouvrier', age: number): number =>
        q({
          ...personnage,
          age,
          etats: { ...personnage.etats, travail: { ...personnage.etats.travail, pcs: p } },
        });
      expect(pcs('ouvrier', 50)).toBeGreaterThan(pcs('cadre', 50));
      expect(pcs('ouvrier', 20)).toBe(pcs('cadre', 20));
    });
  });

  it('fait peser le tabac sur le risque de cancer (addictionsAutresTags)', () => {
    const cancer = evenementParId(DONNEES.evenements, 'san_cancer');
    const sobre = avec([], 'tabac');
    const fumeur: EtatPartie = {
      ...sobre,
      personnage: {
        ...sobre.personnage,
        etats: {
          ...sobre.personnage.etats,
          addictions: { ...sobre.personnage.etats.addictions, tabac: 'dependance' },
        },
      },
    };
    expect(probabiliteEvenement(cancer, fumeur, DONNEES)).toBeGreaterThan(
      probabiliteEvenement(cancer, sobre, DONNEES),
    );
    // Une maladie déjà active ne recommence pas.
    expect(estEligible(cancer, sobre, DONNEES)).toBe(true);
    expect(estEligible(cancer, avec(['cancer'], 'tabac'), DONNEES)).toBe(false);
  });
});
