import { describe, expect, it } from 'vitest';
import { creerPartie, jouerAnneeAuto } from '../../src/moteur/boucle';
import {
  evenementParId,
  multiplicateursTag,
  probabiliteEvenement,
} from '../../src/moteur/evenements';
import { depensesAddictions, evoluerAddictions } from '../../src/moteur/modules/addictions';
import { parametre } from '../../src/moteur/tables';
import type {
  EtatAddiction,
  EtatPartie,
  ModificateurTemporaire,
  Produit,
} from '../../src/moteur/types';
import { DONNEES } from './donnees';
import { TABLES } from './tables';

/** Personnage de 30 ans (ou de l'âge donné) avec un produit dans un état donné. */
function avec(
  produit: Produit,
  etat: EtatAddiction,
  graine: string,
  options: { age?: number; anneesDansEtat?: number; modificateurs?: ModificateurTemporaire[] } = {},
): EtatPartie {
  const { age = 30, anneesDansEtat = 0, modificateurs = [] } = options;
  const base = creerPartie(graine, DONNEES, { anneeNaissance: 1980 });
  const { etats } = base.personnage;
  return {
    ...base,
    annee: 1980 + age,
    modificateursActifs: modificateurs,
    personnage: {
      ...base.personnage,
      age,
      etats: {
        ...etats,
        scolarite: 'sortie',
        emploi: 'cdi',
        addictions: { ...etats.addictions, [produit]: etat },
        debutEtatAddiction: { ...etats.debutEtatAddiction, [produit]: age - anneesDansEtat },
      },
    },
  };
}

/** Part des vies où le produit passe à l'état attendu à la fin de l'année. */
function taux(
  produit: Produit,
  depart: EtatAddiction,
  arrivee: EtatAddiction,
  options: Parameters<typeof avec>[3] = {},
  vies = 1500,
): number {
  let n = 0;
  for (let i = 0; i < vies; i++) {
    const etat = avec(produit, depart, `${produit}-${depart}-${i}`, options);
    if (evoluerAddictions(etat, DONNEES).etat.personnage.etats.addictions[produit] === arrivee) n++;
  }
  return n / vies;
}

const choix = (tag: string, m: number, age = 30): ModificateurTemporaire => ({
  cible: { tag },
  m,
  debut: age + 1,
  fin: age + 1,
});

describe('chaine des addictions', () => {
  it("personne n'est expose avant l'age minimum du produit", () => {
    const ageMin = parametre(TABLES.transitionsAddictions, 'ageMin', { produit: 'jeux_argent' });
    for (let i = 0; i < 100; i++) {
      let etat = creerPartie(`mineur-${i}`, DONNEES);
      while (etat.personnage.vivant && etat.personnage.age < ageMin) {
        etat = jouerAnneeAuto(etat, DONNEES).etat;
      }
      if (!etat.personnage.vivant) continue;
      expect(etat.personnage.etats.addictions.jeux_argent).toBe('jamais_expose');
    }
  });

  it("l'initiation suit le choix du joueur, sans le garantir", () => {
    const accepter = taux('tabac', 'expose', 'usage_occasionnel', {
      modificateurs: [choix('initiation_tabac', 30)],
    });
    const refuser = taux('tabac', 'expose', 'usage_occasionnel', {
      modificateurs: [choix('initiation_tabac', 0.2)],
    });
    expect(accepter).toBeGreaterThan(0.6);
    expect(accepter).toBeLessThan(1);
    expect(refuser).toBeLessThan(0.1);
  });

  it("l'escalade se joue surtout dans les premieres annees", () => {
    const debut = taux('alcool', 'usage_occasionnel', 'usage_regulier');
    const tard = taux('alcool', 'usage_occasionnel', 'usage_regulier', { anneesDansEtat: 20 });
    expect(tard).toBeLessThan(debut / 3);
  });

  it('la sortie passe par un choix ; se faire aider reduit la rechute', () => {
    const sansChoix = taux('tabac', 'dependance', 'sevrage');
    const arreter = taux('tabac', 'dependance', 'sevrage', {
      modificateurs: [choix('arret_tabac', 15)],
    });
    expect(sansChoix).toBeLessThan(0.05);
    expect(arreter).toBeGreaterThan(sansChoix * 5);

    const seul = taux('tabac', 'sevrage', 'usage_regulier');
    const aide = taux('tabac', 'sevrage', 'usage_regulier', {
      modificateurs: [choix('rechute_tabac', 0.5)],
    });
    expect(aide).toBeLessThan(seul * 0.8);
  });

  it("la rechute decroit avec les annees d'abstinence", () => {
    const premiere = taux('alcool', 'abstinent', 'usage_regulier');
    const dixieme = taux('alcool', 'abstinent', 'usage_regulier', { anneesDansEtat: 10 });
    expect(dixieme).toBeLessThan(premiere / 3);
  });

  it('une addiction active augmente le risque des autres', () => {
    const seul = taux('jeux_argent', 'usage_occasionnel', 'usage_regulier');
    let n = 0;
    for (let i = 0; i < 1500; i++) {
      const etat = avec('jeux_argent', 'usage_occasionnel', `jeux_argent-usage_occasionnel-${i}`);
      const buveur: EtatPartie = {
        ...etat,
        personnage: {
          ...etat.personnage,
          etats: {
            ...etat.personnage.etats,
            addictions: { ...etat.personnage.etats.addictions, alcool: 'dependance' },
          },
        },
      };
      const apres = evoluerAddictions(buveur, DONNEES).etat.personnage.etats.addictions;
      if (apres.jeux_argent === 'usage_regulier') n++;
    }
    expect(n / 1500).toBeGreaterThan(seul * 1.3);
  });

  it("les effets et le cout de l'annee viennent de la table", () => {
    const etat = avec('tabac', 'dependance', 'effets');
    const effets = TABLES.effetsAddictions.lignes.find(
      (l) => l.conditions.produit === 'tabac' && l.conditions.etat === 'dependance',
    )!.valeurs;
    const apres = evoluerAddictions(etat, DONNEES).etat.personnage;
    expect(apres.jauges.santePhysique).toBe(
      etat.personnage.jauges.santePhysique + effets.santePhysique!,
    );
    expect(depensesAddictions(etat.personnage, TABLES)).toBe(effets.cout);
  });

  it('une addiction active pese sur les tags des autres modules, cache compris', () => {
    const sobre = avec('alcool', 'usage_occasionnel', 'tags');
    // Même origine et mêmes traits (mêmes objets) : la partie fixe vient du cache.
    const dependant: EtatPartie = {
      ...sobre,
      personnage: {
        ...sobre.personnage,
        etats: {
          ...sobre.personnage.etats,
          addictions: { ...sobre.personnage.etats.addictions, alcool: 'dependance' },
        },
      },
    };
    const produit = (etat: EtatPartie): number =>
      multiplicateursTag(etat, 'emploi_chomage', 31, DONNEES).reduce((a, m) => a * m, 1);
    const alcool = TABLES.addictionsAutresTags.lignes.find(
      (l) => l.conditions.produit === 'alcool' && l.conditions.tag === 'emploi_chomage',
    )!.valeur;
    expect(produit(dependant)).toBeCloseTo(produit(sobre) * alcool);
    const accident = DONNEES.evenements.find((e) => e.tags.includes('accident'))!;
    const evenement = evenementParId(DONNEES.evenements, accident.id);
    const p1 = probabiliteEvenement(evenement, sobre, DONNEES);
    const p2 = probabiliteEvenement(evenement, dependant, DONNEES);
    const p3 = probabiliteEvenement(evenement, sobre, DONNEES);
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBe(p1);
  });
});
