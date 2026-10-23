// Module emploi et revenus (règles, section 6) : entrée sur le marché du travail,
// transitions annuelles, salaire, chômage, retraite à l'âge légal de la génération.

import { distributionCorrigee } from '../cotes';
import { multiplicateursTag } from '../evenements';
import {
  hachageSuffixe,
  normaleBornee,
  sousGenerateur,
  sousGenerateurHache,
  tirerPondere,
} from '../rng';
import { chercherLigne, parametre, periodeDe, valeurSimple } from '../tables';
import type {
  DiplomeJoueur,
  Donnees,
  Emploi,
  EtatPartie,
  Pcs,
  Personnage,
  Tables,
  Travail,
} from '../types';

/** États où l'on touche un salaire. */
export const EMPLOIS_SALARIES: readonly Emploi[] = [
  'cdi',
  'cdd',
  'interim',
  'independant',
  'fonctionnaire',
];

/** Tags que les choix ou le contexte peuvent viser : une transition vers chaque état. */
export const TAGS_EMPLOI = [
  'emploi_cdi',
  'emploi_cdd',
  'emploi_interim',
  'emploi_independant',
  'emploi_fonctionnaire',
  'emploi_chomage',
  'emploi_inactif',
  'emploi_arret_longue_maladie',
] as const;

/** Nombre de meilleures années retenues pour la pension. */
const MEILLEURES_ANNEES = 25;

export const estSalarie = (emploi: Emploi): boolean => EMPLOIS_SALARIES.includes(emploi);

export function niveau(diplome: DiplomeJoueur): 'bas' | 'moyen' | 'haut' {
  if (diplome === 'aucun' || diplome === 'cap_bep') return 'bas';
  if (diplome === 'bac_2_3' || diplome === 'bac_5') return 'haut';
  return 'moyen';
}

function trancheAge(age: number): 'jeune' | 'milieu' | 'senior' {
  return age < 30 ? 'jeune' : age < 50 ? 'milieu' : 'senior';
}

function avecTravail(
  personnage: Personnage,
  travail: Partial<Travail>,
  emploi?: Emploi,
): Personnage {
  return {
    ...personnage,
    etats: {
      ...personnage.etats,
      ...(emploi ? { emploi } : {}),
      travail: { ...personnage.etats.travail, ...travail },
    },
  };
}

/** Âge légal de départ de la génération (années, mois ignorés). */
export function ageRetraite(tables: Tables, anneeNaissance: number): number {
  return parametre(tables.ageLegalRetraite, 'ans', { generation: String(anneeNaissance) });
}

/**
 * Salaire annuel net : grille (salaire de référence de la période × PCS × diplôme
 * × région) × ancienneté × (1 − écart femmes-hommes) × quotité × bruit × progression,
 * puis part de l'année travaillée (CDD, intérim).
 */
export function salaireAnnuel(personnage: Personnage, annee: number, tables: Tables): number {
  const { travail, education, emploi } = personnage.etats;
  const { origine } = personnage;
  const grille =
    valeurSimple(tables.salaireReference, 'periode', periodeDe(annee)) *
    valeurSimple(tables.coefficientPcs, 'pcs', travail.pcs ?? 'employe') *
    valeurSimple(tables.coefficientDiplome, 'diplome', education.diplome) *
    valeurSimple(tables.coefficientRegion, 'region', personnage.etats.residence.region);
  const courbe = chercherLigne(tables.courbeAnciennete, {}, []).parAnnee;
  const anciennete = courbe[Math.min(travail.anciennete, courbe.length - 1)] ?? 1;
  const ecart = origine.sexe === 'femme' ? parametre(tables.parametresEmploi, 'ecartSexe') : 0;
  const part =
    emploi === 'cdd'
      ? parametre(tables.parametresEmploi, 'partAnneeCdd')
      : emploi === 'interim'
        ? parametre(tables.parametresEmploi, 'partAnneeInterim')
        : 1;
  return Math.round(
    grille *
      anciennete *
      (1 - ecart) *
      travail.quotite *
      travail.bruit *
      travail.progression *
      part,
  );
}

