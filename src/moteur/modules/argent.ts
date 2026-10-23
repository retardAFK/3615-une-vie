// Argent (règles, section 7) : bilan annuel, dettes et surendettement. Les aides de
// l'année sont calculées avant, par le module aides ; le logement, les enfants, l'achat
// immobilier et l'héritage, par le module famille.

import { remplir } from '../recit';
import { parametre, periodeDe, valeurDe } from '../tables';
import type {
  Aide,
  Donnees,
  Emploi,
  EntreeContexte,
  EntreeJournal,
  EtatPartie,
  Finances,
  NiveauEndettement,
  Personnage,
  Tables,
} from '../types';
import type { AidesDeLAnnee } from './aides';
import { regleEnVigueur } from './contexte';

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
 * période, selon le territoire et le statut), plus une part des ressources au-delà.
 * Sous le plancher, le personnage réduit son train de vie : seule une part de
 * l'écart reste incompressible. Ressources : revenu de l'année, aides comprises.
 */
export function depenseVie(
  personnage: Personnage,
  annee: number,
  tables: Tables,
  ressources: number = personnage.finances.revenuAnnuel,
): number {
  const reference = valeurDe(tables.salaireReference, { periode: periodeDe(annee) }, ['periode']);
  const coefficient = valeurDe(
    tables.depensesVie,
    { territoire: personnage.etats.residence.territoire, statut: statut(personnage.etats.emploi) },
    ['territoire', 'statut'],
  );
  const plancher = coefficient * reference;
  if (ressources < plancher) {
    const incompressible = parametre(tables.parametresArgent, 'partDeficitIncompressible');
    return Math.round(ressources + incompressible * (plancher - ressources));
  }
  const part = parametre(tables.parametresArgent, 'partRevenuDepensee');
  return Math.round(plancher + part * (ressources - plancher));
}

/** Nom de l'aide l'année donnée, tel que la loi en vigueur la nomme (« LE RSA »). */
export function nomAide(contexte: readonly EntreeContexte[], annee: number, aide: Aide): string {
  const valeur = regleEnVigueur(contexte, annee, aide);
  return typeof valeur === 'string' ? valeur : aide.toUpperCase();
}

/** Dossier de surendettement recevable : plan d'apurement, accès au crédit bloqué. */
export function ouvrirPlan(finances: Finances, tables: Tables): Finances {
  return {
    ...finances,
    planApurement: parametre(tables.parametresArgent, 'dureePlan'),
    endettement: 'surendettement',
    anneesCritique: 0,
  };
}

const borner = (valeur: number): number => Math.min(100, Math.max(0, valeur));

export interface ResultatBilan {
  personnage: Personnage;
  journal: EntreeJournal[];
}

/**
 * Soutien familial : avant l'âge du minimum social, la famille couvre ce que le jeune
 * qui vit chez ses parents ne peut pas payer. Pas de soutien après un placement (ASE).
 */
export function soutenuParSaFamille(personnage: Personnage, tables: Tables): boolean {
  return (
    personnage.etats.logement === 'chez_parents' &&
    personnage.origine.structureFamiliale !== 'placement_ase' &&
    personnage.age < parametre(tables.parametresArgent, 'ageMinimumSocial')
  );
}

/**
 * Bilan de l'année : revenus et aides, moins les charges fixes (logement, enfants,
 * crédit immobilier), la dépense de vie, les autres dépenses (addictions, santé, mises
 * de jeu nettes des gains) et les remboursements. Les charges fixes passent d'abord :
 * la dépense de vie se règle sur ce qui reste.
 * Un solde positif va à l'épargne ; un solde négatif est pris sur l'épargne, puis
 * couvert par la famille (soutien familial), sinon emprunté (découvert, crédit à la
 * consommation) jusqu'au plafond de crédit ; au-delà, ou pendant un plan d'apurement,
 * le personnage se prive. Les intérêts courent sur
 * les dettes, sauf pendant un plan. Le niveau d'endettement suit la part des
 * ressources prise par les remboursements (seuils de parametresArgent).
 */
