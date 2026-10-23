// Remplissage des modèles de texte : variante choisie par sous-générateur,
// puis variables remplacées. Les textes restent au format Minitel.

import { entier, hachageSuffixe, sousGenerateurHache } from './rng';
import type { EtatPartie, Evenement, Libelles } from './types';

/**
 * Variables autorisées dans les textes d'événements ({e} : accord au féminin,
 * « NE{e} » → « NEE » ; {lieu} : « A LA CAMPAGNE », « DANS UNE GRANDE VILLE »...).
 */
export const VARIABLES_TEXTE = [
  'prenom',
  'age',
  'annee',
  'region',
  'territoire',
  'lieu',
  'e',
] as const;
/** Variables en plus pour les résumés de plusieurs années : âges de début et de fin. */
export const VARIABLES_RESUME = ['debut', 'fin'] as const;
/** Variable des récits d'argent : nom de l'aide, tel que la loi en vigueur la nomme. */
export const VARIABLES_ARGENT = ['aide'] as const;
/** Variable des récits d'addiction : nom du produit (libelles.produits). */
export const VARIABLES_ADDICTION = ['produit'] as const;
export type VariableTexte =
  | (typeof VARIABLES_TEXTE)[number]
  | (typeof VARIABLES_RESUME)[number]
  | (typeof VARIABLES_ARGENT)[number]
  | (typeof VARIABLES_ADDICTION)[number];

const MOTIF_VARIABLE = /\{([^{}]*)\}/g;

/** Majuscules sans accents : « Hélène, cœur » → « HELENE, COEUR ». */
export function minitel(texte: string): string {
  return texte
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/[’‘]/g, "'")
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

/** Noms des variables présentes dans un modèle. */
export function variablesDe(modele: string): string[] {
  return [...modele.matchAll(MOTIF_VARIABLE)].map((m) => m[1]!);
}

type Valeurs = Readonly<Partial<Record<VariableTexte, string | (() => string)>>>;

/** Remplit les variables ; une valeur peut être une fonction, appelée seulement si utilisée. */
export function remplir(modele: string, valeurs: Valeurs): string {
  return modele.replace(MOTIF_VARIABLE, (_, nom: string) => {
    const valeur = valeurs[nom as VariableTexte];
    if (valeur === undefined) throw new Error(`Variable de texte inconnue : {${nom}}`);
    return typeof valeur === 'function' ? valeur() : valeur;
  });
}

export function valeursRecit(
  etat: EtatPartie,
  libelles: Libelles,
): Record<(typeof VARIABLES_TEXTE)[number], () => string> {
  const { personnage } = etat;
  const { origine } = personnage;
  return {
    lieu: () => libelles.lieu?.[origine.territoire] ?? minitel(origine.territoire),
    prenom: () => minitel(personnage.prenom),
    age: () => String(personnage.age),
    annee: () => String(etat.annee),
    region: () => libelles.region?.[origine.region] ?? minitel(origine.region),
    territoire: () => libelles.territoire?.[origine.territoire] ?? minitel(origine.territoire),
    e: () => (origine.sexe === 'femme' ? 'E' : ''),
  };
}

/** Texte d'un événement pour l'année en cours : une variante tirée, puis remplie. */
export function rediger(evenement: Evenement, etat: EtatPartie, libelles: Libelles): string {
  const g = sousGenerateurHache(
    etat.graine,
    etat.personnage.age,
    hachageSuffixe(evenement.id, 'texte'),
  );
  const modele = evenement.textes[entier(g, 0, evenement.textes.length - 1)]!;
  if (!modele.includes('{')) return modele;
  const valeurs = valeursRecit(etat, libelles);
  return modele.replace(MOTIF_VARIABLE, (_, nom: string) => {
    const valeur = valeurs[nom as (typeof VARIABLES_TEXTE)[number]];
    if (valeur === undefined) throw new Error(`Variable de texte inconnue : {${nom}}`);
    return valeur();
  });
}

/** Résumé des années sans événement de la petite enfance (libelles.recits.petiteEnfance). */
export function resumerPetiteEnfance(
  etat: EtatPartie,
  debut: number,
  fin: number,
  libelles: Libelles,
): string {
  const modele = libelles.recits?.petiteEnfance ?? '{debut} A {fin} ANS : ENFANCE {lieu}.';
  return remplir(modele, {
    ...valeursRecit(etat, libelles),
    debut: String(debut),
    fin: String(fin),
  });
}
