// Sélection et application des événements (règles, section 4).

import { AGE_MAXIMAL } from './constantes';
import { multiplicateurTrait, probabiliteFinale, probabiliteParProduit } from './cotes';
import { appliquerMontant } from './modules/argent';
import { multiplicateurContexte } from './modules/contexte';
import { rediger } from './recit';
import { sousGenerateur, tirage, tirerPondere } from './rng';
import type {
  ChampCondition,
  ChoixJoueur,
  ChoixPossible,
  ConditionsPersonnage,
  Donnees,
  EtatPartie,
  Evenement,
  EvenementTire,
  JaugeModifiable,
  Jauges,
  ModificateurTemporaire,
  Personnage,
  Tables,
} from './types';

/** Au plus 3 événements par an. */
export const EVENEMENTS_PAR_AN = 3;

const index = new WeakMap<readonly Evenement[], Map<string, Evenement>>();

/** Événement et son rang de déclaration (départage à gravité égale). */
export interface EvenementRange {
  evenement: Evenement;
  rang: number;
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
        tranches[age]!.push({ evenement, rang });
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

/** Valeur d'un champ de condition : origine, ou états du joueur. */
function valeurChamp(personnage: Personnage, champ: ChampCondition): string {
  const { etats } = personnage;
  switch (champ) {
    case 'emploi':
      return etats.emploi;
    case 'scolarite':
      return etats.scolarite;
    case 'diplome':
      return etats.education.diplome;
    case 'pcs':
      return etats.travail.pcs ?? '';
    case 'justice':
      return etats.justice.casier
        ? 'casier'
        : etats.justice.gardesAVue > 0
          ? 'garde_a_vue'
          : 'aucun';
    default:
      return String(personnage.origine[champ]);
  }
}

export function remplitConditions(
  personnage: Personnage,
  conditions: ConditionsPersonnage,
): boolean {
  for (const champ in conditions) {
    const valeurs = conditions[champ as ChampCondition]!;
    if (!valeurs.includes(valeurChamp(personnage, champ as ChampCondition))) return false;
  }
  return true;
}

export function estEligible(evenement: Evenement, etat: EtatPartie): boolean {
  const { age } = etat.personnage;
  const [min, max] = evenement.age;
  if (age < min || age > max) return false;
  return estEligibleAgeCompris(evenement, etat);
}

/** Éligibilité hors tranche d'âge (déjà garantie par l'index par âge) : cooldown, conditions. */
function estEligibleAgeCompris(evenement: Evenement, etat: EtatPartie): boolean {
  const reprise = etat.cooldowns[evenement.id];
  if (reprise !== undefined && etat.personnage.age < reprise) return false;
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
  tables: Tables,
): number[] {
  const resultat: number[] = [];
  for (const mod of etat.modificateursActifs) {
    if ('tag' in mod.cible && mod.cible.tag === tag && estActif(mod, age)) resultat.push(mod.m);
  }
  const contexte = multiplicateurContexte(tables, etat.annee + age - etat.personnage.age, tag);
  if (contexte !== 1) resultat.push(contexte);
  return resultat;
}

/** Probabilité finale de l'événement cette année : pBase corrigée par la formule des cotes. */
export function probabiliteEvenement(
  evenement: Evenement,
  etat: EtatPartie,
  tables?: Tables,
): number {
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
  if (tables && tables.contexte.lignes.length > 0) {
    for (const tag of evenement.tags) produit *= multiplicateurContexte(tables, etat.annee, tag);
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
    const { evenement, rang } = tranche[i]!;
    if (!estEligibleAgeCompris(evenement, etat)) continue;
    if (reportes.length > 0 && reportes.includes(evenement.id)) {
      (candidats ??= []).push({ tire: tire(evenement, etat, donnees, 1, true), rang });
      continue;
    }
    const p = probabiliteEvenement(evenement, etat, donnees.tables);
    if (tirage(graine, personnage.age, evenement.id) < p) {
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

  const cooldowns = { ...etat.cooldowns };
  if (evenement.unique) cooldowns[evenement.id] = AGE_MAXIMAL + 1;
  else if (evenement.cooldown) cooldowns[evenement.id] = age + evenement.cooldown;

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
