// Argent, version simple du jalon 4a (règles, section 7) : revenus moins une dépense
// de vie provisoire, solde vers l'épargne ou en dettes. Aides, surendettement,
// immobilier et héritage : jalons 4d et 6.

import { parametre, periodeDe, valeurDe } from '../tables';
import type { Emploi, Finances, Personnage, Tables } from '../types';

/**
 * Ajoute un montant aux finances. Un gain rembourse d'abord les dettes, puis va
 * à l'épargne ; une perte est prise sur l'épargne, puis en dettes. Jamais négatifs.
 */
export function appliquerMontant(finances: Finances, montant: number): Finances {
  const somme = Math.round(montant);
  if (somme >= 0) {
    const rembourse = Math.min(finances.dettes, somme);
    return {
      ...finances,
      dettes: finances.dettes - rembourse,
      epargne: finances.epargne + somme - rembourse,
    };
  }
  const prise = Math.min(finances.epargne, -somme);
  return {
    ...finances,
    epargne: finances.epargne - prise,
    dettes: finances.dettes - somme - prise,
  };
}

/** Le bilan personnel commence à la sortie des études : avant, les parents paient. */
export function estAutonome(personnage: Personnage): boolean {
  return personnage.etats.scolarite === 'sortie';
}

function statut(emploi: Emploi): 'emploi' | 'chomage' | 'inactif' | 'retraite' {
  switch (emploi) {
    case 'chomage':
    case 'arret_longue_maladie':
      return 'chomage';
    case 'inactif':
    case 'etudiant':
      return 'inactif';
    case 'retraite':
      return 'retraite';
    default:
      return 'emploi';
  }
}

/**
 * Dépense de vie provisoire : un plancher (part du salaire de référence de la
 * période, selon le territoire et le statut), plus une part du revenu au-delà.
 */
export function depenseVie(personnage: Personnage, annee: number, tables: Tables): number {
  const reference = valeurDe(tables.salaireReference, { periode: periodeDe(annee) }, ['periode']);
  const coefficient = valeurDe(
    tables.depensesVie,
    { territoire: personnage.origine.territoire, statut: statut(personnage.etats.emploi) },
    ['territoire', 'statut'],
  );
  const plancher = coefficient * reference;
  const part = parametre(tables.parametresArgent, 'partRevenuDepensee');
  return Math.round(plancher + part * Math.max(0, personnage.finances.revenuAnnuel - plancher));
}

/** Bilan de l'année : le revenu (déjà calculé) moins la dépense de vie. */
export function bilanAnnuel(personnage: Personnage, annee: number, tables: Tables): Personnage {
  if (!estAutonome(personnage)) return personnage;
  const solde = personnage.finances.revenuAnnuel - depenseVie(personnage, annee, tables);
  return { ...personnage, finances: appliquerMontant(personnage.finances, solde) };
}
