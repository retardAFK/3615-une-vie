import { describe, expect, it } from 'vitest';
import { creerPartie } from '../../src/moteur/boucle';
import { FINANCES_INITIALES } from '../../src/moteur/constantes';
import { bilanAnnuel } from '../../src/moteur/modules/argent';
import {
  appliquerChoixJeu,
  jouerAnnee,
  miseDeLAnnee,
  regleDuJeu,
  tauxDeRetour,
  tirerGains,
} from '../../src/moteur/modules/jeux';
import { binomiale, creerGenerateur } from '../../src/moteur/rng';
import { parametre, valeurDe } from '../../src/moteur/tables';
import {
  JEUX,
  type BudgetJeu,
  type EtatAddiction,
  type EtatJeu,
  type EtatPartie,
} from '../../src/moteur/types';
import { validerEvenements } from '../../src/moteur/validation';
import { DONNEES, evenement } from './donnees';
import { TABLES } from './tables';

/** Joueur de 30 ans, autonome, avec un profil et un jeu donnés. */
function joueur(
  profil: EtatAddiction,
  jeu: Partial<EtatJeu> = {},
  graine = 'joueur',
  revenu = 20_000,
): EtatPartie {
  const base = creerPartie(graine, DONNEES, { anneeNaissance: 1980 });
  const { etats } = base.personnage;
  return {
    ...base,
    annee: 2010,
    personnage: {
      ...base.personnage,
      age: 30,
      finances: { ...FINANCES_INITIALES, revenuAnnuel: revenu },
      etats: {
        ...etats,
        scolarite: 'sortie',
        emploi: 'cdi',
        addictions: { ...etats.addictions, jeux_argent: profil },
        jeu: { ...etats.jeu, jeu: 'loto', budget: 'petit', ...jeu },
      },
    },
  };
}

const budget = (b: BudgetJeu): number => valeurDe(TABLES.budgetsJeu, { budget: b }, ['budget']);
const reglage = (nom: string): number => parametre(TABLES.parametresAddictions, nom);

describe('jeux : regles mathematiques', () => {
  it('aucun jeu ne rend plus que la mise en moyenne ; paris en ligne au plus 85 %', () => {
    for (const jeu of JEUX) {
      expect(tauxDeRetour(regleDuJeu(TABLES, jeu)), jeu).toBeLessThan(1);
    }
    expect(tauxDeRetour(regleDuJeu(TABLES, 'paris_sportifs'))).toBeLessThanOrEqual(0.85);
  });

  it('les gains simules convergent vers le taux de retour', () => {
    for (const jeu of ['grattage', 'paris_sportifs', 'casino'] as const) {
      const ligne = regleDuJeu(TABLES, jeu);
      const g = creerGenerateur(`convergence-${jeu}`);
      let gains = 0;
      const mise = 600;
      for (let annee = 0; annee < 2000; annee++) gains += tirerGains(g, ligne, mise);
      expect(gains / (mise * 2000), jeu).toBeCloseTo(tauxDeRetour(ligne), 1);
    }
  });

  it('la loi binomiale garde sa moyenne dans ses trois regimes', () => {
    const g = creerGenerateur('binomiale');
    for (const [n, p] of [
      [50, 0.3],
      [5000, 0.001],
      [5000, 0.3],
    ] as const) {
      let somme = 0;
      for (let i = 0; i < 3000; i++) somme += binomiale(g, n, p);
      expect(somme / 3000 / (n * p), `${n} ${p}`).toBeCloseTo(1, 1);
    }
    expect(binomiale(g, 0, 0.5)).toBe(0);
    expect(binomiale(g, 10, 1)).toBe(10);
  });
});

describe('jeux : mises et profil', () => {
  it('on ne mise que si on joue, selon le profil, double pour se refaire', () => {
    expect(miseDeLAnnee(joueur('expose').personnage, TABLES)).toBe(0);
    expect(miseDeLAnnee(joueur('sevrage').personnage, TABLES)).toBe(0);
    expect(miseDeLAnnee(joueur('usage_occasionnel', { jeu: null }).personnage, TABLES)).toBe(0);
    const occasionnel = miseDeLAnnee(joueur('usage_occasionnel').personnage, TABLES);
    expect(occasionnel).toBe(budget('petit'));
    expect(miseDeLAnnee(joueur('dependance').personnage, TABLES)).toBe(
      Math.round(budget('petit') * reglage('mMiseDependance')),
    );
    expect(miseDeLAnnee(joueur('usage_occasionnel', { chasse: true }).personnage, TABLES)).toBe(
      Math.round(budget('petit') * reglage('mMiseChasse')),
    );
  });

  it("l'interdiction volontaire bloque les jeux en ligne et le casino, pas le loto", () => {
    const interdit = { interdiction: true };
    expect(
      miseDeLAnnee(
        joueur('usage_regulier', { ...interdit, jeu: 'paris_sportifs' }).personnage,
        TABLES,
      ),
    ).toBe(0);
    expect(
      miseDeLAnnee(joueur('usage_regulier', { ...interdit, jeu: 'casino' }).personnage, TABLES),
    ).toBe(0);
    expect(miseDeLAnnee(joueur('usage_regulier', interdit).personnage, TABLES)).toBeGreaterThan(0);
  });

  it('les totaux de la vie s accumulent ; les grosses pertes ouvrent la chasse', () => {
    const avant = joueur('dependance', { budget: 'gros', chasse: true }, 'totaux', 5_000);
    const { etat, mise, gain, journal } = jouerAnnee(avant, DONNEES);
    const { jeu } = etat.personnage.etats;
    expect(jeu.totalMise).toBe(mise);
    expect(jeu.totalRecupere).toBe(gain);
    expect(jeu.chasse).toBe(false);
    expect(jeu.pertesElevees).toBe(mise - gain > reglage('seuilChasse') * 5_000);
    expect(journal[0]).toMatchObject({ type: 'jeu', totalMise: mise, totalRecupere: gain });
  });

  it('les mises nettes des gains entrent dans le bilan', () => {
    const etat = joueur('usage_regulier');
    const sansAide = { versees: {}, nonDemandees: [], total: 0 };
    const sans = bilanAnnuel(etat, sansAide, DONNEES).personnage.finances.epargne;
    const avec = bilanAnnuel(etat, sansAide, DONNEES, 300).personnage.finances.epargne;
    expect(sans - avec).toBe(300);
  });

  it('les choix fixent le jeu, le budget, la chasse et l interdiction', () => {
    const etat = appliquerChoixJeu(joueur('expose', { jeu: null, budget: 'aucun' }), {
      jeu: 'grattage',
      budget: 'moyen',
      interdiction: true,
    });
    expect(etat.personnage.etats.jeu).toMatchObject({
      jeu: 'grattage',
      budget: 'moyen',
      interdiction: true,
    });
    const avecChoix = (effets: unknown): string[] =>
      validerEvenements([
        {
          nom: 'essai.json',
          contenu: {
            module: 'essai',
            source: 'test',
            aCalibrer: true,
            evenements: [
              evenement('jeu', {
                choix: [{ id: 'a', libelle: 'A', effets } as never, { id: 'b', libelle: 'B' }],
              }),
            ],
          },
        },
      ]).erreurs;
    expect(avecChoix({ jeu: 'loto', budget: 'petit' })).toEqual([]);
    expect(avecChoix({ jeu: 'roulette_russe' }).join()).toContain('effet de choix jeu invalide');
    expect(avecChoix({ budget: 'enorme' }).join()).toContain('effet de choix budget invalide');
  });
});
