// Famille et logement (règles, section 11 ; section 7 pour l'achat immobilier et
// l'héritage) : rencontre, vie commune, mariage ou PACS, séparation, veuvage, enfants,
// départ de chez les parents, logement, crédit immobilier, décès des parents.
// Tirages annuels par la formule des cotes ; les choix visent les tags de TAGS_FAMILLE.

import { multiplicateurTrait, probabiliteParProduit } from '../cotes';
import { aUneAddictionActive, produitTag } from '../evenements';
import { remplir } from '../recit';
import { hachageIdentifiant, sousGenerateur, tirageHache, tirerPondere } from '../rng';
import { chercherLigne, parametre, periodeDe, valeurDe } from '../tables';
import type {
  Couple,
  Donnees,
  EntreeJournal,
  EtatPartie,
  Finances,
  Jauges,
  Logement,
  ModificateurTemporaire,
  Personnage,
  Region,
  Tables,
  Territoire,
} from '../types';
import { appliquerMontant, estAutonome } from './argent';
import { regleEnVigueur } from './contexte';
import { estSalarie } from './emploi';
import { probabiliteDecesTable } from './sante';

/** Tags que les choix peuvent viser (sortir, projet d'enfant, demande HLM...). */
export const TAGS_FAMILLE: readonly string[] = [
  'rencontre',
  'separation',
  'naissance_enfant',
  'depart_parents',
  'logement_hlm',
];

/** États où le joueur vit une relation (un conjoint existe). */
const EN_COUPLE: ReadonlySet<Couple> = new Set(['en_couple', 'cohabitation', 'pacs', 'mariage']);
/** États où le couple vit sous le même toit et partage les charges. */
const SOUS_LE_MEME_TOIT: ReadonlySet<Couple> = new Set(['cohabitation', 'pacs', 'mariage']);

export const estEnCouple = (couple: Couple): boolean => EN_COUPLE.has(couple);
export const vitEnCouple = (couple: Couple): boolean => SOUS_LE_MEME_TOIT.has(couple);

const NOMS_PARAMETRES = [
  'kSociabiliteRencontre',
  'ageCohabitationMin',
  'mEnCoupleSeparation',
  'mMariageSeparation',
  'mPacsSeparation',
  'mDettesTendu',
  'mDettesCritique',
  'mAddictionSeparation',
  'anneesChomageLong',
  'mChomageLongSeparation',
  'kLiensSeparation',
  'ecartAgeConjoint',
  'mEnCoupleNaissance',
  'mParEnfant',
  'enfantsMax',
  'ageAutonomieEnfant',
  'coutEnfant',
  'partChargesCouple',
  'bonusLiensCouple',
  'perteMentaleSeparation',
  'perteLiensSeparation',
  'coutSeparation',
  'perteMentaleVeuvage',
  'perteLiensVeuvage',
  'bonusLiensNaissance',
  'ecartAgeParents',
  'ageDeuilParents',
  'perteMentaleDeuil',
  'perteLiensDeuil',
  'kDecileHeritage',
  'ageSortieAse',
  'mEmploiDepart',
  'multipleLoyerAcces',
  'plafondHlm',
  'pHlm',
  'pSortieHlm',
  'pSortiePrecaire',
  'perteSantePrecaire',
  'mPrecaireChomage',
  'partApport',
  'dureeCredit',
  'tauxCredit',
  'multipleRevenuAchat',
  'ageAchatMax',
] as const;
type ParametresFamille = Readonly<Record<(typeof NOMS_PARAMETRES)[number], number>>;

/** Identifiants de tirage du module, hachés une fois. */
const ID = Object.fromEntries(
  [
    'parents',
    'rencontre',
    'veuvage',
    'separation',
    'union',
    'naissance',
    'tempsPartiel',
    'depart',
    'hlm',
    'sortieHlm',
    'sortiePrecaire',
  ].map((nom) => [nom, hachageIdentifiant(`famille.${nom}`)]),
) as Readonly<Record<string, readonly number[]>>;

/** Valeurs d'une année calendaire : salaire de référence et propensions des unions. */
interface AnneeFamille {
  reference: number;
  pCohabitation: number;
  pMariageDirect: number;
  pMariage: number;
  pPacs: number;
  pSeparation: number;
}

