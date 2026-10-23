// Conditions sur le personnage : { champ: [valeurs acceptées] }, sur l'origine
// ou les états du joueur. Partagées par les événements et le contexte historique.

import type { ChampCondition, ConditionsPersonnage, Personnage } from './types';

/** Valeur d'un champ de condition : origine, ou états du joueur. */
function valeurChamp(personnage: Personnage, champ: ChampCondition): string {
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
    case 'endettement':
      return personnage.finances.endettement;
    default:
      return String(personnage.origine[champ]);
  }
}

export function remplitConditions(
  personnage: Personnage,
  conditions: ConditionsPersonnage,
): boolean {
  for (const champ in conditions) {
    const valeurs = conditions[champ as ChampCondition]!;
    if (!valeurs.includes(valeurChamp(personnage, champ as ChampCondition))) return false;
  }
  return true;
}
