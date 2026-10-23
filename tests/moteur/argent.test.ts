import { describe, expect, it } from 'vitest';
import { creerPartie, fermerAnnee, ouvrirAnnee } from '../../src/moteur/boucle';
import { FINANCES_INITIALES } from '../../src/moteur/constantes';
import { estEligible, evenementParId } from '../../src/moteur/evenements';
import { calculerAides, renonce } from '../../src/moteur/modules/aides';
import { bilanAnnuel, nomAide } from '../../src/moteur/modules/argent';
import { parametre, periodeDe } from '../../src/moteur/tables';
import type {
  Aide,
  Donnees,
  Emploi,
  EtatPartie,
  Finances,
  Logement,
  Origine,
  Tables,
} from '../../src/moteur/types';
import { DONNEES, donneesAvec, evenement } from './donnees';
import { TABLES } from './tables';

interface Situation {
  annee?: number;
  age?: number;
  emploi?: Emploi;
  revenu?: number;
  logement?: Logement;
  finances?: Partial<Finances>;
  origine?: Partial<Origine>;
}

/** Adulte sorti des études, placé une année donnée dans une situation donnée. */
function adulte(situation: Situation = {}, graine = 'argent', donnees: Donnees = DONNEES) {
  const {
    annee = 2015,
    age = 40,
    emploi = 'chomage',
    revenu = 0,
    logement = 'chez_parents',
  } = situation;
  // L'année de naissance reste dans les bornes du tirage ; seuls l'âge et l'année comptent ici.
  const anneeNaissance = Math.min(2010, Math.max(1950, annee - age));
  const base = creerPartie(graine, donnees, { anneeNaissance });
  return {
    ...base,
    annee,
    personnage: {
      ...base.personnage,
      age,
      origine: { ...base.personnage.origine, structureFamiliale: 'couple', ...situation.origine },
      etats: { ...base.personnage.etats, scolarite: 'sortie', emploi, logement },
      finances: { ...FINANCES_INITIALES, revenuAnnuel: revenu, ...situation.finances },
    },
  } as EtatPartie;
}

/** Tables de travail, avec des paramètres d'argent remplacés (tests indépendants du calibrage). */
function tablesAvec(valeurs: Record<string, number>, depense?: number): Tables {
  const parametres = TABLES.parametresArgent;
  return {
    ...TABLES,
    parametresArgent: {
      ...parametres,
      lignes: [{ conditions: {}, valeurs: { ...parametres.lignes[0]!.valeurs, ...valeurs } }],
    },
    depensesVie:
      depense === undefined
        ? TABLES.depensesVie
        : { ...TABLES.depensesVie, lignes: [{ conditions: {}, valeur: depense }] },
    // Personne ne renonce : les montants se vérifient sans hasard.
    nonRecours: { ...TABLES.nonRecours, lignes: [{ conditions: {}, valeur: 0 }] },
  };
}

const SANS_RECOURS: Donnees = { ...DONNEES, tables: tablesAvec({}) };
const bareme = (aide: Aide, annee: number, nom: 'montant' | 'plafond'): number =>
  parametre(TABLES.baremesAides, nom, { aide, periode: periodeDe(annee) }, ['periode', 'aide']);

/** Bilan sans aide, avec des tables données : seules les dettes jouent. */
const bilan = (etat: EtatPartie, tables: Tables) =>
  bilanAnnuel(etat, { versees: {}, nonDemandees: [], total: 0 }, { ...DONNEES, tables });