/** Tout ce que le module lit dans les tables, une fois par jeu de tables (et par année). */
interface ConfigFamille {
  tables: Tables;
  parametres: ParametresFamille;
  rencontre: readonly number[];
  decohabitation: readonly number[];
  fecondite: readonly number[];
  annees: Map<number, AnneeFamille>;
  /** Avant cet âge, rien ne peut changer (ni rencontre, ni départ, ni deuil). */
  ageDebut: number;
  /** Prix d'un logement en multiple du salaire de référence, par territoire. */
  prix: Map<string, number>;
  /** Loyer en part du salaire de référence, par territoire puis logement. */
  loyers: Map<string, Map<Logement, number>>;
}

const configurations = new WeakMap<Tables, ConfigFamille>();
let derniere: ConfigFamille | null = null;

function configuration(tables: Tables): ConfigFamille {
  if (derniere && derniere.tables === tables) return derniere;
  let config = configurations.get(tables);
  if (!config) {
    const parametres = {} as Record<(typeof NOMS_PARAMETRES)[number], number>;
    for (const nom of NOMS_PARAMETRES) parametres[nom] = parametre(tables.parametresFamille, nom);
    const courbe = (nom: string): readonly number[] =>
      chercherLigne(tables.courbesFamille, { courbe: nom }, []).parAnnee;
    config = {
      tables,
      parametres,
      rencontre: courbe('rencontre'),
      decohabitation: courbe('decohabitation'),
      fecondite: courbe('fecondite'),
      annees: new Map(),
      ageDebut: Math.min(
        premierAge(courbe('rencontre')),
        premierAge(courbe('decohabitation')),
        parametres.ageDeuilParents,
        parametres.ageSortieAse,
      ),
      prix: new Map(),
      loyers: new Map(),
    };
    configurations.set(tables, config);
  }
  derniere = config;
  return config;
}

/** Premier âge où la courbe n'est pas nulle. */
function premierAge(courbe: readonly number[]): number {
  const age = courbe.findIndex((valeur) => valeur > 0);
  return age === -1 ? courbe.length : age;
}

const borner = (valeur: number): number => Math.min(100, Math.max(0, valeur));
const auAge = (courbe: readonly number[], age: number): number =>
  age < 0 ? 0 : (courbe[Math.min(age, courbe.length - 1)] ?? 0);

function anneeFamille(config: ConfigFamille, annee: number): AnneeFamille {
  let valeurs = config.annees.get(annee);
  if (!valeurs) {
    const { tables } = config;
    const periode = periodeDe(annee);
    const unions = (nom: string): number => parametre(tables.unions, nom, { periode }, ['periode']);
    valeurs = {
      reference: valeurDe(tables.salaireReference, { periode }, ['periode']),
      pCohabitation: unions('pCohabitation'),
      pMariageDirect: unions('pMariageDirect'),
      pMariage: unions('pMariage'),
      pPacs: unions('pPacs'),
      pSeparation: unions('pSeparation'),
    };
    config.annees.set(annee, valeurs);
  }
  return valeurs;
}

function reference(annee: number, tables: Tables): number {
  return anneeFamille(configuration(tables), annee).reference;
}

/** Enfants de moins de l'âge d'autonomie : à charge (coût, allocations familiales). */
export function enfantsACharge(personnage: Personnage, tables: Tables): number {
  const limite = configuration(tables).parametres.ageAutonomieEnfant;
  let n = 0;
  for (const age of personnage.etats.famille.enfants) {
    if (personnage.age - age < limite) n++;
  }
  return n;
}

/** Loyer annuel (ou charges d'un propriétaire) pour ce logement, avant partage. */
function loyer(personnage: Personnage, logement: Logement, annee: number, tables: Tables): number {
  const config = configuration(tables);
  const { territoire } = personnage.etats.residence;
  let parLogement = config.loyers.get(territoire);
  if (!parLogement) {
    parLogement = new Map();
    config.loyers.set(territoire, parLogement);
  }
  let part = parLogement.get(logement);
  if (part === undefined) {
    part = valeurDe(tables.loyers, { logement, territoire }, ['territoire']);
    parLogement.set(logement, part);
  }
  return part * anneeFamille(config, annee).reference;
}

/**
 * Dépenses de l'année liées à la famille et au logement : loyer (partagé en vie
 * commune), coût des enfants à charge et annuité du crédit immobilier, partagés aussi.
 * Avant l'autonomie, les parents paient.
 */
