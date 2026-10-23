// Validateur des fichiers de contenu/evenements/. Renvoie la liste des erreurs,
// sans lever d'exception, pour toutes les signaler d'un coup.

import { AGE_MAXIMAL } from './constantes';
import { TAGS_ADDICTIONS } from './modules/addictions';
import { TAGS_AIDES } from './modules/aides';
import { TAGS_FAMILLE } from './modules/famille';
import { TAGS_SANTE } from './modules/sante';
import { TAGS_EDUCATION } from './modules/education';
import { TAGS_EMPLOI } from './modules/emploi';
import { VARIABLES_TEXTE, minitel, variablesDe } from './recit';
import {
  BUDGETS_JEU,
  CHAMPS_ETATS_CONDITIONS,
  COUPLES,
  EMPLOIS,
  JAUGES_MODIFIABLES,
  JEUX,
  MALADIES,
  LOGEMENTS,
  NOMS_TRAITS,
  REGLES_CONNUES,
  SCOLARITES,
  TYPES_CONTEXTE,
  type EntreeContexte,
  type Evenement,
  type FichierEvenements,
} from './types';

const CHAMPS_ORIGINE = [
  'anneeNaissance',
  'sexe',
  'region',
  'territoire',
  'pcsParents',
  'diplomeParents',
  'decileRevenuFoyer',
  'structureFamiliale',
  'fratrie',
  'logementFamilial',
  'origineMigratoire',
  'santeNaissance',
  ...CHAMPS_ETATS_CONDITIONS,
];
/** Tags d'issue des modules : cibles possibles des modificateurs de choix. */
const TAGS_MODULES: readonly string[] = [
  ...TAGS_EDUCATION,
  ...TAGS_EMPLOI,
  ...TAGS_AIDES,
  ...TAGS_ADDICTIONS,
  ...TAGS_SANTE,
  ...TAGS_FAMILLE,
];
const JAUGES = [...JAUGES_MODIFIABLES, 'bienEtre'];
const ETATS: Record<string, readonly string[]> = {
  scolarite: SCOLARITES,
  emploi: EMPLOIS,
  couple: COUPLES,
  logement: LOGEMENTS,
};
const MOTIF_ID = /^[a-z0-9_]+$/;

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const estEntier = (v: unknown): v is number => Number.isInteger(v);
const estTexte = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export interface FichierAValider {
  nom: string;
  contenu: unknown;
}

export interface ResultatValidation {
  erreurs: string[];
  evenements: Evenement[];
}

/**
 * Copie de l'événement avec tous ses champs, dans un ordre fixe : tous les événements
 * ont la même forme en mémoire, ce qui accélère le tirage annuel (moteur JavaScript).
 */
function normaliser(e: Evenement): Evenement {
  return {
    id: e.id,
    module: e.module,
    age: e.age,
    requiert: e.requiert,
    pBase: e.pBase,
    aCalibrer: e.aCalibrer,
    modificateurs: e.modificateurs,
    effets: e.effets,
    choix: e.choix,
    cooldown: e.cooldown,
    unique: e.unique,
    gravite: e.gravite,
    tags: e.tags,
    textes: e.textes,
    ressources: e.ressources,
    annees: e.annees,
    regle: e.regle,
  };
}

export interface OptionsValidation {
  /** Identifiants des ressources d'aide connues (contenu/textes/ressources.json). */
  ressources?: readonly string[];
}

/** Conditions (requiert ou si) qui testent l'origine migratoire. */
function testeOrigineMigratoire(conditions: unknown): boolean {
  return estObjet(conditions) && 'origineMigratoire' in conditions;
}

