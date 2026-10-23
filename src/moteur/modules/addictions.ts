// Addictions (règles, section 9 ; jalon 5) : une chaîne d'états commune à tous les
// produits, jeu d'argent compris. Exposition, escalade, sevrage et rechute sont tirés
// chaque année. Le joueur n'agit que sur l'initiation et la décision d'arrêter, par des
// choix qui déplacent les probabilités (tags initiation_*, arret_*, rechute_*).

import { multiplicateurTrait, probabiliteParProduit } from '../cotes';
import { AGE_MAXIMAL } from '../constantes';
import { ETATS_ACTIFS, aUneAddictionActive, produitTag } from '../evenements';
import { remplir } from '../recit';
import { hachageIdentifiant, tirageHache } from '../rng';
import { parametre, periodeDe, valeurDe } from '../tables';
import {
  PRODUITS,
  type Donnees,
  type EntreeJournal,
  type EtatAddiction,
  type EtatPartie,
  type Personnage,
  type Produit,
  type Tables,
} from '../types';

/** Étapes tirées chaque année ; chacune a son tag par produit (exposition_tabac...). */
const ETAPES = ['exposition', 'initiation', 'escalade', 'dependance', 'arret', 'rechute'] as const;
type Etape = (typeof ETAPES)[number];

/** Tags que les choix ou le contexte peuvent viser. */
export const TAGS_ADDICTIONS: readonly string[] = PRODUITS.flatMap((produit) =>
  ETAPES.map((etape) => `${etape}_${produit}`),
);

/** États où le produit est consommé (ou le jeu pratiqué) : effets et dépenses. */
const ETATS_USAGE: ReadonlySet<EtatAddiction> = new Set([
  'usage_occasionnel',
  'usage_regulier',
  'dependance',
]);

export const estUsage = (etat: EtatAddiction): boolean => ETATS_USAGE.has(etat);

/** Réglages des addictions et du jeu (table parametresAddictions). */
const NOMS_REGLAGES = [
  'decroissanceEscalade',
  'decroissanceInitiation',
  'decroissanceRechute',
  'kImpulsivite',
  'kLiensJeu',
  'kSanteMentale',
  'kSociabilite',
  'kVulnerabiliteGenetique',
  'mChomage',
  'mDettesJeu',
  'mHorsAge',
  'mInterdictionJeu',
  'mMiseRegulier',
  'mMiseDependance',
  'mMiseChasse',
  'seuilChasse',
  'multipleGrosGain',
  'mGrosGain',
  'dureeGrosGain',
] as const;
export type Reglages = Readonly<Record<(typeof NOMS_REGLAGES)[number], number>>;

/** Effets annuels d'un état sur les jauges, et son coût (table effetsAddictions). */
interface Effet {
  santePhysique: number;
  santeMentale: number;
  liens: number;
  competences: number;
  cout: number;
}

/**
 * Tout ce qu'il faut savoir d'un produit, lu une fois dans les tables : chaque année,
 * six produits passent par la chaîne, sans recherche dans les tables ni clé texte.
 */
interface ConfigProduit {
  produit: Produit;
  rang: number;
  ids: Readonly<Record<Etape, readonly number[]>>;
  tags: Readonly<Record<Etape, string>>;
  ageMin: number;
  ageMax: number;
  initiation: number;
  escalade: number;
  dependance: number;
  arret: number;
  rechuteSevrage: number;
  rechuteAbstinent: number;
  sexe: Readonly<Record<'femme' | 'homme', number>>;
  /** Multiplicateur quand l'autre produit (même rang que PRODUITS) est actif. */
  interactions: readonly number[];
  effets: Readonly<Partial<Record<EtatAddiction, Effet>>>;
  /** Probabilité d'exposition par période (décennie), lue à la demande. */
  exposition: Map<string, number>;
}

interface Configuration {
  produits: readonly ConfigProduit[];
  reglages: Reglages;
  /** Décroissances élevées à la puissance des années dans l'état (0 à AGE_MAXIMAL). */
  decroissanceInitiation: readonly number[];
  decroissanceEscalade: readonly number[];
  decroissanceRechute: readonly number[];
  /** Avant l'âge minimum du premier produit, rien ne peut arriver. */
  ageMinimum: number;
  tables: Tables;
}