export function depensesFamille(personnage: Personnage, annee: number, tables: Tables): number {
  if (!estAutonome(personnage)) return 0;
  const { parametres } = configuration(tables);
  const part = vitEnCouple(personnage.etats.couple) ? parametres.partChargesCouple : 1;
  const enfants =
    enfantsACharge(personnage, tables) * parametres.coutEnfant * reference(annee, tables);
  return Math.round(
    (loyer(personnage, personnage.etats.logement, annee, tables) +
      enfants +
      personnage.finances.annuiteImmobilier) *
      part,
  );
}

/** Prix d'un logement sur le territoire du personnage, cette année. */
function prixLogement(personnage: Personnage, annee: number, tables: Tables): number {
  const config = configuration(tables);
  const { territoire } = personnage.etats.residence;
  let multiple = config.prix.get(territoire);
  if (multiple === undefined) {
    multiple = valeurDe(tables.prixLogement, { territoire }, ['territoire']);
    config.prix.set(territoire, multiple);
  }
  return multiple * anneeFamille(config, annee).reference;
}

/** L'achat est à sa portée : locataire, apport épargné, revenus suffisants, pas de dettes. */
export function peutAcheter(personnage: Personnage, annee: number, tables: Tables): boolean {
  const { parametres } = configuration(tables);
  const { finances, etats } = personnage;
  if (etats.logement !== 'locataire_prive' && etats.logement !== 'hlm') return false;
  if (!estAutonome(personnage) || personnage.age > parametres.ageAchatMax) return false;
  if (finances.dettes > 0 || finances.planApurement > 0 || finances.creditImmobilier > 0) {
    return false;
  }
  const prix = prixLogement(personnage, annee, tables);
  // En vie commune, les deux revenus comptent : approché par la part des charges.
  const part = vitEnCouple(etats.couple) ? parametres.partChargesCouple : 1;
  return (
    finances.epargne >= parametres.partApport * prix &&
    (finances.revenuAnnuel / part) * parametres.multipleRevenuAchat >= prix
  );
}

/**
 * Achat du logement (choix du joueur) : l'apport est pris sur l'épargne, le reste
 * emprunté sur la durée du crédit, à annuités constantes. Le logement entre au patrimoine.
 */
export function acheterLogement(etat: EtatPartie, donnees: Donnees): EtatPartie {
  const { personnage, annee } = etat;
  const { tables } = donnees;
  if (!peutAcheter(personnage, annee, tables)) return etat;
  const { parametres } = configuration(tables);
  const prix = Math.round(prixLogement(personnage, annee, tables));
  const apport = Math.round(parametres.partApport * prix);
  const credit = prix - apport;
  const t = parametres.tauxCredit;
  // Arrondie à l'euro supérieur : le crédit s'éteint au plus tard à la dernière échéance.
  const annuite = Math.ceil((credit * t) / (1 - Math.pow(1 + t, -parametres.dureeCredit)));
  const finances: Finances = {
    ...personnage.finances,
    epargne: personnage.finances.epargne - apport,
    patrimoine: personnage.finances.patrimoine + prix,
    creditImmobilier: credit,
    annuiteImmobilier: annuite,
  };
  const journal = recit(donnees, etat, 'logementAchat');
  return {
    ...etat,
    personnage: {
      ...personnage,
      finances,
      etats: {
        ...personnage.etats,
        logement: 'proprietaire',
        famille: { ...personnage.etats.famille, achatPossible: false },
      },
    },
    historique: journal ? [...etat.historique, journal] : etat.historique,
  };
}

function recit(
  donnees: Donnees,
  etat: EtatPartie,
  cle: string,
  logement?: Logement,
): EntreeJournal | null {
  const modele = donnees.libelles.recits?.[cle];
  if (!modele) return null;
  const variables = logement
    ? { logement: donnees.libelles.logement?.[logement] ?? logement.toUpperCase() }
    : {};
  return {
    annee: etat.annee,
    age: etat.personnage.age,
    type: 'famille',
    texte: remplir(modele, variables),
  };
}

/**
 * Déménagement dans une autre région (choix du joueur, souvent pour un emploi) : région
 * et territoire tirés dans la table mobilite, la région quittée exclue. Le logement suit :
 * on quitte ses parents ou son HLM pour une location ; un propriétaire garde son bien
 * (l'événement ne lui est pas proposé).
 */
