// Partage d'une vie par son seed (docs/architecture.md, Stockage) : ?seed=7F3A21C9 dans
// l'adresse, avec l'année de naissance quand elle avait été imposée. Les anciens liens
// (?graine=...) restent lus.

import type { OptionsPartie } from '../moteur/types';
import { normaliserGraine } from './graine';

/** Adresse qui rejoue la graine (et l'année imposée) depuis la page donnée. */
export function lienDePartage(page: string, graine: string, options: OptionsPartie): string {
  const url = new URL(page);
  url.search = '';
  url.hash = '';
  url.searchParams.set('seed', graine);
  if (options.anneeNaissance !== undefined && !options.anneeLibre) {
    url.searchParams.set('annee', String(options.anneeNaissance));
  }
  return url.toString();
}

/** Graine et année lues dans l'adresse ; une graine invalide est ignorée. */
export function lireLien(recherche: string): { graine: string; annee: string } | null {
  const parametres = new URLSearchParams(recherche);
  const graine = normaliserGraine(parametres.get('seed') ?? parametres.get('graine') ?? '');
  if (!graine) return null;
  const annee = parametres.get('annee') ?? '';
  return { graine, annee: /^\d{4}$/.test(annee) ? annee : '' };
}
