// Sélection et application des événements (règles, section 4).

import { AGE_MAXIMAL } from './constantes';
import { multiplicateurTrait, probabiliteFinale, probabiliteParProduit } from './cotes';
import { appliquerMontant } from './modules/argent';
import { remplitConditions, valeurChamp } from './conditions';
import { multiplicateurContexte, regleEnVigueur, tagsDuContexte } from './modules/contexte';
import { rediger } from './recit';
import {
  hachageIdentifiant,
  hachageSuffixe,
  sousGenerateurHache,
  tirageHache,
  tirerPondere,
} from './rng';
import { CHAMPS_ETATS_CONDITIONS } from './types';
import type {
  ChampCondition,
  ChoixJoueur,
  ChoixPossible,
  Donnees,
  EntreeContexte,
  EtatAddiction,
  EtatPartie,
  Evenement,
  EvenementTire,
  JaugeModifiable,
  Jauges,
  ModificateurTemporaire,
  Personnage,
  Produit,
  TableValeur,
} from './types';

export { remplitConditions };

/** Une addiction est active en usage régulier ou en dépendance (règles, section 9). */
export const ETATS_ACTIFS: ReadonlySet<EtatAddiction> = new Set(['usage_regulier', 'dependance']);

const addictionsParTag = new WeakMap<object, Map<string, [Produit, number][]>>();

// Dernière table indexée : la même sert à tous les appels d'une partie.
let derniereTable: object | null = null;
let dernierIndex = new Map<string, [Produit, number][]>();

function indexAddictions(table: TableValeur): Map<string, [Produit, number][]> {
  if (table === derniereTable) return dernierIndex;
  let parTag = addictionsParTag.get(table);
  if (!parTag) {
    parTag = new Map();
    for (const ligne of table.lignes) {
      const { produit, tag } = ligne.conditions;
      if (!produit || !tag) continue;
      if (!parTag.has(tag)) parTag.set(tag, []);
      parTag.get(tag)!.push([produit as Produit, ligne.valeur]);
    }
    addictionsParTag.set(table, parTag);
  }
  derniereTable = table;
  dernierIndex = parTag;
  return parTag;
}

const tagsAddictions = new WeakMap<object, ReadonlySet<string>>();

/** Tags des autres modules sur lesquels pèse une addiction active (table addictionsAutresTags). */
export function tagsDesAddictions(table: TableValeur): ReadonlySet<string> {
  let tags = tagsAddictions.get(table);
  if (!tags) {
    tags = new Set(indexAddictions(table).keys());
    tagsAddictions.set(table, tags);
  }
  return tags;
}

// Les mêmes addictions sont testées de nombreuses fois par an : dernier résultat gardé.
let dernieresAddictions: Readonly<Record<Produit, EtatAddiction>> | null = null;
let derniereActive = false;

/** Au moins une addiction active (usage régulier ou dépendance). */
export function aUneAddictionActive(addictions: Readonly<Record<Produit, EtatAddiction>>): boolean {
  if (addictions === dernieresAddictions) return derniereActive;
  let active = false;
  for (const produit in addictions) {
    if (ETATS_ACTIFS.has(addictions[produit as Produit])) active = true;
  }
  dernieresAddictions = addictions;
  derniereActive = active;
  return active;
}

/** Produit des multiplicateurs des addictions actives pour ce tag ; 1 sans addiction. */
export function multiplicateurAddictions(
  personnage: Personnage,
  tag: string,
  table: TableValeur,
): number {
  if (!aUneAddictionActive(personnage.etats.addictions)) return 1;
  const liste = indexAddictions(table).get(tag);
  if (!liste) return 1;
  let m = 1;
  for (const [produit, facteur] of liste) {
    if (ETATS_ACTIFS.has(personnage.etats.addictions[produit])) m *= facteur;
  }
  return m;
}

/** Au plus 3 événements par an. */
export const EVENEMENTS_PAR_AN = 3;