export function demenager(etat: EtatPartie, donnees: Donnees, idTirage: string): EtatPartie {
  const { personnage } = etat;
  const { tables } = donnees;
  const g = sousGenerateur(etat.graine, personnage.age, `${idTirage}.demenager`);
  const regions = {
    ...chercherLigne(tables.mobilite, { cible: 'region' }, []).distribution,
  } as Record<Region, number>;
  delete regions[personnage.etats.residence.region];
  const region = tirerPondere(g, regions);
  const territoire = tirerPondere(
    g,
    chercherLigne(tables.mobilite, { cible: 'territoire' }, []).distribution as Record<
      Territoire,
      number
    >,
  );
  const { logement } = personnage.etats;
  const nouveauLogement: Logement =
    logement === 'chez_parents' || logement === 'hlm' ? 'locataire_prive' : logement;
  const modele = donnees.libelles.recits?.mobiliteDemenagement;
  const journal: EntreeJournal | null = modele
    ? {
        annee: etat.annee,
        age: personnage.age,
        type: 'famille',
        texte: remplir(modele, {
          region: donnees.libelles.region?.[region] ?? region.toUpperCase(),
        }),
      }
    : null;
  return {
    ...etat,
    personnage: {
      ...personnage,
      etats: { ...personnage.etats, residence: { region, territoire }, logement: nouveauLogement },
    },
    historique: journal ? [...etat.historique, journal] : etat.historique,
  };
}

/** État de travail d'une année : le personnage, ses jauges et le journal en cours. */
interface Travail {
  personnage: Personnage;
  jauges: Jauges;
  journal: EntreeJournal[];
  modificateurs: ModificateurTemporaire[] | null;
}

/**
 * Évolution annuelle de la famille et du logement, après l'emploi, les addictions et
 * la santé : décès des parents et héritage, couple, naissance, logement, crédit.
 */
export function evoluerFamille(
  etat: EtatPartie,
  donnees: Donnees,
): { etat: EtatPartie; journal: EntreeJournal[] } {
  const { tables } = donnees;
  const config = configuration(tables);
  if (etat.personnage.age < config.ageDebut) return { etat, journal: [] };
  const t: Travail = {
    personnage: etat.personnage,
    jauges: etat.personnage.jauges,
    journal: [],
    modificateurs: null,
  };
  const ecrire = (cle: string, logement?: Logement): void => {
    const entree = recit(donnees, etat, cle, logement);
    if (entree) t.journal.push(entree);
  };
  const changer = (modifs: Partial<Personnage['etats']>): void => {
    t.personnage = { ...t.personnage, etats: { ...t.personnage.etats, ...modifs } };
  };
  const changerFamille = (modifs: Partial<Personnage['etats']['famille']>): void => {
    changer({ famille: { ...t.personnage.etats.famille, ...modifs } });
  };

  deuilDesParents(etat, donnees, config, t, ecrire, changerFamille);
  evoluerCouple(etat, donnees, config, t, ecrire, changer);
  naissance(etat, donnees, config, t, ecrire, changerFamille);
  evoluerLogement(etat, donnees, config, t, ecrire, changer);

  // Crédit immobilier : les intérêts courent, l'annuité de l'année (payée au bilan) amortit.
  const { finances } = t.personnage;
  if (finances.creditImmobilier > 0) {
    const restant = Math.round(
      finances.creditImmobilier * (1 + config.parametres.tauxCredit) - finances.annuiteImmobilier,
    );
    const fini = restant <= 0;
    if (fini) ecrire('logementCreditFini');
    t.personnage = {
      ...t.personnage,
      finances: {
        ...finances,
        creditImmobilier: fini ? 0 : restant,
        annuiteImmobilier: fini ? 0 : finances.annuiteImmobilier,
      },
    };
  }
  const achatPossible = peutAcheter(t.personnage, etat.annee, tables);
  if (achatPossible !== t.personnage.etats.famille.achatPossible) changerFamille({ achatPossible });

  if (t.personnage === etat.personnage && t.modificateurs === null) {
    return { etat, journal: t.journal };
  }
  return {
    etat: {
      ...etat,
      personnage: { ...t.personnage, jauges: t.jauges },
      modificateursActifs: t.modificateurs ?? etat.modificateursActifs,
    },
    journal: t.journal,
  };
}

type Ecrire = (cle: string, logement?: Logement) => void;

/**
 * Décès du dernier parent, à partir de l'âge adulte du joueur (table de mortalité,
 * à l'âge de la mère). Deuil, puis héritage selon le logement et le revenu familiaux.
 */
