// Aides sociales (règles, section 7 ; jalon 4d) : versées automatiquement quand le
// personnage y a droit, selon le barème de l'année et seulement si une loi les a créées.
// Le non-recours (aide non demandée), plus fréquent chez les jeunes et à la campagne,
// est tiré chaque année par la formule des cotes.

import { probabiliteFinale } from '../cotes';
import { multiplicateursTag } from '../evenements';
import { hachageIdentifiant, tirageHache } from '../rng';
import { chercherLigne, parametre, periodeDe, valeurDe } from '../tables';
import {
  AIDES,
  type Aide,
  type Donnees,
  type Emploi,
  type EtatPartie,
  type Logement,
  type Tables,
} from '../types';
import { estAutonome } from './argent';
import { regleEnVigueur } from './contexte';
import { enfantsACharge } from './famille';

/** Tag des tirages du module : un choix peut réduire le non-recours. */
export const TAGS_AIDES = ['non_recours'] as const;

const EN_ACTIVITE: readonly Emploi[] = ['cdi', 'cdd', 'interim', 'independant', 'fonctionnaire'];
const LOCATAIRES: readonly Logement[] = ['locataire_prive', 'hlm'];
const IDS_NON_RECOURS = Object.fromEntries(
  AIDES.map((a) => [a, hachageIdentifiant(`non_recours.${a}`)]),
) as Record<Aide, readonly number[]>;

export interface AidesDeLAnnee {
  versees: Readonly<Partial<Record<Aide, number>>>;
  nonDemandees: readonly Aide[];
  total: number;
}

const SANS_AIDE: AidesDeLAnnee = { versees: {}, nonDemandees: [], total: 0 };

/** Barème d'une aide une année donnée (le plafond n'existe que pour les aides dégressives). */
interface Bareme {
  montant: number;
  plafond: number;
}
// Les barèmes sont relus chaque année pour chaque aide : gardés par table et par année.
const baremes = new WeakMap<object, Map<number, Partial<Record<Aide, Bareme>>>>();

function baremeDe(aide: Aide, annee: number, tables: Tables): Bareme {
  let parAnnee = baremes.get(tables.baremesAides);
  if (!parAnnee) {
    parAnnee = new Map();
    baremes.set(tables.baremesAides, parAnnee);
  }
  let parAide = parAnnee.get(annee);
  if (!parAide) {
    parAide = {};
    parAnnee.set(annee, parAide);
  }
  let bareme = parAide[aide];
  if (!bareme) {
    const { valeurs } = chercherLigne(tables.baremesAides, { aide, periode: periodeDe(annee) }, [
      'periode',
      'aide',
    ]);
    if (valeurs.montant === undefined) {
      throw new Error(`Table baremesAides : parametre montant absent pour ${aide}`);
    }
    bareme = { montant: valeurs.montant, plafond: valeurs.plafond ?? 0 };
    parAide[aide] = bareme;
  }
  return bareme;
}

/**
 * Montant auquel le personnage a droit cette année, compte tenu des ressources déjà
 * comptées (revenus et aides calculées avant). 0 sans droit. Une aide différentielle
 * complète les ressources jusqu'au montant du barème ; une aide dégressive diminue
 * avec les ressources et s'annule au plafond.
 */
export function droitA(aide: Aide, etat: EtatPartie, donnees: Donnees, ressources: number): number {
  const { personnage, annee } = etat;
  const { tables } = donnees;
  const { age } = personnage;
  const { emploi } = personnage.etats;
  const reglage = (nom: string): number => parametre(tables.parametresArgent, nom);
  const bareme = (nom: 'montant' | 'plafond'): number => baremeDe(aide, annee, tables)[nom];
  const differentielle = (): number => Math.max(0, bareme('montant') - ressources);
  const degressive = (): number => {
    const plafond = bareme('plafond');
    return ressources >= plafond ? 0 : bareme('montant') * (1 - ressources / plafond);
  };
  switch (aide) {
    case 'allocationsFamiliales': {
      // À partir du deuxième enfant à charge, sans condition de ressources.
      const enfants = enfantsACharge(personnage, tables);
      return enfants >= 2 ? bareme('montant') * (enfants - 1) : 0;
    }
    case 'aah':
      return personnage.origine.santeNaissance === 'handicap' &&
        emploi !== 'retraite' &&
        age >= reglage('ageAah')
        ? differentielle()
        : 0;
    case 'minimumVieillesse':
      return emploi === 'retraite' && age >= reglage('ageMinimumVieillesse') ? differentielle() : 0;
    case 'minimumSocial':
      return emploi !== 'retraite' && age >= reglage('ageMinimumSocial') ? differentielle() : 0;
    case 'complementActivite':
      return EN_ACTIVITE.includes(emploi) && personnage.finances.revenuAnnuel > 0
        ? degressive()
        : 0;
    case 'aideLogement':
      return LOCATAIRES.includes(personnage.etats.logement) ? degressive() : 0;
  }
}

/** Le personnage ne demande pas l'aide à laquelle il a droit cette année. */
export function renonce(aide: Aide, etat: EtatPartie, donnees: Donnees): boolean {
  const { personnage } = etat;
  const { tables } = donnees;
  const multiplicateurs = multiplicateursTag(etat, 'non_recours', personnage.age, donnees);
  if (personnage.age < parametre(tables.parametresArgent, 'ageJeune')) {
    multiplicateurs.push(parametre(tables.parametresArgent, 'mNonRecoursJeune'));
  }
  if (personnage.origine.territoire === 'rural') {
    multiplicateurs.push(parametre(tables.parametresArgent, 'mNonRecoursRural'));
  }
  const base = valeurDe(tables.nonRecours, { aide }, ['aide']);
  return (
    tirageHache(etat.graine, personnage.age, IDS_NON_RECOURS[aide]) <
    probabiliteFinale(base, multiplicateurs)
  );
}

/** Aides de l'année, dans l'ordre de AIDES : chacune compte dans les ressources des suivantes. */
export function calculerAides(etat: EtatPartie, donnees: Donnees): AidesDeLAnnee {
  const { personnage } = etat;
  if (!estAutonome(personnage)) return SANS_AIDE;
  const versees: Partial<Record<Aide, number>> = {};
  const nonDemandees: Aide[] = [];
  let total = 0;
  for (const aide of AIDES) {
    if (!regleEnVigueur(donnees.contexte, etat.annee, aide)) continue;
    const montant = Math.round(
      droitA(aide, etat, donnees, personnage.finances.revenuAnnuel + total),
    );
    if (montant <= 0) continue;
    if (renonce(aide, etat, donnees)) {
      nonDemandees.push(aide);
      continue;
    }
    versees[aide] = montant;
    total += montant;
  }
  return total === 0 && nonDemandees.length === 0 ? SANS_AIDE : { versees, nonDemandees, total };
}
