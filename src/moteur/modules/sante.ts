// Santé et mortalité (règles, section 10 ; jalon 6) : vieillissement des jauges, retour
// du moral selon la résilience, effets et guérison des maladies actives, mortalité
// annuelle corrigée par la formule des cotes (PCS, addictions, maladies, santé physique).
// Les maladies commencent par des événements de contenu (effet « maladie »).

import { multiplicateurTrait, probabiliteParProduit } from '../cotes';
import { ETATS_ACTIFS, produitTag } from '../evenements';
import { remplir } from '../recit';
import { hachageIdentifiant, tirageHache } from '../rng';
import { chercherLigne, parametre, periodeDe } from '../tables';
import {
  MALADIES,
  PRODUITS,
  type Donnees,
  type EntreeJournal,
  type EtatAddiction,
  type EtatPartie,
  type Jauges,
  type Maladie,
  type Personnage,
  type Produit,
  type Sexe,
  type Tables,
  type Traits,
} from '../types';

/** Tags que les choix peuvent viser : guérir de chaque maladie (consulter tôt, se soigner). */
export const TAGS_SANTE: readonly string[] = MALADIES.map((maladie) => `guerison_${maladie}`);

const NOMS_PARAMETRES = [
  'cibleMoral',
  'tauxRetourMoral',
  'kResilienceRetour',
  'ageAdulteMortalite',
  'kSantePhysiqueMortalite',
  'centreSantePhysique',
  'mRuralSoins',
  'mModesteSoins',
  'decileModeste',
] as const;
type ParametresSante = Readonly<Record<(typeof NOMS_PARAMETRES)[number], number>>;

/** Effets annuels d'une maladie active, son poids sur la mortalité et sa guérison. */
interface EffetsMaladie {
  santePhysique: number;
  santeMentale: number;
  liens: number;
  cout: number;
  mortalite: number;
  guerison: number;
  tag: string;
  id: readonly number[];
}

type JaugeVieillie = 'santePhysique' | 'santeMentale' | 'liens' | 'competences';
const JAUGES_VIEILLIES: readonly JaugeVieillie[] = [
  'santePhysique',
  'santeMentale',
  'liens',
  'competences',
];

/** Tout ce que le module lit dans les tables, une fois par jeu de tables. */
interface ConfigSante {
  tables: Tables;
  parametres: ParametresSante;
  vieillissement: Readonly<Record<JaugeVieillie, readonly number[]>>;
  maladies: Readonly<Record<Maladie, EffetsMaladie>>;
  /** Multiplicateur de mortalité par PCS (adultes). */
  pcs: ReadonlyMap<string, number>;
  /** Probabilités de décès par âge (table mortalite), par sexe puis année calendaire. */
  mortalite: Readonly<Record<Sexe, Map<number, readonly number[]>>>;
  /** Multiplicateur de mortalité par produit et état d'addiction actif (absent : 1). */
  addictions: Readonly<Record<Produit, Partial<Record<EtatAddiction, number>>>>;
}

function construire(tables: Tables): ConfigSante {
  const parametres = {} as Record<(typeof NOMS_PARAMETRES)[number], number>;
  for (const nom of NOMS_PARAMETRES) parametres[nom] = parametre(tables.parametresSante, nom);
  const vieillissement = {} as Record<JaugeVieillie, readonly number[]>;
  for (const jauge of JAUGES_VIEILLIES) {
    vieillissement[jauge] = chercherLigne(tables.vieillissement, { jauge }, []).parAnnee;
  }
  const maladies = {} as Record<Maladie, EffetsMaladie>;
  for (const maladie of MALADIES) {
    const v = chercherLigne(tables.maladies, { maladie }, []).valeurs;
    maladies[maladie] = {
      santePhysique: v.santePhysique ?? 0,
      santeMentale: v.santeMentale ?? 0,
      liens: v.liens ?? 0,
      cout: v.cout ?? 0,
      mortalite: v.mortalite ?? 1,
      guerison: v.guerison ?? 0,
      tag: `guerison_${maladie}`,
      id: hachageIdentifiant(`sante.guerison.${maladie}`),
    };
  }
  const pcs = new Map<string, number>();
  const addictions = {} as Record<Produit, Partial<Record<EtatAddiction, number>>>;
  for (const produit of PRODUITS) addictions[produit] = {};
  for (const ligne of tables.mortaliteFacteurs.lignes) {
    const c = ligne.conditions;
    if (c.pcs) pcs.set(c.pcs, ligne.valeur);
    else if (c.produit && c.etat) {
      addictions[c.produit as Produit][c.etat as EtatAddiction] = ligne.valeur;
    }
  }
  const mortalite = { femme: new Map(), homme: new Map() };
  return { tables, parametres, vieillissement, maladies, pcs, addictions, mortalite };
}

const configurations = new WeakMap<Tables, ConfigSante>();
let derniere: ConfigSante | null = null;

function configuration(tables: Tables): ConfigSante {
  if (derniere && derniere.tables === tables) return derniere;
  let config = configurations.get(tables);
  if (!config) {
    config = construire(tables);
    configurations.set(tables, config);
  }
  derniere = config;
  return config;
}

const borner = (valeur: number): number => Math.min(100, Math.max(0, valeur));

/**
 * Fin d'année : vieillissement des jauges selon l'âge (table vieillissement), puis le
 * moral revient vers sa cible, d'autant plus vite que la résilience est haute.
 * bienEtre est la moyenne des autres jauges.
 */