function construire(tables: Tables): Configuration {
  const reglages = {} as Record<(typeof NOMS_REGLAGES)[number], number>;
  for (const nom of NOMS_REGLAGES) reglages[nom] = parametre(tables.parametresAddictions, nom);
  const puissances = (d: number): number[] =>
    Array.from({ length: AGE_MAXIMAL + 1 }, (_, annees) => d ** annees);
  const produits = PRODUITS.map((produit, rang): ConfigProduit => {
    const transition = (nom: string): number =>
      parametre(tables.transitionsAddictions, nom, { produit }, ['produit']);
    const effets: Partial<Record<EtatAddiction, Effet>> = {};
    for (const ligne of tables.effetsAddictions.lignes) {
      if (ligne.conditions.produit !== produit || !ligne.conditions.etat) continue;
      const v = ligne.valeurs;
      effets[ligne.conditions.etat as EtatAddiction] = {
        santePhysique: v.santePhysique ?? 0,
        santeMentale: v.santeMentale ?? 0,
        liens: v.liens ?? 0,
        competences: v.competences ?? 0,
        cout: v.cout ?? 0,
      };
    }
    return {
      produit,
      rang,
      ids: Object.fromEntries(
        ETAPES.map((etape) => [etape, hachageIdentifiant(`addiction.${produit}.${etape}`)]),
      ) as Record<Etape, readonly number[]>,
      tags: Object.fromEntries(ETAPES.map((etape) => [etape, `${etape}_${produit}`])) as Record<
        Etape,
        string
      >,
      ageMin: transition('ageMin'),
      ageMax: transition('ageMax'),
      initiation: transition('initiation'),
      escalade: transition('escalade'),
      dependance: transition('dependance'),
      arret: transition('arret'),
      rechuteSevrage: transition('rechuteSevrage'),
      rechuteAbstinent: transition('rechuteAbstinent'),
      sexe: {
        femme: valeurDe(tables.sexeAddictions, { produit, sexe: 'femme' }, ['sexe', 'produit']),
        homme: valeurDe(tables.sexeAddictions, { produit, sexe: 'homme' }, ['sexe', 'produit']),
      },
      interactions: PRODUITS.map((autre) =>
        valeurDe(tables.interactionsAddictions, { produit, autre }, ['autre', 'produit']),
      ),
      effets,
      exposition: new Map(),
    };
  });
  return {
    produits,
    reglages,
    decroissanceInitiation: puissances(reglages.decroissanceInitiation),
    decroissanceEscalade: puissances(reglages.decroissanceEscalade),
    decroissanceRechute: puissances(reglages.decroissanceRechute),
    ageMinimum: Math.min(...produits.map((p) => p.ageMin)),
    tables,
  };
}

// Une configuration par jeu de tables ; la dernière est gardée (une partie n'en change pas).
const configurations = new WeakMap<Tables, Configuration>();
let derniere: Configuration | null = null;

function configuration(tables: Tables): Configuration {
  if (derniere && derniere.tables === tables) return derniere;
  let config = configurations.get(tables);
  if (!config) {
    config = construire(tables);
    configurations.set(tables, config);
  }
  derniere = config;
  return config;
}

export const reglages = (tables: Tables): Reglages => configuration(tables).reglages;

function exposition(config: ConfigProduit, tables: Tables, annee: number): number {
  const periode = periodeDe(annee);
  let p = config.exposition.get(periode);
  if (p === undefined) {
    p = valeurDe(tables.expositionAddictions, { produit: config.produit, periode }, [
      'periode',
      'produit',
    ]);
    config.exposition.set(periode, p);
  }
  return p;
}

/** Multiplicateurs des traits (constants pour toute une vie), gardés pour la vie en cours. */
interface FacteursTraits {
  impulsivite: number;
  genetique: number;
  sociabilite: number;
}
let derniersTraits: object | null = null;
let derniersReglages: Reglages | null = null;
let derniersFacteurs: FacteursTraits = { impulsivite: 1, genetique: 1, sociabilite: 1 };

function facteursTraits(personnage: Personnage, r: Reglages): FacteursTraits {
  const { traits } = personnage;
  if (traits === derniersTraits && r === derniersReglages) return derniersFacteurs;
  derniersTraits = traits;
  derniersReglages = r;
  derniersFacteurs = {
    impulsivite: multiplicateurTrait(traits.impulsivite, r.kImpulsivite),
    genetique: multiplicateurTrait(traits.vulnerabiliteGenetique, r.kVulnerabiliteGenetique),
    sociabilite: multiplicateurTrait(traits.sociabilite, r.kSociabilite),
  };
  return derniersFacteurs;
}

