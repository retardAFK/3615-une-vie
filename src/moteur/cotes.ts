// Formule unique des probabilités : correction par cotes (règles, section 4).

/** Bornes techniques : une probabilité finale n'est jamais 0 ni 1. */
export const P_MIN = 1e-6;
export const P_MAX = 1 - 1e-6;

function borner(p: number): number {
  return Math.min(P_MAX, Math.max(P_MIN, p));
}

/**
 * odds = pBase / (1 - pBase) × Π m_i ; p_final = odds / (1 + odds).
 * Un multiplicateur > 1 augmente le risque, < 1 le réduit.
 */
export function probabiliteFinale(pBase: number, multiplicateurs: readonly number[] = []): number {
  if (!Number.isFinite(pBase) || pBase < 0 || pBase > 1) {
    throw new RangeError(`Probabilite de base invalide : ${pBase}`);
  }
  let cotes = borner(pBase) / (1 - borner(pBase));
  for (const m of multiplicateurs) {
    if (!Number.isFinite(m) || m <= 0) throw new RangeError(`Multiplicateur invalide : ${m}`);
    cotes *= m;
  }
  if (!Number.isFinite(cotes)) return P_MAX;
  return borner(cotes / (1 + cotes));
}

/** Effet d'un trait : m = e^(k × (trait − 50) / 50). */
export function multiplicateurTrait(trait: number, k: number): number {
  return Math.exp((k * (trait - 50)) / 50);
}
