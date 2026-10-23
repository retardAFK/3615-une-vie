// Module éducation (règles, section 5). Appelé à l'étape « états » de chaque année :
// les décisions prises en fin d'année a valent pour l'année a + 1, et tiennent compte
// des choix faits cette année (modificateurs actifs à partir de a + 1).

import {
  AGE_CP,
  AGE_MATERNELLE,
  RETARD_MAXIMAL,
  SAVOIR_PAR_ANNEE_SCOLAIRE,
  SAVOIR_PAR_DIPLOME,
} from '../constantes';
import { distributionCorrigee, multiplicateurTrait, probabiliteFinale } from '../cotes';
import { multiplicateursTag } from '../evenements';
import { regleEnVigueur } from './contexte';
import { hachageSuffixe, sousGenerateur, tirageHache, tirerPondere } from '../rng';
import { chercherLigne, periodeDe, valeurDe } from '../tables';
import type {
  DiplomeJoueur,
  Donnees,
  Education,
  EtatPartie,
  Filiere,
  Personnage,
  Voie,
} from '../types';

/** Tags que les choix peuvent viser pour agir sur ce module. */
export const TAGS_EDUCATION = [
  'reussite_scolaire',
  'redoublement',
  'decrochage',
  'voie_generale',
  'voie_technologique',
  'voie_professionnelle',
  'voie_apprentissage',
  'filiere_universite',
  'filiere_bts_but',
  'filiere_prepa',
  'filiere_ecole',
  'filiere_emploi_direct',
  'filiere_master',
  'reprise_diplome',
] as const;

/** Durée de chaque formation, en années. */
const DUREES: Readonly<Record<Exclude<Voie, 'sortie'> | Filiere, number>> = {
  generale: 3,
  technologique: 3,
  professionnelle: 3,
  apprentissage: 2,
  universite: 3,
  bts_but: 2,
  prepa: 5,
  ecole: 5,
  emploi_direct: 0,
  master: 2,
};

/** Diplôme suivant, pour une reprise d'études. */
const DIPLOME_SUIVANT: Readonly<Record<DiplomeJoueur, DiplomeJoueur>> = {
  aucun: 'cap_bep',
  cap_bep: 'bac_pro',
  bac_pro: 'bac_2_3',
  bac_techno: 'bac_2_3',
  bac_general: 'bac_2_3',
  bac_2_3: 'bac_5',
  bac_5: 'bac_5',
};

/** Contexte d'un tirage : l'année qui se termine décide pour l'âge suivant. */
interface Tirage {
  etat: EtatPartie;
  donnees: Donnees;
  /** Âge de l'année à venir (modificateurs actifs à cet âge). */
  suivant: number;
}

function tirer(t: Tirage, id: string, pBase: number, multiplicateurs: number[]): boolean {
  return (
    tirageHache(t.etat.graine, t.etat.personnage.age, hachageSuffixe('education', id)) <
    probabiliteFinale(pBase, multiplicateurs)
  );
}

function tags(t: Tirage, tag: string): number[] {
  return multiplicateursTag(t.etat, tag, t.suivant, t.donnees);
}

function trait(t: Tirage, nom: keyof Personnage['traits'], k: number): number {
  return multiplicateurTrait(t.etat.personnage.traits[nom], k);
}

/** Fin de la scolarité : la jauge « savoir » prend la valeur du diplôme final. */
function sortie(personnage: Personnage, diplome: DiplomeJoueur): Personnage {
  return {
    ...personnage,
    jauges: { ...personnage.jauges, competences: SAVOIR_PAR_DIPLOME[diplome] },
    etats: {
      ...personnage.etats,
      scolarite: 'sortie',
      emploi: 'inactif',
      education: {
        ...personnage.etats.education,
        diplome,
        voie: null,
        filiere: null,
        finPalier: null,
      },
    },
  };
}

function avecEducation(
  personnage: Personnage,
  education: Partial<Education>,
  autres: Partial<Personnage['etats']> = {},
): Personnage {
  return {
    ...personnage,
    etats: {
      ...personnage.etats,
      ...autres,
      education: { ...personnage.etats.education, ...education },
    },
  };
}

function redouble(t: Tirage): boolean {
  const { personnage } = t.etat;
  if (personnage.etats.education.retard >= RETARD_MAXIMAL) return false;
  const p = valeurDe(t.donnees.tables.redoublement, {
    diplomeParents: personnage.origine.diplomeParents,
  });
  const santeFragile = personnage.origine.santeNaissance === 'normale' ? [] : [1.5];
  return tirer(t, 'redoublement', p, [
    trait(t, 'facilite', -0.8),
    ...santeFragile,
    ...tags(t, 'redoublement'),
  ]);
}

