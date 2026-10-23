import { describe, expect, it } from 'vitest';
import { rejouer } from '../../src/moteur/bilan';
import { creerPartie, jouerAnneeAuto, ouvrirAnnee } from '../../src/moteur/boucle';
import { VIES_GARDEES, partieSauvee, stockageMemoire, vieSauvee } from '../../src/stockage/parties';
import { DONNEES } from '../moteur/donnees';

describe('sauvegarde', () => {
  it('reprend une partie en cours sur l annee ouverte', async () => {
    let etat = creerPartie('sauvegarde', DONNEES);
    for (let i = 0; i < 30; i++) etat = jouerAnneeAuto(etat, DONNEES).etat;
    const ouverte = ouvrirAnnee(etat, DONNEES).etat;
    const stockage = stockageMemoire();
    await stockage.sauverEnCours(partieSauvee(ouverte));
    const lue = (await stockage.lireEnCours())!;
    expect(lue.prenom).toBe(ouverte.personnage.prenom);
    const reprise = rejouer(lue.graine, lue.options, lue.decisions, DONNEES, lue.ageOuvert);
    expect(reprise.personnage).toEqual(ouverte.personnage);
    expect(reprise.anneeEnCours).toEqual(ouverte.anneeEnCours);
    await stockage.effacerEnCours();
    expect(await stockage.lireEnCours()).toBeNull();
  });

  it('garde les vies passees les plus recentes', async () => {
    let etat = creerPartie('vie', DONNEES);
    while (etat.personnage.vivant) etat = jouerAnneeAuto(etat, DONNEES).etat;
    const stockage = stockageMemoire();
    for (let i = 0; i < VIES_GARDEES + 5; i++) await stockage.ajouterVie(vieSauvee(etat, i));
    const vies = await stockage.listerVies();
    expect(vies).toHaveLength(VIES_GARDEES);
    expect(vies[0]!.terminee).toBe(VIES_GARDEES + 4);
    expect(vies[0]).toMatchObject({
      prenom: etat.personnage.prenom,
      age: etat.personnage.age,
      anneeDeces: etat.annee,
    });
    const refaite = rejouer(vies[0]!.graine, vies[0]!.options, vies[0]!.decisions, DONNEES);
    expect(refaite.personnage).toEqual(etat.personnage);
  });
});
