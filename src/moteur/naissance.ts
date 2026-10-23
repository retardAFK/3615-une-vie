// Tirage à la naissance : origine dans l'ordre de la section 3 des règles,
// puis traits et prénom. Tous les tirages se font à l'âge 0.

import { TRAITS_ECART_TYPE, TRAITS_MAX, TRAITS_MIN, TRAITS_MOYENNE } from './constantes';
import { normaleBornee, sousGenerateur, tirerPondere } from './rng';
import { chercherLigne, periodeDe } from './tables';
import {
  DECILES,
  DIPLOMES,
  FRATRIES,
  LOGEMENTS_FAMILIAUX,
  NOMS_TRAITS,
  ORIGINES_MIGRATOIRES,
  PCS,
  REGIONS,
  SANTES_NAISSANCE,
  SEXES,
  STRUCTURES_FAMILIALES,
  TERRITOIRES,
  type Conditions,
  type Decile,
  type OptionsPartie,
  type Origine,
  type Tables,
  type Traits,
} from './types';

type ChampOrigine = keyof Origine;
export type OrigineBrute = Partial<Record<ChampOrigine, string>>;

export interface EtapeNaissance {
  champ: ChampOrigine;
  table:
    | 'anneeNaissance'
    | 'sexe'
    | 'region'
    | 'territoire'
    | 'pcsParents'
    | 'diplomeParents'
    | 'decileRevenuFoyer'
    | 'structureFamiliale'
    | 'fratrie'
    | 'logementFamilial'
    | 'origineMigratoire'
    | 'santeNaissance';
  /** Conditions de la table, tirées des champs déjà connus. */
  conditions: (brute: OrigineBrute) => Conditions;
  /** Conditions à abandonner, dans l'ordre, quand une combinaison manque. */
  ordreRepli: readonly string[];
}

const periode = (brute: OrigineBrute): string => periodeDe(Number(brute.anneeNaissance));

/** Ordre fixe du tirage : chaque étape dépend des précédentes. */
export const ETAPES_NAISSANCE: readonly EtapeNaissance[] = [
  { champ: 'anneeNaissance', table: 'anneeNaissance', conditions: () => ({}), ordreRepli: [] },
  { champ: 'sexe', table: 'sexe', conditions: () => ({}), ordreRepli: [] },
  {
    champ: 'region',
    table: 'region',
    conditions: (b) => ({ periode: periode(b) }),
    ordreRepli: ['periode'],
  },
  {
    champ: 'territoire',
    table: 'territoire',
    conditions: (b) => ({ region: b.region! }),
    ordreRepli: ['region'],
  },
  {
    champ: 'pcsParents',
    table: 'pcsParents',
    conditions: (b) => ({ periode: periode(b), territoire: b.territoire! }),
    ordreRepli: ['territoire', 'periode'],
  },
  {
    champ: 'diplomeParents',
    table: 'diplomeParents',
    conditions: (b) => ({ pcsParents: b.pcsParents!, periode: periode(b) }),
    ordreRepli: ['periode', 'pcsParents'],
  },
  {
    champ: 'decileRevenuFoyer',
    table: 'decileRevenuFoyer',
    conditions: (b) => ({
      pcsParents: b.pcsParents!,
      diplomeParents: b.diplomeParents!,
      territoire: b.territoire!,
    }),
    ordreRepli: ['territoire', 'diplomeParents', 'pcsParents'],
  },
  {
    champ: 'structureFamiliale',
    table: 'structureFamiliale',
    conditions: (b) => ({ periode: periode(b), decileRevenuFoyer: b.decileRevenuFoyer! }),
    ordreRepli: ['decileRevenuFoyer', 'periode'],
  },
  {
    champ: 'fratrie',
    table: 'fratrie',
    conditions: (b) => ({ periode: periode(b), decileRevenuFoyer: b.decileRevenuFoyer! }),
    ordreRepli: ['decileRevenuFoyer', 'periode'],
  },
  {
    champ: 'logementFamilial',
    table: 'logementFamilial',
    conditions: (b) => ({ decileRevenuFoyer: b.decileRevenuFoyer!, territoire: b.territoire! }),
    ordreRepli: ['territoire', 'decileRevenuFoyer'],
  },
  {
    champ: 'origineMigratoire',
    table: 'origineMigratoire',
    conditions: (b) => ({ periode: periode(b), territoire: b.territoire! }),
    ordreRepli: ['territoire', 'periode'],
  },
  {
    champ: 'santeNaissance',
    table: 'santeNaissance',
    conditions: (b) => ({ decileRevenuFoyer: b.decileRevenuFoyer! }),
    ordreRepli: ['decileRevenuFoyer'],
  },
];

/** Années de naissance possibles : les clés de la table anneeNaissance. */
export function bornesAnneeNaissance(tables: Tables): { min: number; max: number } {
  const annees = tables.anneeNaissance.lignes.flatMap((l) =>
    Object.keys(l.distribution).map(Number),
  );
  return { min: Math.min(...annees), max: Math.max(...annees) };
}

