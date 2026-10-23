// Pictogrammes en mosaïque, façon semi-graphique Minitel : 8 colonnes × 6 lignes,
// « # » pour un bloc allumé, « . » pour un bloc éteint.

export type Motif = readonly string[];

export const LARGEUR_MOTIF = 8;
export const HAUTEUR_MOTIF = 6;

export const PICTOS: Readonly<Record<string, Motif>> = {
  sante: ['...##...', '...##...', '########', '########', '...##...', '...##...'],
  ecole: ['########', '#..##..#', '#..##..#', '#..##..#', '#..##..#', '########'],
  emploi: ['..####..', '..#..#..', '########', '#......#', '#......#', '########'],
  famille: ['...##...', '..####..', '.######.', '########', '.##..##.', '.##..##.'],
  logement: ['...##...', '..####..', '.######.', '.#.##.#.', '.#.##.#.', '.######.'],
  securite: ['.######.', '##....##', '#..##..#', '#..##..#', '.#....#.', '..####..'],
  police: ['...##...', '.######.', '########', '#.#..#.#', '########', '.#....#.'],
  deuil: ['...##...', '.######.', '...##...', '...##...', '...##...', '...##...'],
  loisirs: ['..####..', '.#.##.#.', '########', '########', '.#.##.#.', '..####..'],
  argent: ['..####..', '.#......', '#####...', '.#......', '#####...', '..####..'],
  orientation: ['....#...', '....##..', '#######.', '#######.', '....##..', '....#...'],
  quotidien: ['########', '#......#', '#.#..#.#', '#......#', '#.####.#', '########'],
  mouvement: ['.######.', '.######.', '.######.', '...##...', '...##...', '...##...'],
};

/** Ordre de priorité : le premier tag de l'événement qui a un picto l'emporte. */
const PAR_TAG: Readonly<Record<string, string>> = {
  deuil: 'deuil',
  police: 'police',
  violence: 'securite',
  securite: 'securite',
  victime: 'securite',
  delinquance: 'police',
  justice: 'police',
  sante: 'sante',
  accident: 'sante',
  maladie_infantile: 'sante',
  ecole: 'ecole',
  orientation: 'orientation',
  formation: 'ecole',
  emploi: 'emploi',
  promotion: 'emploi',
  licenciement: 'emploi',
  opportunite: 'emploi',
  famille: 'famille',
  enfance: 'famille',
  rencontre: 'famille',
  logement: 'logement',
  sinistre: 'logement',
  loisirs: 'loisirs',
  quotidien: 'quotidien',
  mouvement: 'mouvement',
};

/** Picto d'un événement d'après ses tags, ou null. */
export function pictoPour(tags: readonly string[]): Motif | null {
  for (const tag of tags) {
    const nom = PAR_TAG[tag];
    if (nom) return PICTOS[nom]!;
  }
  return null;
}
