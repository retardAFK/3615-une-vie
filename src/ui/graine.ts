// Graines de partie. Le hasard de la graine vient de l'interface, jamais du moteur.

export type SourceAleatoire = (octets: Uint8Array) => Uint8Array;

const sourceCrypto: SourceAleatoire = (octets) => crypto.getRandomValues(octets);

/** Nouvelle graine : 8 caractères hexadécimaux majuscules. */
export function nouvelleGraine(source: SourceAleatoire = sourceCrypto): string {
  return Array.from(source(new Uint8Array(4)), (octet) => octet.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Graine saisie par le joueur : 4 à 16 caractères A-Z et 0-9, sinon null. */
export function normaliserGraine(saisie: string): string | null {
  const graine = saisie.trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(graine) ? graine : null;
}
