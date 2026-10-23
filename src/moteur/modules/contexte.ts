// Contexte historique (règles, section 12 ; jalon 4c) : actualités, crises, lois et
// mouvements sociaux datés et sourcés, de contenu/contexte/. Une crise module les
// tirages par tag, selon le profil ; une loi fixe des règles à sa date d'entrée en vigueur.

import { remplitConditions } from '../conditions';
import type { Donnees, EntreeContexte, Personnage, RegleConnue, ValeurRegle } from '../types';

/** Années couvertes par l'index (au-delà, aucun contexte). */
const PREMIERE_ANNEE = 1940;
const DERNIERE_ANNEE = 2130;

const actives = new WeakMap<readonly EntreeContexte[], EntreeContexte[][]>();
const nouvelles = new WeakMap<readonly EntreeContexte[], EntreeContexte[][]>();

function indexer(contexte: readonly EntreeContexte[]): void {
  const parAnnee: EntreeContexte[][] = [];
  const parDebut: EntreeContexte[][] = [];
  for (let a = PREMIERE_ANNEE; a <= DERNIERE_ANNEE; a++) {
    parAnnee.push([]);
    parDebut.push([]);
  }
  for (const entree of contexte) {
    const debut = Math.max(entree.debut, PREMIERE_ANNEE);
    const fin = Math.min(entree.fin, DERNIERE_ANNEE);
    for (let a = debut; a <= fin; a++) parAnnee[a - PREMIERE_ANNEE]!.push(entree);
    if (entree.debut >= PREMIERE_ANNEE && entree.debut <= DERNIERE_ANNEE) {
      parDebut[entree.debut - PREMIERE_ANNEE]!.push(entree);
    }
  }
  actives.set(contexte, parAnnee);
  nouvelles.set(contexte, parDebut);
}

const AUCUNE: readonly EntreeContexte[] = [];

/** Entrées en cours pendant une année calendaire. */
export function contexteActif(
  contexte: readonly EntreeContexte[],
  annee: number,
): readonly EntreeContexte[] {
  if (!actives.has(contexte)) indexer(contexte);
  return actives.get(contexte)![annee - PREMIERE_ANNEE] ?? AUCUNE;
}

/** Entrées qui commencent pendant une année calendaire (bandeau FLASH INFO, journal). */
export function nouveautesDeLAnnee(
  contexte: readonly EntreeContexte[],
  annee: number,
): readonly EntreeContexte[] {
  if (!nouvelles.has(contexte)) indexer(contexte);
  return nouvelles.get(contexte)![annee - PREMIERE_ANNEE] ?? AUCUNE;
}

/**
 * Produit des multiplicateurs de l'année pour ce tag : seulement les entrées qui
 * visent ce tag et dont le profil correspond au personnage. 1 sans contexte.
 */
export function multiplicateurContexte(
  donnees: Donnees,
  personnage: Personnage,
  annee: number,
  tag: string,
): number {
  let m = 1;
  for (const entree of contexteActif(donnees.contexte, annee)) {
    const facteur = entree.multiplicateurs?.[tag];
    if (facteur === undefined) continue;
    if (entree.profil && !remplitConditions(personnage, entree.profil)) continue;
    m *= facteur;
  }
  return m;
}

/** Tags visés par au moins une entrée du contexte (dépendance à l'année). */
const tagsVises = new WeakMap<readonly EntreeContexte[], Set<string>>();

export function tagsDuContexte(contexte: readonly EntreeContexte[]): ReadonlySet<string> {
  let tags = tagsVises.get(contexte);
  if (!tags) {
    tags = new Set(contexte.flatMap((e) => Object.keys(e.multiplicateurs ?? {})));
    tagsVises.set(contexte, tags);
  }
  return tags;
}

const regles = new WeakMap<
  readonly EntreeContexte[],
  Map<RegleConnue, (ValeurRegle | undefined)[]>
>();

/**
 * Règle en vigueur une année : celle de la loi la plus récente qui la fixe.
 * Valeurs indexées par année au premier appel (plusieurs règles lues chaque année).
 */
export function regleEnVigueur(
  contexte: readonly EntreeContexte[],
  annee: number,
  cle: RegleConnue,
): ValeurRegle | undefined {
  let parCle = regles.get(contexte);
  if (!parCle) {
    parCle = new Map();
    regles.set(contexte, parCle);
  }
  let parAnnee = parCle.get(cle);
  if (!parAnnee) {
    parAnnee = [];
    for (let a = PREMIERE_ANNEE; a <= DERNIERE_ANNEE; a++) {
      let valeur: ValeurRegle | undefined;
      let depuis = -Infinity;
      for (const entree of contexte) {
        const regle = entree.regles?.[cle];
        if (regle === undefined || entree.debut > a || entree.debut < depuis) continue;
        valeur = regle;
        depuis = entree.debut;
      }
      parAnnee.push(valeur);
    }
    parCle.set(cle, parAnnee);
  }
  const borne = Math.min(Math.max(annee, PREMIERE_ANNEE), DERNIERE_ANNEE);
  return parAnnee[borne - PREMIERE_ANNEE];
}