/** Une addiction active (usage régulier, dépendance) multiplie le risque d'en développer une autre. */
function interactions(personnage: Personnage, config: ConfigProduit): number {
  const addictions = personnage.etats.addictions;
  if (!aUneAddictionActive(addictions)) return 1;
  let m = 1;
  for (let i = 0; i < PRODUITS.length; i++) {
    if (i !== config.rang && ETATS_ACTIFS.has(addictions[PRODUITS[i]!])) {
      m *= config.interactions[i]!;
    }
  }
  return m;
}

/** Facteurs d'escalade : impulsivité, génétique, moral bas, chômage, autres addictions. */
function facteursEscalade(
  etat: EtatPartie,
  config: ConfigProduit,
  etape: 'escalade' | 'dependance',
  r: Reglages,
  donnees: Donnees,
): number {
  const { personnage } = etat;
  const traits = facteursTraits(personnage, r);
  let m =
    traits.impulsivite *
    traits.genetique *
    multiplicateurTrait(personnage.jauges.santeMentale, r.kSanteMentale) *
    interactions(personnage, config) *
    produitTag(etat, config.tags[etape], personnage.age + 1, donnees);
  if (personnage.etats.emploi === 'chomage') m *= r.mChomage;
  if (config.produit === 'jeux_argent') {
    // Jeu : isolement, dettes ; l'interdiction volontaire freine (règles, section 8).
    m *= multiplicateurTrait(personnage.jauges.liens, r.kLiensJeu);
    const { endettement } = personnage.finances;
    if (endettement === 'tendu' || endettement === 'critique') m *= r.mDettesJeu;
    if (personnage.etats.jeu.interdiction) m *= r.mInterdictionJeu;
  }
  return m;
}

/** Tirage d'une étape : pBase corrigée par la formule des cotes (produit des multiplicateurs). */
function tire(
  etat: EtatPartie,
  config: ConfigProduit,
  etape: Etape,
  p: number,
  produitMultiplicateurs: number,
): boolean {
  return (
    tirageHache(etat.graine, etat.personnage.age, config.ids[etape]) <
    probabiliteParProduit(p, produitMultiplicateurs)
  );
}

/** Nouvel état d'un produit à la fin de l'année. */
function evoluerProduit(
  etat: EtatPartie,
  config: ConfigProduit,
  configs: Configuration,
  donnees: Donnees,
): EtatAddiction {
  const { personnage } = etat;
  const r = configs.reglages;
  const suivant = personnage.age + 1;
  const courant = personnage.etats.addictions[config.produit];
  // Années dans l'état : l'initiation, l'escalade et la rechute se jouent surtout au début.
  const annees = personnage.age - personnage.etats.debutEtatAddiction[config.produit];
  switch (courant) {
    case 'jamais_expose': {
      if (personnage.age < config.ageMin) return courant;
      const p = exposition(config, donnees.tables, etat.annee);
      let m =
        config.sexe[personnage.origine.sexe] *
        facteursTraits(personnage, r).sociabilite *
        produitTag(etat, config.tags.exposition, suivant, donnees);
      if (personnage.age > config.ageMax) m *= r.mHorsAge;
      return tire(etat, config, 'exposition', p, m) ? 'expose' : courant;
    }
    case 'expose': {
      const m =
        facteursTraits(personnage, r).impulsivite *
        interactions(personnage, config) *
        produitTag(etat, config.tags.initiation, suivant, donnees) *
        configs.decroissanceInitiation[annees]!;
      return tire(etat, config, 'initiation', config.initiation, m) ? 'usage_occasionnel' : courant;
    }
    case 'usage_occasionnel': {
      const m =
        facteursEscalade(etat, config, 'escalade', r, donnees) *
        configs.decroissanceEscalade[annees]!;
      return tire(etat, config, 'escalade', config.escalade, m) ? 'usage_regulier' : courant;
    }
    case 'usage_regulier':
    case 'dependance': {
      // Sortie seulement par choix : le tag arret_* porte la décision du joueur.
      const arret = produitTag(etat, config.tags.arret, suivant, donnees);
      if (tire(etat, config, 'arret', config.arret, arret)) return 'sevrage';
      if (courant === 'dependance') return courant;
      const m =
        facteursEscalade(etat, config, 'dependance', r, donnees) *
        configs.decroissanceEscalade[annees]!;
      return tire(etat, config, 'dependance', config.dependance, m) ? 'dependance' : courant;
    }
    case 'sevrage':
    case 'abstinent': {
      // Rechute : élevée pendant le sevrage, puis décroissante avec les années d'abstinence.
      const enSevrage = courant === 'sevrage';
      let m =
        multiplicateurTrait(personnage.jauges.santeMentale, r.kSanteMentale) *
        produitTag(etat, config.tags.rechute, suivant, donnees);
      if (!enSevrage) m *= configs.decroissanceRechute[annees]!;
      const p = enSevrage ? config.rechuteSevrage : config.rechuteAbstinent;
      return tire(etat, config, 'rechute', p, m) ? 'usage_regulier' : 'abstinent';
    }
  }
}

