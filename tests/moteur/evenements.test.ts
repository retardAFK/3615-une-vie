import { describe, expect, it } from 'vitest';
import { creerPartie, fermerAnnee, jouerAnneeAuto, ouvrirAnnee } from '../../src/moteur/boucle';
import {
  EVENEMENTS_PAR_AN,
  choisirAuto,
  estEligible,
  evenementsParAge,
  probabiliteEvenement,
  tirerEvenements,
} from '../../src/moteur/evenements';
import { sousGenerateur } from '../../src/moteur/rng';
import type { ChoixJoueur, Donnees, EtatPartie } from '../../src/moteur/types';
import { DONNEES, donneesAvec, evenement } from './donnees';

/** Joue jusqu'à l'âge voulu ; choisir donne les choix d'une année ouverte. */
function vivreJusqua(
  age: number,
  donnees: Donnees,
  choisir: (etat: EtatPartie) => ChoixJoueur[] = () => [],
  graine = 'evenements',
): { etat: EtatPartie; tiresParAge: Map<number, string[]> } {
  let etat = creerPartie(graine, donnees);
  const tiresParAge = new Map<number, string[]>();
  while (etat.personnage.vivant && etat.personnage.age < age) {
    const ouverture = ouvrirAnnee(etat, donnees);
    if (!ouverture.etat.personnage.vivant) return { etat: ouverture.etat, tiresParAge };
    tiresParAge.set(
      etat.personnage.age,
      ouverture.evenements.map((e) => e.id),
    );
    etat = fermerAnnee(ouverture.etat, choisir(ouverture.etat), donnees).etat;
  }
  return { etat, tiresParAge };
}

describe('selection annuelle', () => {
  it('garde au plus 3 evenements, les plus graves, et reporte les autres une fois', () => {
    const donnees = donneesAvec([
      evenement('leger_a', { age: [5, 5], gravite: 1 }),
      evenement('grave', { age: [5, 5], gravite: 3 }),
      evenement('leger_b', { age: [5, 6], gravite: 1 }),
      evenement('moyen', { age: [5, 5], gravite: 2 }),
      evenement('leger_c', { age: [5, 6], gravite: 1 }),
    ]);
    const { etat } = vivreJusqua(5, donnees);
    const annee5 = ouvrirAnnee(etat, donnees);
    expect(annee5.evenements.map((e) => e.id)).toEqual(['grave', 'moyen', 'leger_a']);
    expect(annee5.etat.reportes).toEqual(['leger_b', 'leger_c']);

    // L'année suivante, les reportés passent sans nouveau tirage.
    const etat6 = fermerAnnee(annee5.etat, [], donnees).etat;
    const annee6 = ouvrirAnnee(etat6, donnees);
    expect(annee6.evenements.map((e) => [e.id, e.reporte])).toEqual([
      ['leger_b', true],
      ['leger_c', true],
    ]);
    expect(annee6.etat.reportes).toEqual([]);
  });

  it("n'accorde qu'un seul report : ecarte une seconde fois, l'evenement est perdu", () => {
    const donnees = donneesAvec([
      evenement('a', { age: [5, 5], gravite: 3 }),
      evenement('b', { age: [5, 5], gravite: 3 }),
      evenement('c', { age: [5, 5], gravite: 3 }),
      evenement('leger', { age: [5, 6], gravite: 1 }),
      evenement('d', { age: [6, 6], gravite: 3 }),
      evenement('e', { age: [6, 6], gravite: 3 }),
      evenement('f', { age: [6, 6], gravite: 3 }),
    ]);
    const { etat } = vivreJusqua(5, donnees);
    const annee5 = ouvrirAnnee(etat, donnees);
    expect(annee5.etat.reportes).toEqual(['leger']);
    const annee6 = ouvrirAnnee(fermerAnnee(annee5.etat, [], donnees).etat, donnees);
    expect(annee6.evenements.map((e) => e.id)).toEqual(['d', 'e', 'f']);
    expect(annee6.etat.reportes).toEqual([]);
  });

  it('respecte les cooldowns et les evenements uniques', () => {
    const donnees = donneesAvec([
      evenement('periodique', { cooldown: 3 }),
      evenement('une_fois', { unique: true }),
    ]);
    const { tiresParAge } = vivreJusqua(12, donnees);
    const ages = (id: string): number[] =>
      [...tiresParAge].filter(([, ids]) => ids.includes(id)).map(([age]) => age);
    expect(ages('periodique')).toEqual([0, 3, 6, 9]);
    expect(ages('une_fois')).toEqual([0]);
  });

  it("n'ouvre que les evenements de la tranche d'age et des conditions d'origine", () => {
    const etat = creerPartie('conditions', donneesAvec([]));
    const autreSexe = etat.personnage.origine.sexe === 'femme' ? 'homme' : 'femme';
    const donnees = donneesAvec([
      evenement('trop_tot', { age: [10, 20] }),
      evenement('mauvais_sexe', { requiert: { sexe: [autreSexe] } }),
      evenement('ok', { requiert: { sexe: [etat.personnage.origine.sexe] } }),
    ]);
    expect(ouvrirAnnee(etat, donnees).evenements.map((e) => e.id)).toEqual(['ok']);
  });
});

