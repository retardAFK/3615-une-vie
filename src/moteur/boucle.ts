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

  // 1. Vieillissement
  const age = personnage.age + 1;
  const annee = etat.annee + 1;

  // 3. Test de mortalité (l'étape 2, revenus et dépenses, viendra au jalon 4)
  const decede =
    age >= AGE_MAXIMAL ||
    sousGenerateur(etat.graine, age, 'mortalite')() <
      probabiliteDeces(age, personnage.origine.sexe, annee, tables);

  const journal: EntreeJournal[] = decede ? [{ annee, age, type: 'deces' }] : [];
  return {
    etat: {
      ...etat,
      annee,
      personnage: { ...personnage, age, vivant: !decede },
      historique: journal.length > 0 ? [...etat.historique, ...journal] : etat.historique,
    },
    evenements: [],
    choixProposes: [],
    journal,
  };
}
