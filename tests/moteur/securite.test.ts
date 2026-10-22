import { describe, expect, it } from 'vitest';
import { creerPartie, fermerAnnee, jouerAnneeAuto, ouvrirAnnee } from '../../src/moteur/boucle';
import { evoluerEmploi, estSalarie } from '../../src/moteur/modules/emploi';
import type { EtatPartie } from '../../src/moteur/types';
import { validerEvenements } from '../../src/moteur/validation';
import { TABLES_IMMORTELS, donneesAvec, evenement } from './donnees';

const erreurs = (evenements: unknown[]): string[] =>
  validerEvenements([
    {
      nom: 'essai.json',
      contenu: { module: 'essai', source: 'test', aCalibrer: true, evenements },
    },
  ]).erreurs;
const surOrigine = { origineMigratoire: ['premiere_generation'] };

describe("regle de l'origine migratoire", () => {
  it('refuse l origine migratoire hors des evenements tagues discrimination', () => {
    expect(erreurs([evenement('a', { requiert: surOrigine })]).join()).toContain(
      'reservee aux evenements tagues discrimination',
    );
    expect(
      erreurs([evenement('b', { modificateurs: [{ si: surOrigine, m: 2 }] })]).join(),
    ).toContain('reservee aux evenements tagues discrimination');
  });

  it("l'accepte pour un evenement tague discrimination", () => {
    expect(
      erreurs([
        evenement('c', { tags: ['discrimination'], modificateurs: [{ si: surOrigine, m: 2 }] }),
      ]),
    ).toEqual([]);
  });

  it('la refuse toujours pour la delinquance, meme taguee discrimination', () => {
    for (const tags of [['delinquance'], ['delinquance', 'discrimination']]) {
      expect(erreurs([evenement('d', { tags, requiert: surOrigine })]).join()).toContain(
        'delinquance ne teste jamais',
      );
    }
  });

  it("aucun evenement de delinquance du contenu ne teste l'origine migratoire", () => {
    const fichiers = import.meta.glob<{ evenements: Record<string, unknown>[] }>(
      '../../contenu/evenements/*.json',
      { eager: true, import: 'default' },
    );
    const delits = Object.values(fichiers)
      .flatMap((f) => f.evenements)
      .filter((e) => (e.tags as string[]).includes('delinquance'));
    expect(delits.length).toBeGreaterThan(0);
    for (const e of delits) expect(JSON.stringify(e)).not.toContain('origineMigratoire');
  });
});

describe('justice', () => {
  const gav = evenement('gav', { age: [20, 20], effets: { justice: 'garde_a_vue' } });
  const condamnation = evenement('condamnation', {
    age: [21, 21],
    requiert: { justice: ['garde_a_vue'] },
    effets: { justice: 'condamnation' },
  });
  const donnees = donneesAvec([gav, condamnation], TABLES_IMMORTELS);

  it('compte les gardes a vue, puis inscrit le casier a la condamnation', () => {
    let etat = creerPartie('justice', donnees);
    while (etat.personnage.age < 21) etat = jouerAnneeAuto(etat, donnees).etat;
    expect(etat.personnage.etats.justice).toEqual({
      gardesAVue: 1,
      condamnations: 0,
      casier: false,
    });
    etat = jouerAnneeAuto(etat, donnees).etat;
    expect(etat.personnage.etats.justice).toEqual({
      gardesAVue: 1,
      condamnations: 1,
      casier: true,
    });
  });

  it("n'ouvre la condamnation qu'apres une garde a vue", () => {
    const sansGav = donneesAvec([condamnation], TABLES_IMMORTELS);
    let etat = creerPartie('justice', sansGav);
    while (etat.personnage.age < 21) etat = jouerAnneeAuto(etat, sansGav).etat;
    expect(ouvrirAnnee(etat, sansGav).evenements).toEqual([]);
  });

  it("rend l'embauche moins probable avec un casier", () => {
    const sansEvenement = donneesAvec([], TABLES_IMMORTELS);
    const tauxRetourEmploi = (casier: boolean): number => {
      let retours = 0;
      let total = 0;
      for (let i = 0; i < 400; i++) {
        let etat = creerPartie(`casier-${i}`, sansEvenement, { anneeNaissance: 1980 });
        while (etat.personnage.age < 30) etat = jouerAnneeAuto(etat, sansEvenement).etat;
        const chomeur: EtatPartie = {
          ...etat,
          personnage: {
            ...etat.personnage,
            etats: {
              ...etat.personnage.etats,
              emploi: 'chomage',
              justice: { gardesAVue: 1, condamnations: casier ? 1 : 0, casier },
            },
          },
        };
        const apres = evoluerEmploi(chomeur, chomeur.personnage, 'chomage', sansEvenement);
        total++;
        if (estSalarie(apres.etats.emploi)) retours++;
      }
      return retours / total;
    };
    expect(tauxRetourEmploi(true)).toBeLessThan(tauxRetourEmploi(false));
  });
});

describe('suites apres un controle abusif', () => {
  it('porter plainte rend la suite de plainte tres probable', () => {
    const controle = evenement('controle', {
      age: [20, 20],
      tags: ['police'],
      choix: [
        {
          id: 'plainte',
          libelle: 'PLAINTE',
          modificateurs: [{ cible: { evenement: 'suite' }, m: 2_000_000, duree: 2 }],
        },
        { id: 'rien', libelle: 'RIEN' },
      ],
    });
    const suite = evenement('suite', { pBase: 0.000001 });
    const donnees = donneesAvec([controle, suite], TABLES_IMMORTELS);
    let suites = 0;
    for (let i = 0; i < 100; i++) {
      let etat = creerPartie(`plainte-${i}`, donnees);
      while (etat.personnage.age < 20) etat = jouerAnneeAuto(etat, donnees).etat;
      const ouverte = ouvrirAnnee(etat, donnees).etat;
      etat = fermerAnnee(ouverte, [{ evenementId: 'controle', choixId: 'plainte' }], donnees).etat;
      for (let annee = 0; annee < 2; annee++) {
        const o = ouvrirAnnee(etat, donnees);
        if (o.evenements.some((e) => e.id === 'suite')) {
          suites++;
          break;
        }
        etat = fermerAnnee(o.etat, [], donnees).etat;
      }
    }
    expect(suites).toBeGreaterThan(70);
  });
});