/** Récit d'un changement d'état ({produit} : nom du produit). */
const RECITS: Partial<Record<EtatAddiction, string>> = {
  usage_occasionnel: 'addictionOccasionnel',
  usage_regulier: 'addictionRegulier',
  dependance: 'addictionDependance',
  sevrage: 'addictionSevrage',
  abstinent: 'addictionAbstinent',
};

/**
 * Fin d'année : chaque produit avance dans la chaîne, puis les effets de l'année
 * (état pendant l'année) s'appliquent aux jauges. Les changements entrent au journal.
 */
export function evoluerAddictions(
  etat: EtatPartie,
  donnees: Donnees,
): { etat: EtatPartie; journal: EntreeJournal[] } {
  const { personnage } = etat;
  const configs = configuration(donnees.tables);
  if (personnage.age < configs.ageMinimum) return { etat, journal: [] };
  const avant = personnage.etats.addictions;
  let addictions = avant;
  let debuts = personnage.etats.debutEtatAddiction;
  // Un nouvel état commence l'an prochain.
  const debut = personnage.age + 1;
  // Effets de l'année sur les jauges (sans objet intermédiaire : appelé chaque année).
  let santePhysique = 0;
  let santeMentale = 0;
  let liens = 0;
  let competences = 0;
  const journal: EntreeJournal[] = [];

  for (let i = 0; i < configs.produits.length; i++) {
    const config = configs.produits[i]!;
    const { produit } = config;
    const courant = avant[produit];
    if (courant !== 'jamais_expose' && courant !== 'expose' && courant !== 'abstinent') {
      const effet = config.effets[courant];
      if (effet) {
        santePhysique += effet.santePhysique;
        santeMentale += effet.santeMentale;
        liens += effet.liens;
        competences += effet.competences;
      }
    }
    const nouveau = evoluerProduit(etat, config, configs, donnees);
    if (nouveau === courant) continue;
    debuts = { ...debuts, [produit]: debut };
    addictions = addictions === avant ? { ...avant } : addictions;
    addictions[produit] = nouveau;
    if (nouveau === 'expose') continue;
    const rechute = (courant === 'sevrage' || courant === 'abstinent') && nouveau !== 'abstinent';
    const cle = rechute ? 'addictionRechute' : RECITS[nouveau];
    const modele = cle && donnees.libelles.recits?.[cle];
    if (modele) {
      const nom = donnees.libelles.produits?.[produit] ?? produit.toUpperCase();
      journal.push({
        annee: etat.annee,
        age: personnage.age,
        type: 'addiction',
        texte: remplir(modele, { produit: nom }),
      });
    }
  }

  const effets = santePhysique !== 0 || santeMentale !== 0 || liens !== 0 || competences !== 0;
  if (!effets && addictions === avant) return { etat, journal };
  const { jauges } = personnage;
  return {
    etat: {
      ...etat,
      personnage: {
        ...personnage,
        jauges: effets
          ? {
              ...jauges,
              santePhysique: borner(jauges.santePhysique + santePhysique),
              santeMentale: borner(jauges.santeMentale + santeMentale),
              liens: borner(jauges.liens + liens),
              competences: borner(jauges.competences + competences),
            }
          : jauges,
        etats:
          addictions === avant
            ? personnage.etats
            : { ...personnage.etats, addictions, debutEtatAddiction: debuts },
      },
    },
    journal,
  };
}

const borner = (valeur: number): number => Math.min(100, Math.max(0, valeur));

/** Dépense annuelle liée aux addictions en usage (bilan, règles section 7). Hors jeu. */
export function depensesAddictions(personnage: Personnage, tables: Tables): number {
  const { produits } = configuration(tables);
  let total = 0;
  for (let i = 0; i < produits.length; i++) {
    const config = produits[i]!;
    if (config.produit === 'jeux_argent') continue;
    const etat = personnage.etats.addictions[config.produit];
    if (estUsage(etat)) total += config.effets[etat]?.cout ?? 0;
  }
  return Math.round(total);
}
