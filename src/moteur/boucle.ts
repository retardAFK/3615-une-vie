// Boucle annuelle, en deux temps (règles, section 1) :
// ouvrirAnnee : revenus et bilan d'argent, mortalité, puis tirage des événements ;
// fermerAnnee : choix, effets, éducation et emploi, journal, vieillissement.

import {
  AGE_FIN_PETITE_ENFANCE,
  AGE_MAXIMAL,
  FINANCES_INITIALES,
  JAUGES_INITIALES,
  deriveJaugesProvisoire,
  etatsInitiaux,
} from './constantes';
import { probabiliteFinale } from './cotes';
import {
  appliquerEvenement,
  rangDe,
  choisirAuto,
  choixRetenu,
  evenementParId,
  provoqueDeces,
  tirerEvenements,
} from './evenements';
import { calculerAides } from './modules/aides';
import { bilanAnnuel, ouvrirPlan } from './modules/argent';
import { evoluerEducation } from './modules/education';
import { nouveautesDeLAnnee } from './modules/contexte';
import { changerEmploi, comptabiliserAnnee, evoluerEmploi } from './modules/emploi';
import { naitre } from './naissance';
import { resumerPetiteEnfance } from './recit';
import { tirage } from './rng';
import { chercherLigne, periodeDe } from './tables';
import type {
  ChoixJoueur,
  Donnees,
  EntreeJournal,
  EtatPartie,
  Jauges,
  OptionsPartie,
  ResultatFermeture,
  ResultatOuverture,
  Sexe,
  Tables,
} from './types';

export function creerPartie(
  graine: string,
  donnees: Donnees,
  options: OptionsPartie = {},
): EtatPartie {
  const { origine, traits, prenom } = naitre(graine, donnees.tables, options);
  return {
    graine,
    options: { ...options },
    annee: origine.anneeNaissance,
    personnage: {
      prenom,
      origine,
      traits,
      jauges: { ...JAUGES_INITIALES },
      finances: { ...FINANCES_INITIALES },
      etats: etatsInitiaux(),
      age: 0,
      vivant: true,
    },
    historique: [{ annee: origine.anneeNaissance, age: 0, type: 'naissance' }],
    cooldowns: [],
    modificateursActifs: [],
    anneeEnCours: null,
    reportes: [],
  };
}

const borner = (valeur: number): number => Math.min(100, Math.max(0, valeur));

/** Applique la dérive provisoire liée à l'âge ; bienEtre est la moyenne des autres jauges. */
export function deriverJauges(jauges: Jauges, age: number): Jauges {
  const derive = deriveJaugesProvisoire(age);
  const santePhysique = borner(jauges.santePhysique + derive.santePhysique);
  const santeMentale = borner(jauges.santeMentale + derive.santeMentale);
  const liens = borner(jauges.liens + derive.liens);
  const competences = borner(jauges.competences + derive.competences);
  const bienEtre = (santePhysique + santeMentale + liens + competences) / 4;
  return { santePhysique, santeMentale, bienEtre, liens, competences };
}

/** Probabilité de décéder dans l'année, à cet âge, pour ce sexe et cette année. */
export function probabiliteDeces(age: number, sexe: Sexe, annee: number, tables: Tables): number {
  const ligne = chercherLigne(tables.mortalite, { sexe, periode: periodeDe(annee) }, [
    'periode',
    'sexe',
  ]);
  const q = ligne.qParAge[Math.min(age, ligne.qParAge.length - 1)];
  if (q === undefined) throw new Error(`Table mortalite : aucune valeur pour ${age} ans`);
  return probabiliteFinale(q, []);
}

function deces(etat: EtatPartie, cause: string, journal: EntreeJournal[]): ResultatFermeture {
  const entree: EntreeJournal = {
    annee: etat.annee,
    age: etat.personnage.age,
    type: 'deces',
    cause,
  };
  return {
    etat: {
      ...etat,
      personnage: { ...etat.personnage, vivant: false },
      historique: [...etat.historique, ...journal, entree],
      anneeEnCours: null,
    },
    journal: [...journal, entree],
  };
}

/** Étapes 1 à 3 : (revenus, jalon 4), test de mortalité à l'âge vécu, tirage des événements. */
export function ouvrirAnnee(etatRecu: EtatPartie, donnees: Donnees): ResultatOuverture {
  if (!etatRecu.personnage.vivant) throw new Error('La partie est terminee');
  if (etatRecu.anneeEnCours) throw new Error('Une annee est deja ouverte');

  // Étape 1 : revenus de l'année (salaire, indemnités, pension), aides, puis bilan d'argent.
  const { tables } = donnees;
  const comptes: EtatPartie = {
    ...etatRecu,
    personnage: comptabiliserAnnee(etatRecu.personnage, etatRecu.annee, tables),
  };
  const bilan = bilanAnnuel(comptes, calculerAides(comptes, donnees), donnees);
  const etat: EtatPartie = { ...comptes, personnage: bilan.personnage };
  const { personnage } = etat;

  const meurt =
    personnage.age >= AGE_MAXIMAL ||
    tirage(etat.graine, personnage.age, 'mortalite') <
      probabiliteDeces(personnage.age, personnage.origine.sexe, etat.annee, donnees.tables);
  if (meurt) {
    const { etat: final, journal } = deces(etat, 'mortalite', bilan.journal);
    return { etat: final, evenements: [], choixProposes: [], journal };
  }

  const { retenus, reportes } = tirerEvenements(etat, donnees);
  // Contexte historique : chaque entrée qui commence cette année entre au journal,
  // puis les nouvelles de l'argent (aides, dettes).
  const actualites: EntreeJournal[] = nouveautesDeLAnnee(donnees.contexte, etat.annee).map(
    (entree) => ({
      annee: etat.annee,
      age: personnage.age,
      type: 'actualite',
      texte: entree.titre,
      contexteId: entree.id,
    }),
  );
  if (bilan.journal.length > 0) actualites.push(...bilan.journal);
  return {
    etat: {
      ...etat,
      anneeEnCours: { evenements: retenus },
      reportes,
      historique: actualites.length > 0 ? [...etat.historique, ...actualites] : etat.historique,
    },
    evenements: retenus,
    choixProposes: retenus
      .filter((e) => e.choix.length > 0)
      .map((e) => ({ evenementId: e.id, options: e.choix })),
    journal: actualites,
  };
}