/** Garde les meilleures années, de la plus haute à la plus basse. */
function retenirMeilleures(meilleures: readonly number[], salaire: number): number[] {
  if (meilleures.length >= MEILLEURES_ANNEES && salaire <= meilleures.at(-1)!) {
    return meilleures as number[];
  }
  // Insertion à sa place dans la liste déjà triée.
  const liste = meilleures.slice(0, MEILLEURES_ANNEES - 1);
  let rang = liste.findIndex((s) => s < salaire);
  if (rang === -1) rang = liste.length;
  liste.splice(rang, 0, salaire);
  return liste;
}

/**
 * Étape 1 du tour : revenu de l'année selon l'état d'emploi (salaire, indemnités,
 * pension), ancienneté et trimestres validés.
 */
export function comptabiliserAnnee(
  personnage: Personnage,
  annee: number,
  tables: Tables,
): Personnage {
  const { emploi, travail } = personnage.etats;
  const params = tables.parametresEmploi;
  let revenu = 0;
  let suite: Partial<Travail> = {};
  if (estSalarie(emploi)) {
    revenu = salaireAnnuel(personnage, annee, tables);
    suite = {
      salaire: revenu,
      dernierSalaire: revenu,
      anciennete: travail.anciennete + 1,
      trimestres: travail.trimestres + 4,
      meilleursSalaires: retenirMeilleures(travail.meilleursSalaires, revenu),
      dureeChomage: 0,
    };
  } else if (emploi === 'chomage') {
    const indemnise = travail.dureeChomage < parametre(params, 'dureeIndemnisation');
    revenu = indemnise
      ? Math.round(parametre(params, 'tauxIndemnisation') * travail.dernierSalaire)
      : 0;
    suite = {
      salaire: 0,
      dureeChomage: travail.dureeChomage + 1,
      trimestres: travail.trimestres + (indemnise && travail.dernierSalaire > 0 ? 4 : 0),
    };
  } else if (emploi === 'arret_longue_maladie') {
    revenu = Math.round(parametre(params, 'tauxArret') * travail.dernierSalaire);
    suite = { salaire: 0, trimestres: travail.trimestres + 4 };
  } else if (emploi === 'retraite') {
    revenu = travail.pension;
  }
  const avecSuite = avecTravail(personnage, suite);
  return { ...avecSuite, finances: { ...avecSuite.finances, revenuAnnuel: revenu } };
}

/** Nouvel emploi : quotité et bruit tirés une fois pour cet emploi. */
export function nouvelEmploi(
  etat: EtatPartie,
  personnage: Personnage,
  emploi: Emploi,
  tables: Tables,
  idTirage: string,
): Personnage {
  const g = sousGenerateurHache(
    etat.graine,
    etat.personnage.age,
    hachageSuffixe('emploi', idTirage),
  );
  const { distribution } = chercherLigne(tables.quotite, { sexe: personnage.origine.sexe }, [
    'sexe',
  ]);
  const quotite = Number(tirerPondere(g, distribution));
  const sigma = parametre(tables.parametresEmploi, 'sigmaBruit');
  const bruit = Math.exp(normaleBornee(g, 0, sigma, -3 * sigma, 3 * sigma));
  return avecTravail(personnage, { quotite, bruit }, emploi);
}

/** Un casier judiciaire rend l'embauche moins probable (règles, section 14). */
function effetCasier(personnage: Personnage, issue: string, tables: Tables): number[] {
  if (!personnage.etats.justice.casier || !estSalarie(issue as Emploi)) return [];
  return [parametre(tables.parametresEmploi, 'effetCasierEmbauche')];
}

/** Sortie des études : métier (PCS) tiré, puis premier état sur le marché du travail. */
function entrerSurLeMarche(etat: EtatPartie, personnage: Personnage, donnees: Donnees): Personnage {
  const { tables } = donnees;
  const { diplome } = personnage.etats.education;
  const g = sousGenerateur(etat.graine, etat.personnage.age, 'emploi.entree');
  const lignePcs = chercherLigne(
    tables.pcsJoueur,
    { diplome, pcsParents: personnage.origine.pcsParents },
    ['pcsParents', 'diplome'],
  );
  const pcs = tirerPondere(g, lignePcs.distribution) as Pcs;
  const avecPcs = avecTravail(personnage, { pcs });
  if (pcs === 'artisan_commercant' || pcs === 'agriculteur') {
    return nouvelEmploi(etat, avecPcs, 'independant', tables, 'premier');
  }
  const ligne = chercherLigne(
    tables.insertion,
    { niveau: niveau(diplome), periode: periodeDe(etat.annee + 1) },
    ['periode', 'niveau'],
  );
  const premier = tirerPondere(
    g,
    distributionCorrigee(ligne.distribution, (issue) => effetCasier(personnage, issue, tables)),
  ) as Emploi;
  return estSalarie(premier)
    ? nouvelEmploi(etat, avecPcs, premier, tables, 'premier')
    : avecTravail(avecPcs, {}, premier);
}