export function vieillirJauges(
  jauges: Jauges,
  age: number,
  traits: Traits,
  tables: Tables,
): Jauges {
  const { vieillissement, parametres } = configuration(tables);
  const a = Math.min(age, vieillissement.santePhysique.length - 1);
  const santePhysique = borner(jauges.santePhysique + vieillissement.santePhysique[a]!);
  const liens = borner(jauges.liens + vieillissement.liens[a]!);
  const competences = borner(jauges.competences + vieillissement.competences[a]!);
  const taux = Math.min(
    1,
    parametres.tauxRetourMoral *
      multiplicateurTrait(traits.resilience, parametres.kResilienceRetour),
  );
  const moral = jauges.santeMentale + vieillissement.santeMentale[a]!;
  const santeMentale = borner(moral + (parametres.cibleMoral - moral) * taux);
  const bienEtre = (santePhysique + santeMentale + liens + competences) / 4;
  return { santePhysique, santeMentale, bienEtre, liens, competences };
}

/**
 * Effets de l'année des maladies actives, puis guérison tirée pour celles qui en ont
 * une : choix du joueur (tag guerison_*), accès aux soins (campagne, revenus modestes).
 */
export function evoluerSante(
  etat: EtatPartie,
  donnees: Donnees,
): { etat: EtatPartie; journal: EntreeJournal[] } {
  const { personnage } = etat;
  const avant = personnage.etats.maladies;
  if (avant.length === 0) return { etat, journal: [] };
  const config = configuration(donnees.tables);
  const { parametres } = config;
  let santePhysique = 0;
  let santeMentale = 0;
  let liens = 0;
  const restantes: Maladie[] = [];
  const journal: EntreeJournal[] = [];
  for (const maladie of avant) {
    const effets = config.maladies[maladie];
    santePhysique += effets.santePhysique;
    santeMentale += effets.santeMentale;
    liens += effets.liens;
    if (effets.guerison > 0) {
      let m = produitTag(etat, effets.tag, personnage.age + 1, donnees);
      if (personnage.origine.territoire === 'rural') m *= parametres.mRuralSoins;
      if (personnage.origine.decileRevenuFoyer <= parametres.decileModeste) {
        m *= parametres.mModesteSoins;
      }
      const p = probabiliteParProduit(effets.guerison, m);
      if (tirageHache(etat.graine, personnage.age, effets.id) < p) {
        const modele = donnees.libelles.recits?.santeGuerison;
        if (modele) {
          const nom = donnees.libelles.maladies?.[maladie] ?? maladie.toUpperCase();
          journal.push({
            annee: etat.annee,
            age: personnage.age,
            type: 'sante',
            texte: remplir(modele, { maladie: nom }),
          });
        }
        continue;
      }
    }
    restantes.push(maladie);
  }
  const { jauges } = personnage;
  return {
    etat: {
      ...etat,
      personnage: {
        ...personnage,
        jauges: {
          ...jauges,
          santePhysique: borner(jauges.santePhysique + santePhysique),
          santeMentale: borner(jauges.santeMentale + santeMentale),
          liens: borner(jauges.liens + liens),
        },
        etats:
          restantes.length === avant.length
            ? personnage.etats
            : { ...personnage.etats, maladies: restantes },
      },
    },
    journal,
  };
}

/** Maladie qui commence : ajoutée aux maladies actives (une seule fois). */
export function commencerMaladie(personnage: Personnage, maladie: Maladie): Personnage {
  if (personnage.etats.maladies.includes(maladie)) return personnage;
  return {
    ...personnage,
    etats: { ...personnage.etats, maladies: [...personnage.etats.maladies, maladie] },
  };
}

/** Dépense annuelle liée aux maladies actives (bilan, règles section 7). */
export function depensesSante(personnage: Personnage, tables: Tables): number {
  const { maladies } = personnage.etats;
  if (maladies.length === 0) return 0;
  const config = configuration(tables);
  let total = 0;
  for (const maladie of maladies) total += config.maladies[maladie].cout;
  return Math.round(total);
}

/** Probabilité de décéder dans l'année d'après la table seule (âge, sexe, année). */
export function probabiliteDecesTable(
  age: number,
  sexe: Sexe,
  annee: number,
  tables: Tables,
): number {
  const parAnnee = configuration(tables).mortalite[sexe];
  let qParAge = parAnnee.get(annee);
  if (!qParAge) {
    qParAge = chercherLigne(tables.mortalite, { sexe, periode: periodeDe(annee) }, [
      'periode',
      'sexe',
    ]).qParAge;
    parAnnee.set(annee, qParAge);
  }
  const q = qParAge[Math.min(age, qParAge.length - 1)];
  if (q === undefined) throw new Error(`Table mortalite : aucune valeur pour ${age} ans`);
  return q;
}

/**
 * Mortalité de l'année pour ce personnage : la table, corrigée par la formule des
 * cotes (PCS à l'âge adulte, addictions actives, maladies actives, santé physique).
 */
export function probabiliteDecesPersonnage(
  personnage: Personnage,
  annee: number,
  tables: Tables,
): number {
  const q = probabiliteDecesTable(personnage.age, personnage.origine.sexe, annee, tables);
  const config = configuration(tables);
  const { parametres } = config;
  let m = 1;
  if (personnage.age >= parametres.ageAdulteMortalite) {
    m *= config.pcs.get(personnage.etats.travail.pcs ?? 'sans_emploi') ?? 1;
  }
  for (const produit of PRODUITS) {
    const etat = personnage.etats.addictions[produit];
    if (ETATS_ACTIFS.has(etat)) m *= config.addictions[produit][etat] ?? 1;
  }
  for (const maladie of personnage.etats.maladies) m *= config.maladies[maladie].mortalite;
  m *= Math.exp(
    (parametres.kSantePhysiqueMortalite *
      (personnage.jauges.santePhysique - parametres.centreSantePhysique)) /
      50,
  );
  return probabiliteParProduit(q, m);
}