function deuilDesParents(
  etat: EtatPartie,
  donnees: Donnees,
  config: ConfigFamille,
  t: Travail,
  ecrire: Ecrire,
  changerFamille: (modifs: Partial<Personnage['etats']['famille']>) => void,
): void {
  const { personnage, annee, graine } = etat;
  const { parametres } = config;
  if (!personnage.etats.famille.parentsVivants || personnage.age < parametres.ageDeuilParents) {
    return;
  }
  const q = probabiliteDecesTable(
    personnage.age + parametres.ecartAgeParents,
    'femme',
    annee,
    donnees.tables,
  );
  if (tirageHache(graine, personnage.age, ID.parents!) >= q) return;
  changerFamille({ parentsVivants: false });
  t.jauges = {
    ...t.jauges,
    santeMentale: borner(t.jauges.santeMentale - parametres.perteMentaleDeuil),
    liens: borner(t.jauges.liens - parametres.perteLiensDeuil),
  };
  ecrire('familleDeuil');
  const { origine } = personnage;
  if (origine.structureFamiliale === 'placement_ase') return;
  const base = valeurDe(donnees.tables.heritage, { logementFamilial: origine.logementFamilial }, [
    'logementFamilial',
  ]);
  const montant = Math.round(
    base *
      reference(annee, donnees.tables) *
      Math.exp((parametres.kDecileHeritage * (origine.decileRevenuFoyer - 5.5)) / 4.5),
  );
  if (montant <= 0) return;
  t.personnage = {
    ...t.personnage,
    finances: appliquerMontant(t.personnage.finances, montant),
  };
  ecrire('familleHeritage');
}

/** Multiplicateur de séparation selon la situation du couple (règles, section 11). */
function facteurSeparation(personnage: Personnage, config: ConfigFamille): number {
  const { parametres } = config;
  const { etats, finances } = personnage;
  let m = 1;
  if (etats.couple === 'en_couple') m *= parametres.mEnCoupleSeparation;
  else if (etats.couple === 'mariage') m *= parametres.mMariageSeparation;
  else if (etats.couple === 'pacs') m *= parametres.mPacsSeparation;
  if (finances.endettement === 'tendu') m *= parametres.mDettesTendu;
  else if (finances.endettement === 'critique' || finances.endettement === 'surendettement') {
    m *= parametres.mDettesCritique;
  }
  if (aUneAddictionActive(etats.addictions)) m *= parametres.mAddictionSeparation;
  if (etats.emploi === 'chomage' && etats.travail.dureeChomage >= parametres.anneesChomageLong) {
    m *= parametres.mChomageLongSeparation;
  }
  return m * multiplicateurTrait(personnage.jauges.liens, parametres.kLiensSeparation);
}

/**
 * Couple : rencontre pour qui est seul ; pour un couple, veuvage (mortalité du
 * conjoint), puis séparation, puis avancée vers la vie commune, le mariage ou le PACS.
 */
