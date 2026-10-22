// Aléatoire reproductible : sfc32 initialisé par un hachage cyrb128 de la graine.
// Chaque tirage utilise un sous-générateur dérivé de (graine, age, idTirage) :
// ajouter ou retirer un tirage ne décale jamais les autres.

/** Renvoie un flottant dans [0, 1[. */
export type Generateur = () => number;

/** Hachage 128 bits d'une chaîne, en quatre entiers 32 bits. */
export function cyrb128(texte: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < texte.length; i++) {
    const k = texte.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Générateur sfc32 (Small Fast Counter). */
export function sfc32(a: number, b: number, c: number, d: number): Generateur {
  const suivant = (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Premiers tirages écartés pour bien mélanger l'état initial.
  for (let i = 0; i < 15; i++) suivant();
  return suivant;
}

export function creerGenerateur(graine: string): Generateur {
  const [a, b, c, d] = cyrb128(graine);
  return sfc32(a, b, c, d);
}

/** Sous-générateur propre à un tirage : ne dépend que de (graine, age, idTirage). */
export function sousGenerateur(graine: string, age: number, idTirage: string): Generateur {
  return creerGenerateur(`${graine}|${age}|${idTirage}`);
}

/** Flottant dans [0, 1[. */
export function flottant(g: Generateur): number {
  return g();
}

/** Entier dans [min, max], bornes comprises. */
export function entier(g: Generateur, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`Intervalle invalide : [${min}, ${max}]`);
  }
  return min + Math.floor(g() * (max - min + 1));
}

/** Tire une clé selon ses poids (non nécessairement normalisés). */
export function tirerPondere<K extends string>(
  g: Generateur,
  distribution: Readonly<Record<K, number>>,
): K {
  const entrees = (Object.entries(distribution) as [K, number][]).filter(([, poids]) => poids > 0);
  const total = entrees.reduce((somme, [, poids]) => somme + poids, 0);
  if (entrees.length === 0 || !Number.isFinite(total)) {
    throw new RangeError('Distribution vide ou invalide');
  }
  let reste = g() * total;
  for (const [cle, poids] of entrees) {
    reste -= poids;
    if (reste < 0) return cle;
  }
  // Erreurs d'arrondi : on retombe sur la dernière clé.
  return entrees[entrees.length - 1]![0];
}

/**
 * Loi normale tronquée à [min, max], par rejet (Box-Muller).
 * Au-delà de essaisMax rejets, renvoie la moyenne ramenée dans les bornes.
 */
export function normaleBornee(
  g: Generateur,
  moyenne: number,
  ecartType: number,
  min: number,
  max: number,
  essaisMax = 100,
): number {
  for (let essai = 0; essai < essaisMax; essai++) {
    const u1 = 1 - g(); // dans ]0, 1] : évite log(0)
    const u2 = g();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const valeur = moyenne + ecartType * z;
    if (valeur >= min && valeur <= max) return valeur;
  }
  return Math.min(max, Math.max(min, moyenne));
}
