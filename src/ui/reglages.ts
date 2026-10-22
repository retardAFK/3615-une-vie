// Réglages du joueur : vitesse d'affichage et sons. Gardés dans le navigateur
// (préférence personnelle) ; sans stockage disponible, les valeurs par défaut s'appliquent.

export const VITESSES = ['lente', 'normale', 'rapide', 'instantanee'] as const;
export type Vitesse = (typeof VITESSES)[number];

export interface Reglages {
  vitesse: Vitesse;
  /** Sons générés en WebAudio : désactivés par défaut. */
  sons: boolean;
}

export const REGLAGES_PAR_DEFAUT: Readonly<Reglages> = { vitesse: 'normale', sons: false };

/** Millisecondes par caractère pour la révélation des textes. */
export const MS_PAR_CARACTERE: Readonly<Record<Vitesse, number>> = {
  lente: 45,
  normale: 28,
  rapide: 10,
  instantanee: 0,
};

const CLE = '3615-une-vie.reglages';

export type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

function stockageNavigateur(): Stockage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Réglages enregistrés, complétés et validés ; valeurs par défaut en cas de problème. */
export function lireReglages(stockage: Stockage | null = stockageNavigateur()): Reglages {
  try {
    const brut = stockage?.getItem(CLE);
    if (!brut) return { ...REGLAGES_PAR_DEFAUT };
    const lu = JSON.parse(brut) as Partial<Reglages>;
    return {
      vitesse: VITESSES.includes(lu.vitesse as Vitesse)
        ? (lu.vitesse as Vitesse)
        : REGLAGES_PAR_DEFAUT.vitesse,
      sons: typeof lu.sons === 'boolean' ? lu.sons : REGLAGES_PAR_DEFAUT.sons,
    };
  } catch {
    return { ...REGLAGES_PAR_DEFAUT };
  }
}

export function ecrireReglages(
  reglages: Reglages,
  stockage: Stockage | null = stockageNavigateur(),
): void {
  try {
    stockage?.setItem(CLE, JSON.stringify(reglages));
  } catch {
    // Navigation privée ou stockage bloqué : le réglage vaut pour la session seulement.
  }
}

export function vitesseSuivante(vitesse: Vitesse): Vitesse {
  return VITESSES[(VITESSES.indexOf(vitesse) + 1) % VITESSES.length]!;
}

/**
 * Délai par caractère réellement appliqué : aucune animation en mode AUTO
 * (rien ne doit le ralentir) ni quand le système demande moins de mouvement.
 */
export function delaiParCaractere(
  reglages: Reglages,
  mouvementReduit: boolean,
  auto: boolean,
): number {
  if (mouvementReduit || auto) return 0;
  return MS_PAR_CARACTERE[reglages.vitesse];
}

/** Les animations (transitions, clignotements, écarts de jauge) sont-elles permises ? */
export function animationsPermises(
  reglages: Reglages,
  mouvementReduit: boolean,
  auto: boolean,
): boolean {
  return delaiParCaractere(reglages, mouvementReduit, auto) > 0;
}
