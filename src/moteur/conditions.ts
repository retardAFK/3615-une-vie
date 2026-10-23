// Conditions sur le personnage : { champ: [valeurs acceptées] }, sur l'origine
// ou les états du joueur. Partagées par les événements et le contexte historique.

import type { ChampCondition, ConditionsPersonnage, Personnage } from './types';

/** Valeur d'un champ de condition : origine, ou états du joueur. */
export function valeurChamp(personnage: Personnage, champ: ChampCondition): string {
  const { etats } = personnage;
  switch (champ) {
    case 'emploi':
      return etats.emploi;
    case 'scolarite':
      return etats.scolarite;
    case 'diplome':
      return etats.education.diplome;
    case 'pcs':
      return etats.travail.pcs ?? '';
    case 'justice':
      return etats.justice.casier
        ? 'casier'
        : etats.justice.gardesAVue > 0
          ? 'garde_a_vue'
          : 'aucun';
    case 'logement':
      return etats.logement;
    case 'couple':
      return etats.couple;
    case 'enfants':
      return etats.famille.enfants.length === 0
        ? 'aucun'
        : etats.famille.enfants.length === 1
          ? 'un'
          : 'plusieurs';
    case 'achatPossible':
      return etats.famille.achatPossible ? 'oui' : 'non';
    case 'endettement':
      return personnage.finances.endettement;
    case 'tabac':
    case 'alcool':
    case 'cannabis':
    case 'autres_drogues':
    case 'jeux_argent':
    case 'ecrans':
      return etats.addictions[champ];
    case 'pertesJeu':
      return etats.jeu.pertesElevees ? 'elevees' : 'normales';
    case 'budgetJeu':
      return etats.jeu.budget;
    case 'chronique':
    case 'cancer':
    case 'cardiovasculaire':
    case 'depression':
    case 'demence':
      return etats.maladies.includes(champ) ? 'oui' : 'non';
    default:
      return String(personnage.origine[champ]);
  }
}

// Les mêmes conditions sont testées chaque année : chacune est compilée une fois en
// une liste (champ, valeurs acceptées), sans parcourir l'objet à chaque appel.
const compilees = new WeakMap<ConditionsPersonnage, [ChampCondition, readonly string[]][]>();

export function remplitConditions(
  personnage: Personnage,
  conditions: ConditionsPersonnage,
): boolean {
  let liste = compilees.get(conditions);
  if (!liste) {
    liste = Object.entries(conditions) as [ChampCondition, readonly string[]][];
    compilees.set(conditions, liste);
  }
  for (let i = 0; i < liste.length; i++) {
    const [champ, valeurs] = liste[i]!;
    if (!valeurs.includes(valeurChamp(personnage, champ))) return false;
  }
  return true;
}