export function validerEvenements(
  fichiers: readonly FichierAValider[],
  options: OptionsValidation = {},
): ResultatValidation {
  const erreurs: string[] = [];
  const evenements: Evenement[] = [];
  const ids = new Set<string>();
  const tags = new Set<string>();
  // Cibles des modificateurs de choix, vérifiées une fois tous les ids et tags connus.
  const cibles: { lieu: string; cible: Objet }[] = [];

  /** Texte au format Minitel (hors variables), avec des variables connues. */
  const verifierTexte = (lieu: string, texte: unknown, avecVariables: boolean): void => {
    if (!estTexte(texte)) return void erreurs.push(`${lieu} : texte vide ou absent`);
    const variables = variablesDe(texte);
    if (!avecVariables && variables.length > 0) erreurs.push(`${lieu} : variables interdites ici`);
    for (const nom of variables) {
      if (!(VARIABLES_TEXTE as readonly string[]).includes(nom)) {
        erreurs.push(`${lieu} : variable inconnue {${nom}}`);
      }
    }
    const horsVariables = texte.replace(/\{[^{}]*\}/g, '');
    if (horsVariables !== minitel(horsVariables)) {
      erreurs.push(`${lieu} : texte hors format Minitel (majuscules sans accents)`);
    }
  };

  const verifierConditions = (lieu: string, conditions: unknown): void => {
    if (!estObjet(conditions)) return void erreurs.push(`${lieu} : conditions invalides`);
    for (const [champ, valeurs] of Object.entries(conditions)) {
      if (!CHAMPS_ORIGINE.includes(champ)) erreurs.push(`${lieu} : champ inconnu ${champ}`);
      if (!Array.isArray(valeurs) || valeurs.length === 0 || !valeurs.every(estTexte)) {
        erreurs.push(`${lieu} : valeurs de ${champ} invalides`);
      }
    }
  };

  const verifierJauges = (lieu: string, jauges: unknown, negatives: boolean): void => {
    if (jauges === undefined) return;
    if (!estObjet(jauges)) return void erreurs.push(`${lieu} : jauges invalides`);
    for (const [nom, delta] of Object.entries(jauges)) {
      if (!(JAUGES_MODIFIABLES as readonly string[]).includes(nom)) {
        erreurs.push(`${lieu} : jauge non modifiable ${nom}`);
      }
      if (!estNombre(delta)) erreurs.push(`${lieu} : variation de ${nom} invalide`);
      else if (negatives && delta > 0)
        erreurs.push(`${lieu} : un cout ne peut pas augmenter ${nom}`);
    }
  };

  const verifierTraitK = (lieu: string, valeur: Objet): void => {
    if (!(NOMS_TRAITS as readonly string[]).includes(valeur.trait as string)) {
      erreurs.push(`${lieu} : trait inconnu ${String(valeur.trait)}`);
    }
    if (!estNombre(valeur.k)) erreurs.push(`${lieu} : k invalide`);
  };

  const verifierChoix = (lieu: string, choix: unknown): void => {
    if (!estObjet(choix)) return void erreurs.push(`${lieu} : choix invalide`);
    if (!estTexte(choix.id) || !MOTIF_ID.test(choix.id)) erreurs.push(`${lieu} : id invalide`);
    verifierTexte(`${lieu} > libelle`, choix.libelle, false);
    if (choix.journal !== undefined) verifierTexte(`${lieu} > journal`, choix.journal, true);
    if (choix.cout !== undefined) {
      if (!estObjet(choix.cout)) erreurs.push(`${lieu} : cout invalide`);
      else {
        verifierJauges(`${lieu} > cout`, choix.cout.jauges, true);
        const argent = choix.cout.argent;
        if (argent !== undefined && (!estEntier(argent) || argent < 0)) {
          erreurs.push(`${lieu} : cout en argent invalide`);
        }
      }
    }
    if (choix.modificateurs !== undefined) {
      if (!Array.isArray(choix.modificateurs)) erreurs.push(`${lieu} : modificateurs invalides`);
      else
        choix.modificateurs.forEach((mod: unknown, i) => {
          const ici = `${lieu} > modificateur ${i + 1}`;
          if (!estObjet(mod)) return void erreurs.push(`${ici} : invalide`);
          if (!estNombre(mod.m) || mod.m <= 0) erreurs.push(`${ici} : m doit etre positif`);
          if (mod.duree !== undefined && (!estEntier(mod.duree) || mod.duree < 1)) {
            erreurs.push(`${ici} : duree invalide`);
          }
          if (!estObjet(mod.cible)) erreurs.push(`${ici} : cible absente`);
          else cibles.push({ lieu: ici, cible: mod.cible });
        });
    }
    if (choix.effets !== undefined) {
      // Effets directs : accepter une opportunité, ou un acte du joueur sur son jeu
      // (choisir un jeu et un budget, se refaire, s'inscrire à l'interdiction volontaire,
      // acheter son logement quand l'achat est possible).
      const effets = choix.effets;
      if (!estObjet(effets) || Object.keys(effets).length === 0) {
        erreurs.push(`${lieu} : effets de choix invalides`);
      } else {
        for (const [cle, valeur] of Object.entries(effets)) {
          const valide =
            cle === 'changerEmploi' ||
            cle === 'chasse' ||
            cle === 'interdiction' ||
            cle === 'acheterLogement'
              ? valeur === true
              : cle === 'jeu'
                ? (JEUX as readonly unknown[]).includes(valeur)
                : cle === 'budget'
                  ? (BUDGETS_JEU as readonly unknown[]).includes(valeur)
                  : false;
          if (!valide) erreurs.push(`${lieu} : effet de choix ${cle} invalide`);
        }
      }
    }
    if (choix.affinites !== undefined) {
      if (!Array.isArray(choix.affinites)) erreurs.push(`${lieu} : affinites invalides`);
      else
        choix.affinites.forEach((a: unknown, i) => {
          if (!estObjet(a)) erreurs.push(`${lieu} > affinite ${i + 1} : invalide`);
          else verifierTraitK(`${lieu} > affinite ${i + 1}`, a);
        });
    }
  };

  const verifierEvenement = (fichier: string, brut: unknown, rang: number): void => {
    if (!estObjet(brut)) return void erreurs.push(`${fichier} > evenement ${rang} : invalide`);
    const lieu = `${fichier} > ${estTexte(brut.id) ? brut.id : `evenement ${rang}`}`;
    const avant = erreurs.length;

    if (!estTexte(brut.id) || !MOTIF_ID.test(brut.id)) erreurs.push(`${lieu} : id invalide`);
    else if (ids.has(brut.id)) erreurs.push(`${lieu} : id en double`);
    else ids.add(brut.id);
    if (!estTexte(brut.module)) erreurs.push(`${lieu} : module absent`);

    const [min, max] = Array.isArray(brut.age) ? brut.age : [];
    if (
      !Array.isArray(brut.age) ||
      brut.age.length !== 2 ||
      !estEntier(min) ||
      !estEntier(max) ||
      min < 0 ||
      min > max ||
      max > AGE_MAXIMAL
    ) {
      erreurs.push(`${lieu} : age doit etre [min, max] avec 0 <= min <= max <= ${AGE_MAXIMAL}`);
    }

    if (estObjet(brut.pBase)) erreurs.push(`${lieu} : pBase par table pas encore prise en charge`);
    else if (!estNombre(brut.pBase) || brut.pBase < 0 || brut.pBase > 1) {
      erreurs.push(`${lieu} : pBase doit etre entre 0 et 1`);
    }
    if (brut.aCalibrer !== undefined && typeof brut.aCalibrer !== 'boolean') {
      erreurs.push(`${lieu} : aCalibrer doit etre un booleen`);
    }
    if (![1, 2, 3].includes(brut.gravite as number)) {
      erreurs.push(`${lieu} : gravite doit valoir 1, 2 ou 3`);
    }

    if (!Array.isArray(brut.tags) || !brut.tags.every((t) => estTexte(t) && MOTIF_ID.test(t))) {
      erreurs.push(`${lieu} : tags invalides`);
    } else brut.tags.forEach((t: string) => tags.add(t));

    if (!Array.isArray(brut.textes) || brut.textes.length < 2 || brut.textes.length > 3) {
      erreurs.push(`${lieu} : il faut 2 ou 3 variantes de texte`);
    } else
      brut.textes.forEach((t: unknown, i) => verifierTexte(`${lieu} > texte ${i + 1}`, t, true));

    if (brut.requiert !== undefined) verifierConditions(`${lieu} > requiert`, brut.requiert);

    // Origine migratoire : seulement pour modéliser une discrimination mesurée, jamais
    // un comportement (CLAUDE.md, règles section 14).
    const testeOrigine =
      testeOrigineMigratoire(brut.requiert) ||
      (Array.isArray(brut.modificateurs) &&
        brut.modificateurs.some((m: unknown) => estObjet(m) && testeOrigineMigratoire(m.si)));
    if (testeOrigine) {
      const etiquettes = Array.isArray(brut.tags) ? brut.tags : [];
      if (etiquettes.includes('delinquance')) {
        erreurs.push(`${lieu} : un evenement de delinquance ne teste jamais l'origine migratoire`);
      } else if (!etiquettes.includes('discrimination')) {
        erreurs.push(`${lieu} : origine migratoire reservee aux evenements tagues discrimination`);
      }
    }

    if (brut.ressources !== undefined) {
      if (!Array.isArray(brut.ressources) || !brut.ressources.every(estTexte)) {
        erreurs.push(`${lieu} : ressources invalides`);
      } else if (options.ressources) {
        for (const r of brut.ressources as string[]) {
          if (!options.ressources.includes(r)) erreurs.push(`${lieu} : ressource inconnue ${r}`);
        }
      }
    }

    if (brut.modificateurs !== undefined) {
      if (!Array.isArray(brut.modificateurs)) erreurs.push(`${lieu} : modificateurs invalides`);
      else
        brut.modificateurs.forEach((mod: unknown, i) => {
          const ici = `${lieu} > modificateur ${i + 1}`;
          if (!estObjet(mod)) return void erreurs.push(`${ici} : invalide`);
          if ('trait' in mod) verifierTraitK(ici, mod);
          else if ('jauge' in mod) {
            if (!JAUGES.includes(mod.jauge as string)) erreurs.push(`${ici} : jauge inconnue`);
            if (!estNombre(mod.k)) erreurs.push(`${ici} : k invalide`);
          } else if ('si' in mod) {
            verifierConditions(ici, mod.si);
            if (!estNombre(mod.m) || mod.m <= 0) erreurs.push(`${ici} : m doit etre positif`);
          } else erreurs.push(`${ici} : forme inconnue (trait, jauge ou si)`);
        });
    }

    const effets = brut.effets;
    if (!estObjet(effets)) erreurs.push(`${lieu} : effets absents`);
    else {
      verifierJauges(`${lieu} > effets`, effets.jauges, false);
      if (effets.etats !== undefined) {
        if (!estObjet(effets.etats)) erreurs.push(`${lieu} : etats invalides`);
        else
          for (const [champ, valeur] of Object.entries(effets.etats)) {
            if (!ETATS[champ]?.includes(valeur as string)) {
              erreurs.push(`${lieu} : etat ${champ} = ${String(valeur)} inconnu`);
            }
          }
      }
      if (effets.revenu !== undefined) {
        const [min, max] = Array.isArray(effets.revenu) ? effets.revenu : [];
        if (!estNombre(min) || !estNombre(max) || min <= 0 || min > max) {
          erreurs.push(`${lieu} : revenu doit etre [min, max] avec 0 < min <= max`);
        }
      }
      if (
        effets.justice !== undefined &&
        !['garde_a_vue', 'condamnation'].includes(effets.justice as string)
      ) {
        erreurs.push(`${lieu} : justice doit valoir garde_a_vue ou condamnation`);
      }
      if (
        effets.maladie !== undefined &&
        !(MALADIES as readonly unknown[]).includes(effets.maladie)
      ) {
        erreurs.push(`${lieu} : maladie inconnue ${String(effets.maladie)}`);
      }
      if (effets.surendettement !== undefined && effets.surendettement !== true) {
        erreurs.push(`${lieu} : surendettement doit valoir true`);
      }
      if (effets.argent !== undefined && !estEntier(effets.argent)) {
        erreurs.push(`${lieu} : argent doit etre un entier`);
      }
      if (effets.deces !== undefined) {
        if (!estNombre(effets.deces) || effets.deces < 0 || effets.deces > 1) {
          erreurs.push(`${lieu} : deces doit etre entre 0 et 1`);
        }
        if (brut.choix !== undefined)
          erreurs.push(`${lieu} : un evenement mortel n'a pas de choix`);
      }
    }

    if (brut.choix !== undefined) {
      if (!Array.isArray(brut.choix) || brut.choix.length < 2 || brut.choix.length > 3) {
        erreurs.push(`${lieu} : il faut 2 ou 3 choix`);
      } else {
        brut.choix.forEach((c: unknown, i) => verifierChoix(`${lieu} > choix ${i + 1}`, c));
        const idsChoix = brut.choix.map((c: unknown) => (estObjet(c) ? c.id : undefined));
        if (new Set(idsChoix).size !== idsChoix.length)
          erreurs.push(`${lieu} : ids de choix en double`);
      }
    }

    if (brut.annees !== undefined) {
      const [premiere, derniere] = Array.isArray(brut.annees) ? brut.annees : [];
      if (!estEntier(premiere) || !estEntier(derniere) || premiere > derniere) {
        erreurs.push(`${lieu} : annees doit etre [premiere, derniere] en annees calendaires`);
      }
    }

    if (brut.regle !== undefined && !(REGLES_CONNUES as readonly unknown[]).includes(brut.regle)) {
      erreurs.push(`${lieu} : regle inconnue ${String(brut.regle)}`);
    }

    if (brut.cooldown !== undefined && (!estEntier(brut.cooldown) || brut.cooldown < 1)) {
      erreurs.push(`${lieu} : cooldown invalide`);
    }
    if (brut.unique !== undefined && typeof brut.unique !== 'boolean') {
      erreurs.push(`${lieu} : unique doit etre un booleen`);
    }
    if (brut.unique === true && brut.cooldown !== undefined) {
      erreurs.push(`${lieu} : unique et cooldown sont incompatibles`);
    }

    if (erreurs.length === avant) evenements.push(normaliser(brut as unknown as Evenement));
  };

  for (const { nom, contenu } of fichiers) {
    if (!estObjet(contenu)) {
      erreurs.push(`${nom} : fichier invalide`);
      continue;
    }
    const fichier = contenu as Partial<Record<keyof FichierEvenements, unknown>>;
    if (!estTexte(fichier.module)) erreurs.push(`${nom} : module absent`);
    if (!estTexte(fichier.source)) erreurs.push(`${nom} : source absente`);
    if (typeof fichier.aCalibrer !== 'boolean') erreurs.push(`${nom} : aCalibrer absent`);
    if (!Array.isArray(fichier.evenements)) erreurs.push(`${nom} : liste evenements absente`);
    else fichier.evenements.forEach((e, i) => verifierEvenement(nom, e, i + 1));
  }

  for (const { lieu, cible } of cibles) {
    if (typeof cible.evenement === 'string') {
      if (!ids.has(cible.evenement))
        erreurs.push(`${lieu} : evenement cible inconnu ${cible.evenement}`);
    } else if (typeof cible.tag === 'string') {
      if (!tags.has(cible.tag) && !TAGS_MODULES.includes(cible.tag)) {
        erreurs.push(`${lieu} : tag cible inconnu ${cible.tag}`);
      }
    } else erreurs.push(`${lieu} : cible sans evenement ni tag`);
  }

  return { erreurs, evenements };
}

