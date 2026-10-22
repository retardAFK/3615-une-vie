import { describe, expect, it } from 'vitest';
import { creerPartie, fermerAnnee, jouerAnneeAuto, ouvrirAnnee } from '../../src/moteur/boucle';
import { distributionCorrigee } from '../../src/moteur/cotes';
import { probabiliteEvenement } from '../../src/moteur/evenements';
import { appliquerMontant } from '../../src/moteur/modules/argent';
import { evoluerEducation } from '../../src/moteur/modules/education';
import { ageRetraite, estSalarie } from '../../src/moteur/modules/emploi';
import { creerGenerateur } from '../../src/moteur/rng';
import type { DiplomeJoueur, Donnees, EtatPartie, Finances } from '../../src/moteur/types';
import { DONNEES, TABLES_IMMORTELS, donneesAvec, evenement } from './donnees';

const finances = (epargne: number, dettes: number): Finances => ({
  revenuAnnuel: 0,
  epargne,
  dettes,
  patrimoine: 0,
});

/** Joue en AUTO jusqu'à l'âge voulu (ou la mort). */
function jusqua(
  age: number,
  graine: string,
  donnees: Donnees,
  anneeNaissance?: number,
): EtatPartie {
  let etat = creerPartie(graine, donnees, anneeNaissance ? { anneeNaissance } : {});
  while (etat.personnage.vivant && etat.personnage.age < age) {
    etat = jouerAnneeAuto(etat, donnees).etat;
  }
  return etat;
}

describe('distributionCorrigee', () => {
  it('rend la distribution telle quelle sans multiplicateur', () => {
    const d = { a: 0.2, b: 0.8 };
    expect(distributionCorrigee(d, () => [])).toEqual(d);
  });

  it('applique les cotes par issue puis renormalise, sans rendre possible une issue nulle', () => {
    const d = distributionCorrigee({ a: 0.5, b: 0.5, c: 0 }, (i) => (i === 'a' ? [3] : [1]));
    expect(d.c).toBe(0);
    expect(d.a + d.b).toBeCloseTo(1, 10);
    // a : cotes 1 × 3 = 3, soit 0,75 ; b : 0,5 ; renormalisé : 0,75 / 1,25 = 0,6.
    expect(d.a).toBeCloseTo(0.6, 10);
  });
});