export function bilanAnnuel(
  etat: EtatPartie,
  aides: AidesDeLAnnee,
  donnees: Donnees,
  depenses = 0,
  charges = 0,
): ResultatBilan {
  const { personnage, annee } = etat;
  if (!estAutonome(personnage)) {
    // Avant l'autonomie, seules les dépenses passées (mises de jeu) touchent les finances.
    if (depenses === 0 && charges === 0) return { personnage, journal: [] };
    return {
      personnage: {
        ...personnage,
        finances: appliquerMontant(personnage.finances, -depenses - charges),
      },
      journal: [],
    };
  }
  const { tables, contexte } = donnees;
  const reglage = (nom: string): number => parametre(tables.parametresArgent, nom);
  const avant = personnage.finances;
  const ressources = avant.revenuAnnuel + aides.total;
  const apresCharges = ressources - charges;
  const disponible =
    apresCharges - depenseVie(personnage, annee, tables, Math.max(0, apresCharges)) - depenses;
  const enPlan = avant.planApurement > 0;

  // Intérêts, puis remboursement de l'année : contractuel, ou selon la capacité pendant un plan.
  let dettes = enPlan
    ? avant.dettes
    : avant.dettes + Math.round(avant.dettes * reglage('tauxInteret'));
  const du = Math.min(
    dettes,
    enPlan
      ? Math.max(0, Math.round(disponible * reglage('partCapacitePlan')))
      : Math.max(reglage('remboursementMinimum'), Math.round(dettes * reglage('partRemboursee'))),
  );
  dettes -= du;
  let epargne = avant.epargne;
  let manque = 0;
  const reste = disponible - du;
  if (reste >= 0) epargne += reste;
  else {
    const pris = Math.min(epargne, -reste);
    epargne -= pris;
    manque = -reste - pris;
    if (manque > 0 && soutenuParSaFamille(personnage, tables)) manque = 0;
  }
  let prive = false;
  if (manque > 0) {
    const plafond = enPlan
      ? 0
      : Math.max(
          reglage('plafondCreditMinimum'),
          Math.round(ressources * reglage('plafondCreditRevenus')),
        );
    const emprunt = Math.max(0, Math.min(manque, plafond - dettes));
    dettes += emprunt;
    prive = emprunt < manque;
  }
  // Incident de paiement : plus de crédit possible, les remboursements ne sont pas payés.
  const incident = prive && du > 0;

  const journal: EntreeJournal[] = [];
  const recit = (cle: string, aide?: Aide): void => {
    const modele = donnees.libelles.recits?.[cle];
    if (!modele) return;
    const texte = remplir(modele, aide ? { aide: nomAide(contexte, annee, aide) } : {});
    journal.push({ annee, age: personnage.age, type: 'argent', texte });
  };

  let plan = avant.planApurement;
  if (enPlan) {
    plan -= 1;
    if (plan === 0) {
      recit('argentFinPlan');
      if (dettes > 0 && regleEnVigueur(contexte, annee, 'retablissementPersonnel')) {
        dettes = 0;
        recit('argentEffacement');
      }
    }
  }

  const part = du / Math.max(1, ressources);
  let niveau: NiveauEndettement =
    plan > 0
      ? 'surendettement'
      : dettes === 0
        ? 'sain'
        : incident || part > reglage('seuilCritique')
          ? 'critique'
          : part >= reglage('seuilTendu')
            ? 'tendu'
            : 'sain';
  let anneesCritique = niveau === 'critique' ? avant.anneesCritique + 1 : 0;
  // Dossier déposé d'office après plusieurs années critiques, si la loi le prévoit.
  if (
    niveau === 'critique' &&
    anneesCritique >= reglage('anneesAvantDossier') &&
    regleEnVigueur(contexte, annee, 'surendettement')
  ) {
    plan = reglage('dureePlan');
    niveau = 'surendettement';
    anneesCritique = 0;
    recit('argentDossier');
  }

  for (const aide of Object.keys(aides.versees) as Aide[]) {
    if (avant.aides[aide] === undefined) recit('argentAide', aide);
  }
  for (const aide of aides.nonDemandees) {
    if (avant.aides[aide] === undefined && !avant.nonDemandees.includes(aide)) {
      recit('argentNonRecours', aide);
    }
  }
  if (niveau === 'tendu' && avant.endettement === 'sain') recit('argentTendu');
  if (niveau === 'critique' && avant.endettement !== 'critique') recit('argentCritique');
  if (avant.dettes > 0 && dettes === 0 && !enPlan) recit('argentDesendette');

  // Effets sur les jauges : inquiétude quand les dettes pèsent, privations sans crédit.
  const perteMentale =
    niveau === 'tendu'
      ? reglage('perteSanteTendu')
      : niveau === 'critique'
        ? reglage('perteSanteCritique')
        : 0;
  const pertePhysique = prive ? reglage('perteSantePrivation') : 0;
  const jauges =
    perteMentale > 0 || pertePhysique > 0
      ? {
          ...personnage.jauges,
          santeMentale: borner(personnage.jauges.santeMentale - perteMentale),
          santePhysique: borner(personnage.jauges.santePhysique - pertePhysique),
        }
      : personnage.jauges;

  return {
    personnage: {
      ...personnage,
      jauges,
      finances: {
        ...avant,
        epargne,
        dettes,
        aides: aides.versees,
        nonDemandees: aides.nonDemandees,
        remboursements: du,
        endettement: niveau,
        anneesCritique,
        planApurement: plan,
      },
    },
    journal,
  };
}