const index = new WeakMap<readonly Evenement[], Map<string, Evenement>>();

/** Événement de la tranche d'âge, avec ce dont le tirage annuel a besoin. */
export interface EvenementRange {
  evenement: Evenement;
  /** Rang de déclaration : départage à gravité égale, index des cooldowns. */
  rang: number;
  /** Hachage de l'identifiant, calculé une fois. */
  identifiant: readonly number[];
}

const rangs = new WeakMap<readonly Evenement[], Map<Evenement, number>>();

/** Rang d'un événement dans sa liste (index des cooldowns). */
export function rangDe(evenements: readonly Evenement[], evenement: Evenement): number {
  let parEvenement = rangs.get(evenements);
  if (!parEvenement) {
    parEvenement = new Map(evenements.map((e, rang) => [e, rang]));
    rangs.set(evenements, parEvenement);
  }
  const rang = parEvenement.get(evenement);
  if (rang === undefined) throw new Error(`Evenement hors de la liste : ${evenement.id}`);
  return rang;
}

const indexParAge = new WeakMap<readonly Evenement[], EvenementRange[][]>();

/**
 * Événements éligibles par l'âge, pour chaque âge de 0 à AGE_MAXIMAL, dans l'ordre
 * de déclaration. Construit une fois par liste d'événements, puis mis en cache.
 */
export function evenementsParAge(evenements: readonly Evenement[]): EvenementRange[][] {
  let parAge = indexParAge.get(evenements);
  if (!parAge) {
    const tranches: EvenementRange[][] = Array.from({ length: AGE_MAXIMAL + 1 }, () => []);
    evenements.forEach((evenement, rang) => {
      const [min, max] = evenement.age;
      for (let age = Math.max(0, min); age <= Math.min(max, AGE_MAXIMAL); age++) {
        tranches[age]!.push({ evenement, rang, identifiant: hachageIdentifiant(evenement.id) });
      }
    });
    parAge = tranches;
    indexParAge.set(evenements, parAge);
  }
  return parAge;
}

/**
 * Tranche d'âge rangée pour le tirage : les événements sans condition, et ceux qui en
 * ont une, rangés selon la valeur acceptée de leur première condition. Chaque année,
 * seuls les événements dont cette condition correspond sont examinés. L'ordre d'examen
 * ne change rien : les tirages sont indépendants et les candidats triés ensuite.
 */
interface TrancheRangee {
  libres: EvenementRange[];
  gardes: { champ: ChampCondition; parValeur: Map<string, EvenementRange[]> }[];
}

const indexRange = new WeakMap<readonly Evenement[], TrancheRangee[]>();

function tranchesRangees(evenements: readonly Evenement[]): TrancheRangee[] {
  let rangees = indexRange.get(evenements);
  if (!rangees) {
    rangees = evenementsParAge(evenements).map((tranche) => {
      const rangee: TrancheRangee = { libres: [], gardes: [] };
      for (const range of tranche) {
        const requiert = range.evenement.requiert;
        const champ = requiert && (Object.keys(requiert)[0] as ChampCondition | undefined);
        if (!champ) {
          rangee.libres.push(range);
          continue;
        }
        let garde = rangee.gardes.find((g) => g.champ === champ);
        if (!garde) {
          garde = { champ, parValeur: new Map() };
          rangee.gardes.push(garde);
        }
        for (const valeur of requiert[champ]!) {
          if (!garde.parValeur.has(valeur)) garde.parValeur.set(valeur, []);
          garde.parValeur.get(valeur)!.push(range);
        }
      }
      return rangee;
    });
    indexRange.set(evenements, rangees);
  }
  return rangees;
}

/** Retrouve un événement par son id (index mis en cache par liste). */
export function evenementParId(evenements: readonly Evenement[], id: string): Evenement {
  let parId = index.get(evenements);
  if (!parId) {
    parId = new Map(evenements.map((e) => [e.id, e]));
    index.set(evenements, parId);
  }
  const evenement = parId.get(id);
  if (!evenement) throw new Error(`Evenement inconnu : ${id}`);
  return evenement;
}

