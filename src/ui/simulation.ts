// Client du worker de simulation : le bilan comparatif se calcule hors du fil de
// l'interface. Sans worker (navigateur ancien), le calcul se fait sur place.

import { comparer, type Comparaison } from '../moteur/bilan';
import type { Donnees, EtatPartie } from '../moteur/types';
import type { DemandeComparaison, ReponseComparaison } from '../worker/simulation.worker';

let worker: Worker | null = null;
let prochainId = 0;
const enAttente = new Map<
  number,
  { resoudre: (c: Comparaison) => void; rejeter: (e: Error) => void }
>();

function demarrer(): Worker {
  const nouveau = new Worker(new URL('../worker/simulation.worker.ts', import.meta.url), {
    type: 'module',
  });
  nouveau.onmessage = (message: MessageEvent<ReponseComparaison>) => {
    const reponse = message.data;
    const attente = enAttente.get(reponse.id);
    if (!attente) return;
    enAttente.delete(reponse.id);
    if ('erreur' in reponse) attente.rejeter(new Error(reponse.erreur));
    else attente.resoudre(reponse.comparaison);
  };
  return nouveau;
}

/** « Mêmes choix, autre naissance » et vies des enfants d'une vie terminée. */
export function comparerVies(etat: EtatPartie, donnees: Donnees): Promise<Comparaison> {
  if (typeof Worker === 'undefined') {
    return new Promise((resoudre) => resoudre(comparer(etat, donnees)));
  }
  worker ??= demarrer();
  const id = prochainId++;
  const demande: DemandeComparaison = { id, etat, donnees };
  return new Promise((resoudre, rejeter) => {
    enAttente.set(id, { resoudre, rejeter });
    worker!.postMessage(demande);
  });
}
