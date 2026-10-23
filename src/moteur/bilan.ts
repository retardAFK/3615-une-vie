// Fin de partie (règles, section 13) : bilan d'une vie, reconstruction d'une partie par
// sa graine et ses choix, « mêmes choix, autre naissance » et vies des enfants.
// Tout est pur : le worker et les tests appellent ces fonctions telles quelles.

import { avancerPetiteEnfance, creerPartie, fermerAnnee, ouvrirAnnee } from './boucle';
import { AGE_FIN_PETITE_ENFANCE, AGE_MAXIMAL } from './constantes';
import { choisirAuto } from './evenements';
import { decileDeRevenu } from './modules/argent';
import { probabiliteDecesTable } from './modules/sante';
import { chercherLigne } from './tables';
import type {
  ChoixJoueur,
  Decile,
  DiplomeJoueur,
  Donnees,
  EtatPartie,
  Maladie,
  OptionsPartie,
  Origine,
  Pcs,
  ResultatOuverture,
  Sexe,
  Tables,
} from './types';

/** Choix fait une année : de quoi reconstruire la partie avec sa graine. */
export interface Decision {
  age: number;
  evenementId: string;
  choixId: string;
}

/** Choix faits au fil de la vie, lus dans le journal (choix du joueur et choix automatiques). */
export function decisionsDe(etat: EtatPartie): Decision[] {
  const decisions: Decision[] = [];
  for (const entree of etat.historique) {
    if (entree.type === 'evenement' && entree.evenementId && entree.choixId) {
      decisions.push({ age: entree.age, evenementId: entree.evenementId, choixId: entree.choixId });
    }
  }
  return decisions;
}

/**
 * Rejoue une vie avec sa graine, ses options et ses choix. Les années s'ouvrent comme
 * dans l'interface (petite enfance sans arrêt) ; un événement sans choix enregistré à
 * cet âge est tranché par choisirAuto. S'arrête sur l'année ouverte à ageOuvert (la
 * partie telle que le joueur l'a laissée), sinon à la mort.
 */
export function rejouer(
  graine: string,
  options: OptionsPartie,
  decisions: readonly Decision[],
  donnees: Donnees,
  ageOuvert?: number,
): EtatPartie {
  const parAge = new Map<number, Map<string, string>>();
  for (const { age, evenementId, choixId } of decisions) {
    if (!parAge.has(age)) parAge.set(age, new Map());
    parAge.get(age)!.set(evenementId, choixId);
  }
  let etat = creerPartie(graine, donnees, options);
  while (etat.personnage.vivant) {
    const ouverture: ResultatOuverture =
      etat.personnage.age < AGE_FIN_PETITE_ENFANCE
        ? avancerPetiteEnfance(etat, donnees)
        : ouvrirAnnee(etat, donnees);
    const ouvert = ouverture.etat;
    if (!ouvert.personnage.vivant) return ouvert;
    if (ageOuvert !== undefined && ouvert.personnage.age >= ageOuvert) return ouvert;
    const faits = parAge.get(ouvert.personnage.age);
    const choix: ChoixJoueur[] = ouverture.evenements
      .filter((e) => e.choix.length > 0)
      .map((e) => {
        const choixId = faits?.get(e.id);
        return choixId && e.choix.some((c) => c.id === choixId)
          ? { evenementId: e.id, choixId }
          : choisirAuto(ouvert, e, donnees);
      });
    etat = fermerAnnee(ouvert, choix, donnees).etat;
  }
  return etat;
}

/** Côté de l'échelle sociale d'une origine : favorisée ou modeste. */
function estFavorisee(origine: Origine): boolean {
  return (
    origine.pcsParents === 'cadre' ||
    origine.pcsParents === 'intermediaire' ||
    origine.decileRevenuFoyer >= 7
  );
}

/**
 * « Mêmes choix, autre naissance » : même graine (mêmes traits, même hasard), même sexe,
 * même année et même région, mais l'origine sociale de l'autre bout de l'échelle.
 * Les territoires d'outre-mer restent les mêmes.
 */
export function autreNaissance(etat: EtatPartie): OptionsPartie {
  const { origine } = etat.personnage;
  const versHaut = !estFavorisee(origine);
  const territoire =
    origine.territoire === 'drom' ? 'drom' : versHaut ? 'grande_metropole' : 'quartier_prioritaire';
  return {
    anneeNaissance: origine.anneeNaissance,
    anneeLibre: true,
    origine: {
      sexe: origine.sexe,
      region: origine.region,
      territoire,
      pcsParents: versHaut ? 'cadre' : 'ouvrier',
      diplomeParents: versHaut ? 'bac_5' : 'cap_bep',
      decileRevenuFoyer: versHaut ? 9 : 2,
      logementFamilial: versHaut ? 'proprietaire' : 'hlm',
    },
  };
}