describe('aides sociales', () => {
  it("n'existent qu'une fois creees par une loi, sous le nom de l'epoque", () => {
    const sansRevenu = (annee: number) =>
      calculerAides(adulte({ annee }), SANS_RECOURS).versees.minimumSocial;
    expect(sansRevenu(1980)).toBeUndefined();
    expect(sansRevenu(1995)).toBe(bareme('minimumSocial', 1995, 'montant'));
    expect(nomAide(DONNEES.contexte, 1995, 'minimumSocial')).toBe('LE RMI');
    expect(nomAide(DONNEES.contexte, 2015, 'minimumSocial')).toBe('LE RSA');
    expect(nomAide(DONNEES.contexte, 1960, 'minimumVieillesse')).toBe('LE MINIMUM VIEILLESSE');
    expect(nomAide(DONNEES.contexte, 2010, 'minimumVieillesse')).toBe("L'ASPA");
    expect(nomAide(DONNEES.contexte, 2005, 'complementActivite')).toBe("LA PRIME POUR L'EMPLOI");
    expect(nomAide(DONNEES.contexte, 2012, 'complementActivite')).toBe('LE RSA ACTIVITE');
    expect(nomAide(DONNEES.contexte, 2020, 'complementActivite')).toBe("LA PRIME D'ACTIVITE");
  });

  it('le minimum social complete les ressources, a partir de son age minimum', () => {
    const aides = calculerAides(adulte({ revenu: 2000 }), SANS_RECOURS);
    expect(aides.versees.minimumSocial).toBe(bareme('minimumSocial', 2015, 'montant') - 2000);
    const ageMinimum = parametre(TABLES.parametresArgent, 'ageMinimumSocial');
    expect(calculerAides(adulte({ age: ageMinimum - 1 }), SANS_RECOURS).versees).toEqual({});
  });

  it('AAH, minimum vieillesse, complement d activite et aide au logement selon la situation', () => {
    const handicap = adulte({ annee: 1980, age: 30, origine: { santeNaissance: 'handicap' } });
    expect(calculerAides(handicap, SANS_RECOURS).versees.aah).toBe(bareme('aah', 1980, 'montant'));
    expect(calculerAides({ ...handicap, annee: 1970 }, SANS_RECOURS).versees.aah).toBeUndefined();

    const retraite = adulte({ age: 70, emploi: 'retraite', revenu: 3000 });
    expect(calculerAides(retraite, SANS_RECOURS).versees.minimumVieillesse).toBe(
      bareme('minimumVieillesse', 2015, 'montant') - 3000,
    );

    const plafond = bareme('complementActivite', 2020, 'plafond');
    const salarie = adulte({ annee: 2020, emploi: 'cdi', revenu: Math.round(plafond / 2) });
    expect(calculerAides(salarie, SANS_RECOURS).versees.complementActivite).toBe(
      Math.round(bareme('complementActivite', 2020, 'montant') / 2),
    );
    const aise = adulte({ annee: 2020, emploi: 'cdi', revenu: plafond });
    expect(calculerAides(aise, SANS_RECOURS).versees).toEqual({});

    const locataire = adulte({ annee: 2020, emploi: 'cdi', revenu: 8_000, logement: 'hlm' });
    expect(calculerAides(locataire, SANS_RECOURS).versees.aideLogement).toBeGreaterThan(0);
  });

  it('le non-recours est plus frequent chez les jeunes et a la campagne ; un choix le reduit', () => {
    const taux = (situation: Situation, reduit = false): number => {
      let renonces = 0;
      for (let i = 0; i < 2000; i++) {
        const etat = adulte(situation, `recours-${i}`);
        const avecChoix: EtatPartie = reduit
          ? {
              ...etat,
              modificateursActifs: [{ cible: { tag: 'non_recours' }, m: 0.3, debut: 0, fin: null }],
            }
          : etat;
        if (renonce('minimumSocial', avecChoix, DONNEES)) renonces++;
      }
      return renonces / 2000;
    };
    const ville = taux({ age: 45, origine: { territoire: 'grande_metropole' } });
    const jeuneRural = taux({ age: 26, origine: { territoire: 'rural' } });
    expect(jeuneRural).toBeGreaterThan(ville + 0.1);
    expect(taux({ age: 45, origine: { territoire: 'grande_metropole' } }, true)).toBeLessThan(
      ville - 0.1,
    );
  });

  it('une aide nouvelle ou non demandee entre au journal', () => {
    const { journal } = bilanAnnuel(adulte(), calculerAides(adulte(), SANS_RECOURS), SANS_RECOURS);
    expect(journal.map((e) => e.texte)).toContain('TU TOUCHES LE RSA.');
    const toutRefuse: Donnees = {
      ...DONNEES,
      tables: {
        ...TABLES,
        nonRecours: { ...TABLES.nonRecours, lignes: [{ conditions: {}, valeur: 1 }] },
      },
    };
    const refus = bilanAnnuel(adulte(), calculerAides(adulte(), toutRefuse), toutRefuse);
    expect(refus.journal.map((e) => e.texte)).toContain('DROIT NON DEMANDE : LE RSA.');
    expect(refus.personnage.finances.nonDemandees).toEqual(['minimumSocial']);
  });
});