/** Départ à la retraite : pension sur les meilleures années, au prorata des trimestres. */
function partirALaRetraite(personnage: Personnage, tables: Tables): Personnage {
  const { travail } = personnage.etats;
  const params = tables.parametresEmploi;
  const meilleures = travail.meilleursSalaires;
  const moyenne = meilleures.length ? meilleures.reduce((a, b) => a + b, 0) / meilleures.length : 0;
  const prorata = Math.min(1, travail.trimestres / parametre(params, 'trimestresRequis'));
  const pension = Math.round(parametre(params, 'tauxPension') * moyenne * prorata);
  return avecTravail(personnage, { pension, salaire: 0, ageRetraite: personnage.age }, 'retraite');
}

/** Transition annuelle d'état d'emploi (matrice selon l'état, l'âge et le niveau). */
function transition(etat: EtatPartie, personnage: Personnage, donnees: Donnees): Personnage {
  const { tables } = donnees;
  const { emploi, education } = personnage.etats;
  const suivant = personnage.age + 1;
  const { distribution } = chercherLigne(
    tables.transitionsEmploi,
    { emploi, trancheAge: trancheAge(suivant), niveau: niveau(education.diplome) },
    ['trancheAge', 'niveau'],
  );
  const corrigee = distributionCorrigee(distribution, (issue) => [
    ...multiplicateursTag(etat, `emploi_${issue}`, suivant, donnees),
    ...effetCasier(personnage, issue, tables),
  ]);
  const g = sousGenerateur(etat.graine, personnage.age, 'emploi.transition');
  const prochain = tirerPondere(g, corrigee) as Emploi;
  if (prochain === emploi) return personnage;
  // Changement de contrat chez le même employeur (CDD → CDI...) : même salaire.
  if (estSalarie(prochain) && estSalarie(emploi)) return avecTravail(personnage, {}, prochain);
  if (estSalarie(prochain)) return nouvelEmploi(etat, personnage, prochain, tables, 'reprise');
  return avecTravail(personnage, { dureeChomage: 0, salaire: 0 }, prochain);
}

/**
 * Étape « états » : entrée sur le marché du travail à la sortie des études,
 * retraite à l'âge légal, sinon transition annuelle. Un état changé cette année
 * par un événement (licenciement, arrêt...) n'est pas retransformé.
 */
export function evoluerEmploi(
  etat: EtatPartie,
  personnage: Personnage,
  emploiAvant: Emploi,
  donnees: Donnees,
): Personnage {
  const { tables } = donnees;
  const { scolarite, emploi, travail } = personnage.etats;
  if (emploi === 'retraite') return personnage;
  if (personnage.age + 1 > ageRetraite(tables, personnage.origine.anneeNaissance)) {
    return partirALaRetraite(personnage, tables);
  }
  if (scolarite !== 'sortie') return personnage;
  if (travail.pcs === null) return entrerSurLeMarche(etat, personnage, donnees);
  if (emploi !== emploiAvant) {
    // Perte d'emploi par un événement : l'épisode de chômage commence.
    return estSalarie(emploi) ? personnage : avecTravail(personnage, { dureeChomage: 0 });
  }
  return transition(etat, personnage, donnees);
}

/** Accepter une offre extérieure : nouvel emploi en CDI, nouveau bruit et hausse. */
export function changerEmploi(etat: EtatPartie, donnees: Donnees, idTirage: string): EtatPartie {
  const { tables } = donnees;
  const personnage = nouvelEmploi(etat, etat.personnage, 'cdi', tables, idTirage);
  const hausse = parametre(tables.parametresEmploi, 'hausseChangementEmploi');
  const { progression } = personnage.etats.travail;
  return { ...etat, personnage: avecTravail(personnage, { progression: progression * hausse }) };
}