export function estEligible(evenement: Evenement, etat: EtatPartie, donnees: Donnees): boolean {
  const { age } = etat.personnage;
  const [min, max] = evenement.age;
  if (age < min || age > max) return false;
  return estEligibleAgeCompris(evenement, rangDe(donnees.evenements, evenement), etat, donnees);
}

/**
 * Éligibilité hors tranche d'âge (déjà garantie par l'index par âge) : cooldown,
 * années calendaires, règle en vigueur, conditions.
 */
function estEligibleAgeCompris(
  evenement: Evenement,
  rang: number,
  etat: EtatPartie,
  donnees: Donnees,
): boolean {
  const reprise = etat.cooldowns[rang];
  if (reprise !== undefined && etat.personnage.age < reprise) return false;
  const annees = evenement.annees;
  if (annees && (etat.annee < annees[0] || etat.annee > annees[1])) return false;
  if (evenement.regle && !regleEnVigueur(donnees.contexte, etat.annee, evenement.regle)) {
    return false;
  }
  return !evenement.requiert || remplitConditions(etat.personnage, evenement.requiert);
}

function vise(modificateur: ModificateurTemporaire, evenement: Evenement): boolean {
  const { cible } = modificateur;
  return 'evenement' in cible
    ? cible.evenement === evenement.id
    : evenement.tags.includes(cible.tag);
}

export function estActif(modificateur: ModificateurTemporaire, age: number): boolean {
  return age >= modificateur.debut && (modificateur.fin === null || age <= modificateur.fin);
}

/**
 * Multiplicateurs visant un tag à un âge donné : modificateurs de choix actifs,
 * contexte historique de l'année correspondante, addictions actives.
 * Sert aux tirages des modules.
 */
export function multiplicateursTag(
  etat: EtatPartie,
  tag: string,
  age: number,
  donnees: Donnees,
): number[] {
  const resultat: number[] = [];
  for (const mod of etat.modificateursActifs) {
    if ('tag' in mod.cible && mod.cible.tag === tag && estActif(mod, age)) resultat.push(mod.m);
  }
  const annee = etat.annee + age - etat.personnage.age;
  const contexte = multiplicateurContexte(donnees, etat.personnage, annee, tag);
  if (contexte !== 1) resultat.push(contexte);
  const addictions = multiplicateurAddictions(
    etat.personnage,
    tag,
    donnees.tables.addictionsAutresTags,
  );
  if (addictions !== 1) resultat.push(addictions);
  return resultat;
}

/**
 * Même chose, en un seul produit et sans tableau intermédiaire : pour les tirages
 * annuels des modules (plusieurs par produit d'addiction et par an).
 */
export function produitTag(etat: EtatPartie, tag: string, age: number, donnees: Donnees): number {
  let m = 1;
  const actifs = etat.modificateursActifs;
  for (let i = 0; i < actifs.length; i++) {
    const mod = actifs[i]!;
    if ('tag' in mod.cible && mod.cible.tag === tag && estActif(mod, age)) m *= mod.m;
  }
  const annee = etat.annee + age - etat.personnage.age;
  if (donnees.contexte.length > 0) {
    m *= multiplicateurContexte(donnees, etat.personnage, annee, tag);
  }
  return m * multiplicateurAddictions(etat.personnage, tag, donnees.tables.addictionsAutresTags);
}

/** Ce dont dépend la probabilité d'un événement. */
export type Dependance = 'origine' | 'traits' | 'jauges' | 'etats' | 'annee';

/**
 * Dépendances de la probabilité d'un événement, déduites de ce qu'il déclare
 * (modificateurs, pBase), du contexte historique (un tag présent dans la table
 * contexte rend l'événement dépendant de l'année) et des addictions (un tag sur
 * lequel pèse une addiction active le rend dépendant des états). Jamais établies à la main.
 */