/** Fin de 3e : voie tirée selon l'origine, la facilité, le retard et les vœux. */
function orienterFin3e(t: Tirage): Voie {
  const { personnage } = t.etat;
  const { tables } = t.donnees;
  const annee = t.etat.annee + 1;
  const { distribution } = chercherLigne(
    tables.voieFin3e,
    { pcsParents: personnage.origine.pcsParents, periode: periodeDe(annee) },
    ['pcsParents', 'periode'],
  );
  // Sortie impossible avant la fin de l'obligation scolaire.
  const obligation = valeurDe(
    tables.obligationScolaire,
    { generation: String(personnage.origine.anneeNaissance) },
    ['generation'],
  );
  const base = { ...distribution } as Record<Voie, number>;
  if (t.suivant < obligation) base.sortie = 0;
  const retard = personnage.etats.education.retard;
  const k: Readonly<Record<Voie, number>> = {
    generale: 0.9,
    technologique: 0.3,
    professionnelle: -0.5,
    apprentissage: -0.5,
    sortie: -0.8,
  };
  const corrigee = distributionCorrigee(base, (voie) => [
    trait(t, 'facilite', k[voie]),
    ...(voie === 'generale' && retard > 0 ? [0.5 ** retard] : []),
    ...tags(t, `voie_${voie}`),
  ]);
  return tirerPondere(sousGenerateur(t.etat.graine, personnage.age, 'education.voie'), corrigee);
}

function orienterPostBac(t: Tirage, diplome: DiplomeJoueur): Filiere {
  const { personnage } = t.etat;
  const { distribution } = chercherLigne(
    t.donnees.tables.orientationPostBac,
    { diplome, pcsParents: personnage.origine.pcsParents },
    ['pcsParents', 'diplome'],
  );
  const k: Partial<Record<Filiere, number>> = { prepa: 1, ecole: 0.6, universite: 0.3 };
  const corrigee = distributionCorrigee(distribution as Record<Filiere, number>, (filiere) => [
    trait(t, 'facilite', k[filiere] ?? 0),
    ...tags(t, `filiere_${filiere}`),
  ]);
  return tirerPondere(sousGenerateur(t.etat.graine, personnage.age, 'education.filiere'), corrigee);
}

function reussit(t: Tirage, formation: string): boolean {
  const p = valeurDe(t.donnees.tables.reussiteDiplome, { formation });
  return tirer(t, 'examen', p, [
    trait(t, 'facilite', 0.8),
    multiplicateurTrait(t.etat.personnage.jauges.santeMentale, 0.3),
    ...tags(t, 'reussite_scolaire'),
  ]);
}

/** Diplôme de fin de lycée, selon la voie. */
/**
 * Diplôme de fin de lycée, selon la voie. Le bac professionnel n'existe qu'à partir
 * de la loi qui le crée (contexte historique, règle « bacPro ») ; avant, un CAP ou BEP.
 */
function diplomeLycee(voie: Voie, annee: number, donnees: Donnees): DiplomeJoueur {
  switch (voie) {
    case 'generale':
      return 'bac_general';
    case 'technologique':
      return 'bac_techno';
    case 'professionnelle':
      return regleEnVigueur(donnees.contexte, annee, 'bacPro') === true ? 'bac_pro' : 'cap_bep';
    default:
      return 'cap_bep';
  }
}

/** Entrée dans le supérieur, ou dans la vie active pour « emploi direct ». */
function apresBac(t: Tirage, personnage: Personnage, diplome: DiplomeJoueur): Personnage {
  const filiere = orienterPostBac(t, diplome);
  if (filiere === 'emploi_direct') return sortie(personnage, diplome);
  return avecEducation(
    personnage,
    { diplome, voie: null, filiere, finPalier: t.suivant + DUREES[filiere] },
    { scolarite: 'superieur', emploi: 'etudiant' },
  );
}

function lycee(t: Tirage, personnage: Personnage): Personnage {
  const { tables } = t.donnees;
  const ed = personnage.etats.education;
  const voie = ed.voie ?? 'generale';
  const pDecrochage = valeurDe(tables.decrochage, { voie });
  const decroche = tirer(t, 'decrochage', pDecrochage, [
    multiplicateurTrait(personnage.jauges.santeMentale, -0.5),
    ...tags(t, 'decrochage'),
  ]);
  if (decroche) return sortie(personnage, ed.diplome);
  if (ed.finPalier === null || t.suivant < ed.finPalier) return personnage;
  if (reussit(t, voie)) {
    const diplome = diplomeLycee(voie, t.etat.annee, t.donnees);
    return diplome === 'cap_bep' || diplome === 'bac_pro'
      ? sortie(personnage, diplome)
      : apresBac(t, personnage, diplome);
  }
  if (ed.retard < RETARD_MAXIMAL) {
    return avecEducation(personnage, { retard: ed.retard + 1, finPalier: ed.finPalier + 1 });
  }
  return sortie(personnage, ed.diplome);
}

