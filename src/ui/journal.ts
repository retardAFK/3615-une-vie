// Écran Journal (docs/design-minitel.md) : une ligne par entrée du journal de la vie,
// colorée selon sa nature (argent, jeu, choc), et découpée en pages.

import type { EntreeJournal, Evenement } from '../moteur/types';
import { minitel, montant } from './texte';

/** Couleur d'une ligne : la légende du journal (ARGENT, JEU, CHOC), ou neutre. */
export type CategorieJournal = 'argent' | 'jeu' | 'choc' | 'actualite' | 'neutre';

export interface LigneJournal {
  annee: number;
  age: number;
  texte: string;
  categorie: CategorieJournal;
}

const TAGS_JEU = new Set(['jeu', 'jeux_argent', 'jeu_cache']);
const TAGS_ARGENT = new Set(['argent', 'dettes', 'surendettement', 'aides', 'expulsion']);
const TAGS_CHOC = new Set(['deuil', 'violence', 'violences_conjugales', 'licenciement']);

function categorieEvenement(evenement: Evenement | undefined): CategorieJournal {
  if (!evenement) return 'neutre';
  const { tags } = evenement;
  if (tags.some((t) => TAGS_JEU.has(t))) return 'jeu';
  if (evenement.gravite === 3 || tags.some((t) => TAGS_CHOC.has(t))) return 'choc';
  if (tags.some((t) => TAGS_ARGENT.has(t))) return 'argent';
  return 'neutre';
}

/**
 * Lignes du journal, dans l'ordre de la vie. Les totaux de jeu (cumulés) deviennent la
 * mise et le gain de l'année ; le décès reprend sa cause quand ce n'est pas un événement.
 */
export function lignesJournal(
  historique: readonly EntreeJournal[],
  evenements: readonly Evenement[],
): LigneJournal[] {
  const parId = new Map(evenements.map((e) => [e.id, e]));
  const lignes: LigneJournal[] = [];
  let mise = 0;
  let recupere = 0;
  for (const entree of historique) {
    const { annee, age } = entree;
    switch (entree.type) {
      case 'naissance':
        lignes.push({ annee, age, texte: 'NAISSANCE.', categorie: 'neutre' });
        break;
      case 'deces':
        lignes.push({ annee, age, texte: 'FIN DE LA VIE.', categorie: 'choc' });
        break;
      case 'jeu': {
        const miseAnnee = (entree.totalMise ?? mise) - mise;
        const gainAnnee = (entree.totalRecupere ?? recupere) - recupere;
        mise = entree.totalMise ?? mise;
        recupere = entree.totalRecupere ?? recupere;
        if (miseAnnee > 0) {
          lignes.push({
            annee,
            age,
            texte: `JEU : MISE ${montant(miseAnnee, annee)}, GAIN ${montant(gainAnnee, annee)}.`,
            categorie: 'jeu',
          });
        }
        break;
      }
      case 'actualite':
        lignes.push({ annee, age, texte: minitel(entree.texte ?? ''), categorie: 'actualite' });
        break;
      case 'evenement':
        lignes.push({
          annee,
          age,
          texte: entree.texte ?? '',
          categorie: categorieEvenement(parId.get(entree.evenementId ?? '')),
        });
        break;
      default:
        if (entree.texte) {
          lignes.push({
            annee,
            age,
            texte: entree.texte,
            categorie: entree.type === 'argent' ? 'argent' : 'neutre',
          });
        }
    }
  }
  return lignes;
}

/** Lignes par page : l'écran mobile en montre une dizaine sans défiler. */
export const LIGNES_PAR_PAGE = 9;

export function nombreDePages(lignes: number): number {
  return Math.max(1, Math.ceil(lignes / LIGNES_PAR_PAGE));
}

/** Lignes de la page demandée (de 0 à nombreDePages - 1). */
export function page<T>(lignes: readonly T[], numero: number): readonly T[] {
  return lignes.slice(numero * LIGNES_PAR_PAGE, (numero + 1) * LIGNES_PAR_PAGE);
}