export function dependancesProbabilite(
  evenement: Evenement,
  contexte: readonly EntreeContexte[],
  tagsAddictions: ReadonlySet<string> = new Set(),
): Set<Dependance> {
  const dependances = new Set<Dependance>();
  // pBase par table (jalon 4c et suivants) : dépendance supposée aux états.
  if (typeof evenement.pBase !== 'number') dependances.add('etats');
  for (const mod of evenement.modificateurs ?? []) {
    if ('trait' in mod) dependances.add('traits');
    else if ('jauge' in mod) dependances.add('jauges');
    else {
      for (const champ in mod.si) {
        const surEtat = (CHAMPS_ETATS_CONDITIONS as readonly string[]).includes(champ);
        dependances.add(surEtat ? 'etats' : 'origine');
      }
    }
  }
  const visesParLeContexte = tagsDuContexte(contexte);
  if (evenement.tags.some((tag) => visesParLeContexte.has(tag))) dependances.add('annee');
  if (evenement.tags.some((tag) => tagsAddictions.has(tag))) dependances.add('etats');
  return dependances;
}

const fixes = new WeakMap<object, Map<Evenement, boolean>>();
// Dernier contexte : une partie n'en change pas.
let dernierContexteFixes: object | null = null;
let derniersFixes = new Map<Evenement, boolean>();

/**
 * Probabilité fixe pour toute une vie, hors addictions : ne dépend que de l'origine
 * et des traits, qui ne changent jamais. Le facteur des addictions actives (tags
 * visés par addictionsAutresTags) s'applique à part, à chaque tirage.
 * Classement mis en cache par table de contexte.
 */
export function aProbabiliteFixe(
  evenement: Evenement,
  contexte: readonly EntreeContexte[],
): boolean {
  let parEvenement: Map<Evenement, boolean>;
  if (contexte === dernierContexteFixes) parEvenement = derniersFixes;
  else {
    parEvenement = fixes.get(contexte) ?? new Map();
    fixes.set(contexte, parEvenement);
    dernierContexteFixes = contexte;
    derniersFixes = parEvenement;
  }
  let fixe = parEvenement.get(evenement);
  if (fixe === undefined) {
    const d = dependancesProbabilite(evenement, contexte);
    fixe = !d.has('jauges') && !d.has('etats') && !d.has('annee');
    parEvenement.set(evenement, fixe);
  }
  return fixe;
}

/**
 * Produits de multiplicateurs fixes déjà calculés, par vie (origine et traits constants).
 * Les conditions sur region et territoire suivent le lieu de vie : un déménagement
 * (nouvel objet residence) refait le cache.
 */
interface CacheVie {
  traits: object;
  residence: object;
  valeurs: Map<Evenement, number>;
  probabilites: Map<Evenement, number>;
}
const produitsFixes = new WeakMap<object, CacheVie>();
// Vie en cours : ses années se suivent, sans recherche dans le cache des vies.
let derniereOrigine: object | null = null;
let dernierCache: CacheVie | undefined;

function viseParUnChoix(evenement: Evenement, etat: EtatPartie): boolean {
  const actifs = etat.modificateursActifs;
  for (let i = 0; i < actifs.length; i++) {
    if (estActif(actifs[i]!, etat.personnage.age) && vise(actifs[i]!, evenement)) return true;
  }
  return false;
}

// Tags de chaque événement visés par la table addictionsAutresTags courante.
let tableTagsEvenements: object | null = null;
let tagsEvenements = new Map<Evenement, readonly string[]>();
const AUCUN_TAG: readonly string[] = [];

