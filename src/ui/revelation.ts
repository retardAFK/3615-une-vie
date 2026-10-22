// Révélation des textes caractère par caractère, comme un affichage Minitel.

/** Nombre de caractères visibles après `ecoule` millisecondes (tout, sans délai). */
export function caracteresVisibles(
  longueur: number,
  ecoule: number,
  msParCaractere: number,
): number {
  if (msParCaractere <= 0) return longueur;
  return Math.max(0, Math.min(longueur, Math.floor(ecoule / msParCaractere)));
}

/** Durée totale de la révélation d'un texte. */
export function dureeRevelation(longueur: number, msParCaractere: number): number {
  return msParCaractere <= 0 ? 0 : longueur * msParCaractere;
}
