// Boucle annuelle, en deux temps (règles, section 1) :
// ouvrirAnnee : revenus et bilan d'argent, mortalité, puis tirage des événements ;
// fermerAnnee : choix, effets, éducation et emploi, journal, vieillissement.

import {
  AGE_FIN_PETITE_ENFANCE,
  AGE_MAXIMAL,
  FINANCES_INITIALES,
  JAUGES_INITIALES,
  etatsInitiaux,
} from './constantes';
import {
  appliquerEvenement,
  rangDe,
  choisirAuto,
  choixRetenu,
  evenementParId,
  provoqueDeces,
  tirerEvenements,
} from './evenements';
import { depensesAddictions, evoluerAddictions } from './modules/addictions';
import { calculerAides } from './modules/aides';
import { bilanAnnuel, estAutonome, ouvrirPlan } from './modules/argent';
import { evoluerEducation } from './modules/education';
import { nouveautesDeLAnnee } from './modules/contexte';
import { changerEmploi, comptabiliserAnnee, evoluerEmploi } from './modules/emploi';
import { acheterLogement, demenager, depensesFamille, evoluerFamille } from './modules/famille';
import { appliquerChoixJeu, jouerAnnee } from './modules/jeux';
import {
  commencerMaladie,
  depensesSante,
  evoluerSante,
  probabiliteDecesPersonnage,
  vieillirJauges,
} from './modules/sante';
import { naitre } from './naissance';
import { resumerPetiteEnfance } from './recit';
import { tirage } from './rng';
import type {
  ChoixJoueur,
  Donnees,
  EntreeJournal,
  EtatPartie,
  OptionsPartie,
  ResultatFermeture,
  ResultatOuverture,
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
      etats: etatsInitiaux(origine),
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

  // Étape 1 : revenus de l'année (salaire, indemnités, pension), jeu, aides, puis bilan
  // d'argent avec les charges fixes (logement, enfants, crédit immobilier), les dépenses
  // des addictions et de santé, et les mises nettes des gains.
  const { tables } = donnees;
  const comptes: EtatPartie = {
    ...etatRecu,
    personnage: comptabiliserAnnee(etatRecu.personnage, etatRecu.annee, tables),
  };
  const jeu = jouerAnnee(comptes, donnees);
  const joueur = jeu.etat.personnage;
  const autonome = estAutonome(joueur);
  const depenses =
    (autonome ? depensesAddictions(joueur, tables) + depensesSante(joueur, tables) : 0) +
    jeu.mise -
    jeu.gain;
  const charges = autonome ? depensesFamille(joueur, comptes.annee, tables) : 0;
  const bilan = bilanAnnuel(jeu.etat, calculerAides(jeu.etat, donnees), donnees, depenses, charges);
  const etat: EtatPartie = { ...jeu.etat, personnage: bilan.personnage };
  const { personnage } = etat;

  const meurt =
    personnage.age >= AGE_MAXIMAL ||
    tirage(etat.graine, personnage.age, 'mortalite') <
      probabiliteDecesPersonnage(personnage, etat.annee, donnees.tables);
  if (meurt) {
    const { etat: final, journal } = deces(etat, 'mortalite', [...bilan.journal, ...jeu.journal]);
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
  if (jeu.journal.length > 0) actualites.push(...jeu.journal);
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
    if (retenu?.effets) courant = appliquerChoixJeu(courant, retenu.effets);
    if (retenu?.effets?.acheterLogement) courant = acheterLogement(courant, donnees);
    if (retenu?.effets?.demenager) courant = demenager(courant, donnees, evenement.id);
    if (evenement.effets.maladie) {
      const malade = commencerMaladie(courant.personnage, evenement.effets.maladie);
      if (malade !== courant.personnage) courant = { ...courant, personnage: malade };
    }
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
  // Étape 6 : addictions (exposition, escalade, sevrage, rechute) et leurs effets.
  const addictions = evoluerAddictions(courant, donnees);
  courant = addictions.etat;
  if (addictions.journal.length > 0) journal.push(...addictions.journal);
  // Étape 6 (suite) : santé (effets et guérison des maladies).
  const sante = evoluerSante(courant, donnees);
  courant = sante.etat;
  if (sante.journal.length > 0) journal.push(...sante.journal);
  // Étape 7 : famille et logement (parents, couple, enfants, logement, crédit).
  const famille = evoluerFamille(courant, donnees);
  courant = famille.etat;
  if (famille.journal.length > 0) journal.push(...famille.journal);

  const { personnage } = courant;
  const age = personnage.age + 1;
  return {
    etat: {
      ...courant,
      annee: courant.annee + 1,
      personnage: {
        ...personnage,
        age,
        jauges: vieillirJauges(
          personnage.jauges,
          personnage.age,
          personnage.traits,
          donnees.tables,
        ),
      },
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
