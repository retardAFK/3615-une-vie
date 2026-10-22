// Sélection et application des événements (règles, section 4).

import { AGE_MAXIMAL } from './constantes';
import { multiplicateurTrait, probabiliteFinale } from './cotes';
import { rediger } from './recit';
import { sousGenerateur, tirerPondere } from './rng';
import type {
  ChoixJoueur,
  ChoixPossible,
  ConditionsOrigine,
  Donnees,
  EtatPartie,
  Evenement,
  EvenementTire,
  JaugeModifiable,
  Jauges,
  ModificateurTemporaire,
  Personnage,
} from './types';

/** Au plus 3 événements par an. */
export const EVENEMENTS_PAR_AN = 3;

const index = new WeakMap<readonly Evenement[], Map<string, Evenement>>();

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

export function remplitConditions(personnage: Personnage, conditions: ConditionsOrigine): boolean {
  return Object.entries(conditions).every(([champ, valeurs]) =>
    (valeurs as readonly string[]).includes(
      String(personnage.origine[champ as keyof Personnage['origine']]),
    ),
  );
}

export function estEligible(evenement: Evenement, etat: EtatPartie): boolean {
  const { age } = etat.personnage;
  const [min, max] = evenement.age;
  if (age < min || age > max) return false;
  if (evenement.requiert && !remplitConditions(etat.personnage, evenement.requiert)) return false;
  const reprise = etat.cooldowns[evenement.id];
  return reprise === undefined || age >= reprise;
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

/** Probabilité finale de l'événement cette année : pBase corrigée par la formule des cotes. */
export function probabiliteEvenement(evenement: Evenement, etat: EtatPartie): number {
  if (typeof evenement.pBase !== 'number') {
    throw new Error(`${evenement.id} : pBase par table pas encore prise en charge`);
  }
  const { personnage } = etat;
  const multiplicateurs: number[] = [];
  for (const mod of evenement.modificateurs ?? []) {
    if ('trait' in mod)
      multiplicateurs.push(multiplicateurTrait(personnage.traits[mod.trait], mod.k));
    else if ('jauge' in mod)
      multiplicateurs.push(multiplicateurTrait(personnage.jauges[mod.jauge], mod.k));
    else if (remplitConditions(personnage, mod.si)) multiplicateurs.push(mod.m);
  }
  for (const mod of etat.modificateursActifs) {
    if (estActif(mod, personnage.age) && vise(mod, evenement)) multiplicateurs.push(mod.m);
  }
  return probabiliteFinale(evenement.pBase, multiplicateurs);
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
  const candidats: { tire: EvenementTire; rang: number }[] = [];
  donnees.evenements.forEach((evenement, rang) => {
    if (!estEligible(evenement, etat)) return;
    if (etat.reportes.includes(evenement.id)) {
      candidats.push({ tire: tire(evenement, etat, donnees, 1, true), rang });
      return;
    }
    const p = probabiliteEvenement(evenement, etat);
    if (sousGenerateur(graine, personnage.age, evenement.id)() < p) {
      candidats.push({ tire: tire(evenement, etat, donnees, p, false), rang });
    }
  });
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

/** Applique l'événement et son choix : effets, coût, modificateurs, cooldown. */
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
  if (depense > 0) {
    const prisSurEpargne = Math.min(finances.epargne, depense);
    finances = {
      ...finances,
      epargne: finances.epargne - prisSurEpargne,
      dettes: finances.dettes + depense - prisSurEpargne,
    };
  }

  const nouveaux: ModificateurTemporaire[] = (choix?.modificateurs ?? []).map((mod) => ({
    cible: mod.cible,
    m: mod.m,
    debut: age + 1,
    fin: mod.duree === undefined ? null : age + mod.duree,
  }));

  const cooldowns = { ...etat.cooldowns };
  if (evenement.unique) cooldowns[evenement.id] = AGE_MAXIMAL + 1;
  else if (evenement.cooldown) cooldowns[evenement.id] = age + evenement.cooldown;

  return {
    ...etat,
    personnage: {
      ...personnage,
      jauges,
      finances,
      etats: { ...personnage.etats, ...evenement.effets.etats },
    },
    cooldowns,
    modificateursActifs: [...etat.modificateursActifs, ...nouveaux],
  };
}

/** Tirage du décès causé par un événement mortel. */
export function provoqueDeces(etat: EtatPartie, evenement: Evenement): boolean {
  const p = evenement.effets.deces;
  if (p === undefined || p <= 0) return false;
  const g = sousGenerateur(etat.graine, etat.personnage.age, `${evenement.id}.deces`);
  return g() < probabiliteFinale(p, []);
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
