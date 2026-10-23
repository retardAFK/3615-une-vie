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

/** Aides sociales, dans l'ordre de calcul (règles, section 7). */
export const AIDES = [
  'allocationsFamiliales',
  'aah',
  'minimumVieillesse',
  'minimumSocial',
  'complementActivite',
  'aideLogement',
] as const;
export type Aide = (typeof AIDES)[number];

/** Niveaux d'endettement (règles, section 7). */
export const NIVEAUX_ENDETTEMENT = ['sain', 'tendu', 'critique', 'surendettement'] as const;
export type NiveauEndettement = (typeof NIVEAUX_ENDETTEMENT)[number];

export interface Finances {
  revenuAnnuel: number;
  epargne: number;
  dettes: number;
  patrimoine: number;
  /** Aides versées cette année (une aide absente n'est pas versée). */
  aides: Readonly<Partial<Record<Aide, number>>>;
  /** Aides auxquelles le personnage avait droit cette année sans les demander. */
  nonDemandees: readonly Aide[];
  /** Remboursements de l'année. */
  remboursements: number;
  endettement: NiveauEndettement;
  /** Années de suite au niveau critique. */
  anneesCritique: number;
  /** Années restantes du plan d'apurement ; 0 sans plan (accès au crédit bloqué pendant). */
  planApurement: number;
  /** Capital restant dû du crédit immobilier. */
  creditImmobilier: number;
  /** Annuité du crédit immobilier, payée chaque année tant qu'il reste du capital. */
  annuiteImmobilier: number;
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

/** Maladies suivies par le module santé (règles, section 10). */
export const MALADIES = [
  'chronique',
  'cancer',
  'cardiovasculaire',
  'depression',
  'demence',
] as const;
export type Maladie = (typeof MALADIES)[number];

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
export const ETATS_ADDICTION = [
  'jamais_expose',
  'expose',
  'usage_occasionnel',
  'usage_regulier',
  'dependance',
  'sevrage',
  'abstinent',
] as const;
export type EtatAddiction = (typeof ETATS_ADDICTION)[number];

// --- Jeux d'argent (règles, section 8) ---

export const JEUX = [
  'loto',
  'euromillions',
  'grattage',
  'paris_sportifs',
  'hippique',
  'poker',
  'casino',
] as const;
export type NomJeu = (typeof JEUX)[number];

export const BUDGETS_JEU = ['aucun', 'petit', 'moyen', 'gros'] as const;
export type BudgetJeu = (typeof BUDGETS_JEU)[number];

export interface EtatJeu {
  /** Jeu pratiqué ; null tant que le personnage n'en a pas choisi. */
  jeu: NomJeu | null;
  budget: BudgetJeu;
  /** Totaux de toute la vie, toujours visibles (garde-fou, règles section 13). */
  totalMise: number;
  totalRecupere: number;
  miseAnnee: number;
  gainAnnee: number;
  /** « Se refaire » : la mise de l'année suivante est doublée. */
  chasse: boolean;
  /** Interdiction volontaire de jeux : ni jeux en ligne, ni casino. */
  interdiction: boolean;
  /** Pertes de l'année au-delà du seuil de chasse aux pertes. */
  pertesElevees: boolean;
}

// --- Éducation et travail du joueur (règles, sections 5 et 6) ---

/** Diplôme le plus élevé obtenu par le joueur. */
export const DIPLOMES_JOUEUR = [
  'aucun',
  'cap_bep',
  'bac_pro',
  'bac_techno',
  'bac_general',
  'bac_2_3',
  'bac_5',
] as const;
export type DiplomeJoueur = (typeof DIPLOMES_JOUEUR)[number];

/** Voies de fin de 3e ; « sortie » : fin de la scolarité. */
export const VOIES = [
  'generale',
  'technologique',
  'professionnelle',
  'apprentissage',
  'sortie',
] as const;
export type Voie = (typeof VOIES)[number];

/** Après le bac ; « master » : poursuite après une licence. */
export const FILIERES = [
  'universite',
  'bts_but',
  'prepa',
  'ecole',
  'emploi_direct',
  'master',
] as const;
export type Filiere = (typeof FILIERES)[number];

export interface Education {
  diplome: DiplomeJoueur;
  voie: Voie | null;
  filiere: Filiere | null;
  /** Années de retard (redoublements, échec au bac). */
  retard: number;
  /** Âge auquel se termine la formation en cours ; null hors formation. */
  finPalier: number | null;
}

export interface Travail {
  /** Métier du joueur : sa PCS, tirée à l'entrée sur le marché du travail. */
  pcs: Pcs | null;
  /** 1 (temps plein), 0,8 ou 0,5. */
  quotite: number;
  /** Facteur tiré une fois par emploi (loi log-normale autour de 1). */
  bruit: number;
  /** Cumul des promotions et changements d'emploi. */
  progression: number;
  /** Années passées en emploi (courbe d'ancienneté). */
  anciennete: number;
  /** Salaire annuel net de l'année en cours, euros constants. */
  salaire: number;
  /** Dernier salaire avant le chômage ou l'arrêt (base des indemnités). */
  dernierSalaire: number;
  /** Années d'indemnisation déjà consommées dans l'épisode de chômage. */
  dureeChomage: number;
  trimestres: number;
  /** Les 25 meilleurs salaires annuels, du plus haut au plus bas (pension). */
  meilleursSalaires: number[];
  pension: number;
  /** Âge de départ à la retraite ; null avant. */
  ageRetraite: number | null;
}

/** Suites judiciaires (règles, section 14). */
export interface Justice {
  gardesAVue: number;
  condamnations: number;
  /** Casier judiciaire : pèse ensuite sur l'embauche. */
  casier: boolean;
}

/** Niveau judiciaire, pour les conditions : « aucun », « garde_a_vue » ou « casier ». */
export const NIVEAUX_JUSTICE = ['aucun', 'garde_a_vue', 'casier'] as const;

/**
 * Lieu de vie actuel : celui de l'origine jusqu'à un déménagement (règles, section 11).
 * Les conditions sur region et territoire, les salaires, les loyers et l'accès aux soins
 * le suivent ; l'origine reste celle de la naissance.
 */
export interface Residence {
  region: Region;
  territoire: Territoire;
}

/** Ce qu'un enfant reçoit de la situation du joueur le jour de sa naissance. */
export type OrigineTransmise = Pick<
  Origine,
  | 'region'
  | 'territoire'
  | 'pcsParents'
  | 'diplomeParents'
  | 'decileRevenuFoyer'
  | 'structureFamiliale'
  | 'logementFamilial'
>;

/** Enfant du joueur : personnage secondaire dont l'origine vient de la situation du joueur. */
export interface Enfant {
  /** Âge du joueur à la naissance. */
  age: number;
  origine: OrigineTransmise;
}

/** Famille du joueur (règles, section 11). */
export interface Famille {
  enfants: readonly Enfant[];
  /** Au moins un parent du joueur est en vie : l'héritage vient au décès du dernier. */
  parentsVivants: boolean;
  /** Achat immobilier à sa portée cette année (apport, revenus, pas de dettes). */
  achatPossible: boolean;
}

export interface Etats {
  scolarite: Scolarite;
  emploi: Emploi;
  couple: Couple;
  logement: Logement;
  addictions: Record<Produit, EtatAddiction>;
  /** Maladies actives. */
  maladies: readonly Maladie[];
  education: Education;
  travail: Travail;
  justice: Justice;
  /** Âge où commence l'état courant de chaque addiction (risques décroissants avec les années). */
  debutEtatAddiction: Record<Produit, number>;
  jeu: EtatJeu;
  famille: Famille;
  residence: Residence;
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

/** Champs qu'une condition peut tester, en plus de ceux de l'origine. */
export const CHAMPS_ETATS_CONDITIONS = [
  'emploi',
  'scolarite',
  'diplome',
  'pcs',
  'justice',
  'logement',
  'endettement',
  // État de chaque addiction (chaîne commune), et pertes de jeu de l'année.
  ...PRODUITS,
  'pertesJeu',
  'budgetJeu',
  // Chaque maladie : « oui » si elle est active, « non » sinon.
  ...MALADIES,
  // Famille : couple, enfants (« aucun », « un », « plusieurs »), achat possible (« oui », « non »).
  'couple',
  'enfants',
  'achatPossible',
] as const;
export type ChampCondition = keyof Origine | (typeof CHAMPS_ETATS_CONDITIONS)[number];

/** Conditions : { champ: [valeurs acceptées] }, sur l'origine ou les états du joueur. */
export type ConditionsPersonnage = Readonly<Partial<Record<ChampCondition, readonly string[]>>>;

/** Modificateur de probabilité d'un événement (règles, section 4). */
export type ModificateurEvenement =
  | { trait: NomTrait; k: number }
  | { jauge: keyof Jauges; k: number }
  | { si: ConditionsPersonnage; m: number };

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

/**
 * Effets directs d'un choix : actes du joueur, pas des résultats (règles, section 4).
 * Accepter une opportunité tirée par le hasard ; choisir un jeu et un budget,
 * se refaire, s'inscrire à l'interdiction volontaire de jeux (règles, section 8).
 */
export interface EffetsChoix {
  changerEmploi?: boolean;
  jeu?: NomJeu;
  budget?: BudgetJeu;
  chasse?: true;
  interdiction?: true;
  /** Acheter son logement à crédit, quand l'achat est possible (règles, section 7). */
  acheterLogement?: true;
  /** Déménager dans une autre région (règles, section 11). */
  demenager?: true;
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
  /**
   * Accepter une opportunité déjà tirée par le hasard : seule exception
   * à la règle des choix sans résultat direct (règles, section 4).
   */
  effets?: EffetsChoix;
}

export interface Effets {
  jauges?: Partial<Record<JaugeModifiable, number>>;
  etats?: Partial<Pick<Etats, 'scolarite' | 'emploi' | 'couple' | 'logement'>>;
  /** Probabilité que l'événement soit mortel. */
  deces?: number;
  /** Salaire multiplié par un facteur tiré dans [min, max] (promotion). */
  revenu?: readonly [number, number];
  /** Euros gagnés (positif) ou perdus (négatif : épargne, puis dettes). */
  argent?: number;
  /** Suite judiciaire : une condamnation inscrit le casier. */
  justice?: 'garde_a_vue' | 'condamnation';
  /** Dossier de surendettement recevable : un plan d'apurement commence. */
  surendettement?: true;
  /** Maladie qui commence (règles, section 10). */
  maladie?: Maladie;
  /**
   * Modificateurs posés par l'événement lui-même pour les années suivantes, comme ceux
   * d'un choix : par exemple un refus de location qui ralentit l'accès au logement.
   */
  modificateurs?: readonly ModificateurChoix[];
}

export interface Evenement {
  id: string;
  module: string;
  /** Âges d'éligibilité, bornes comprises. */
  age: readonly [number, number];
  requiert?: ConditionsPersonnage;
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
  /** Ressources d'aide affichées avec l'événement (contenu/textes/ressources.json). */
  ressources?: readonly string[];
  /** Années calendaires d'éligibilité, bornes comprises (mouvements sociaux datés). */
  annees?: readonly [number, number];
  /** Règle du contexte qui doit être en vigueur (une loi l'a créée). */
  regle?: RegleConnue;
}

export interface FichierEvenements {
  module: string;
  source: string;
  aCalibrer: boolean;
  evenements: readonly Evenement[];
}

export type Libelles = Readonly<Record<string, Readonly<Record<string, string>>>>;

// --- Contexte historique (contenu/contexte/*.json, règles section 12) ---

export const TYPES_CONTEXTE = ['actualite', 'crise', 'loi', 'mouvement'] as const;
export type TypeContexte = (typeof TYPES_CONTEXTE)[number];

/** Règles qu'une loi peut fixer à sa date d'entrée en vigueur. */
export const REGLES_CONNUES = [
  'bacPro',
  'minimumSocial',
  'complementActivite',
  'aideLogement',
  'aah',
  'minimumVieillesse',
  'surendettement',
  'retablissementPersonnel',
  'allocationsFamiliales',
  'pacs',
] as const;
export type RegleConnue = (typeof REGLES_CONNUES)[number];
/** Valeur d'une règle ; un texte nomme l'aide créée (« LE RSA »). */
export type ValeurRegle = boolean | number | string;

export interface EntreeContexte {
  id: string;
  type: TypeContexte;
  /** Années calendaires, bornes comprises. */
  debut: number;
  fin: number;
  /** France ou monde (actualités internationales). */
  portee: 'france' | 'monde';
  titre: string;
  texte: string;
  /** Source de l'entrée : texte de loi, institution... Obligatoire. */
  source: string;
  url?: string | null;
  /** Qui est touché : sans profil, tout le monde. */
  profil?: ConditionsPersonnage;
  /** Multiplicateurs par tag pendant les années de l'entrée (aCalibrer). */
  multiplicateurs?: Readonly<Record<string, number>>;
  /** Règles fixées par une loi à partir de son année de début. */
  regles?: Readonly<Partial<Record<RegleConnue, ValeurRegle>>>;
  aCalibrer?: boolean;
}

export interface FichierContexte {
  source: string;
  entrees: readonly EntreeContexte[];
}

/** Tout ce que le moteur reçoit en plus de l'état. */
export interface Donnees {
  tables: Tables;
  evenements: readonly Evenement[];
  libelles: Libelles;
  contexte: readonly EntreeContexte[];
}

// --- Partie ---

/**
 * « resume » : années sans événement de la petite enfance, en une ligne ;
 * « actualite » : entrée du contexte historique qui commence cette année-là.
 */
export type TypeEntree =
  | 'naissance'
  | 'deces'
  | 'evenement'
  | 'resume'
  | 'actualite'
  | 'argent'
  | 'jeu'
  | 'addiction'
  | 'sante'
  | 'famille';

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
  /** Actualité : id de l'entrée du contexte historique. */
  contexteId?: string;
  /** Jeu : totaux de la vie misés et récupérés (l'interface les met en forme). */
  totalMise?: number;
  totalRecupere?: number;
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
  /** Ressources d'aide à afficher avec l'événement. */
  ressources: readonly string[];
}

/** Année ouverte : événements tirés, en attente des choix. */
export interface AnneeEnCours {
  evenements: readonly EvenementTire[];
}

/** Options de création d'une partie, gardées pour REVIVRE. */
export interface OptionsPartie {
  /** Année imposée ; absente : tirage pondéré. */
  anneeNaissance?: number;
  /**
   * Champs de l'origine imposés (« mêmes choix, autre naissance », enfants du joueur) :
   * les autres restent tirés, conditionnés par ceux-ci. L'année se règle par anneeNaissance.
   */
  origine?: Partial<Omit<Origine, 'anneeNaissance'>>;
  /**
   * L'année imposée peut sortir de la table des naissances (enfants du joueur, nés
   * après 2010) : les tables suivent alors par repli vers leurs lignes sans période.
   */
  anneeLibre?: true;
}

/** Ce qui se cumule au fil de la vie pour le bilan (règles, section 13). */
export interface Parcours {
  /** Somme du moral (santeMentale) et nombre d'années vécues, par décennie d'âge. */
  moral: readonly number[];
  annees: readonly number[];
  anneesChomage: number;
  /** Années avec au moins une addiction en dépendance. */
  anneesDependance: number;
  revenusCumules: number;
  coutAddictions: number;
  /** Revenu de l'année des 60 ans ; null avant (le bilan prend alors le dernier revenu). */
  revenu60: number | null;
}

export interface EtatPartie {
  graine: string;
  options: OptionsPartie;
  parcours: Parcours;
  annee: number;
  personnage: Personnage;
  historique: EntreeJournal[];
  /**
   * Âge à partir duquel chaque événement redevient éligible, indexé par son rang
   * dans donnees.evenements (case vide : éligible).
   */
  cooldowns: number[];
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
  /**
   * Paramètres qui sont des choix de conception (effets sur les jauges, poids des traits,
   * seuils de mécanique), pas des statistiques : jamais calibrés sur des données.
   */
  reglages?: { noms: readonly string[]; source: string };
}

export type TableDistribution = Table<LigneDistribution>;

/** Une valeur par combinaison de conditions (probabilité, coefficient, montant...). */
export interface LigneValeur {
  conditions: Conditions;
  valeur: number;
}
export type TableValeur = Table<LigneValeur>;

/** Plusieurs paramètres nommés par combinaison de conditions. */
export interface LigneValeurs {
  conditions: Conditions;
  valeurs: Readonly<Record<string, number>>;
}
export type TableValeurs = Table<LigneValeurs>;

/** Un rang de gain d'un jeu : probabilité par mise unitaire et gain en euros. */
export interface RangJeu {
  probabilite: number;
  gain: number;
}

/** Règles mathématiques d'un jeu d'argent : prix d'une mise et rangs de gain. */
export interface LigneJeu {
  conditions: Conditions;
  prix: number;
  rangs: readonly RangJeu[];
  /** Bloqué par l'interdiction volontaire de jeux (en ligne, casino). */
  bloqueParInterdiction: boolean;
}
export type TableJeux = Table<LigneJeu>;

/** Une valeur par année écoulée (courbe d'ancienneté). */
export interface LigneCourbe {
  conditions: Conditions;
  parAnnee: readonly number[];
}

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
  /** Correction des causes modélisées par le jeu, par sexe, décennie et âge (calibrée). */
  correctionMortalite: Table<LigneCourbe>;
  // Éducation
  obligationScolaire: TableValeur;
  redoublement: TableValeur;
  voieFin3e: TableDistribution;
  decrochage: TableValeur;
  reussiteDiplome: TableValeur;
  orientationPostBac: TableDistribution;
  abandonSup: TableValeur;
  poursuiteMaster: TableValeur;
  repriseEtudes: TableValeur;
  // Emploi et retraite
  pcsJoueur: TableDistribution;
  insertion: TableDistribution;
  transitionsEmploi: TableDistribution;
  salaireReference: TableValeur;
  coefficientPcs: TableValeur;
  coefficientDiplome: TableValeur;
  coefficientRegion: TableValeur;
  courbeAnciennete: Table<LigneCourbe>;
  quotite: TableDistribution;
  parametresEmploi: TableValeurs;
  ageLegalRetraite: TableValeurs;
  // Argent
  depensesVie: TableValeur;
  parametresArgent: TableValeurs;
  baremesAides: TableValeurs;
  nonRecours: TableValeur;
  // Addictions et jeux d'argent
  transitionsAddictions: TableValeurs;
  expositionAddictions: TableValeur;
  sexeAddictions: TableValeur;
  effetsAddictions: TableValeurs;
  interactionsAddictions: TableValeur;
  addictionsAutresTags: TableValeur;
  parametresAddictions: TableValeurs;
  jeuxArgent: TableJeux;
  budgetsJeu: TableValeur;
  // Santé
  vieillissement: Table<LigneCourbe>;
  maladies: TableValeurs;
  mortaliteFacteurs: TableValeur;
  parametresSante: TableValeurs;
  // Famille et logement
  courbesFamille: Table<LigneCourbe>;
  fecondite: Table<LigneCourbe>;
  parametresFamille: TableValeurs;
  unions: TableValeurs;
  effetsEnfant: TableValeurs;
  loyers: TableValeur;
  prixLogement: TableValeur;
  heritage: TableValeur;
  mobilite: TableDistribution;
  // Bilan
  seuilsDeciles: TableValeurs;
}
