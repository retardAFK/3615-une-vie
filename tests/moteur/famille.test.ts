import { describe, expect, it } from 'vitest';
import { creerPartie, fermerAnnee, ouvrirAnnee } from '../../src/moteur/boucle';
import { FINANCES_INITIALES } from '../../src/moteur/constantes';
import { calculerAides } from '../../src/moteur/modules/aides';
import { bilanAnnuel } from '../../src/moteur/modules/argent';
import {
  acheterLogement,
  depensesFamille,
  enfantsACharge,
  evoluerFamille,
  peutAcheter,
} from '../../src/moteur/modules/famille';
import { parametre } from '../../src/moteur/tables';
import type {
  Couple,
  Donnees,
  Emploi,
  EtatPartie,
  Famille,
  Finances,
  Logement,
  ModificateurTemporaire,
  Origine,
} from '../../src/moteur/types';
import { DONNEES, evenement } from './donnees';
import { TABLES } from './tables';

interface Situation {
  annee?: number;
  age?: number;
  emploi?: Emploi;
  couple?: Couple;
  logement?: Logement;
  famille?: Partial<Famille>;
  finances?: Partial<Finances>;
  origine?: Partial<Origine>;
  modificateurs?: ModificateurTemporaire[];
  liens?: number;
}

/** Adulte sorti des études, placé une année donnée dans une situation familiale donnée. */
function adulte(situation: Situation = {}, graine = 'famille'): EtatPartie {
  const {
    annee = 2015,
    age = 30,
    emploi = 'cdi',
    couple = 'celibataire',
    logement = 'locataire_prive',
  } = situation;
  const anneeNaissance = Math.min(2010, Math.max(1950, annee - age));
  const base = creerPartie(graine, DONNEES, { anneeNaissance });
  const { etats } = base.personnage;
  return {
    ...base,
    annee,
    modificateursActifs: situation.modificateurs ?? [],
    personnage: {
      ...base.personnage,
      age,
      jauges: { ...base.personnage.jauges, liens: situation.liens ?? 60 },
      origine: { ...base.personnage.origine, structureFamiliale: 'couple', ...situation.origine },
      etats: {
        ...etats,
        scolarite: 'sortie',
        emploi,
        couple,
        logement,
        travail: { ...etats.travail, pcs: 'employe', salaire: 20_000 },
        famille: { ...etats.famille, ...situation.famille },
      },
      finances: { ...FINANCES_INITIALES, revenuAnnuel: 20_000, ...situation.finances },
    },
  };
}

/** Part des vies où la condition est vraie après une année de famille. */
function taux(
  situation: Situation,
  condition: (etat: EtatPartie) => boolean,
  vies = 2000,
  donnees: Donnees = DONNEES,
): number {
  let n = 0;
  for (let i = 0; i < vies; i++) {
    if (condition(evoluerFamille(adulte(situation, `taux-${i}`), donnees).etat)) n++;
  }
  return n / vies;
}

const reglage = (nom: string): number => parametre(TABLES.parametresFamille, nom);
const pour = (tag: string, m: number): ModificateurTemporaire[] => [
  { cible: { tag }, m, debut: 0, fin: null },
];