/** Tags de l'événement sur lesquels pèsent les addictions actives (souvent aucun). */
function tagsAddictionsDe(evenement: Evenement, donnees: Donnees): readonly string[] {
  const table = donnees.tables.addictionsAutresTags;
  if (table !== tableTagsEvenements) {
    tableTagsEvenements = table;
    tagsEvenements = new Map();
  }
  let tags = tagsEvenements.get(evenement);
  if (tags === undefined) {
    const vises = tagsDesAddictions(table);
    const trouves = evenement.tags.filter((tag) => vises.has(tag));
    tags = trouves.length > 0 ? trouves : AUCUN_TAG;
    tagsEvenements.set(evenement, tags);
  }
  return tags;
}

/** Probabilité finale de l'événement cette année : pBase corrigée par la formule des cotes. */
export function probabiliteEvenement(
  evenement: Evenement,
  etat: EtatPartie,
  donnees?: Donnees,
): number {
  if (typeof evenement.pBase !== 'number') {
    throw new Error(`${evenement.id} : pBase par table pas encore prise en charge`);
  }
  if (!donnees) {
    return probabiliteParProduit(evenement.pBase, produitMultiplicateurs(evenement, etat));
  }
  const tags = tagsAddictionsDe(evenement, donnees);
  let facteur = 1;
  for (let i = 0; i < tags.length; i++) {
    facteur *= multiplicateurAddictions(
      etat.personnage,
      tags[i]!,
      donnees.tables.addictionsAutresTags,
    );
  }
  if (!aProbabiliteFixe(evenement, donnees.contexte) || viseParUnChoix(evenement, etat)) {
    return probabiliteParProduit(
      evenement.pBase,
      produitMultiplicateurs(evenement, etat, donnees) * facteur,
    );
  }
  // Partie fixe pour toute la vie : le produit des multiplicateurs, en cache.
  const { origine, traits } = etat.personnage;
  const { residence } = etat.personnage.etats;
  let cache = origine === derniereOrigine ? dernierCache : produitsFixes.get(origine);
  if (!cache || cache.traits !== traits || cache.residence !== residence) {
    cache = { traits, residence, valeurs: new Map(), probabilites: new Map() };
    produitsFixes.set(origine, cache);
  }
  derniereOrigine = origine;
  dernierCache = cache;
  if (tags.length === 0) {
    let p = cache.probabilites.get(evenement);
    if (p === undefined) {
      p = probabiliteParProduit(evenement.pBase, produitMultiplicateurs(evenement, etat, donnees));
      cache.probabilites.set(evenement, p);
    }
    return p;
  }
  let produit = cache.valeurs.get(evenement);
  if (produit === undefined) {
    produit = produitMultiplicateurs(evenement, etat, donnees);
    cache.valeurs.set(evenement, produit);
  }
  return probabiliteParProduit(evenement.pBase, produit * facteur);
}

/** Produit des multiplicateurs de l'événement, hors addictions (appelé ~20 fois par an). */
function produitMultiplicateurs(evenement: Evenement, etat: EtatPartie, donnees?: Donnees): number {
  const { personnage } = etat;
  let produit = 1;
  const modificateurs = evenement.modificateurs;
  if (modificateurs) {
    for (let i = 0; i < modificateurs.length; i++) {
      const mod = modificateurs[i]!;
      if ('trait' in mod) produit *= multiplicateurTrait(personnage.traits[mod.trait], mod.k);
      else if ('jauge' in mod) produit *= multiplicateurTrait(personnage.jauges[mod.jauge], mod.k);
      else if (remplitConditions(personnage, mod.si)) produit *= mod.m;
    }
  }
  const actifs = etat.modificateursActifs;
  for (let i = 0; i < actifs.length; i++) {
    const mod = actifs[i]!;
    if (estActif(mod, personnage.age) && vise(mod, evenement)) produit *= mod.m;
  }
  if (donnees && donnees.contexte.length > 0) {
    for (const tag of evenement.tags) {
      produit *= multiplicateurContexte(donnees, personnage, etat.annee, tag);
    }
  }
  return produit;
}