/** Étapes 4 à 7 : choix, effets (décès possible), journal, vieillissement. */
export function fermerAnnee(
  etat: EtatPartie,
  choix: readonly ChoixJoueur[],
  donnees: Donnees,
): ResultatFermeture {
  const enCours = etat.anneeEnCours;
  if (!enCours) throw new Error('Aucune annee ouverte');

  const emploiAvant = etat.personnage.etats.emploi;
  let courant = etat;
  const journal: EntreeJournal[] = [];
  for (const tire of enCours.evenements) {
    const evenement = evenementParId(donnees.evenements, tire.id);
    const retenu = choixRetenu(evenement, choix);
    courant = appliquerEvenement(courant, evenement, retenu, rangDe(donnees.evenements, evenement));
    // Opportunité acceptée (offre extérieure) : seule exception aux choix sans résultat direct.
    if (retenu?.effets?.changerEmploi) courant = changerEmploi(courant, donnees, evenement.id);
    if (evenement.effets.surendettement) {
      const { personnage } = courant;
      courant = {
        ...courant,
        personnage: { ...personnage, finances: ouvrirPlan(personnage.finances, donnees.tables) },
      };
    }
    journal.push({
      annee: courant.annee,
      age: courant.personnage.age,
      type: 'evenement',
      texte: retenu?.journal ? `${tire.texte} ${retenu.journal}` : tire.texte,
      evenementId: evenement.id,
      ...(retenu ? { choixId: retenu.id } : {}),
    });
    if (provoqueDeces(courant, evenement)) return deces(courant, evenement.id, journal);
  }

  // Étape 5 : éducation, puis emploi (entrée sur le marché, transitions, retraite).
  const eduque = evoluerEducation(courant, donnees);
  courant = { ...courant, personnage: evoluerEmploi(courant, eduque, emploiAvant, donnees) };

  const { personnage } = courant;
  const age = personnage.age + 1;
  return {
    etat: {
      ...courant,
      annee: courant.annee + 1,
      personnage: { ...personnage, age, jauges: deriverJauges(personnage.jauges, personnage.age) },
      historique: journal.length > 0 ? [...courant.historique, ...journal] : courant.historique,
      // Les modificateurs dont la dernière année d'effet est passée expirent.
      modificateursActifs: courant.modificateursActifs.some((m) => m.fin !== null && m.fin < age)
        ? courant.modificateursActifs.filter((m) => m.fin === null || m.fin >= age)
        : courant.modificateursActifs,
      anneeEnCours: null,
    },
    journal,
  };
}

/** Une année complète, les choix faits par choisirAuto (mode AUTO, worker, tests). */
export function jouerAnneeAuto(etat: EtatPartie, donnees: Donnees): ResultatFermeture {
  const ouverture = ouvrirAnnee(etat, donnees);
  if (!ouverture.etat.personnage.vivant) {
    return { etat: ouverture.etat, journal: ouverture.journal };
  }
  const choix = ouverture.evenements
    .filter((e) => e.choix.length > 0)
    .map((e) => choisirAuto(ouverture.etat, e, donnees));
  return fermerAnnee(ouverture.etat, choix, donnees);
}

export { choisirAuto };

/**
 * Petite enfance accélérée (hors mode AUTO) : avant AGE_FIN_PETITE_ENFANCE, les années
 * sans événement s'enchaînent sans arrêt et se résument en une ligne de journal.
 * S'arrête à la première année qui a un événement (ou au décès, ou à l'âge de fin),
 * et renvoie cette année ouverte, comme ouvrirAnnee.
 */
export function avancerPetiteEnfance(etat: EtatPartie, donnees: Donnees): ResultatOuverture {
  const debut = etat.personnage.age;
  let courant = etat;
  let ouverture = ouvrirAnnee(courant, donnees);
  while (
    ouverture.etat.personnage.vivant &&
    ouverture.evenements.length === 0 &&
    courant.personnage.age < AGE_FIN_PETITE_ENFANCE
  ) {
    courant = fermerAnnee(ouverture.etat, [], donnees).etat;
    ouverture = ouvrirAnnee(courant, donnees);
  }
  // Années passées sans arrêt : de l'âge de départ à l'année avant l'arrêt.
  const fin = courant.personnage.age - 1;
  if (fin < debut) return ouverture;
  const resume: EntreeJournal = {
    annee: courant.annee - 1,
    age: fin,
    type: 'resume',
    texte: resumerPetiteEnfance(courant, debut, fin, donnees.libelles),
  };
  // Le résumé précède les entrées de l'année d'arrêt (un décès, par exemple).
  const historique = [...courant.historique, resume, ...ouverture.journal];
  return {
    ...ouverture,
    etat: { ...ouverture.etat, historique },
  };
}
