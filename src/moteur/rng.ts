// Aléatoire reproductible : sfc32 initialisé par un hachage cyrb128 de la graine.
// Chaque tirage utilise un sous-générateur dérivé de (graine, age, idTirage) :
// ajouter ou retirer un tirage ne décale jamais les autres.

/** Renvoie un flottant dans [0, 1[. */
export type Generateur = () => number;

// État du hachage cyrb128, gardé dans des variables (pas de tableau à chaque tirage).
let h1 = 0;
let h2 = 0;
let h3 = 0;
let h4 = 0;

function initialiser(): void {
  h1 = 1779033703;
  h2 = 3144134277;
  h3 = 1013904242;
  h4 = 2773480762;
}

/** Absorbe les caractères d'un texte dans l'état du hachage (première phase de cyrb128). */
function absorber(texte: string): void {
  for (let i = 0; i < texte.length; i++) {
    const k = texte.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
}

/** Mélange final de cyrb128. */
function finir(): void {
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
}

/** Hachage 128 bits d'une chaîne, en quatre entiers 32 bits. */
export function cyrb128(texte: string): [number, number, number, number] {
  initialiser();
  absorber(texte);
  finir();
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Premiers tirages écartés. L'état initial vient d'un hachage cyrb128 déjà bien
 * mélangé : quelques tours suffisent (un tirage annuel en dépend, ce coût compte).
 */
const TOURS_DE_CHAUFFE = 4;

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
  for (let i = 0; i < TOURS_DE_CHAUFFE; i++) suivant();
  return suivant;
}

export function creerGenerateur(graine: string): Generateur {
  const [a, b, c, d] = cyrb128(graine);
  return sfc32(a, b, c, d);
}

/** Sous-générateur propre à un tirage : ne dépend que de (graine, age, idTirage). */
export function sousGenerateur(graine: string, age: number, idTirage: string): Generateur {
  hacherTirage(graine, age, idTirage);
  return sfc32(h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0);
}

/** Même sous-générateur, avec le hachage de l'identifiant déjà calculé. */
export function sousGenerateurHache(
  graine: string,
  age: number,
  identifiant: readonly number[],
): Generateur {
  preparerPrefixe(graine, age);
  melangerIdentifiant(identifiant);
  return sfc32(h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0);
}

const parEvenement = new Map<string, Record<string, readonly number[]>>();

/**
 * Hachage de « id.suffixe » (texte, auto, deces, revenu...), gardé par identifiant
 * d'événement : évite de construire et de hacher la chaîne à chaque événement tiré.
 */
export function hachageSuffixe(id: string, suffixe: string): readonly number[] {
  let suffixes = parEvenement.get(id);
  if (!suffixes) {
    suffixes = {};
    parEvenement.set(id, suffixes);
  }
  let hache = suffixes[suffixe];
  if (!hache) {
    hache = hachageIdentifiant(`${id}.${suffixe}`);
    suffixes[suffixe] = hache;
  }
  return hache;
}

/**
 * Graine du tirage (graine, age, idTirage), dans h1..h4 : l'état du hachage de
 * « graine|age| » (commun aux tirages de l'année, gardé en cache) est combiné au
 * hachage de l'identifiant (calculé une fois par identifiant), puis mélangé.
 */
function hacherTirage(graine: string, age: number, idTirage: string): void {
  preparerPrefixe(graine, age);
  melangerIdentifiant(hachageIdentifiant(idTirage));
}

/** Hachage d'un identifiant de tirage, calculé une fois (les identifiants sont en nombre fini). */
export function hachageIdentifiant(idTirage: string): readonly number[] {
  let id = identifiants.get(idTirage);
  if (!id) {
    id = cyrb128(idTirage);
    identifiants.set(idTirage, id);
  }
  return id;
}

/** Combine l'état du préfixe de l'année au hachage de l'identifiant, puis mélange. */
function melangerIdentifiant(id: readonly number[]): void {
  h1 = prefixe.p1 ^ Math.imul(id[0]!, 597399067);
  h2 = prefixe.p2 ^ Math.imul(id[1]!, 2869860233);
  h3 = prefixe.p3 ^ Math.imul(id[2]!, 951274213);
  h4 = prefixe.p4 ^ Math.imul(id[3]!, 2716044179);
  finir();
}

/** Absorbe un caractère (même calcul qu'absorber, pour un seul code). */
function absorberCode(k: number): void {
  h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
  h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
  h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
  h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
}

const BARRE = 124; // « | »
const ZERO = 48; // « 0 »

/**
 * Prépare l'état du hachage de « graine|age| ». L'absorption est séquentielle : l'état
 * après « graine| » est gardé (une vie entière), seuls les chiffres de l'âge et la barre
 * finale sont absorbés chaque année, sans construire de chaîne.
 */
function preparerPrefixe(graine: string, age: number): void {
  if (graine === prefixe.graine && age === prefixe.age) return;
  if (graine !== prefixe.graine) {
    initialiser();
    absorber(graine);
    absorberCode(BARRE);
    prefixe.graine = graine;
    prefixe.g1 = h1;
    prefixe.g2 = h2;
    prefixe.g3 = h3;
    prefixe.g4 = h4;
  } else {
    h1 = prefixe.g1;
    h2 = prefixe.g2;
    h3 = prefixe.g3;
    h4 = prefixe.g4;
  }
  // Chiffres de l'âge (entier positif), du plus fort au plus faible.
  let puissance = 1;
  while (puissance * 10 <= age) puissance *= 10;
  for (; puissance >= 1; puissance = Math.floor(puissance / 10)) {
    absorberCode(ZERO + (Math.floor(age / puissance) % 10));
  }
  absorberCode(BARRE);
  prefixe.age = age;
  prefixe.p1 = h1;
  prefixe.p2 = h2;
  prefixe.p3 = h3;
  prefixe.p4 = h4;
}

const prefixe = { graine: '', age: -1, g1: 0, g2: 0, g3: 0, g4: 0, p1: 0, p2: 0, p3: 0, p4: 0 };
/** Hachage de chaque identifiant de tirage (ils sont en nombre fini). */
const identifiants = new Map<string, [number, number, number, number]>();

/**
 * Tirage simple (graine, age, idTirage) : un flottant dans [0, 1[ pris directement
 * dans le hachage de « graine|age|idTirage », sans générateur. Déterministe et
 * indépendant des autres tirages ; sert aux tirages à une seule valeur, très nombreux
 * (un par événement éligible et par an). Les tirages à plusieurs valeurs utilisent
 * sousGenerateur.
 */
export function tirage(graine: string, age: number, idTirage: string): number {
  return tirageHache(graine, age, hachageIdentifiant(idTirage));
}

/** Même tirage, avec le hachage de l'identifiant déjà calculé (tirage annuel). */
export function tirageHache(graine: string, age: number, identifiant: readonly number[]): number {
  preparerPrefixe(graine, age);
  melangerIdentifiant(identifiant);
  return (h1 >>> 0) / 4294967296;
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
  // Deux passages sans allocation, dans l'ordre des clés ; les poids nuls sont ignorés.
  let total = 0;
  let derniere: K | undefined;
  for (const cle in distribution) {
    const poids = distribution[cle];
    if (poids > 0) {
      total += poids;
      derniere = cle;
    }
  }
  if (derniere === undefined || !Number.isFinite(total)) {
    throw new RangeError('Distribution vide ou invalide');
  }
  let reste = g() * total;
  for (const cle in distribution) {
    const poids = distribution[cle];
    if (poids > 0) {
      reste -= poids;
      if (reste < 0) return cle;
    }
  }
  // Erreurs d'arrondi : on retombe sur la dernière clé.
  return derniere;
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

/**
 * Nombre de succès sur n essais de probabilité p (loi binomiale). Succès rares
 * (p < 0,05, moyenne < 20) : approximation de Poisson ; sinon exacte jusqu'à 100
 * essais, puis loi normale arrondie, bornée à [0, n]. Sert aux mises de jeu.
 */
export function binomiale(g: Generateur, n: number, p: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  const moyenne = n * p;
  if (n <= 100 && p >= 0.05) {
    let succes = 0;
    for (let i = 0; i < n; i++) if (g() < p) succes++;
    return succes;
  }
  if (moyenne < 20) {
    const u = g();
    let k = 0;
    let terme = Math.exp(-moyenne);
    let cumul = terme;
    while (u > cumul && k < n) {
      k++;
      terme *= moyenne / k;
      cumul += terme;
    }
    return k;
  }
  const u1 = 1 - g();
  const u2 = g();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.min(n, Math.max(0, Math.round(moyenne + Math.sqrt(moyenne * (1 - p)) * z)));
}
