// Boucle annuelle. Ce jalon ne gère que le vieillissement, le test de mortalité
// et la fin de partie : pas d'événements, pas de choix, jauges figées.

import {
  AGE_MAXIMAL,
  FINANCES_INITIALES,
  JAUGES_INITIALES,
  deriveJaugesProvisoire,
  etatsInitiaux,
} from './constantes';
import { probabiliteFinale } from './cotes';
import { naitre } from './naissance';
import { sousGenerateur } from './rng';
import { chercherLigne, periodeDe } from './tables';
import type {
  ChoixJoueur,
  EntreeJournal,
  EtatPartie,
  Jauges,
  ResultatAnnee,
  Sexe,
  Tables,
} from './types';

export function creerPartie(graine: string, tables: Tables): EtatPartie {
  const { origine, traits, prenom } = naitre(graine, tables);
  return {
    graine,
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

export function jouerAnnee(
  etat: EtatPartie,
  _choix: ChoixJoueur | null,
  tables: Tables,
): ResultatAnnee {
  const { personnage } = etat;
  if (!personnage.vivant) throw new Error('La partie est terminee');

  const { age } = personnage;
  const { annee } = etat;

  // Étape 1 (revenus et dépenses) : jalon 4.
  // Étape 2 : test de mortalité, à l'âge vécu pendant l'année.
  const decede =
    age >= AGE_MAXIMAL ||
    sousGenerateur(etat.graine, age, 'mortalite')() <
      probabiliteDeces(age, personnage.origine.sexe, annee, tables);

  if (decede) {
    const journal: EntreeJournal[] = [{ annee, age, type: 'deces' }];
    return {
      etat: {
        ...etat,
        personnage: { ...personnage, vivant: false },
        historique: [...etat.historique, ...journal],
      },
      evenements: [],
      choixProposes: [],
      journal,
    };
  }

  // Étapes 3, 4 et 6 (événements, choix, journal) : jalon 3.
  // Étape 5 : jauges, avec une dérive provisoire liée à l'âge.
  // Étape 7 : vieillissement.
  return {
    etat: {
      ...etat,
      annee: annee + 1,
      personnage: { ...personnage, age: age + 1, jauges: deriverJauges(personnage.jauges, age) },
    },
    evenements: [],
    choixProposes: [],
    journal: [],
  };
}
