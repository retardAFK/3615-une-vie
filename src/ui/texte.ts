// Mise en forme des textes à l'écran : style Minitel et montants.

/** Taux légal de conversion entre le franc et l'euro. */
export const FRANCS_PAR_EURO = 6.55957;
/** Première année affichée en euros. */
export const ANNEE_EURO = 2002;

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

/** Groupe les milliers par une espace : 1234567 → « 1 234 567 ». */
function grouper(entier: number): string {
  return String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Montant en euros constants, affiché en francs avant 2002.
 * Exemples : « 12 400 EUR », « 81 339 F », « - 6 500 EUR ».
 */
export function montant(euros: number, annee: number): string {
  const enFrancs = annee < ANNEE_EURO;
  const valeur = Math.round(enFrancs ? euros * FRANCS_PAR_EURO : euros);
  const signe = valeur < 0 ? '- ' : '';
  return `${signe}${grouper(Math.abs(valeur))} ${enFrancs ? 'F' : 'EUR'}`;
}

/** Rang d'un décile : 1 → « 1ER DECILE », 2 → « 2E DECILE ». */
export function decile(rang: number): string {
  return `${rang}${rang === 1 ? 'ER' : 'E'} DECILE`;
}
