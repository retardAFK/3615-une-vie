// Recherche d'une ligne dans une table conditionnelle, avec repli
// vers une table moins précise quand une combinaison manque (règles, section 3).

import type { Conditions, LigneValeur, LigneValeurs, Table } from './types';

const periodes = new Map<number, string>();

/** Période décennale d'une année : 1987 → « 1980-1989 » (chaîne construite une fois). */
export function periodeDe(annee: number): string {
  let periode = periodes.get(annee);
  if (periode === undefined) {
    const debut = Math.floor(annee / 10) * 10;
    periode = `${debut}-${debut + 9}`;
    periodes.set(annee, periode);
  }
  return periode;
}

function memesConditions(a: Conditions, b: Conditions): boolean {
  const clesA = Object.keys(a);
  return clesA.length === Object.keys(b).length && clesA.every((cle) => a[cle] === b[cle]);
}

/**
 * Les mêmes recherches reviennent chaque année : le résultat est mis en cache par
 * table, dans un arbre indexé par nom puis valeur de chaque condition (sans chaîne
 * à construire). Invariant : pour une même table, les mêmes conditions sont toujours
 * cherchées avec le même ordre de repli.
 */
interface Noeud {
  ligne?: unknown;
  suite?: Map<string, Map<string, Noeud>>;
}
const caches = new WeakMap<object, Noeud>();

function noeudDe(table: object, conditions: Conditions): Noeud {
  let noeud = caches.get(table);
  if (!noeud) {
    noeud = {};
    caches.set(table, noeud);
  }
  for (const nom in conditions) {
    noeud.suite ??= new Map();
    let parValeur = noeud.suite.get(nom);
    if (!parValeur) {
      parValeur = new Map();
      noeud.suite.set(nom, parValeur);
    }
    const valeur = conditions[nom]!;
    let suivant = parValeur.get(valeur);
    if (!suivant) {
      suivant = {};
      parValeur.set(valeur, suivant);
    }
    noeud = suivant;
  }
  return noeud;
}

/**
 * Cherche la ligne dont les conditions sont exactement `conditions`.
 * À défaut, retire les conditions une à une dans l'ordre de `ordreRepli`
 * (par défaut : l'ordre des conditions) et recommence, jusqu'à la ligne sans condition.
 */
export function chercherLigne<L extends { conditions: Conditions }>(
  table: Table<L>,
  conditions: Conditions,
  ordreRepli?: readonly string[],
): L {
  const noeud = noeudDe(table, conditions);
  if (noeud.ligne) return noeud.ligne as L;

  const repli = ordreRepli ?? Object.keys(conditions);
  const courantes: Record<string, string> = { ...conditions };
  for (let i = 0; i <= repli.length; i++) {
    const ligne = table.lignes.find((l) => memesConditions(l.conditions, courantes));
    if (ligne) {
      noeud.ligne = ligne;
      return ligne;
    }
    const retiree = repli[i];
    if (retiree !== undefined) delete courantes[retiree];
  }
  throw new Error(`Table ${table.table} : aucune ligne pour ${JSON.stringify(conditions)}`);
}

/** Valeur d'une table à une valeur par ligne. */
export function valeurDe(
  table: Table<LigneValeur>,
  conditions: Conditions = {},
  ordreRepli?: readonly string[],
): number {
  return chercherLigne(table, conditions, ordreRepli).valeur;
}

const simples = new WeakMap<object, Map<string, Map<string, number>>>();

/**
 * valeurDe pour une seule condition, avec repli vers la ligne sans condition : le
 * résultat est gardé par table, champ et valeur (recherches annuelles des modules).
 */
export function valeurSimple(table: Table<LigneValeur>, champ: string, valeur: string): number {
  let parChamp = simples.get(table);
  if (!parChamp) {
    parChamp = new Map();
    simples.set(table, parChamp);
  }
  let parValeur = parChamp.get(champ);
  if (!parValeur) {
    parValeur = new Map();
    parChamp.set(champ, parValeur);
  }
  let resultat = parValeur.get(valeur);
  if (resultat === undefined) {
    resultat = valeurDe(table, { [champ]: valeur }, [champ]);
    parValeur.set(valeur, resultat);
  }
  return resultat;
}

const parametresFixes = new WeakMap<object, Readonly<Record<string, number>>>();

/** Paramètre nommé d'une table de paramètres. */
export function parametre(
  table: Table<LigneValeurs>,
  nom: string,
  conditions?: Conditions,
  ordreRepli?: readonly string[],
): number {
  let valeurs: Readonly<Record<string, number>> | undefined;
  if (conditions === undefined) {
    valeurs = parametresFixes.get(table);
    if (!valeurs) {
      valeurs = chercherLigne(table, {}, []).valeurs;
      parametresFixes.set(table, valeurs);
    }
  } else valeurs = chercherLigne(table, conditions, ordreRepli).valeurs;
  const valeur = valeurs[nom];
  if (valeur === undefined) throw new Error(`Table ${table.table} : parametre ${nom} absent`);
  return valeur;
}