function evoluerCouple(
  etat: EtatPartie,
  donnees: Donnees,
  config: ConfigFamille,
  t: Travail,
  ecrire: Ecrire,
  changer: (modifs: Partial<Personnage['etats']>) => void,
): void {
  const { personnage, annee, graine } = etat;
  const { parametres } = config;
  const { couple } = personnage.etats;
  const { age } = personnage;
  const suivant = age + 1;
  const tirer = (id: string): number => tirageHache(graine, age, ID[id]!);

  if (!estEnCouple(couple)) {
    const base = auAge(config.rencontre, age);
    if (base === 0) return;
    const p = probabiliteParProduit(
      base,
      multiplicateurTrait(personnage.traits.sociabilite, parametres.kSociabiliteRencontre) *
        produitTag(etat, 'rencontre', suivant, donnees),
    );
    if (tirer('rencontre') < p) {
      changer({ couple: 'en_couple' });
      ecrire('familleRencontre');
    }
    return;
  }

  // Le conjoint a à peu près le même âge : un peu plus âgé pour une femme.
  const ecart = personnage.origine.sexe === 'femme' ? 1 : -1;
  const qConjoint = probabiliteDecesTable(
    Math.max(0, age + ecart * parametres.ecartAgeConjoint),
    personnage.origine.sexe === 'femme' ? 'homme' : 'femme',
    annee,
    donnees.tables,
  );
  if (tirer('veuvage') < qConjoint) {
    changer({ couple: 'veuvage' });
    t.jauges = {
      ...t.jauges,
      santeMentale: borner(t.jauges.santeMentale - parametres.perteMentaleVeuvage),
      liens: borner(t.jauges.liens - parametres.perteLiensVeuvage),
    };
    ecrire('familleVeuvage');
    return;
  }

  const unions = anneeFamille(config, annee);
  const pSeparation = probabiliteParProduit(
    unions.pSeparation,
    facteurSeparation(personnage, config) * produitTag(etat, 'separation', suivant, donnees),
  );
  if (tirer('separation') < pSeparation) {
    changer({ couple: 'separation' });
    t.jauges = {
      ...t.jauges,
      santeMentale: borner(t.jauges.santeMentale - parametres.perteMentaleSeparation),
      liens: borner(t.jauges.liens - parametres.perteLiensSeparation),
    };
    // Deux logements au lieu d'un : un coût la première année.
    if (vitEnCouple(couple) && estAutonome(personnage)) {
      t.personnage = {
        ...t.personnage,
        finances: appliquerMontant(
          t.personnage.finances,
          -parametres.coutSeparation * reference(annee, donnees.tables),
        ),
      };
    }
    ecrire('familleSeparation');
    return;
  }

  if (vitEnCouple(couple)) {
    t.jauges = { ...t.jauges, liens: borner(t.jauges.liens + parametres.bonusLiensCouple) };
  }
  // Avancée du couple : un seul tirage, issues exclusives (rien après le mariage).
  if (couple === 'mariage') return;
  if (couple === 'en_couple') {
    if (age < parametres.ageCohabitationMin) return;
    const u = tirer('union');
    if (u < unions.pCohabitation) {
      changer({ couple: 'cohabitation' });
      ecrire('familleCohabitation');
    } else if (u < unions.pCohabitation + unions.pMariageDirect) {
      changer({ couple: 'mariage' });
      ecrire('familleMariage');
    }
  } else {
    const u = tirer('union');
    const pacsPossible = regleEnVigueur(donnees.contexte, annee, 'pacs') === true;
    if (u < unions.pMariage) {
      changer({ couple: 'mariage' });
      ecrire('familleMariage');
    } else if (couple === 'cohabitation' && pacsPossible && u < unions.pMariage + unions.pPacs) {
      changer({ couple: 'pacs' });
      ecrire('famillePacs');
    }
  }
}

/**
 * Naissance d'un enfant : fécondité selon l'âge de la mère (le joueur, ou sa
 * conjointe), réduite hors vie commune et avec le nombre d'enfants, augmentée par le
 * projet d'enfant (choix). Effet sur la carrière, plus fort pour les femmes.
 */
function naissance(
  etat: EtatPartie,
  donnees: Donnees,
  config: ConfigFamille,
  t: Travail,
  ecrire: Ecrire,
  changerFamille: (modifs: Partial<Personnage['etats']['famille']>) => void,
): void {
  const { personnage, graine } = etat;
  const { parametres } = config;
  // Le couple du début d'année : pas de naissance l'année de la rencontre.
  const { couple } = personnage.etats;
  if (!estEnCouple(couple)) return;
  const { enfants } = personnage.etats.famille;
  if (enfants.length >= parametres.enfantsMax) return;
  const { age } = personnage;
  const ageMere = personnage.origine.sexe === 'femme' ? age : age - parametres.ecartAgeConjoint;
  const base = auAge(config.fecondite, ageMere);
  if (base === 0) return;
  let m =
    Math.pow(parametres.mParEnfant, enfants.length) *
    produitTag(etat, 'naissance_enfant', age + 1, donnees);
  if (!vitEnCouple(couple)) m *= parametres.mEnCoupleNaissance;
  if (tirageHache(graine, age, ID.naissance!) >= probabiliteParProduit(base, m)) return;

  changerFamille({ enfants: [...enfants, age] });
  t.jauges = { ...t.jauges, liens: borner(t.jauges.liens + parametres.bonusLiensNaissance) };
  ecrire('familleNaissance');
  // Carrière : passage au temps partiel, progression ralentie (table effetsEnfant).
  const { travail, emploi } = t.personnage.etats;
  if (!estSalarie(emploi)) return;
  const effets = (nom: string): number =>
    parametre(donnees.tables.effetsEnfant, nom, { sexe: personnage.origine.sexe }, ['sexe']);
  const partiel = tirageHache(graine, age, ID.tempsPartiel!) < effets('pTempsPartiel');
  t.personnage = {
    ...t.personnage,
    etats: {
      ...t.personnage.etats,
      travail: {
        ...travail,
        quotite: partiel ? Math.min(travail.quotite, 0.8) : travail.quotite,
        progression: travail.progression * (1 - effets('perteProgression')),
      },
    },
  };
}