describe('dettes', () => {
  // Sans dépense de vie ni intérêts : les remboursements se lisent directement.
  const simples = tablesAvec(
    { partRevenuDepensee: 0, tauxInteret: 0, partRemboursee: 0.25, remboursementMinimum: 0 },
    0,
  );
  const endette = (
    dettes: number,
    revenu: number,
    finances: Partial<Finances> = {},
    annee = 2015,
  ) => adulte({ annee, emploi: 'cdi', revenu, finances: { dettes, ...finances } });

  it('les interets courent, puis le remboursement de l annee est preleve', () => {
    const tables = tablesAvec({ tauxInteret: 0.1, partRemboursee: 0.25, remboursementMinimum: 0 });
    const { finances } = bilan(endette(10_000, 40_000), tables).personnage;
    expect(finances.remboursements).toBe(Math.round(11_000 * 0.25));
    expect(finances.dettes).toBe(11_000 - Math.round(11_000 * 0.25));
    expect(finances.epargne).toBeGreaterThan(0);
  });

  it('niveaux : sain, tendu, critique selon la part des ressources remboursee', () => {
    expect(bilan(endette(4_000, 10_000), simples).personnage.finances.endettement).toBe('sain');
    const tendu = bilan(endette(16_000, 10_000), simples).personnage;
    expect(tendu.finances.endettement).toBe('tendu');
    expect(tendu.jauges.santeMentale).toBe(
      70 - parametre(simples.parametresArgent, 'perteSanteTendu'),
    );
    expect(bilan(endette(24_000, 10_000), simples).personnage.finances.endettement).toBe(
      'critique',
    );
  });

  it('sans credit possible, le personnage se prive et tombe au niveau critique', () => {
    const tables = tablesAvec({ plafondCreditMinimum: 3_000, plafondCreditRevenus: 0 }, 0.5);
    const { personnage, journal } = bilan(
      adulte({ annee: 1980, finances: { dettes: 3_000 } }),
      tables,
    );
    expect(personnage.finances.endettement).toBe('critique');
    expect(personnage.finances.dettes).toBeLessThanOrEqual(3_000 * 1.2);
    expect(personnage.jauges.santePhysique).toBe(
      70 - parametre(tables.parametresArgent, 'perteSantePrivation'),
    );
    expect(journal.map((e) => e.texte)).toContain('TU NE PEUX PLUS FAIRE FACE A TES DETTES.');
  });

  it('la famille couvre le deficit des jeunes, sauf apres un placement', () => {
    const jeune = (structureFamiliale: Origine['structureFamiliale']) =>
      bilan(adulte({ age: 21, origine: { structureFamiliale } }), TABLES).personnage.finances;
    expect(jeune('couple').dettes).toBe(0);
    expect(jeune('placement_ase').dettes).toBeGreaterThan(0);
  });

  it('jamais d epargne ni de dettes negatives', () => {
    for (let i = 0; i < 300; i++) {
      const { finances } = bilan(
        endette(i * 97, (i * 131) % 25_000, { epargne: (i * 53) % 4_000 }),
        TABLES,
      ).personnage;
      expect(finances.dettes).toBeGreaterThanOrEqual(0);
      expect(finances.epargne).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('surendettement', () => {
  const tables = tablesAvec(
    { partRevenuDepensee: 0, tauxInteret: 0.1, partCapacitePlan: 0.5, remboursementMinimum: 0 },
    0,
  );

  it("pendant le plan : pas d'interets, remboursement selon la capacite", () => {
    const etat = adulte({
      emploi: 'cdi',
      revenu: 10_000,
      finances: { dettes: 10_000, planApurement: 2, endettement: 'surendettement' },
    });
    const { finances } = bilan(etat, tables).personnage;
    expect(finances.dettes).toBe(5_000);
    expect(finances.planApurement).toBe(1);
    expect(finances.endettement).toBe('surendettement');
  });

  it("en fin de plan, les dettes restantes ne sont effacees qu'apres la loi de 2003", () => {
    const fin = (annee: number) =>
      bilan(
        adulte({
          annee,
          emploi: 'cdi',
          revenu: 2_000,
          finances: { dettes: 10_000, planApurement: 1, endettement: 'surendettement' },
        }),
        tables,
      );
    const avant = fin(1995);
    expect(avant.personnage.finances.dettes).toBe(9_000);
    expect(avant.personnage.finances.planApurement).toBe(0);
    const apres = fin(2010);
    expect(apres.personnage.finances.dettes).toBe(0);
    expect(apres.journal.map((e) => e.texte)).toContain('TES DETTES RESTANTES SONT EFFACEES.');
  });

  it("dossier d'office apres plusieurs annees critiques, seulement apres la loi Neiertz", () => {
    const annees = parametre(TABLES.parametresArgent, 'anneesAvantDossier');
    const critique = (annee: number) =>
      bilan(
        adulte({
          annee,
          finances: { dettes: 50_000, endettement: 'critique', anneesCritique: annees - 1 },
        }),
        TABLES,
      ).personnage.finances;
    expect(critique(1985)).toMatchObject({ endettement: 'critique', planApurement: 0 });
    expect(critique(1995)).toMatchObject({
      endettement: 'surendettement',
      planApurement: parametre(TABLES.parametresArgent, 'dureePlan'),
    });
  });

  it('les relances ne proposent le dossier que si la loi le permet', () => {
    const relances = evenementParId(DONNEES.evenements, 'arg_relances');
    const enCrise = (annee: number) =>
      adulte({ annee, finances: { dettes: 50_000, endettement: 'critique' } });
    expect(estEligible(relances, enCrise(1985), DONNEES)).toBe(false);
    expect(estEligible(relances, enCrise(1995), DONNEES)).toBe(true);
  });

  it("un dossier recevable ouvre le plan d'apurement", () => {
    const donnees = donneesAvec([evenement('recevable', { effets: { surendettement: true } })]);
    const etat = adulte({ finances: { dettes: 50_000 } }, 'recevable', donnees);
    const ouverture = ouvrirAnnee(etat, donnees);
    expect(ouverture.evenements.map((e) => e.id)).toEqual(['recevable']);
    const { finances } = fermerAnnee(ouverture.etat, [], donnees).etat.personnage;
    expect(finances.planApurement).toBe(parametre(TABLES.parametresArgent, 'dureePlan'));
    expect(finances.endettement).toBe('surendettement');
  });
});