describe('famille', () => {
  it('ne change rien pendant l enfance', () => {
    const etat = adulte({ age: 8, logement: 'chez_parents' });
    expect(evoluerFamille(etat, DONNEES)).toEqual({ etat, journal: [] });
  });

  it('est deterministe pour une meme graine', () => {
    const etat = adulte({ couple: 'cohabitation', age: 28 });
    expect(evoluerFamille(etat, DONNEES)).toEqual(evoluerFamille(etat, DONNEES));
  });

  describe('couple', () => {
    const rencontre = (e: EtatPartie): boolean => e.personnage.etats.couple === 'en_couple';

    it('fait rencontrer quelqu un, plus souvent quand le joueur sort', () => {
      const seul = taux({ age: 25 }, rencontre);
      expect(seul).toBeGreaterThan(0);
      expect(taux({ age: 25, modificateurs: pour('rencontre', 3) }, rencontre)).toBeGreaterThan(
        seul,
      );
      expect(taux({ age: 12, logement: 'chez_parents' }, rencontre)).toBe(0);
    });

    it('separe plus souvent un couple endette, moins un couple aux liens forts', () => {
      const separe = (e: EtatPartie): boolean => e.personnage.etats.couple === 'separation';
      const sain = taux({ couple: 'mariage', age: 40 }, separe);
      expect(sain).toBeGreaterThan(0);
      const endette = taux(
        { couple: 'mariage', age: 40, finances: { endettement: 'critique' } },
        separe,
      );
      expect(endette).toBeGreaterThan(sain);
      expect(taux({ couple: 'mariage', age: 40, liens: 95 }, separe)).toBeLessThan(sain);
    });

    it('coute du moral et des liens a la separation', () => {
      const avant = adulte({ couple: 'cohabitation', age: 35 });
      const separes = Array.from({ length: 400 }, (_, i) =>
        evoluerFamille(
          adulte(
            { couple: 'cohabitation', age: 35, modificateurs: pour('separation', 1e4) },
            `s${i}`,
          ),
          DONNEES,
        ),
      ).filter((r) => r.etat.personnage.etats.couple === 'separation');
      expect(separes.length).toBeGreaterThan(300);
      const { jauges, finances } = separes[0]!.etat.personnage;
      expect(jauges.santeMentale).toBeLessThan(avant.personnage.jauges.santeMentale);
      expect(jauges.liens).toBeLessThan(avant.personnage.jauges.liens);
      expect(finances.epargne + -finances.dettes).toBeLessThan(0);
      expect(separes[0]!.journal.map((e) => e.type)).toContain('famille');
    });

    it('rend veuf plus souvent a 80 ans qu a 40 ans', () => {
      const veuf = (e: EtatPartie): boolean => e.personnage.etats.couple === 'veuvage';
      expect(taux({ couple: 'mariage', age: 80, emploi: 'retraite' }, veuf)).toBeGreaterThan(
        taux({ couple: 'mariage', age: 40 }, veuf),
      );
    });

    it('ne propose le PACS qu apres la loi de 1999', () => {
      const pacs = (e: EtatPartie): boolean => e.personnage.etats.couple === 'pacs';
      expect(taux({ couple: 'cohabitation', annee: 1990, age: 30 }, pacs)).toBe(0);
      expect(taux({ couple: 'cohabitation', annee: 2010, age: 30 }, pacs)).toBeGreaterThan(0);
    });
  });

  describe('enfants', () => {
    const naissance = (e: EtatPartie): boolean => e.personnage.etats.famille.enfants.length > 0;
    const femme = { origine: { sexe: 'femme' as const } };

    it('fait naitre des enfants en couple, plus avec un projet d enfant', () => {
      const base = taux({ ...femme, couple: 'mariage', age: 28 }, naissance);
      expect(base).toBeGreaterThan(0);
      expect(
        taux(
          { ...femme, couple: 'mariage', age: 28, modificateurs: pour('naissance_enfant', 4) },
          naissance,
        ),
      ).toBeGreaterThan(base);
      expect(taux({ ...femme, age: 28 }, naissance)).toBe(0);
      expect(taux({ ...femme, couple: 'mariage', age: 55 }, naissance)).toBe(0);
    });

    it('ralentit davantage la carriere des meres que celle des peres', () => {
      const effet = (sexe: 'femme' | 'homme'): { partiel: number; progression: number } => {
        let partiel = 0;
        let progression = 0;
        let naissances = 0;
        for (let i = 0; i < 3000; i++) {
          const situation: Situation = {
            origine: { sexe },
            couple: 'mariage',
            age: 30,
            modificateurs: pour('naissance_enfant', 50),
          };
          const { travail, famille } = evoluerFamille(adulte(situation, `c${i}`), DONNEES).etat
            .personnage.etats;
          if (famille.enfants.length === 0) continue;
          naissances++;
          if (travail.quotite < 1) partiel++;
          progression += travail.progression;
        }
        return { partiel: partiel / naissances, progression: progression / naissances };
      };
      const mere = effet('femme');
      const pere = effet('homme');
      expect(mere.partiel).toBeGreaterThan(pere.partiel);
      expect(mere.progression).toBeLessThan(pere.progression);
    });

    it('compte les enfants a charge jusqu a l age d autonomie', () => {
      const limite = reglage('ageAutonomieEnfant');
      const { personnage } = adulte({ age: 50, famille: { enfants: [25, 50 - limite + 1, 49] } });
      expect(enfantsACharge(personnage, TABLES)).toBe(2);
    });

    it('verse les allocations familiales a partir du deuxieme enfant', () => {
      const sansRecours: Donnees = {
        ...DONNEES,
        tables: {
          ...TABLES,
          nonRecours: { ...TABLES.nonRecours, lignes: [{ conditions: {}, valeur: 0 }] },
        },
      };
      const allocations = (enfants: number[]): number | undefined =>
        calculerAides(adulte({ age: 40, famille: { enfants } }), sansRecours).versees
          .allocationsFamiliales;
      expect(allocations([35])).toBeUndefined();
      const deux = allocations([33, 35])!;
      expect(deux).toBeGreaterThan(0);
      expect(allocations([31, 33, 35])).toBe(2 * deux);
    });
  });

  describe('logement', () => {
    const logement = (e: EtatPartie): Logement => e.personnage.etats.logement;

    it('fait quitter le domicile des parents a la vie commune ou a la fin d un placement', () => {
      const commun = adulte({ age: 24, couple: 'cohabitation', logement: 'chez_parents' });
      expect(logement(evoluerFamille(commun, DONNEES).etat)).not.toBe('chez_parents');
      const ase = adulte({
        age: 18,
        logement: 'chez_parents',
        origine: { structureFamiliale: 'placement_ase' },
      });
      expect(logement(evoluerFamille(ase, DONNEES).etat)).not.toBe('chez_parents');
    });

    it('ne fait partir de chez ses parents que si les revenus suivent', () => {
      const parti = (e: EtatPartie): boolean => logement(e) !== 'chez_parents';
      const avecRevenus = { age: 26, logement: 'chez_parents' as const };
      expect(taux(avecRevenus, parti)).toBeGreaterThan(0);
      const sansRevenus = {
        ...avecRevenus,
        emploi: 'chomage' as const,
        finances: { revenuAnnuel: 0 },
      };
      // Sans revenus, seul un HLM peut l'accueillir : moins de départs.
      expect(taux(sansRevenus, parti)).toBeLessThan(taux(avecRevenus, parti));
    });

    it('fait souffrir la sante et l emploi sans logement stable', () => {
      const precaire = adulte({
        logement: 'precaire',
        emploi: 'chomage',
        finances: { revenuAnnuel: 0 },
      });
      const { etat } = evoluerFamille(precaire, DONNEES);
      expect(etat.personnage.jauges.santePhysique).toBeLessThan(
        precaire.personnage.jauges.santePhysique,
      );
      expect(etat.modificateursActifs).toContainEqual(
        expect.objectContaining({ cible: { tag: 'emploi_chomage' }, debut: 32, fin: 32 }),
      );
    });

    it('fait payer le loyer, partage en vie commune, et le cout des enfants', () => {
      const seul = depensesFamille(adulte().personnage, 2015, TABLES);
      expect(seul).toBeGreaterThan(0);
      expect(depensesFamille(adulte({ couple: 'mariage' }).personnage, 2015, TABLES)).toBe(
        Math.round(seul * reglage('partChargesCouple')),
      );
      expect(
        depensesFamille(adulte({ famille: { enfants: [28] } }).personnage, 2015, TABLES),
      ).toBeGreaterThan(seul);
      expect(depensesFamille(adulte({ logement: 'chez_parents' }).personnage, 2015, TABLES)).toBe(
        0,
      );
      const etudiant = adulte();
      etudiant.personnage.etats.scolarite = 'superieur';
      expect(depensesFamille(etudiant.personnage, 2015, TABLES)).toBe(0);
    });
  });

  describe('achat immobilier et heritage', () => {
    const acheteur: Situation = {
      age: 35,
      couple: 'mariage',
      finances: { revenuAnnuel: 40_000, epargne: 60_000 },
    };

    it('permet d acheter avec un apport et des revenus suffisants', () => {
      expect(peutAcheter(adulte(acheteur).personnage, 2015, TABLES)).toBe(true);
      expect(
        peutAcheter(adulte({ ...acheteur, finances: { epargne: 0 } }).personnage, 2015, TABLES),
      ).toBe(false);
      expect(
        peutAcheter(
          adulte({ ...acheteur, finances: { ...acheteur.finances, dettes: 500 } }).personnage,
          2015,
          TABLES,
        ),
      ).toBe(false);
    });

    it('achete a credit, puis rembourse jusqu a la derniere echeance', () => {
      const avant = adulte(acheteur);
      const apres = acheterLogement(avant, DONNEES);
      const { finances, etats } = apres.personnage;
      expect(etats.logement).toBe('proprietaire');
      expect(finances.epargne).toBeLessThan(avant.personnage.finances.epargne);
      expect(finances.patrimoine).toBeGreaterThan(0);
      expect(finances.creditImmobilier).toBeGreaterThan(0);
      expect(finances.annuiteImmobilier).toBeGreaterThan(0);
      expect(apres.historique.at(-1)?.type).toBe('famille');
      // Immortel et sans changement de couple : seul le crédit évolue.
      let etat = apres;
      for (let annee = 0; annee < reglage('dureeCredit'); annee++) {
        etat = evoluerFamille(etat, DONNEES).etat;
        etat = {
          ...etat,
          personnage: {
            ...etat.personnage,
            etats: { ...etat.personnage.etats, couple: 'mariage' },
          },
        };
      }
      expect(etat.personnage.finances.creditImmobilier).toBe(0);
      expect(etat.personnage.finances.annuiteImmobilier).toBe(0);
      // Un achat impossible ne change rien.
      const sansApport = adulte({ ...acheteur, finances: { epargne: 0 } });
      expect(acheterLogement(sansApport, DONNEES)).toBe(sansApport);
    });

    it('achete par le choix d un evenement de contenu', () => {
      const donnees: Donnees = {
        ...DONNEES,
        evenements: [
          evenement('achat', {
            age: [35, 35],
            requiert: { achatPossible: ['oui'] },
            choix: [
              {
                id: 'acheter',
                libelle: 'ACHETER',
                modificateurs: [],
                effets: { acheterLogement: true },
              },
            ],
          }),
        ],
      };
      const depart = adulte({ ...acheteur, famille: { achatPossible: true } });
      const ouverte = ouvrirAnnee(depart, donnees);
      expect(ouverte.evenements.map((e) => e.id)).toEqual(['achat']);
      const fermee = fermerAnnee(
        ouverte.etat,
        [{ evenementId: 'achat', choixId: 'acheter' }],
        donnees,
      );
      expect(fermee.etat.personnage.etats.logement).toBe('proprietaire');
    });

    it('fait heriter au deces des parents, selon le logement familial', () => {
      const heritage = (origine: Partial<Origine>): number => {
        let total = 0;
        for (let i = 0; i < 400; i++) {
          const situation: Situation = { age: 70, emploi: 'retraite', origine };
          const avant = adulte(situation, `h${i}`);
          const { personnage } = evoluerFamille(avant, DONNEES).etat;
          if (!personnage.etats.famille.parentsVivants) {
            total += personnage.finances.epargne - avant.personnage.finances.epargne;
          }
        }
        return total;
      };
      const proprietaires = heritage({ logementFamilial: 'proprietaire', decileRevenuFoyer: 8 });
      expect(proprietaires).toBeGreaterThan(0);
      expect(heritage({ logementFamilial: 'hlm', decileRevenuFoyer: 2 })).toBeLessThan(
        proprietaires,
      );
      expect(heritage({ structureFamiliale: 'placement_ase' })).toBe(0);
    });
  });

  it('regle la depense de vie sur ce qui reste apres les charges fixes', () => {
    const etat = adulte({ finances: { revenuAnnuel: 25_000 } });
    const sansAide = { versees: {}, nonDemandees: [], total: 0 };
    const commeCharges = bilanAnnuel(etat, sansAide, DONNEES, 0, 6000).personnage.finances;
    const commeDepenses = bilanAnnuel(etat, sansAide, DONNEES, 6000).personnage.finances;
    // Le train de vie s'ajuste au loyer : il reste plus qu'avec une dépense imprévue.
    expect(commeCharges.epargne - commeCharges.dettes).toBeGreaterThan(
      commeDepenses.epargne - commeDepenses.dettes,
    );
  });
});
