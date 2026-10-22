// Boucle annuelle. Ce jalon ne gère que le vieillissement, le test de mortalité
// et la fin de partie : pas d'événements, pas de choix, jauges figées.

import { AGE_MAXIMAL, FINANCES_INITIALES, JAUGES_INITIALES, etatsInitiaux } from './constantes';
import { probabiliteFinale } from './cotes';
import { naitre } from './naissance';
import { sousGenerateur } from './rng';
import { chercherLigne, periodeDe } from './tables';
import type { ChoixJoueur, EntreeJournal, EtatPartie, ResultatAnnee, Sexe, Tables } from './types';

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

  // Étapes 3 à 6 (événements, choix, jauges, journal) : jalon 3.
  // Étape 7 : vieillissement.
  return {
    etat: {
      ...etat,
      annee: annee + 1,
      personnage: { ...personnage, age: age + 1 },
    },
    evenements: [],
    choixProposes: [],
    journal: [],
  };
}
