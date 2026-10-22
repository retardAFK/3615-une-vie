// Boucle annuelle, en deux temps (règles, section 1) :
// ouvrirAnnee : mortalité, puis tirage des événements ;
// fermerAnnee : choix, effets, journal, vieillissement.

import {
  AGE_MAXIMAL,
  FINANCES_INITIALES,
  JAUGES_INITIALES,
  deriveJaugesProvisoire,
  etatsInitiaux,
} from './constantes';
import { probabiliteFinale } from './cotes';
import {
  appliquerEvenement,
  choisirAuto,
  choixRetenu,
  evenementParId,
  provoqueDeces,
  tirerEvenements,
} from './evenements';
import { naitre } from './naissance';
import { sousGenerateur } from './rng';
import { chercherLigne, periodeDe } from './tables';
import type {
  ChoixJoueur,
  Donnees,
  EntreeJournal,
  EtatPartie,
  Jauges,
  OptionsPartie,
  LigneMortalite,
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
    cooldowns: {},
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

const lignesMortalite = new WeakMap<Tables['mortalite'], Map<string, LigneMortalite>>();

/** Ligne de mortalité pour ce sexe et cette période, mise en cache (appelée chaque année). */
function ligneMortalite(tables: Tables, sexe: Sexe, periode: string): LigneMortalite {
  let cache = lignesMortalite.get(tables.mortalite);
  if (!cache) {
    cache = new Map();
    lignesMortalite.set(tables.mortalite, cache);
  }
  const cle = `${sexe}|${periode}`;
  let ligne = cache.get(cle);
  if (!ligne) {
    ligne = chercherLigne(tables.mortalite, { sexe, periode }, ['periode', 'sexe']);
    cache.set(cle, ligne);
  }
  return ligne;
}

/** Probabilité de décéder dans l'année, à cet âge, pour ce sexe et cette année. */
export function probabiliteDeces(age: number, sexe: Sexe, annee: number, tables: Tables): number {
  const ligne = ligneMortalite(tables, sexe, periodeDe(annee));
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
export function ouvrirAnnee(etat: EtatPartie, donnees: Donnees): ResultatOuverture {
  const { personnage } = etat;
  if (!personnage.vivant) throw new Error('La partie est terminee');
  if (etat.anneeEnCours) throw new Error('Une annee est deja ouverte');

  const meurt =
    personnage.age >= AGE_MAXIMAL ||
    sousGenerateur(etat.graine, personnage.age, 'mortalite')() <
      probabiliteDeces(personnage.age, personnage.origine.sexe, etat.annee, donnees.tables);
  if (meurt) {
    const { etat: final, journal } = deces(etat, 'mortalite', []);
    return { etat: final, evenements: [], choixProposes: [], journal };
  }

  const { retenus, reportes } = tirerEvenements(etat, donnees);
  return {
    etat: { ...etat, anneeEnCours: { evenements: retenus }, reportes },
    evenements: retenus,
    choixProposes: retenus
      .filter((e) => e.choix.length > 0)
      .map((e) => ({ evenementId: e.id, options: e.choix })),
    journal: [],
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

  let courant = etat;
  const journal: EntreeJournal[] = [];
  for (const tire of enCours.evenements) {
    const evenement = evenementParId(donnees.evenements, tire.id);
    const retenu = choixRetenu(evenement, choix);
    courant = appliquerEvenement(courant, evenement, retenu);
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