export interface ResultatValidationContexte {
  erreurs: string[];
  entrees: EntreeContexte[];
}

/**
 * Validateur des fichiers de contenu/contexte/ : chaque entrée historique est datée,
 * sourcée, au format Minitel ; ses multiplicateurs visent des tags connus ; son profil
 * ne teste jamais l'origine migratoire (un contexte n'est pas une discrimination mesurée).
 */
export function validerContexte(
  fichiers: readonly FichierAValider[],
  tagsConnus: ReadonlySet<string>,
): ResultatValidationContexte {
  const erreurs: string[] = [];
  const entrees: EntreeContexte[] = [];
  const ids = new Set<string>();
  const texteMinitel = (lieu: string, texte: unknown): void => {
    if (!estTexte(texte)) erreurs.push(`${lieu} : texte vide ou absent`);
    else if (texte !== minitel(texte) || /\{/.test(texte)) {
      erreurs.push(`${lieu} : texte hors format Minitel (majuscules sans accents, sans variable)`);
    }
  };

  for (const { nom, contenu } of fichiers) {
    if (!estObjet(contenu) || !Array.isArray(contenu.entrees)) {
      erreurs.push(`${nom} : liste entrees absente`);
      continue;
    }
    if (!estTexte(contenu.source)) erreurs.push(`${nom} : source du fichier absente`);
    contenu.entrees.forEach((brut: unknown, rang) => {
      if (!estObjet(brut)) return void erreurs.push(`${nom} > entree ${rang + 1} : invalide`);
      const lieu = `${nom} > ${estTexte(brut.id) ? brut.id : `entree ${rang + 1}`}`;
      const avant = erreurs.length;
      if (!estTexte(brut.id) || !MOTIF_ID.test(brut.id)) erreurs.push(`${lieu} : id invalide`);
      else if (ids.has(brut.id)) erreurs.push(`${lieu} : id en double`);
      else ids.add(brut.id);
      if (!(TYPES_CONTEXTE as readonly string[]).includes(brut.type as string)) {
        erreurs.push(`${lieu} : type doit valoir ${TYPES_CONTEXTE.join(', ')}`);
      }
      if (!['france', 'monde'].includes(brut.portee as string)) {
        erreurs.push(`${lieu} : portee doit valoir france ou monde`);
      }
      if (
        !estEntier(brut.debut) ||
        !estEntier(brut.fin) ||
        brut.debut < 1940 ||
        brut.fin > 2130 ||
        brut.debut > brut.fin
      ) {
        erreurs.push(`${lieu} : debut et fin doivent etre des annees, debut <= fin`);
      }
      texteMinitel(`${lieu} > titre`, brut.titre);
      texteMinitel(`${lieu} > texte`, brut.texte);
      if (!estTexte(brut.source)) erreurs.push(`${lieu} : source absente`);
      if (brut.url !== undefined && brut.url !== null && !/^https:\/\//.test(String(brut.url))) {
        erreurs.push(`${lieu} : url invalide`);
      }
      if (brut.profil !== undefined) {
        if (!estObjet(brut.profil)) erreurs.push(`${lieu} : profil invalide`);
        else {
          for (const [champ, valeurs] of Object.entries(brut.profil)) {
            if (champ === 'origineMigratoire') {
              erreurs.push(`${lieu} : un contexte ne teste jamais l'origine migratoire`);
            } else if (!CHAMPS_ORIGINE.includes(champ)) {
              erreurs.push(`${lieu} : champ de profil inconnu ${champ}`);
            }
            if (!Array.isArray(valeurs) || valeurs.length === 0 || !valeurs.every(estTexte)) {
              erreurs.push(`${lieu} : valeurs de ${champ} invalides`);
            }
          }
        }
      }
      if (brut.multiplicateurs !== undefined) {
        if (!estObjet(brut.multiplicateurs)) erreurs.push(`${lieu} : multiplicateurs invalides`);
        else {
          for (const [tag, m] of Object.entries(brut.multiplicateurs)) {
            if (!tagsConnus.has(tag)) erreurs.push(`${lieu} : tag vise inconnu ${tag}`);
            if (!estNombre(m) || m <= 0)
              erreurs.push(`${lieu} : multiplicateur de ${tag} invalide`);
          }
        }
      }
      if (brut.regles !== undefined) {
        if (!estObjet(brut.regles)) erreurs.push(`${lieu} : regles invalides`);
        else {
          for (const [cle, valeur] of Object.entries(brut.regles)) {
            if (!(REGLES_CONNUES as readonly string[]).includes(cle)) {
              erreurs.push(`${lieu} : regle inconnue ${cle}`);
            }
            if (typeof valeur === 'string') {
              if (!estTexte(valeur) || valeur !== minitel(valeur)) {
                erreurs.push(`${lieu} : nom de la regle ${cle} hors format Minitel`);
              }
            } else if (typeof valeur !== 'boolean' && !estNombre(valeur)) {
              erreurs.push(`${lieu} : valeur de la regle ${cle} invalide`);
            }
          }
        }
      }
      if (erreurs.length === avant) entrees.push(brut as unknown as EntreeContexte);
    });
  }
  return { erreurs, entrees };
}

/** Tags visables par le contexte : ceux des événements et des modules. */
export function tagsConnus(evenements: readonly Evenement[]): Set<string> {
  return new Set([...evenements.flatMap((e) => e.tags), ...TAGS_MODULES]);
}
