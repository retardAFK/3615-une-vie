// Types du moteur : voir docs/regles-du-jeu.md (section 2) et docs/architecture.md.
// Les listes de valeurs servent aussi à valider ce qui vient des tables JSON.

// --- Origine (tirée une fois, jamais modifiée) ---

export const SEXES = ['femme', 'homme'] as const;
export type Sexe = (typeof SEXES)[number];

export const REGIONS = [
  'ile_de_france',
  'auvergne_rhone_alpes',
  'hauts_de_france',
  'nouvelle_aquitaine',
  'occitanie',
  'grand_est',
  'provence_alpes_cote_d_azur',
  'pays_de_la_loire',
  'bretagne',
  'normandie',
  'bourgogne_franche_comte',
  'centre_val_de_loire',
  'corse',
  'guadeloupe',
  'martinique',
  'guyane',
  'la_reunion',
  'mayotte',
] as const;
export type Region = (typeof REGIONS)[number];

export const TERRITOIRES = [
  'grande_metropole',
  'ville_moyenne',
  'periurbain',
  'rural',
  'quartier_prioritaire',
  'drom',
] as const;
export type Territoire = (typeof TERRITOIRES)[number];

export const PCS = [
  'cadre',
  'intermediaire',
  'employe',
  'ouvrier',
  'artisan_commercant',
  'agriculteur',
  'sans_emploi',
] as const;
export type Pcs = (typeof PCS)[number];

export const DIPLOMES = ['aucun', 'cap_bep', 'bac', 'bac_2_3', 'bac_5'] as const;
export type Diplome = (typeof DIPLOMES)[number];

export const DECILES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
export type Decile = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const LOGEMENTS_FAMILIAUX = ['proprietaire', 'locataire_prive', 'hlm', 'precaire'] as const;
export type LogementFamilial = (typeof LOGEMENTS_FAMILIAUX)[number];

export const STRUCTURES_FAMILIALES = [
  'couple',
  'monoparentale',
  'recomposee',
  'placement_ase',
] as const;
export type StructureFamiliale = (typeof STRUCTURES_FAMILIALES)[number];

/** 0 à 5 ; 5 signifie « 5 et plus ». */
export const FRATRIES = ['0', '1', '2', '3', '4', '5'] as const;

export const ORIGINES_MIGRATOIRES = [
  'aucune',
  'premiere_generation',
  'deuxieme_generation',
] as const;
export type OrigineMigratoire = (typeof ORIGINES_MIGRATOIRES)[number];

export const SANTES_NAISSANCE = ['normale', 'prematurite', 'handicap'] as const;
export type SanteNaissance = (typeof SANTES_NAISSANCE)[number];

export interface Origine {
  anneeNaissance: number;
  sexe: Sexe;
  region: Region;
  territoire: Territoire;
  pcsParents: Pcs;
  diplomeParents: Diplome;
  decileRevenuFoyer: Decile;
  structureFamiliale: StructureFamiliale;
  fratrie: number;
  logementFamilial: LogementFamilial;
  origineMigratoire: OrigineMigratoire;
  santeNaissance: SanteNaissance;
}

// --- Traits (0 à 100, cachés au joueur) ---

export const NOMS_TRAITS = [
  'facilite',
  'impulsivite',
  'sociabilite',
  'resilience',
  'ambition',
  'vulnerabiliteGenetique',
] as const;
export type NomTrait = (typeof NOMS_TRAITS)[number];
export type Traits = Record<NomTrait, number>;

// --- Jauges (0 à 100) ---

export interface Jauges {
  santePhysique: number;
  santeMentale: number;
  bienEtre: number;
  liens: number;
  competences: number;
}

// --- Finances (euros constants, entiers) ---

export interface Finances {
  revenuAnnuel: number;
  epargne: number;
  dettes: number;
  patrimoine: number;
}

// --- États (variables discrètes) ---

export type Scolarite =
  'non_scolarise' | 'maternelle' | 'primaire' | 'college' | 'lycee' | 'superieur' | 'sortie';

export type Emploi =
  | 'etudiant'
  | 'cdi'
  | 'cdd'
  | 'interim'
  | 'independant'
  | 'fonctionnaire'
  | 'chomage'
  | 'inactif'
  | 'arret_longue_maladie'
  | 'retraite';

export type Couple =
  'celibataire' | 'en_couple' | 'cohabitation' | 'pacs' | 'mariage' | 'separation' | 'veuvage';

export type Logement = 'chez_parents' | 'locataire_prive' | 'hlm' | 'proprietaire' | 'precaire';

export const PRODUITS = [
  'tabac',
  'alcool',
  'cannabis',
  'autres_drogues',
  'jeux_argent',
  'ecrans',
] as const;
export type Produit = (typeof PRODUITS)[number];

/** Chaîne commune à toutes les addictions, jeux d'argent compris (règles, section 9). */
export type EtatAddiction =
  | 'jamais_expose'
  | 'expose'
  | 'usage_occasionnel'
  | 'usage_regulier'
  | 'dependance'
  | 'sevrage'
  | 'abstinent';

export interface Etats {
  scolarite: Scolarite;
  emploi: Emploi;
  couple: Couple;
  logement: Logement;
  addictions: Record<Produit, EtatAddiction>;
  /** Identifiants des pathologies actives. */
  maladies: string[];
}

// --- Personnage et partie ---

export interface Personnage {
  prenom: string;
  origine: Origine;
  traits: Traits;
  jauges: Jauges;
  finances: Finances;
  etats: Etats;
  age: number;
  vivant: boolean;
}

export type TypeEntree = 'naissance' | 'deces';

export interface EntreeJournal {
  annee: number;
  age: number;
  type: TypeEntree;
}

export interface ModificateurTemporaire {
  /** Événement ou groupe d'événements visé. */
  cible: string;
  m: number;
  /** Âge auquel le modificateur expire. */
  jusquA: number;
}

export interface EtatPartie {
  graine: string;
  annee: number;
  personnage: Personnage;
  historique: EntreeJournal[];
  cooldowns: Record<string, number>;
  modificateursActifs: ModificateurTemporaire[];
}

export interface ChoixJoueur {
  evenementId: string;
  choixId: string;
}

export interface EvenementTire {
  id: string;
  /** Probabilité finale qui a servi au tirage. */
  probabilite: number;
}

export interface ResultatAnnee {
  etat: EtatPartie;
  evenements: EvenementTire[];
  choixProposes: ChoixJoueur[];
  journal: EntreeJournal[];
}

// --- Tables de données (public/data/*.json) ---

export type Conditions = Readonly<Record<string, string>>;

export interface LigneDistribution {
  conditions: Conditions;
  distribution: Readonly<Record<string, number>>;
}

export interface LigneMortalite {
  conditions: Conditions;
  /** Probabilité de décéder dans l'année, indexée par l'âge (0 à 110). */
  qParAge: readonly number[];
}

export interface Table<L> {
  table: string;
  source: string;
  url: string | null;
  aCalibrer: boolean;
  lignes: readonly L[];
}

export type TableDistribution = Table<LigneDistribution>;

export interface Tables {
  anneeNaissance: TableDistribution;
  sexe: TableDistribution;
  region: TableDistribution;
  territoire: TableDistribution;
  pcsParents: TableDistribution;
  diplomeParents: TableDistribution;
  decileRevenuFoyer: TableDistribution;
  structureFamiliale: TableDistribution;
  fratrie: TableDistribution;
  logementFamilial: TableDistribution;
  origineMigratoire: TableDistribution;
  santeNaissance: TableDistribution;
  prenoms: TableDistribution;
  mortalite: Table<LigneMortalite>;
}