/**
 * Espérance de vie à la naissance de la génération : survie année après année, avec la
 * probabilité de décès de chaque âge l'année calendaire où il est atteint.
 */
export function esperanceGeneration(anneeNaissance: number, sexe: Sexe, tables: Tables): number {
  let survie = 1;
  let esperance = 0;
  for (let age = 0; age < AGE_MAXIMAL; age++) {
    const suivante = survie * (1 - probabiliteDecesTable(age, sexe, anneeNaissance + age, tables));
    esperance += (survie + suivante) / 2;
    survie = suivante;
  }
  return esperance;
}

export interface Bilan {
  prenom: string;
  sexe: Sexe;
  anneeNaissance: number;
  anneeDeces: number;
  age: number;
  /** « mortalite » (test annuel) ou id de l'événement mortel. */
  cause: string;
  /** Texte de l'événement mortel, s'il y en a un. */
  causeTexte: string | null;
  /** Maladie active la plus mortelle au décès, pour une mort au test annuel. */
  causeMaladie: Maladie | null;
  esperanceGeneration: number;
  /** Moral moyen de chaque décennie vécue (0-9 ans, 10-19 ans...). */
  moralParDecennie: number[];
  decileNaissance: Decile;
  /** Décile du revenu de l'année des 60 ans, ou de la dernière année vécue avant. */
  decileFinal: Decile;
  ageDecileFinal: number;
  diplome: DiplomeJoueur;
  pcs: Pcs | null;
  anneesChomage: number;
  anneesDependance: number;
  revenusCumules: number;
  coutAddictions: number;
  patrimoineTransmis: number;
  jeu: { mise: number; recupere: number };
  enfants: number;
}

/** Bilan d'une vie terminée (ou en cours : il décrit alors la vie jusqu'ici). */
export function bilan(etat: EtatPartie, donnees: Donnees): Bilan {
  const { personnage, parcours, historique } = etat;
  const { origine, finances, etats } = personnage;
  const { tables } = donnees;
  const deces = historique.at(-1)?.type === 'deces' ? historique.at(-1)! : null;
  const cause = deces?.cause ?? 'mortalite';
  const precedente = historique.at(-2);
  const causeTexte =
    cause !== 'mortalite' && precedente?.evenementId === cause ? (precedente.texte ?? null) : null;
  let causeMaladie: Maladie | null = null;
  if (cause === 'mortalite') {
    let pire = 1;
    for (const maladie of etats.maladies) {
      const m = chercherLigne(tables.maladies, { maladie }, []).valeurs.mortalite ?? 1;
      if (m > pire) {
        pire = m;
        causeMaladie = maladie;
      }
    }
  }
  const age60 = parcours.revenu60 !== null;
  const ageDecileFinal = age60 ? 60 : personnage.age;
  return {
    prenom: personnage.prenom,
    sexe: origine.sexe,
    anneeNaissance: origine.anneeNaissance,
    anneeDeces: etat.annee,
    age: personnage.age,
    cause,
    causeTexte,
    causeMaladie,
    esperanceGeneration: esperanceGeneration(origine.anneeNaissance, origine.sexe, tables),
    moralParDecennie: parcours.moral
      .map((somme, decennie) => {
        const annees = parcours.annees[decennie] ?? 0;
        return annees > 0 ? somme / annees : -1;
      })
      .filter((moyenne) => moyenne >= 0),
    decileNaissance: origine.decileRevenuFoyer,
    decileFinal: decileDeRevenu(
      parcours.revenu60 ?? finances.revenuAnnuel,
      origine.anneeNaissance + ageDecileFinal,
      tables,
    ),
    ageDecileFinal,
    diplome: etats.education.diplome,
    pcs: etats.travail.pcs,
    anneesChomage: parcours.anneesChomage,
    anneesDependance: parcours.anneesDependance,
    revenusCumules: parcours.revenusCumules,
    coutAddictions: parcours.coutAddictions,
    patrimoineTransmis: Math.max(
      0,
      finances.epargne + finances.patrimoine - finances.dettes - finances.creditImmobilier,
    ),
    jeu: { mise: etats.jeu.totalMise, recupere: etats.jeu.totalRecupere },
    enfants: etats.famille.enfants.length,
  };
}

/**
 * Vie d'un enfant du joueur, jouée en AUTO jusqu'à sa mort : sa propre graine, l'année
 * de sa naissance et l'origine transmise par la situation du joueur ce jour-là.
 */
export function vieDEnfant(etat: EtatPartie, rang: number, donnees: Donnees): EtatPartie {
  const enfant = etat.personnage.etats.famille.enfants[rang];
  if (!enfant) throw new RangeError(`Aucun enfant au rang ${rang}`);
  const options: OptionsPartie = {
    anneeNaissance: etat.personnage.origine.anneeNaissance + enfant.age,
    anneeLibre: true,
    origine: { ...enfant.origine },
  };
  return rejouer(`${etat.graine}E${rang + 1}`, options, [], donnees);
}
