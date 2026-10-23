// Sélection et application des événements (règles, section 4).

import { AGE_MAXIMAL } from './constantes';
import { multiplicateurTrait, probabiliteFinale, probabiliteParProduit } from './cotes';
import { appliquerMontant } from './modules/argent';
import { remplitConditions } from './conditions';
import { multiplicateurContexte, regleEnVigueur, tagsDuContexte } from './modules/contexte';
import { rediger } from './recit';
import { hachageIdentifiant, sousGenerateur, tirage, tirageHache, tirerPondere } from './rng';
import { CHAMPS_ETATS_CONDITIONS } from './types';
import type {
  ChoixJoueur,
  ChoixPossible,
  Donnees,
  EntreeContexte,
  EtatPartie,
  Evenement,
  EvenementTire,
  JaugeModifiable,
  Jauges,
  ModificateurTemporaire,
} from './types';

export { remplitConditions };

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
 * puis contexte historique de l'année correspondante. Sert aux tirages des modules.
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
  return resultat;
}

/** Probabilité finale de l'événement cette année : pBase corrigée par la formule des cotes. */
/** Ce dont dépend la probabilité d'un événement. */
export type Dependance = 'origine' | 'traits' | 'jauges' | 'etats' | 'annee';

/**
 * Dépendances de la probabilité d'un événement, déduites de ce qu'il déclare
 * (modificateurs, pBase) et du contexte historique (un tag présent dans la table
 * contexte rend l'événement dépendant de l'année). Jamais établies à la main.
 */
export function dependancesProbabilite(
  evenement: Evenement,
  contexte: readonly EntreeContexte[],
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
  return dependances;
}

const fixes = new WeakMap<object, WeakMap<Evenement, boolean>>();

/**
 * Probabilité fixe pour toute une vie : ne dépend que de l'origine et des traits,
 * qui ne changent jamais. Classement mis en cache par table de contexte.
 */
export function aProbabiliteFixe(
  evenement: Evenement,
  contexte: readonly EntreeContexte[],
): boolean {
  let parEvenement = fixes.get(contexte);
  if (!parEvenement) {
    parEvenement = new WeakMap();
    fixes.set(contexte, parEvenement);
  }
  let fixe = parEvenement.get(evenement);
  if (fixe === undefined) {
    const d = dependancesProbabilite(evenement, contexte);
    fixe = !d.has('jauges') && !d.has('etats') && !d.has('annee');
    parEvenement.set(evenement, fixe);
  }
  return fixe;
}

/** Probabilités fixes déjà calculées, par vie (l'origine et les traits ne changent pas). */
const probabilitesFixes = new WeakMap<
  object,
  { traits: object; valeurs: Map<Evenement, number> }
>();

function viseParUnChoix(evenement: Evenement, etat: EtatPartie): boolean {
  const actifs = etat.modificateursActifs;
  for (let i = 0; i < actifs.length; i++) {
    if (estActif(actifs[i]!, etat.personnage.age) && vise(actifs[i]!, evenement)) return true;
  }
  return false;
}

export function probabiliteEvenement(
  evenement: Evenement,
  etat: EtatPartie,
  donnees?: Donnees,
): number {
  if (
    !donnees ||
    !aProbabiliteFixe(evenement, donnees.contexte) ||
    viseParUnChoix(evenement, etat)
  ) {
    return calculerProbabilite(evenement, etat, donnees);
  }
  const { origine, traits } = etat.personnage;
  let cache = probabilitesFixes.get(origine);
  if (!cache || cache.traits !== traits) {
    cache = { traits, valeurs: new Map() };
    probabilitesFixes.set(origine, cache);
  }
  let p = cache.valeurs.get(evenement);
  if (p === undefined) {
    p = calculerProbabilite(evenement, etat, donnees);
    cache.valeurs.set(evenement, p);
  }
  return p;
}

function calculerProbabilite(evenement: Evenement, etat: EtatPartie, donnees?: Donnees): number {
  if (typeof evenement.pBase !== 'number') {
    throw new Error(`${evenement.id} : pBase par table pas encore prise en charge`);
  }
  const { personnage } = etat;
  // Produit des multiplicateurs, calculé au fil de l'eau (appelé ~20 fois par an).
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
  return probabiliteParProduit(evenement.pBase, produit);
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
  const tranche = evenementsParAge(donnees.evenements)[personnage.age] ?? [];
  const reportes = etat.reportes;
  // La plupart des années, rien n'est tiré : aucune allocation dans ce cas.
  let candidats: { tire: EvenementTire; rang: number }[] | null = null;
  for (let i = 0; i < tranche.length; i++) {
    const { evenement, rang, identifiant } = tranche[i]!;
    if (!estEligibleAgeCompris(evenement, rang, etat, donnees)) continue;
    if (reportes.length > 0 && reportes.includes(evenement.id)) {
      (candidats ??= []).push({ tire: tire(evenement, etat, donnees, 1, true), rang });
      continue;
    }
    const p = probabiliteEvenement(evenement, etat, donnees);
    if (tirageHache(graine, personnage.age, identifiant) < p) {
      (candidats ??= []).push({ tire: tire(evenement, etat, donnees, p, false), rang });
    }
  }
  if (candidats === null) return { retenus: [], reportes: [] };
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
    const g = sousGenerateur(etat.graine, age, `${evenement.id}.revenu`);
    travail = { ...travail, progression: travail.progression * (min + (max - min) * g()) };
  }

  // Seuls les objets qui changent sont copiés (un événement s'applique ~40 fois par vie).
  const nouveaux: ModificateurTemporaire[] = (choix?.modificateurs ?? []).map((mod) => ({
    cible: mod.cible,
    m: mod.m,
    debut: age + 1,
    fin: mod.duree === undefined ? null : age + mod.duree,
  }));

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
    tirage(etat.graine, etat.personnage.age, `${evenement.id}.deces`) < probabiliteFinale(p, [])
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
  const g = sousGenerateur(etat.graine, etat.personnage.age, `${evenement.id}.auto`);
  return { evenementId: evenement.id, choixId: tirerPondere(g, poids) };
}
