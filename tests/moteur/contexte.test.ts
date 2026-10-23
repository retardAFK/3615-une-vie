import { describe, expect, it } from 'vitest';
import { creerPartie, jouerAnneeAuto, ouvrirAnnee } from '../../src/moteur/boucle';
import {
  contexteActif,
  nouveautesDeLAnnee,
  regleEnVigueur,
} from '../../src/moteur/modules/contexte';
import type { EtatPartie } from '../../src/moteur/types';
import { validerContexte } from '../../src/moteur/validation';
import { DONNEES, TABLES_IMMORTELS, donneesAvec, evenement } from './donnees';

const entree = (partiel: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'essai',
  type: 'actualite',
  debut: 1990,
  fin: 1990,
  portee: 'france',
  titre: 'TITRE',
  texte: 'TEXTE.',
  source: 'Source de test.',
  ...partiel,
});
const erreurs = (entrees: unknown[]): string[] =>
  validerContexte(
    [{ nom: 'essai.json', contenu: { source: 'test', entrees } }],
    new Set(['licenciement']),
  ).erreurs;

describe('validation du contexte', () => {
  it('accepte une entree datee et sourcee', () => {
    expect(erreurs([entree()])).toEqual([]);
  });

  it('exige une source, des dates coherentes et le format Minitel', () => {
    expect(erreurs([entree({ source: '' })]).join()).toContain('source absente');
    expect(erreurs([entree({ debut: 2000, fin: 1990 })]).join()).toContain('debut et fin');
    expect(erreurs([entree({ titre: 'Titre accentué' })]).join()).toContain('format Minitel');
  });

  it("refuse l'origine migratoire dans un profil, un tag inconnu, une regle inconnue", () => {
    expect(
      erreurs([entree({ profil: { origineMigratoire: ['premiere_generation'] } })]).join(),
    ).toContain("ne teste jamais l'origine migratoire");
    expect(erreurs([entree({ multiplicateurs: { fantome: 2 } })]).join()).toContain(
      'tag vise inconnu',
    );
    expect(erreurs([entree({ regles: { inventee: true } })]).join()).toContain('regle inconnue');
  });

  it('chaque entree du contenu porte une source', () => {
    expect(DONNEES.contexte.length).toBeGreaterThan(40);
    for (const e of DONNEES.contexte) expect(e.source.length, e.id).toBeGreaterThan(10);
  });
});

describe('lois et regles', () => {
  it('le bac professionnel existe a partir de la loi qui le cree', () => {
    expect(regleEnVigueur(DONNEES.contexte, 1986, 'bacPro')).toBeUndefined();
    expect(regleEnVigueur(DONNEES.contexte, 1987, 'bacPro')).toBe(true);
    expect(regleEnVigueur(DONNEES.contexte, 2030, 'bacPro')).toBe(true);
  });

  it('indexe les entrees en cours et celles qui commencent chaque annee', () => {
    expect(contexteActif(DONNEES.contexte, 1965).map((e) => e.id)).toContain(
      'crise_trente_glorieuses',
    );
    expect(nouveautesDeLAnnee(DONNEES.contexte, 1969).map((e) => e.id)).toContain('act_apollo_11');
    expect(nouveautesDeLAnnee(DONNEES.contexte, 1965).map((e) => e.id)).not.toContain(
      'crise_trente_glorieuses',
    );
  });
});

describe('evenements dates', () => {
  it('ne propose un mouvement social que pendant ses annees calendaires', () => {
    const greve = evenement('greve', { age: [0, 110], annees: [1995, 1995] });
    const donnees = donneesAvec([greve], TABLES_IMMORTELS);
    const ouvertA = (annee: number): string[] => {
      let etat: EtatPartie = creerPartie('greve', donnees, { anneeNaissance: 1980 });
      while (etat.annee < annee) etat = jouerAnneeAuto(etat, donnees).etat;
      return ouvrirAnnee(etat, donnees).evenements.map((e) => e.id);
    };
    expect(ouvertA(1994)).toEqual([]);
    expect(ouvertA(1995)).toEqual(['greve']);
  });
});

describe('vies et contexte historique', () => {
  const contextesVecus = (anneeNaissance: number): Set<string> => {
    let etat = creerPartie(`histoire-${anneeNaissance}`, DONNEES, { anneeNaissance });
    while (etat.personnage.vivant && etat.annee <= 2026) etat = jouerAnneeAuto(etat, DONNEES).etat;
    return new Set(etat.historique.filter((e) => e.type === 'actualite').map((e) => e.contexteId!));
  };

  it('ecrit au journal les actualites de chaque annee vecue', () => {
    const vecus = contextesVecus(1960);
    expect(vecus).toContain('act_apollo_11');
    expect(vecus).toContain('loi_euro');
  });

  it('deux vies nees a 30 ans d ecart traversent des contextes visiblement differents', () => {
    const ancienne = contextesVecus(1950);
    const recente = contextesVecus(1980);
    const seulementAncienne = [...ancienne].filter((id) => !recente.has(id));
    const seulementRecente = [...recente].filter((id) => !ancienne.has(id));
    // Avant 1980 : Algérie, Mai 68, Apollo 11, chocs pétroliers... Après : jusqu'en 2026 si la vie dure.
    expect(seulementAncienne.length).toBeGreaterThanOrEqual(8);
    expect(seulementAncienne).toEqual(expect.arrayContaining(['act_apollo_11', 'mvt_mai_68']));
    expect(seulementRecente.length + seulementAncienne.length).toBeGreaterThanOrEqual(8);
  });
});