/**
 * Logement : départ de chez les parents (tiré, ou forcé par la vie commune, la fin
 * d'un placement ou le décès des parents), accès au HLM sous plafond de ressources,
 * sortie de la précarité. Sans logement stable : santé et emploi en souffrent.
 */
function evoluerLogement(
  etat: EtatPartie,
  donnees: Donnees,
  config: ConfigFamille,
  t: Travail,
  ecrire: Ecrire,
  changer: (modifs: Partial<Personnage['etats']>) => void,
): void {
  const { annee, graine } = etat;
  const { tables } = donnees;
  const { parametres } = config;
  const personnage = t.personnage;
  const { logement, couple, emploi } = personnage.etats;
  const { age } = personnage;
  const suivant = age + 1;
  const tirer = (id: string): number => tirageHache(graine, age, ID[id]!);
  const revenu = personnage.finances.revenuAnnuel;
  const ref = reference(annee, tables);
  const sousPlafond = revenu < parametres.plafondHlm * ref;
  const pHlm = (): number =>
    probabiliteParProduit(parametres.pHlm, produitTag(etat, 'logement_hlm', suivant, donnees));

  /** Où aller en quittant un logement : location si les revenus suffisent, sinon HLM. */
  const destination = (force: boolean): Logement | null => {
    // Un étudiant qui part est logé avec l'aide de ses parents.
    if (!estAutonome(personnage)) return force ? 'locataire_prive' : null;
    const part = vitEnCouple(couple) ? parametres.partChargesCouple : 1;
    const loyerPrive = loyer(personnage, 'locataire_prive', annee, tables) * part;
    if (revenu >= parametres.multipleLoyerAcces * loyerPrive) return 'locataire_prive';
    if (sousPlafond && tirer('hlm') < pHlm()) return 'hlm';
    if (!force) return null;
    return personnage.finances.epargne >= loyerPrive ? 'locataire_prive' : 'precaire';
  };

  switch (logement) {
    case 'chez_parents': {
      const force =
        vitEnCouple(couple) ||
        (age >= parametres.ageSortieAse &&
          (personnage.origine.structureFamiliale === 'placement_ase' ||
            !personnage.etats.famille.parentsVivants));
      if (!force) {
        const base = auAge(config.decohabitation, age);
        if (base === 0) return;
        const actif = estSalarie(emploi) || emploi === 'independant';
        const p = probabiliteParProduit(
          base,
          (actif ? parametres.mEmploiDepart : 1) *
            produitTag(etat, 'depart_parents', suivant, donnees),
        );
        if (tirer('depart') >= p) return;
      }
      const vers = destination(force);
      if (!vers) return;
      changer({ logement: vers });
      ecrire(vers === 'precaire' ? 'logementPrecaire' : 'logementDepart', vers);
      return;
    }
    case 'locataire_prive':
      if (sousPlafond && tirer('hlm') < pHlm()) {
        changer({ logement: 'hlm' });
        ecrire('logementHlm');
      }
      return;
    case 'hlm':
      if (!sousPlafond && tirer('sortieHlm') < parametres.pSortieHlm) {
        changer({ logement: 'locataire_prive' });
      }
      return;
    case 'precaire': {
      t.jauges = {
        ...t.jauges,
        santePhysique: borner(t.jauges.santePhysique - parametres.perteSantePrecaire),
      };
      // L'emploi de l'an prochain en souffre (tirage de transition fait à l'âge suivant).
      t.modificateurs = [
        ...etat.modificateursActifs,
        {
          cible: { tag: 'emploi_chomage' },
          m: parametres.mPrecaireChomage,
          debut: age + 2,
          fin: age + 2,
        },
      ];
      if (tirer('sortiePrecaire') >= parametres.pSortiePrecaire) return;
      const vers = destination(false);
      if (!vers) return;
      changer({ logement: vers });
      ecrire('logementSortie', vers);
      return;
    }
    case 'proprietaire':
      return;
  }
}