function superieur(t: Tirage, personnage: Personnage): Personnage {
  const { tables } = t.donnees;
  const ed = personnage.etats.education;
  const filiere = ed.filiere ?? 'universite';
  if (tirer(t, 'abandon', valeurDe(tables.abandonSup, { filiere }), [])) {
    return sortie(personnage, ed.diplome);
  }
  if (ed.finPalier === null || t.suivant < ed.finPalier) return personnage;
  const succes = reussit(t, filiere);
  switch (filiere) {
    case 'universite': {
      if (!succes) return sortie(personnage, ed.diplome);
      const pMaster = valeurDe(tables.poursuiteMaster, {
        pcsParents: personnage.origine.pcsParents,
      });
      const poursuit = tirer(t, 'master', pMaster, [
        trait(t, 'ambition', 0.7),
        ...tags(t, 'filiere_master'),
      ]);
      if (!poursuit) return sortie(personnage, 'bac_2_3');
      return avecEducation(personnage, {
        diplome: 'bac_2_3',
        filiere: 'master',
        finPalier: t.suivant + DUREES.master,
      });
    }
    case 'bts_but':
      return sortie(personnage, succes ? 'bac_2_3' : ed.diplome);
    case 'master':
      return sortie(personnage, succes ? 'bac_5' : 'bac_2_3');
    default:
      // Prépa et école : bac+5 en cas de réussite, sinon équivalence bac+2/3.
      return sortie(personnage, succes ? 'bac_5' : 'bac_2_3');
  }
}

/** Reprise d'études à l'âge adulte : seulement si un choix l'a demandée. */
function reprise(t: Tirage, personnage: Personnage): Personnage {
  const demandes = tags(t, 'reprise_diplome');
  if (demandes.length === 0) return personnage;
  const p = valeurDe(t.donnees.tables.repriseEtudes);
  if (!tirer(t, 'reprise', p, [trait(t, 'facilite', 0.6), ...demandes])) return personnage;
  const diplome = DIPLOME_SUIVANT[personnage.etats.education.diplome];
  return {
    ...avecEducation(personnage, { diplome }),
    jauges: {
      ...personnage.jauges,
      competences: Math.max(personnage.jauges.competences, SAVOIR_PAR_DIPLOME[diplome]),
    },
  };
}

/** Une année de scolarité : progression, redoublements, orientations, diplômes. */
export function evoluerEducation(etat: EtatPartie, donnees: Donnees): Personnage {
  const personnage = etat.personnage;
  const t: Tirage = { etat, donnees, suivant: personnage.age + 1 };
  const { scolarite, education } = personnage.etats;
  if (scolarite === 'sortie') return reprise(t, personnage);

  // Savoir gagné pendant l'année scolaire.
  const scolarise = scolarite !== 'non_scolarise' && scolarite !== 'maternelle';
  const p: Personnage = scolarise
    ? {
        ...personnage,
        jauges: {
          ...personnage.jauges,
          competences: Math.min(100, personnage.jauges.competences + SAVOIR_PAR_ANNEE_SCOLAIRE),
        },
      }
    : personnage;
  const { retard } = education;

  switch (scolarite) {
    case 'non_scolarise':
      return t.suivant >= AGE_MATERNELLE ? avecEducation(p, {}, { scolarite: 'maternelle' }) : p;
    case 'maternelle':
      return t.suivant >= AGE_CP ? avecEducation(p, {}, { scolarite: 'primaire' }) : p;
    case 'primaire':
      if (redouble(t)) return avecEducation(p, { retard: retard + 1 });
      return t.suivant >= 11 + retard ? avecEducation(p, {}, { scolarite: 'college' }) : p;
    case 'college': {
      if (redouble(t)) return avecEducation(p, { retard: retard + 1 });
      if (t.suivant < 15 + retard) return p;
      const voie = orienterFin3e(t);
      if (voie === 'sortie') return sortie(p, 'aucun');
      return avecEducation(
        p,
        { voie, finPalier: t.suivant + DUREES[voie] },
        { scolarite: 'lycee' },
      );
    }
    case 'lycee':
      return lycee(t, p);
    case 'superieur':
      return superieur(t, p);
    default:
      return p;
  }
}