describe('choix et modificateurs', () => {
  const cible = evenement('cible', { pBase: 0.1, age: [0, 110] });
  const proposition = evenement('proposition', {
    age: [10, 10],
    choix: [
      {
        id: 'oui',
        libelle: 'OUI',
        cout: { jauges: { liens: -5 }, argent: 100 },
        modificateurs: [{ cible: { evenement: 'cible' }, m: 3, duree: 4 }],
      },
      { id: 'non', libelle: 'NON' },
    ],
  });
  const donnees = donneesAvec([proposition, cible]);
  const choisirOui = (etat: EtatPartie): ChoixJoueur[] =>
    etat.anneeEnCours?.evenements.some((e) => e.id === 'proposition')
      ? [{ evenementId: 'proposition', choixId: 'oui' }]
      : [];

  it('applique le cout immediat et pose un modificateur pendant sa duree, puis l expire', () => {
    const avant = vivreJusqua(10, donnees).etat;
    const ouverte = ouvrirAnnee(avant, donnees).etat;
    const apres = fermerAnnee(ouverte, choisirOui(ouverte), donnees).etat;
    expect(apres.personnage.jauges.liens).toBe(avant.personnage.jauges.liens - 5);
    expect(apres.personnage.finances.dettes).toBe(100);
    expect(apres.modificateursActifs).toEqual([
      { cible: { evenement: 'cible' }, m: 3, debut: 11, fin: 14 },
    ]);

    const definition = donnees.evenements[1]!;
    const pBase = probabiliteEvenement(definition, avant);
    let etat = apres;
    for (let age = 11; age <= 16; age++) {
      const p = probabiliteEvenement(definition, etat);
      if (age <= 14) expect(p).toBeGreaterThan(pBase * 2);
      else expect(p).toBeCloseTo(pBase, 10);
      etat = fermerAnnee(ouvrirAnnee(etat, donnees).etat, [], donnees).etat;
    }
    expect(etat.modificateursActifs).toEqual([]);
  });

  it('refuse de fermer une annee sans le choix demande', () => {
    const avant = vivreJusqua(10, donnees).etat;
    const ouverte = ouvrirAnnee(avant, donnees).etat;
    expect(() => fermerAnnee(ouverte, [], donnees)).toThrow('choix manquant');
  });

  it('ecrit une ligne de journal par evenement, avec la phrase du choix', () => {
    const avecJournal = donneesAvec([
      evenement('offre', {
        age: [3, 3],
        choix: [
          { id: 'a', libelle: 'A', journal: 'TU ACCEPTES.' },
          { id: 'b', libelle: 'B' },
        ],
      }),
    ]);
    const etat = vivreJusqua(3, avecJournal).etat;
    const ouverte = ouvrirAnnee(etat, avecJournal).etat;
    const { journal } = fermerAnnee(ouverte, [{ evenementId: 'offre', choixId: 'a' }], avecJournal);
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      type: 'evenement',
      evenementId: 'offre',
      choixId: 'a',
      age: 3,
    });
    expect(journal[0]!.texte).toMatch(/^OFFRE (A 3 ANS|EN \d{4})\. TU ACCEPTES\.$/);
  });

  it('garde identiques les tirages qui ne dependent pas du choix', () => {
    const independant = evenement('independant', { pBase: 0.3 });
    const avecIndependant = donneesAvec([proposition, cible, independant]);
    const choisirNon = (etat: EtatPartie): ChoixJoueur[] =>
      etat.anneeEnCours?.evenements.some((e) => e.id === 'proposition')
        ? [{ evenementId: 'proposition', choixId: 'non' }]
        : [];
    const oui = vivreJusqua(80, avecIndependant, choisirOui).tiresParAge;
    const non = vivreJusqua(80, avecIndependant, choisirNon).tiresParAge;
    const tirages = (t: Map<number, string[]>): boolean[] =>
      [...t.values()].map((ids) => ids.includes('independant'));
    expect(tirages(oui)).toEqual(tirages(non));
    expect(tirages(oui).filter(Boolean).length).toBeGreaterThan(10);
  });
});

