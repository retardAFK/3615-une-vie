// Jeux d'argent (règles, section 8 ; jalon 5) : chaque jeu est simulé avec ses règles
// mathématiques, un prix de mise et des rangs de gain (table jeuxArgent). On perd en
// moyenne, on gagne parfois ; les totaux misés et récupérés restent toujours visibles.
// Le profil de joueur suit la chaîne commune des addictions (produit jeux_argent).

import { sousGenerateur, binomiale } from '../rng';
import { chercherLigne, valeurDe } from '../tables';
import { reglages } from './addictions';
import type {
  EffetsChoix,
  EntreeJournal,
  EtatJeu,
  EtatPartie,
  LigneJeu,
  ModificateurTemporaire,
  NomJeu,
  Personnage,
  Tables,
  Donnees,
} from '../types';

/** Règles d'un jeu. */
export function regleDuJeu(tables: Tables, jeu: NomJeu): LigneJeu {
  return chercherLigne(tables.jeuxArgent, { jeu }, ['jeu']);
}

/** Taux de retour d'un jeu : euros récupérés en moyenne pour un euro misé. */
export function tauxDeRetour(ligne: LigneJeu): number {
  let esperance = 0;
  for (const rang of ligne.rangs) esperance += rang.probabilite * rang.gain;
  return esperance / ligne.prix;
}

/** Mise de l'année : budget choisi, plus lourd selon le profil, doublé pour se refaire. */
export function miseDeLAnnee(personnage: Personnage, tables: Tables): number {
  const { jeu } = personnage.etats;
  const profil = personnage.etats.addictions.jeux_argent;
  if (jeu.jeu === null || jeu.budget === 'aucun') return 0;
  if (profil !== 'usage_occasionnel' && profil !== 'usage_regulier' && profil !== 'dependance') {
    return 0;
  }
  if (jeu.interdiction && regleDuJeu(tables, jeu.jeu).bloqueParInterdiction) return 0;
  let mise = valeurDe(tables.budgetsJeu, { budget: jeu.budget }, ['budget']);
  if (profil === 'usage_regulier') mise *= reglages(tables).mMiseRegulier;
  if (profil === 'dependance') mise *= reglages(tables).mMiseDependance;
  if (jeu.chasse) mise *= reglages(tables).mMiseChasse;
  return Math.round(mise);
}

/** Gains d'une année : pour chaque rang, nombre de mises gagnantes tiré (loi binomiale). */
export function tirerGains(g: () => number, ligne: LigneJeu, mise: number): number {
  const mises = Math.floor(mise / ligne.prix);
  let gain = 0;
  for (const rang of ligne.rangs) gain += binomiale(g, mises, rang.probabilite) * rang.gain;
  return Math.round(gain);
}

export interface AnneeDeJeu {
  etat: EtatPartie;
  mise: number;
  gain: number;
  journal: EntreeJournal[];
}

/**
 * Année de jeu, au début de l'année : mise, gains tirés, totaux de la vie. Des pertes
 * au-delà du seuil de chasse ouvrent l'événement « se refaire » ; un gros gain précoce
 * pousse vers le jeu régulier pendant quelques années.
 */
export function jouerAnnee(etat: EtatPartie, donnees: Donnees): AnneeDeJeu {
  const { personnage } = etat;
  const { tables } = donnees;
  const avant = personnage.etats.jeu;
  const mise = miseDeLAnnee(personnage, tables);
  if (mise === 0) {
    if (avant.miseAnnee === 0 && !avant.chasse && !avant.pertesElevees) {
      return { etat, mise: 0, gain: 0, journal: [] };
    }
    const jeu: EtatJeu = {
      ...avant,
      miseAnnee: 0,
      gainAnnee: 0,
      chasse: false,
      pertesElevees: false,
    };
    return { etat: avecJeu(etat, jeu), mise: 0, gain: 0, journal: [] };
  }

  const ligne = regleDuJeu(tables, avant.jeu!);
  const g = sousGenerateur(etat.graine, personnage.age, 'jeu.gains');
  const gain = tirerGains(g, ligne, mise);
  const seuil = reglages(tables).seuilChasse * personnage.finances.revenuAnnuel;
  const jeu: EtatJeu = {
    ...avant,
    totalMise: avant.totalMise + mise,
    totalRecupere: avant.totalRecupere + gain,
    miseAnnee: mise,
    gainAnnee: gain,
    chasse: false,
    pertesElevees: mise - gain > seuil,
  };

  let suite = avecJeu(etat, jeu);
  if (
    personnage.etats.addictions.jeux_argent === 'usage_occasionnel' &&
    gain > mise * reglages(tables).multipleGrosGain
  ) {
    const gros: ModificateurTemporaire = {
      cible: { tag: 'escalade_jeux_argent' },
      m: reglages(tables).mGrosGain,
      debut: personnage.age,
      fin: personnage.age + reglages(tables).dureeGrosGain - 1,
    };
    suite = { ...suite, modificateursActifs: [...suite.modificateursActifs, gros] };
  }
  const journal: EntreeJournal[] = [
    {
      annee: etat.annee,
      age: personnage.age,
      type: 'jeu',
      totalMise: jeu.totalMise,
      totalRecupere: jeu.totalRecupere,
    },
  ];
  return { etat: suite, mise, gain, journal };
}

function avecJeu(etat: EtatPartie, jeu: EtatJeu): EtatPartie {
  const { personnage } = etat;
  return {
    ...etat,
    personnage: { ...personnage, etats: { ...personnage.etats, jeu } },
  };
}

/** Effets directs d'un choix sur le jeu : jeu, budget, se refaire, interdiction volontaire. */
export function appliquerChoixJeu(etat: EtatPartie, effets: EffetsChoix): EtatPartie {
  if (
    effets.jeu === undefined &&
    effets.budget === undefined &&
    !effets.chasse &&
    !effets.interdiction
  ) {
    return etat;
  }
  const avant = etat.personnage.etats.jeu;
  return avecJeu(etat, {
    ...avant,
    jeu: effets.jeu ?? avant.jeu,
    budget: effets.budget ?? avant.budget,
    chasse: effets.chasse ?? avant.chasse,
    interdiction: effets.interdiction ?? avant.interdiction,
  });
}
