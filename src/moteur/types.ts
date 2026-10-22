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

/** Jauges modifiables directement ; bienEtre est la moyenne des autres. */
export const JAUGES_MODIFIABLES = [
  'santePhysique',
  'santeMentale',
  'liens',
  'competences',
] as const;
export type JaugeModifiable = (typeof JAUGES_MODIFIABLES)[number];

// --- Finances (euros constants, entiers) ---

export interface Finances {
  revenuAnnuel: number;
  epargne: number;
  dettes: number;
  patrimoine: number;
}

// --- États (variables discrètes) ---

export const SCOLARITES = [
  'non_scolarise',
  'maternelle',
  'primaire',
  'college',
  'lycee',
  'superieur',
  'sortie',
] as const;
export type Scolarite = (typeof SCOLARITES)[number];

export const EMPLOIS = [
  'etudiant',
  'cdi',
  'cdd',
  'interim',
  'independant',
  'fonctionnaire',
  'chomage',
  'inactif',
  'arret_longue_maladie',
  'retraite',
] as const;
export type Emploi = (typeof EMPLOIS)[number];

export const COUPLES = [
  'celibataire',
  'en_couple',
  'cohabitation',
  'pacs',
  'mariage',
  'separation',
  'veuvage',
] as const;
export type Couple = (typeof COUPLES)[number];

export const LOGEMENTS = [
  'chez_parents',
  'locataire_prive',
  'hlm',
  'proprietaire',
  'precaire',
] as const;
export type Logement = (typeof LOGEMENTS)[number];

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

// --- Événements (contenu/evenements/*.json) ---

/** Conditions sur l'origine : { champ: [valeurs acceptées] }. */
export type ConditionsOrigine = Readonly<Partial<Record<keyof Origine, readonly string[]>>>;

/** Modificateur de probabilité d'un événement (règles, section 4). */
export type ModificateurEvenement =
  | { trait: NomTrait; k: number }
  | { jauge: keyof Jauges; k: number }
  | { si: ConditionsOrigine; m: number };

/** Cible d'un modificateur de choix : un événement précis, ou tous ceux d'un tag. */
export type CibleModificateur = { evenement: string } | { tag: string };

export interface ModificateurChoix {
  cible: CibleModificateur;
  m: number;
  /** Durée en années ; absente : permanent. */
  duree?: number;
}

export interface CoutChoix {
  /** Variations immédiates des jauges, toujours négatives ou nulles. */
  jauges?: Partial<Record<JaugeModifiable, number>>;
  /** Euros dépensés : pris sur l'épargne, puis en dettes. */
  argent?: number;
}

export interface Affinite {
  trait: NomTrait;
  k: number;
}

export interface ChoixPossible {
  id: string;
  libelle: string;
  cout?: CoutChoix;
  modificateurs?: readonly ModificateurChoix[];
  /** Penchant du mode automatique : poids = produit des e^(k × (trait − 50) / 50). */
  affinites?: readonly Affinite[];
  /** Phrase ajoutée à la ligne de journal. */
  journal?: string;
}

export interface Effets {
  jauges?: Partial<Record<JaugeModifiable, number>>;
  etats?: Partial<Pick<Etats, 'scolarite' | 'emploi' | 'couple' | 'logement'>>;
  /** Probabilité que l'événement soit mortel. */
  deces?: number;
}

export interface Evenement {
  id: string;
  module: string;
  /** Âges d'éligibilité, bornes comprises. */
  age: readonly [number, number];
  requiert?: ConditionsOrigine;
  /** La forme par table sera prise en charge au jalon 4. */
  pBase: number | { source: string; par: readonly string[] };
  aCalibrer?: boolean;
  modificateurs?: readonly ModificateurEvenement[];
  effets: Effets;
  choix?: readonly ChoixPossible[];
  cooldown?: number;
  /** Au plus une fois dans une vie. */
  unique?: boolean;
  /** 1 à 3 : au-delà de 3 événements dans l'année, les plus graves passent. */
  gravite: 1 | 2 | 3;
  tags: readonly string[];
  /** Variantes du texte, avec {variables}. */
  textes: readonly string[];
}

export interface FichierEvenements {
  module: string;
  source: string;
  aCalibrer: boolean;
  evenements: readonly Evenement[];
}

export type Libelles = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Tout ce que le moteur reçoit en plus de l'état. */
export interface Donnees {
  tables: Tables;
  evenements: readonly Evenement[];
  libelles: Libelles;
}

// --- Partie ---

export type TypeEntree = 'naissance' | 'deces' | 'evenement';

export interface EntreeJournal {
  annee: number;
  age: number;
  type: TypeEntree;
  /** Texte rendu (événement). */
  texte?: string;
  evenementId?: string;
  choixId?: string;
  /** Décès : « mortalite » (test annuel) ou id de l'événement mortel. */
  cause?: string;
}

export interface ModificateurTemporaire {
  cible: CibleModificateur;
  m: number;
  /** Premier âge d'effet. */
  debut: number;
  /** Dernier âge d'effet, compris ; null : permanent. */
  fin: number | null;
}

export interface OptionChoix {
  id: string;
  libelle: string;
}

export interface EvenementTire {
  id: string;
  /** Probabilité finale qui a servi au tirage (1 pour un événement reporté). */
  probabilite: number;
  gravite: 1 | 2 | 3;
  tags: readonly string[];
  /** Tiré l'année précédente, puis reporté. */
  reporte: boolean;
  /** Texte rendu, au format Minitel. */
  texte: string;
  /** Choix proposés (vide si aucun). */
  choix: readonly OptionChoix[];
}

/** Année ouverte : événements tirés, en attente des choix. */
export interface AnneeEnCours {
  evenements: readonly EvenementTire[];
}

export interface EtatPartie {
  graine: string;
  annee: number;
  personnage: Personnage;
  historique: EntreeJournal[];
  /** Âge à partir duquel chaque événement redevient éligible. */
  cooldowns: Record<string, number>;
  modificateursActifs: ModificateurTemporaire[];
  anneeEnCours: AnneeEnCours | null;
  /** Événements écartés cette année, à passer l'an prochain. */
  reportes: string[];
}

export interface ChoixJoueur {
  evenementId: string;
  choixId: string;
}

export interface ChoixPropose {
  evenementId: string;
  options: readonly OptionChoix[];
}

export interface ResultatOuverture {
  etat: EtatPartie;
  evenements: readonly EvenementTire[];
  choixProposes: readonly ChoixPropose[];
  journal: EntreeJournal[];
}

export interface ResultatFermeture {
  etat: EtatPartie;
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