/**
 * Tire les champs de l'origine, sous forme de chaînes, dans l'ordre des étapes.
 * Une année ou des champs imposés remplacent leur tirage ; les autres étapes gardent
 * leurs sous-générateurs et restent conditionnées par les champs imposés.
 */
export function tirerOrigineBrute(
  graine: string,
  tables: Tables,
  options: OptionsPartie = {},
): Required<OrigineBrute> {
  const brute: OrigineBrute = {};
  if (options.anneeNaissance !== undefined) {
    const { min, max } = bornesAnneeNaissance(tables);
    const annee = options.anneeNaissance;
    const horsBornes = annee < min || (annee > max && !options.anneeLibre);
    if (!Number.isInteger(annee) || horsBornes) {
      throw new RangeError(`Annee de naissance hors bornes (${min}-${max}) : ${annee}`);
    }
    brute.anneeNaissance = String(annee);
  }
  for (const [champ, valeur] of Object.entries(options.origine ?? {})) {
    if (valeur !== undefined) brute[champ as ChampOrigine] = String(valeur);
  }
  for (const etape of ETAPES_NAISSANCE) {
    if (brute[etape.champ] !== undefined) continue;
    const ligne = chercherLigne(tables[etape.table], etape.conditions(brute), etape.ordreRepli);
    const g = sousGenerateur(graine, 0, `naissance.${etape.champ}`);
    brute[etape.champ] = tirerPondere(g, ligne.distribution);
  }
  return brute as Required<OrigineBrute>;
}

function valider<T extends string>(valeurs: readonly T[], valeur: string, champ: string): T {
  if (!(valeurs as readonly string[]).includes(valeur)) {
    throw new Error(`Valeur inconnue pour ${champ} : ${valeur}`);
  }
  return valeur as T;
}

function entierValide(valeur: string, champ: string): number {
  const n = Number(valeur);
  if (!Number.isInteger(n)) throw new Error(`Valeur inconnue pour ${champ} : ${valeur}`);
  return n;
}

export function tirerOrigine(graine: string, tables: Tables, options: OptionsPartie = {}): Origine {
  const b = tirerOrigineBrute(graine, tables, options);
  return {
    anneeNaissance: entierValide(b.anneeNaissance, 'anneeNaissance'),
    sexe: valider(SEXES, b.sexe, 'sexe'),
    region: valider(REGIONS, b.region, 'region'),
    territoire: valider(TERRITOIRES, b.territoire, 'territoire'),
    pcsParents: valider(PCS, b.pcsParents, 'pcsParents'),
    diplomeParents: valider(DIPLOMES, b.diplomeParents, 'diplomeParents'),
    decileRevenuFoyer: Number(valider(DECILES, b.decileRevenuFoyer, 'decileRevenuFoyer')) as Decile,
    structureFamiliale: valider(STRUCTURES_FAMILIALES, b.structureFamiliale, 'structureFamiliale'),
    fratrie: Number(valider(FRATRIES, b.fratrie, 'fratrie')),
    logementFamilial: valider(LOGEMENTS_FAMILIAUX, b.logementFamilial, 'logementFamilial'),
    origineMigratoire: valider(ORIGINES_MIGRATOIRES, b.origineMigratoire, 'origineMigratoire'),
    santeNaissance: valider(SANTES_NAISSANCE, b.santeNaissance, 'santeNaissance'),
  };
}

/** Traits tirés indépendamment, entiers dans [5, 95]. */
export function tirerTraits(graine: string): Traits {
  const traits = {} as Traits;
  for (const nom of NOMS_TRAITS) {
    const g = sousGenerateur(graine, 0, `naissance.trait.${nom}`);
    traits[nom] = Math.round(
      normaleBornee(g, TRAITS_MOYENNE, TRAITS_ECART_TYPE, TRAITS_MIN, TRAITS_MAX),
    );
  }
  return traits;
}

export function tirerPrenom(graine: string, origine: Origine, tables: Tables): string {
  const ligne = chercherLigne(
    tables.prenoms,
    { sexe: origine.sexe, periode: periodeDe(origine.anneeNaissance) },
    ['periode', 'sexe'],
  );
  return tirerPondere(sousGenerateur(graine, 0, 'naissance.prenom'), ligne.distribution);
}

/**
 * Fréquence du prénom parmi les bébés du même sexe nés dans la même décennie, pour
 * 1 000 naissances (table prenoms) ; null si le prénom n'y figure pas.
 */
export function frequencePrenom(prenom: string, origine: Origine, tables: Tables): number | null {
  const ligne = chercherLigne(
    tables.prenoms,
    { sexe: origine.sexe, periode: periodeDe(origine.anneeNaissance) },
    ['periode', 'sexe'],
  );
  return ligne.distribution[prenom] ?? null;
}

export interface Naissance {
  origine: Origine;
  traits: Traits;
  prenom: string;
}

export function naitre(graine: string, tables: Tables, options: OptionsPartie = {}): Naissance {
  const origine = tirerOrigine(graine, tables, options);
  return { origine, traits: tirerTraits(graine), prenom: tirerPrenom(graine, origine, tables) };
}
