// Sauvegarde des parties (docs/architecture.md, Stockage) : la graine, les options et la
// liste des choix suffisent à reconstruire une partie (moteur : rejouer) ; on ne stocke
// jamais l'état complet. IndexedDB dans le navigateur, mémoire à défaut.

import { decisionsDe, type Decision } from '../moteur/bilan';
import type { EtatPartie, OptionsPartie, Sexe } from '../moteur/types';

/** Partie en cours : reprise sur l'année que le joueur avait ouverte. */
export interface PartieSauvee {
  graine: string;
  options: OptionsPartie;
  decisions: Decision[];
  ageOuvert: number;
  prenom: string;
}

/** Vie terminée, pour la liste des vies passées et son bilan. */
export interface VieSauvee {
  graine: string;
  options: OptionsPartie;
  decisions: Decision[];
  prenom: string;
  sexe: Sexe;
  anneeNaissance: number;
  anneeDeces: number;
  age: number;
  /** Moment de la fin de la vie (horloge du navigateur), pour l'ordre de la liste. */
  terminee: number;
}

/** Nombre de vies passées gardées : les plus anciennes s'effacent. */
export const VIES_GARDEES = 30;

export function partieSauvee(etat: EtatPartie): PartieSauvee {
  return {
    graine: etat.graine,
    options: etat.options,
    decisions: decisionsDe(etat),
    ageOuvert: etat.personnage.age,
    prenom: etat.personnage.prenom,
  };
}

export function vieSauvee(etat: EtatPartie, terminee: number): VieSauvee {
  const { personnage } = etat;
  return {
    graine: etat.graine,
    options: etat.options,
    decisions: decisionsDe(etat),
    prenom: personnage.prenom,
    sexe: personnage.origine.sexe,
    anneeNaissance: personnage.origine.anneeNaissance,
    anneeDeces: etat.annee,
    age: personnage.age,
    terminee,
  };
}

export interface Stockage {
  lireEnCours(): Promise<PartieSauvee | null>;
  sauverEnCours(partie: PartieSauvee): Promise<void>;
  effacerEnCours(): Promise<void>;
  /** Ajoute une vie terminée ; ne garde que les VIES_GARDEES plus récentes. */
  ajouterVie(vie: VieSauvee): Promise<void>;
  /** Vies passées, de la plus récente à la plus ancienne. */
  listerVies(): Promise<VieSauvee[]>;
}

const plusRecentes = (vies: readonly VieSauvee[]): VieSauvee[] =>
  [...vies].sort((a, b) => b.terminee - a.terminee).slice(0, VIES_GARDEES);

/** Stockage en mémoire : tests, et navigateurs sans IndexedDB (rien ne survit au rechargement). */
export function stockageMemoire(): Stockage {
  let enCours: PartieSauvee | null = null;
  let vies: VieSauvee[] = [];
  return {
    lireEnCours: () => Promise.resolve(enCours),
    sauverEnCours: (partie) => {
      enCours = partie;
      return Promise.resolve();
    },
    effacerEnCours: () => {
      enCours = null;
      return Promise.resolve();
    },
    ajouterVie: (vie) => {
      vies = plusRecentes([...vies, vie]);
      return Promise.resolve();
    },
    listerVies: () => Promise.resolve(plusRecentes(vies)),
  };
}

const BASE = '3615-une-vie';
const VERSION = 1;
const PARTIES = 'parties';
const VIES = 'vies';
const CLE_EN_COURS = 'en_cours';

function requete<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resoudre, rejeter) => {
    r.onsuccess = () => resoudre(r.result);
    r.onerror = () => rejeter(r.error ?? new Error('IndexedDB'));
  });
}

function ouvrirBase(): Promise<IDBDatabase> {
  const ouverture = indexedDB.open(BASE, VERSION);
  ouverture.onupgradeneeded = () => {
    const base = ouverture.result;
    if (!base.objectStoreNames.contains(PARTIES)) base.createObjectStore(PARTIES);
    if (!base.objectStoreNames.contains(VIES))
      base.createObjectStore(VIES, { autoIncrement: true });
  };
  return requete(ouverture);
}

/** Stockage IndexedDB : partie en cours et vies passées survivent au rechargement. */
export function stockageIndexedDB(): Stockage {
  let base: Promise<IDBDatabase> | null = null;
  const magasin = async (nom: string, mode: IDBTransactionMode): Promise<IDBObjectStore> => {
    base ??= ouvrirBase();
    return (await base).transaction(nom, mode).objectStore(nom);
  };
  return {
    async lireEnCours() {
      const lue = await requete((await magasin(PARTIES, 'readonly')).get(CLE_EN_COURS));
      return (lue as PartieSauvee | undefined) ?? null;
    },
    async sauverEnCours(partie) {
      await requete((await magasin(PARTIES, 'readwrite')).put(partie, CLE_EN_COURS));
    },
    async effacerEnCours() {
      await requete((await magasin(PARTIES, 'readwrite')).delete(CLE_EN_COURS));
    },
    async ajouterVie(vie) {
      const vies = await magasin(VIES, 'readwrite');
      await requete(vies.add(vie));
      // Au-delà de la limite, les plus anciennes (premières clés) s'effacent.
      const cles = await requete(vies.getAllKeys());
      for (const cle of cles.slice(0, Math.max(0, cles.length - VIES_GARDEES))) {
        await requete(vies.delete(cle));
      }
    },
    async listerVies() {
      const vies = (await requete((await magasin(VIES, 'readonly')).getAll())) as VieSauvee[];
      return plusRecentes(vies);
    },
  };
}

/** IndexedDB si le navigateur le permet, sinon la mémoire. */
export async function ouvrirStockage(): Promise<Stockage> {
  if (typeof indexedDB === 'undefined') return stockageMemoire();
  const stockage = stockageIndexedDB();
  try {
    await stockage.lireEnCours();
    return stockage;
  } catch {
    // Navigation privée stricte, quota refusé... : la partie se joue sans sauvegarde.
    return stockageMemoire();
  }
}