function tire(
  evenement: Evenement,
  etat: EtatPartie,
  donnees: Donnees,
  probabilite: number,
  reporte: boolean,
): EvenementTire {
  return {
    id: evenement.id,
    probabilite,
    gravite: evenement.gravite,
    tags: evenement.tags,
    reporte,
    texte: rediger(evenement, etat, donnees.libelles),
    choix: (evenement.choix ?? []).map(({ id, libelle }) => ({ id, libelle })),
    ressources: evenement.ressources ?? [],
  };
}

/**
 * Tirage de l'année : les événements reportés passent sans nouveau tirage s'ils sont
 * encore éligibles ; les autres sont tirés chacun par son sous-générateur.
 * Au-delà de 3, les plus graves passent (à gravité égale, l'ordre de déclaration) ;
 * les autres sont reportés d'un an, une seule fois.
 */
export function tirerEvenements(
  etat: EtatPartie,
  donnees: Donnees,
): { retenus: EvenementTire[]; reportes: string[] } {
  const { graine, personnage } = etat;
  const rangee = tranchesRangees(donnees.evenements)[personnage.age];
  if (!rangee) return { retenus: [], reportes: [] };
  const reportes = etat.reportes;
  const candidats: { tire: EvenementTire; rang: number }[] = [];
  const examiner = (liste: readonly EvenementRange[]): void => {
    for (let i = 0; i < liste.length; i++) {
      const { evenement, rang, identifiant } = liste[i]!;
      if (!estEligibleAgeCompris(evenement, rang, etat, donnees)) continue;
      if (reportes.length > 0 && reportes.includes(evenement.id)) {
        candidats.push({ tire: tire(evenement, etat, donnees, 1, true), rang });
        continue;
      }
      const p = probabiliteEvenement(evenement, etat, donnees);
      if (tirageHache(graine, personnage.age, identifiant) < p) {
        candidats.push({ tire: tire(evenement, etat, donnees, p, false), rang });
      }
    }
  };
  examiner(rangee.libres);
  for (let i = 0; i < rangee.gardes.length; i++) {
    const { champ, parValeur } = rangee.gardes[i]!;
    const liste = parValeur.get(valeurChamp(personnage, champ));
    if (liste) examiner(liste);
  }
  if (candidats.length === 0) return { retenus: [], reportes: [] };
  candidats.sort((a, b) => b.tire.gravite - a.tire.gravite || a.rang - b.rang);
  return {
    retenus: candidats.slice(0, EVENEMENTS_PAR_AN).map((c) => c.tire),
    reportes: candidats
      .slice(EVENEMENTS_PAR_AN)
      .filter((c) => !c.tire.reporte)
      .map((c) => c.tire.id),
  };
}

const borner = (valeur: number): number => Math.min(100, Math.max(0, valeur));

export function modifierJauges(
  jauges: Jauges,
  variations: Partial<Record<JaugeModifiable, number>> | undefined,
): Jauges {
  if (!variations) return jauges;
  const resultat = { ...jauges };
  for (const [nom, delta] of Object.entries(variations) as [JaugeModifiable, number][]) {
    resultat[nom] = borner(resultat[nom] + delta);
  }
  return resultat;
}

/** Choix fait par le joueur pour cet événement (obligatoire s'il y a des choix). */
export function choixRetenu(
  evenement: Evenement,
  choix: readonly ChoixJoueur[],
): ChoixPossible | null {
  if (!evenement.choix?.length) return null;
  const fait = choix.find((c) => c.evenementId === evenement.id);
  const possible = evenement.choix.find((c) => c.id === fait?.choixId);
  if (!possible) throw new Error(`${evenement.id} : choix manquant ou inconnu`);
  return possible;
}

/**
 * Applique l'événement et son choix : effets, coût, modificateurs, cooldown.
 * L'acceptation d'une opportunité (changerEmploi) est traitée par la boucle.
 */