describe('choisirAuto', () => {
  const offre = evenement('offre', {
    age: [0, 110],
    choix: [
      { id: 'social', libelle: 'SOCIAL', affinites: [{ trait: 'sociabilite', k: 3 }] },
      { id: 'seul', libelle: 'SEUL', affinites: [{ trait: 'sociabilite', k: -3 }] },
    ],
  });
  const donnees = donneesAvec([offre]);

  it('est deterministe', () => {
    const etat = ouvrirAnnee(creerPartie('auto', donnees), donnees).etat;
    const tire = etat.anneeEnCours!.evenements[0]!;
    expect(choisirAuto(etat, tire, donnees)).toEqual(choisirAuto(etat, tire, donnees));
  });

  it('suit les affinites avec les traits', () => {
    const comptes = { social: 0, seul: 0 };
    for (let i = 0; i < 300; i++) {
      const etat = ouvrirAnnee(creerPartie(`auto-${i}`, donnees), donnees).etat;
      etat.personnage.traits.sociabilite = 90;
      const { choixId } = choisirAuto(etat, etat.anneeEnCours!.evenements[0]!, donnees);
      comptes[choixId as 'social' | 'seul']++;
    }
    expect(comptes.social).toBeGreaterThan(comptes.seul * 5);
  });
});

describe('evenement mortel', () => {
  it("termine la partie a l'age vecu, avec la cause", () => {
    const donnees = donneesAvec([
      evenement('fatal', { age: [30, 30], gravite: 3, effets: { deces: 1 } }),
    ]);
    let etat = creerPartie('fatal', donnees);
    while (etat.personnage.vivant) etat = jouerAnneeAuto(etat, donnees).etat;
    expect(etat.personnage.age).toBe(30);
    expect(etat.historique.at(-1)).toMatchObject({ type: 'deces', age: 30, cause: 'fatal' });
    expect(etat.historique.at(-2)).toMatchObject({ type: 'evenement', evenementId: 'fatal' });
    expect(() => ouvrirAnnee(etat, donnees)).toThrow();
  });
});

describe('index des evenements par age', () => {
  /** Tirage de référence, sans index : parcourt toute la liste (version du jalon 3). */
  function tirageReference(etat: EtatPartie, donnees: Donnees): string[] {
    const candidats: { id: string; gravite: number; rang: number }[] = [];
    donnees.evenements.forEach((ev, rang) => {
      if (!estEligible(ev, etat)) return;
      if (
        etat.reportes.includes(ev.id) ||
        sousGenerateur(etat.graine, etat.personnage.age, ev.id)() < probabiliteEvenement(ev, etat)
      ) {
        candidats.push({ id: ev.id, gravite: ev.gravite, rang });
      }
    });
    candidats.sort((a, b) => b.gravite - a.gravite || a.rang - b.rang);
    return candidats.slice(0, EVENEMENTS_PAR_AN).map((c) => c.id);
  }

  it('donne exactement les memes tirages que le parcours complet, sur 200 vies', () => {
    let annees = 0;
    for (let i = 0; i < 200; i++) {
      let etat = creerPartie(`index-${i}`, DONNEES);
      while (etat.personnage.vivant) {
        const attendu = tirageReference(etat, DONNEES);
        expect(tirerEvenements(etat, DONNEES).retenus.map((e) => e.id)).toEqual(attendu);
        etat = jouerAnneeAuto(etat, DONNEES).etat;
        annees++;
      }
    }
    expect(annees).toBeGreaterThan(10_000);
  });

  it('range chaque evenement aux ages de sa tranche, dans l ordre de declaration', () => {
    const parAge = evenementsParAge(DONNEES.evenements);
    for (let age = 0; age < parAge.length; age++) {
      const attendus = DONNEES.evenements.filter((e) => age >= e.age[0] && age <= e.age[1]);
      expect(parAge[age]!.map((r) => r.evenement)).toEqual(attendus);
    }
  });
});
