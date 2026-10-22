// Paramètres de jeu (choix de conception, pas des statistiques réelles).

import type { Etats, Finances, Jauges } from './types';

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
  competences: 70,
};

export const FINANCES_INITIALES: Readonly<Finances> = {
  revenuAnnuel: 0,
  epargne: 0,
  dettes: 0,
  patrimoine: 0,
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
  };
}

/**
 * Dérive annuelle des jauges selon l'âge vécu.
 * PROVISOIRE, remplacée au jalon 3 par les effets des événements.
 * bienEtre n'y figure pas : c'est la moyenne des autres jauges.
 */
export function deriveJaugesProvisoire(age: number): Readonly<Omit<Jauges, 'bienEtre'>> {
  return {
    santePhysique: age >= 75 ? -1.5 : age >= 40 ? -0.6 : 0,
    santeMentale: 0,
    liens: age >= 70 ? -0.5 : 0,
    competences: age >= 6 && age < 25 ? 0.6 : age >= 65 ? -0.3 : 0,
  };
}
