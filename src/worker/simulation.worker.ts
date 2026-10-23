// Simulations hors du fil de l'interface (docs/architecture.md, Web Worker) : le bilan
// comparatif « mêmes choix, autre naissance » et les vies des enfants. Le moteur est
// importé tel quel ; les données arrivent avec la demande.

import { comparer } from '../moteur/bilan';
import type { Donnees, EtatPartie } from '../moteur/types';

export interface DemandeComparaison {
  id: number;
  etat: EtatPartie;
  donnees: Donnees;
}

export type ReponseComparaison =
  { id: number; comparaison: ReturnType<typeof comparer> } | { id: number; erreur: string };

// La configuration TypeScript du projet décrit le DOM : la portée du worker est typée ici.
const portee = self as unknown as {
  onmessage: ((message: MessageEvent<DemandeComparaison>) => void) | null;
  postMessage: (reponse: ReponseComparaison) => void;
};

portee.onmessage = (message) => {
  const { id, etat, donnees } = message.data;
  try {
    portee.postMessage({ id, comparaison: comparer(etat, donnees) });
  } catch (erreur) {
    portee.postMessage({ id, erreur: String(erreur) });
  }
};
