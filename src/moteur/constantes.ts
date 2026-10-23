// Paramètres de jeu (choix de conception, pas des statistiques réelles).

import type { DiplomeJoueur, Etats, Finances, Jauges } from './types';

/** Âge auquel toute vie se termine. */
export const AGE_MAXIMAL = 110;

/** Traits : loi normale centrée sur 50, écart-type 15, bornée à [5, 95] (règles, section 2). */
export const TRAITS_MOYENNE = 50;
export const TRAITS_ECART_TYPE = 15;
export const TRAITS_MIN = 5;
export const TRAITS_MAX = 95;

/** Valeurs de départ provisoires, à revoir au jalon 2. */
export const JAUGES_INITIALES: Readonly<Jauges> = {
  santePhysique: 70,
  santeMentale: 70,
  bienEtre: 70,
  liens: 70,
  competences: 20,
};

/** Savoir gagné par année de scolarité (jauge competences), jusqu'à la sortie. */
export const SAVOIR_PAR_ANNEE_SCOLAIRE = 3;

/** Le diplôme final fixe la jauge « savoir » de départ (règles, section 5). */
export const SAVOIR_PAR_DIPLOME: Readonly<Record<DiplomeJoueur, number>> = {
  aucun: 35,
  cap_bep: 50,
  bac_pro: 55,
  bac_techno: 58,
  bac_general: 62,
  bac_2_3: 70,
  bac_5: 80,
};

/** Avant cet âge, hors mode AUTO, les années sans événement défilent sans arrêt. */
export const AGE_FIN_PETITE_ENFANCE = 6;

/** Retard scolaire maximal : au-delà, l'échec fait sortir du système scolaire. */
export const RETARD_MAXIMAL = 2;

/** Âge d'entrée à l'école maternelle, puis au CP. */
export const AGE_MATERNELLE = 3;
export const AGE_CP = 6;

export const FINANCES_INITIALES: Readonly<Finances> = {
  revenuAnnuel: 0,
  epargne: 0,
  dettes: 0,
  patrimoine: 0,
  aides: {},
  nonDemandees: [],
  remboursements: 0,
  endettement: 'sain',
  anneesCritique: 0,
  planApurement: 0,
  creditImmobilier: 0,
  annuiteImmobilier: 0,
};

export function etatsInitiaux(): Etats {
  return {
    scolarite: 'non_scolarise',
    emploi: 'inactif',
    couple: 'celibataire',
    logement: 'chez_parents',
    addictions: {
      tabac: 'jamais_expose',
      alcool: 'jamais_expose',
      cannabis: 'jamais_expose',
      autres_drogues: 'jamais_expose',
      jeux_argent: 'jamais_expose',
      ecrans: 'jamais_expose',
    },
    maladies: [],
    education: { diplome: 'aucun', voie: null, filiere: null, retard: 0, finPalier: null },
    travail: {
      pcs: null,
      quotite: 1,
      bruit: 1,
      progression: 1,
      anciennete: 0,
      salaire: 0,
      dernierSalaire: 0,
      dureeChomage: 0,
      trimestres: 0,
      meilleursSalaires: [],
      pension: 0,
      ageRetraite: null,
    },
    justice: { gardesAVue: 0, condamnations: 0, casier: false },
    debutEtatAddiction: {
      tabac: 0,
      alcool: 0,
      cannabis: 0,
      autres_drogues: 0,
      jeux_argent: 0,
      ecrans: 0,
    },
    jeu: {
      jeu: null,
      budget: 'aucun',
      totalMise: 0,
      totalRecupere: 0,
      miseAnnee: 0,
      gainAnnee: 0,
      chasse: false,
      interdiction: false,
      pertesElevees: false,
    },
    famille: { enfants: [], parentsVivants: true, achatPossible: false },
  };
}