export function appliquerEvenement(
  etat: EtatPartie,
  evenement: Evenement,
  choix: ChoixPossible | null,
  rang: number,
): EtatPartie {
  const { personnage } = etat;
  const { age } = personnage;
  let jauges = modifierJauges(personnage.jauges, evenement.effets.jauges);
  jauges = modifierJauges(jauges, choix?.cout?.jauges);

  let finances = personnage.finances;
  const depense = choix?.cout?.argent ?? 0;
  if (depense > 0) finances = appliquerMontant(finances, -depense);
  if (evenement.effets.argent) finances = appliquerMontant(finances, evenement.effets.argent);

  let travail = personnage.etats.travail;
  if (evenement.effets.revenu) {
    const [min, max] = evenement.effets.revenu;
    const g = sousGenerateurHache(etat.graine, age, hachageSuffixe(evenement.id, 'revenu'));
    travail = { ...travail, progression: travail.progression * (min + (max - min) * g()) };
  }

  // Seuls les objets qui changent sont copiés (un événement s'applique ~40 fois par vie).
  // Modificateurs posés par l'événement lui-même, puis par le choix.
  const nouveaux: ModificateurTemporaire[] = [];
  for (const liste of [evenement.effets.modificateurs, choix?.modificateurs]) {
    if (!liste) continue;
    for (const mod of liste) {
      nouveaux.push({
        cible: mod.cible,
        m: mod.m,
        debut: age + 1,
        fin: mod.duree === undefined ? null : age + mod.duree,
      });
    }
  }

  let { justice } = personnage.etats;
  if (evenement.effets.justice === 'garde_a_vue') {
    justice = { ...justice, gardesAVue: justice.gardesAVue + 1 };
  } else if (evenement.effets.justice === 'condamnation') {
    justice = { ...justice, condamnations: justice.condamnations + 1, casier: true };
  }

  let cooldowns = etat.cooldowns;
  if (evenement.unique || evenement.cooldown) {
    cooldowns = etat.cooldowns.slice();
    cooldowns[rang] = evenement.unique ? AGE_MAXIMAL + 1 : age + evenement.cooldown!;
  }

  const etatsChanges =
    evenement.effets.etats !== undefined ||
    travail !== personnage.etats.travail ||
    justice !== personnage.etats.justice;
  return {
    ...etat,
    personnage: {
      ...personnage,
      jauges,
      finances,
      etats: etatsChanges
        ? { ...personnage.etats, ...evenement.effets.etats, travail, justice }
        : personnage.etats,
    },
    cooldowns,
    modificateursActifs:
      nouveaux.length > 0 ? [...etat.modificateursActifs, ...nouveaux] : etat.modificateursActifs,
  };
}

/** Tirage du décès causé par un événement mortel. */
export function provoqueDeces(etat: EtatPartie, evenement: Evenement): boolean {
  const p = evenement.effets.deces;
  if (p === undefined || p <= 0) return false;
  return (
    tirageHache(etat.graine, etat.personnage.age, hachageSuffixe(evenement.id, 'deces')) <
    probabiliteFinale(p, [])
  );
}

/** Choix du mode automatique, pondéré par les affinités et les traits. */
export function choisirAuto(
  etat: EtatPartie,
  evenement: EvenementTire,
  donnees: Donnees,
): ChoixJoueur {
  const definition = evenementParId(donnees.evenements, evenement.id);
  const options = definition.choix ?? [];
  if (options.length === 0) throw new Error(`${evenement.id} : aucun choix a faire`);
  const poids: Record<string, number> = {};
  for (const option of options) {
    poids[option.id] = (option.affinites ?? []).reduce(
      (produit, { trait, k }) => produit * multiplicateurTrait(etat.personnage.traits[trait], k),
      1,
    );
  }
  const g = sousGenerateurHache(
    etat.graine,
    etat.personnage.age,
    hachageSuffixe(evenement.id, 'auto'),
  );
  return { evenementId: evenement.id, choixId: tirerPondere(g, poids) };
}
