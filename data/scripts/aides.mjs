// public/data/baremesAides.json : montants annuels des aides, en euros 2025.
// Source : barèmes IPP (Institut des politiques publiques), prestations sociales :
// - minimumSocial : montant de base mensuel du RMI (1988-2008) puis du RSA (2009-) pour une
//   personne seule ;
// - allocationsFamiliales : montant mensuel pour le deuxième enfant (taux af_enf2 de la
//   BMAF, base mensuelle des allocations familiales).
// Montant de chaque année : celui en vigueur au 1er janvier (francs avant 2002, convertis
// en euros puis en euros 2025 par le convertisseur Insee) ; moyenne des années de chaque
// décennie où l'aide existe. Le fichier s'arrête en 2014 : les années suivantes reprennent
// la dernière valeur connue. Les autres aides gardent leurs valeurs de travail.

import { join } from 'node:path';
import { BRUT, PERIODES, ecrireTable, lireSerieSdmx, lireTable, nombre } from './lib/sources.mjs';
import { lireClasseur } from './lib/xlsx.mjs';

const FRANCS_PAR_EURO = 6.55957;
const coefficients = lireSerieSdmx(join(BRUT, 'insee', 'serie-011813530.xml'));
const enEuros2025 = (euros, annee) => (euros * coefficients.get(2025)) / coefficients.get(annee);
const classeur = lireClasseur(
  join(BRUT, 'ipp', 'baremes-ipp-prestations-sociales-social-benefits.xlsx'),
);

/** Date Excel (jours depuis le 30/12/1899) → année et mois. */
const dateExcel = (serie) => new Date(Date.UTC(1899, 11, 30) + serie * 86400000);

/**
 * Barème d'une feuille IPP : [{ date, valeur }], du plus ancien au plus récent. Un montant
 * (monnaie) est converti en euros avant 2002 ; un taux reste tel quel.
 */
function bareme(feuille, colonne, monnaie = true) {
  const lignes = [];
  for (const ligne of classeur.get(feuille)) {
    if (typeof ligne[0] !== 'number') continue;
    const date = dateExcel(ligne[0]);
    const brut = nombre(String(ligne[colonne] ?? '').replace(/[€F\s]/g, ''));
    const enFrancs = monnaie && date.getUTCFullYear() < 2002;
    lignes.push({ date, valeur: brut === null ? null : brut / (enFrancs ? FRANCS_PAR_EURO : 1) });
  }
  return lignes.sort((a, b) => a.date - b.date);
}

/** Montant en vigueur au 1er janvier de chaque année (null : aide supprimée ou absente). */
function parAnnee(lignes, debut, fin) {
  const resultat = new Map();
  for (let annee = debut; annee <= fin; annee++) {
    const janvier = new Date(Date.UTC(annee, 0, 1, 12));
    const enVigueur = lignes.filter((l) => l.date <= janvier).at(-1);
    if (enVigueur?.valeur) resultat.set(annee, enVigueur.valeur);
  }
  return resultat;
}

// RMI puis RSA (le RSA remplace le RMI le 1er juin 2009 ; la ligne de suppression du RMI
// n'a pas de montant). Montants mensuels.
const rmi = bareme('RMI_M', 1).filter((l) => l.valeur);
const rsa = bareme('RSA_M', 1).filter((l) => l.valeur);
const minimumSocial = parAnnee(
  [...rmi, ...rsa].sort((a, b) => a.date - b.date),
  1989,
  2014,
);

// Allocations familiales : taux du deuxième enfant × BMAF.
const bmaf = parAnnee(bareme('BMAF', 1), 1977, 2014);
const taux = parAnnee(bareme('AF_CM', 2, false), 1977, 2014);
const allocations = new Map(
  [...bmaf].filter(([a]) => taux.has(a)).map(([a, b]) => [a, b * taux.get(a)]),
);

/** Moyenne annuelle (12 mois, euros 2025) des années de la décennie ; repli sur 2014. */
function parDecennie(mensuels) {
  const derniere = Math.max(...mensuels.keys());
  return PERIODES.map((periode) => {
    const annees = [];
    for (let a = periode.debut; a <= periode.fin; a++) {
      const annee = Math.min(a, derniere);
      if (mensuels.has(annee)) annees.push(12 * enEuros2025(mensuels.get(annee), annee));
    }
    return annees.length === 0
      ? null
      : Math.round(annees.reduce((s, v) => s + v, 0) / annees.length / 10) * 10;
  });
}
const calibres = {
  minimumSocial: parDecennie(minimumSocial),
  allocationsFamiliales: parDecennie(allocations),
};

const existante = lireTable('baremesAides');
const lignes = existante.lignes.map((ligne) => {
  const montants = calibres[ligne.conditions.aide];
  if (!montants) return ligne;
  const rang = PERIODES.findIndex((p) => p.nom === ligne.conditions.periode);
  const montant = rang === -1 ? montants.at(-1) : montants[rang];
  // Décennie où l'aide n'existait pas encore : son montant n'est jamais lu (la loi du
  // contexte historique la crée), on garde la valeur existante.
  return montant === null ? ligne : { ...ligne, valeurs: { ...ligne.valeurs, montant } };
});
ecrireTable('baremesAides', {
  ...existante,
  source:
    "minimumSocial (RMI 1988-2008, RSA ensuite, personne seule) et allocationsFamiliales (deuxième enfant, taux × BMAF) : barèmes IPP, prestations sociales, montant au 1er janvier de chaque année converti en euros 2025 (convertisseur Insee), moyenne de la décennie ; le fichier s'arrête en 2014, les années suivantes reprennent la dernière valeur. AAH, minimum vieillesse, complément d'activité, aide au logement : valeurs de travail, à calibrer.",
  url: 'https://www.data.gouv.fr/datasets/baremes-ipp-systeme-social-et-fiscal-francais',
  aCalibrer: true,
  lignes,
});
console.log('baremesAides', JSON.stringify(calibres));