describe('argent', () => {
  it('rembourse les dettes avant d epargner, puise dans l epargne avant de s endetter', () => {
    expect(appliquerMontant(finances(0, 300), 1000)).toMatchObject({ epargne: 700, dettes: 0 });
    expect(appliquerMontant(finances(500, 0), -800)).toMatchObject({ epargne: 0, dettes: 300 });
    expect(appliquerMontant(finances(500, 0), -200)).toMatchObject({ epargne: 300, dettes: 0 });
  });

  it('ne rend jamais l epargne ni les dettes negatives', () => {
    const g = creerGenerateur('argent');
    let f = finances(0, 0);
    for (let i = 0; i < 5000; i++) {
      f = appliquerMontant(f, Math.round((g() - 0.5) * 40_000));
      expect(f.epargne).toBeGreaterThanOrEqual(0);
      expect(f.dettes).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('retraite', () => {
  it("part a l'age legal de chaque generation, d'apres la table", () => {
    const sansEvenement = donneesAvec([], TABLES_IMMORTELS);
    for (let generation = 1950; generation <= 2010; generation++) {
      const etat = jusqua(70, `retraite-${generation}`, sansEvenement, generation);
      const attendu = ageRetraite(DONNEES.tables, generation);
      expect(etat.personnage.etats.travail.ageRetraite, `generation ${generation}`).toBe(attendu);
      expect(etat.personnage.etats.emploi).toBe('retraite');
    }
    expect(ageRetraite(DONNEES.tables, 1950)).toBe(60);
    expect(ageRetraite(DONNEES.tables, 1965)).toBe(62);
    expect(ageRetraite(DONNEES.tables, 1975)).toBe(64);
  });
});

describe('education', () => {
  it("ne quitte pas l'ecole avant 16 ans pour les generations nees a partir de 1953", () => {
    const sansEvenement = donneesAvec([], TABLES_IMMORTELS);
    for (let i = 0; i < 300; i++) {
      let etat = creerPartie(`obligation-${i}`, sansEvenement, { anneeNaissance: 1960 + (i % 40) });
      while (etat.personnage.etats.scolarite !== 'sortie') {
        etat = jouerAnneeAuto(etat, sansEvenement).etat;
      }
      expect(etat.personnage.age).toBeGreaterThanOrEqual(16);
    }
  });

  it('suit les voeux : un modificateur sur voie_generale augmente la part de la voie generale', () => {
    const sansEvenement = donneesAvec([], TABLES_IMMORTELS);
    const part = (avecVoeu: boolean): number => {
      let generale = 0;
      for (let i = 0; i < 400; i++) {
        let etat = creerPartie(`voeu-${i}`, sansEvenement, { anneeNaissance: 1990 });
        while (etat.personnage.etats.scolarite !== 'college' || etat.personnage.age < 14) {
          etat = jouerAnneeAuto(etat, sansEvenement).etat;
        }
        const { retard } = etat.personnage.etats.education;
        // Jusqu'à la fin de 3e, avec le vœu actif à partir de 15 ans.
        if (avecVoeu) {
          etat = {
            ...etat,
            modificateursActifs: [{ cible: { tag: 'voie_generale' }, m: 4, debut: 15, fin: 20 }],
          };
        }
        while (etat.personnage.age < 14 + retard) etat = jouerAnneeAuto(etat, sansEvenement).etat;
        const apres = evoluerEducation(etat, sansEvenement);
        if (apres.etats.education.voie === 'generale') generale++;
      }
      return generale / 400;
    };
    expect(part(true)).toBeGreaterThan(part(false) + 0.1);
  });
});

describe('emploi', () => {
  it('accepte une offre : nouvel emploi en CDI avec une hausse', () => {
    const offre = evenement('offre_test', {
      age: [30, 30],
      requiert: { emploi: ['cdi', 'cdd', 'interim'] },
      choix: [
        { id: 'changer', libelle: 'CHANGER', effets: { changerEmploi: true } },
        { id: 'rester', libelle: 'RESTER' },
      ],
    });
    const donnees = donneesAvec([offre], TABLES_IMMORTELS);
    for (let i = 0; i < 50; i++) {
      const avant = jusqua(30, `offre-${i}`, donnees, 1980);
      if (!['cdi', 'cdd', 'interim'].includes(avant.personnage.etats.emploi)) continue;
      const ouverte = ouvrirAnnee(avant, donnees).etat;
      const choix = [{ evenementId: 'offre_test', choixId: 'changer' }];
      const apres = fermerAnnee(ouverte, choix, donnees).etat;
      expect(['cdi', 'chomage', 'inactif', 'cdd', 'interim', 'independant']).toContain(
        apres.personnage.etats.emploi,
      );
      expect(apres.personnage.etats.travail.progression).toBeCloseTo(
        avant.personnage.etats.travail.progression * 1.08,
        5,
      );
      return;
    }
    throw new Error('aucune vie salariee a 30 ans');
  });

  it("n'ouvre les evenements d'emploi qu'aux personnes dans l'etat requis", () => {
    const licenciement = DONNEES.evenements.find((e) => e.id === 'emp_licenciement')!;
    const enfant = creerPartie('enfant', DONNEES);
    const donnees = donneesAvec([{ ...licenciement, age: [0, 110], pBase: 1 }]);
    expect(ouvrirAnnee(enfant, donnees).evenements).toEqual([]);
  });

  it('applique le contexte historique aux evenements du tag vise', () => {
    const ev = evenement('choc', { pBase: 0.1, tags: ['licenciement'] });
    const etat = creerPartie('contexte', DONNEES);
    const tables = {
      ...DONNEES.tables,
      contexte: {
        ...DONNEES.tables.contexte,
        lignes: [
          { conditions: { annee: String(etat.annee) }, multiplicateurs: { licenciement: 3 } },
        ],
      },
    };
    expect(probabiliteEvenement(ev, etat, tables)).toBeGreaterThan(
      probabiliteEvenement(ev, etat, DONNEES.tables) * 2,
    );
  });
});

describe('10 000 vies en AUTO', () => {
  const NIVEAUX: Record<DiplomeJoueur, string> = {
    aucun: 'aucun',
    cap_bep: 'cap_bep',
    bac_pro: 'bac',
    bac_techno: 'bac',
    bac_general: 'bac',
    bac_2_3: 'bac_2_3',
    bac_5: 'bac_5',
  };
  const mediane = (v: number[]): number => {
    const t = [...v].sort((a, b) => a - b);
    return t[Math.floor(t.length / 2)] ?? 0;
  };

  it("reproduit les ecarts d'origine, de diplome et de sexe, sans finances negatives", () => {
    const bacGeneral: Record<string, { oui: number; total: number }> = {};
    const salaires40: Record<string, number[]> = {};
    const revenus = { femme: [] as number[], homme: [] as number[] };
    let financesNegatives = 0;

    for (let i = 0; i < 10_000; i++) {
      let etat = creerPartie(`stats-${i}`, DONNEES);
      const { pcsParents, sexe } = etat.personnage.origine;
      let aEuBacGeneral = false;
      while (etat.personnage.vivant) {
        const age = etat.personnage.age;
        etat = jouerAnneeAuto(etat, DONNEES).etat;
        const p = etat.personnage;
        if (p.finances.epargne < 0 || p.finances.dettes < 0) financesNegatives++;
        if (p.etats.education.diplome === 'bac_general') aEuBacGeneral = true;
        if (age >= 25 && age <= 60) revenus[sexe].push(p.finances.revenuAnnuel);
        if (age === 40 && estSalarie(p.etats.emploi) && p.etats.travail.salaire > 0) {
          (salaires40[NIVEAUX[p.etats.education.diplome]] ??= []).push(p.etats.travail.salaire);
        }
      }
      const cpt = (bacGeneral[pcsParents] ??= { oui: 0, total: 0 });
      cpt.total++;
      // Bachelier général : bac général obtenu, même s'il a été suivi d'un diplôme du supérieur.
      if (aEuBacGeneral) cpt.oui++;
    }

    const part = (pcs: string): number => bacGeneral[pcs]!.oui / bacGeneral[pcs]!.total;
    const medianes = ['aucun', 'cap_bep', 'bac', 'bac_2_3', 'bac_5'].map((n) =>
      mediane(salaires40[n] ?? []),
    );
    const moyenne = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
    console.log(
      `Bac general : enfants de cadres ${(100 * part('cadre')).toFixed(1)} %, ` +
        `d'ouvriers ${(100 * part('ouvrier')).toFixed(1)} %\n` +
        `Salaire median a 40 ans (aucun, CAP, bac, bac+2/3, bac+5) : ${medianes.join(' / ')} EUR\n` +
        `Revenu moyen de 25 a 60 ans : femmes ${Math.round(moyenne(revenus.femme))} EUR, ` +
        `hommes ${Math.round(moyenne(revenus.homme))} EUR`,
    );

    expect(part('cadre')).toBeGreaterThan(part('ouvrier'));
    for (let i = 1; i < medianes.length; i++) expect(medianes[i]).toBeGreaterThan(medianes[i - 1]!);
    expect(moyenne(revenus.femme)).toBeLessThan(moyenne(revenus.homme));
    expect(financesNegatives).toBe(0);
  }, 60_000);
});
