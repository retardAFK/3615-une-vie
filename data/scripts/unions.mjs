// public/data/unions.json : évolution des unions d'une décennie à l'autre.
// Faute de population par âge et situation conjugale, seul le niveau de la décennie
// 2010-2019 reste un réglage à calibrer ; les autres décennies suivent les données :
// - mariages : la propension totale (pMariageDirect + pMariage) suit le taux brut de
//   nuptialité (Insee, MAR1, France métropolitaine, mariages pour 1 000 habitants)
//   rapporté à celui des années 2010 ; le partage direct / après vie commune est gardé ;
// - séparations : taux brut de divortialité (Insee, T26, France métropolitaine) rapporté
//   à celui des années 2010 ;
// - PACS : rapport PACS / mariages de la décennie (Insee, MAR3), appliqué à pMariage.
// La vie commune hors mariage (pCohabitation) garde ses valeurs de travail.

import { join } from 'node:path';
import { BRUT, PERIODES, ecrireTable, lireTable, nombre, significatif } from './lib/sources.mjs';
import { lireClasseur } from './lib/xlsx.mjs';

const ANCRE = '2010-2019';

/** Série annuelle d'une feuille : année → valeur de la colonne donnée. */
function serie(feuille, colonne) {
  const valeurs = new Map();
  for (const ligne of feuille) {
    const annee = Number(String(ligne[0] ?? '').slice(0, 4));
    const valeur = nombre(ligne[colonne]);
    if (Number.isInteger(annee) && annee >= 1900 && valeur !== null) valeurs.set(annee, valeur);
  }
  return valeurs;
}
const moyennePeriode = (valeurs, periode) => {
  const liste = [...valeurs].filter(([a]) => a >= periode.debut && a <= periode.fin);
  return liste.length === 0 ? null : liste.reduce((s, [, v]) => s + v, 0) / liste.length;
};

const mariages = lireClasseur(join(BRUT, 'insee', '1_Mariages_tnup.xlsx')).get('FM');
const nuptialite = serie(mariages, 6);
const nombreMariages = serie(
  lireClasseur(join(BRUT, 'insee', '1_Mariages_tnup.xlsx')).get('FR'),
  1,
);
const pacs = serie(lireClasseur(join(BRUT, 'insee', '3_Pacs.xlsx')).get('FR'), 1);
const divorce = serie(lireClasseur(join(BRUT, 'insee', 'fm_t26.xlsx')).get('T26'), 3);

const existante = lireTable('unions');
const ancre = existante.lignes.find((l) => l.conditions.periode === ANCRE).valeurs;
const ancreNuptialite = moyennePeriode(
  nuptialite,
  PERIODES.find((p) => p.nom === ANCRE),
);
const ancreDivorce = moyennePeriode(
  divorce,
  PERIODES.find((p) => p.nom === ANCRE),
);

const lignes = PERIODES.map((periode) => {
  const n = moyennePeriode(nuptialite, periode) ?? ancreNuptialite;
  const d = moyennePeriode(divorce, periode) ?? ancreDivorce;
  const totalMariages = moyennePeriode(nombreMariages, periode);
  const totalPacs = moyennePeriode(pacs, periode);
  const rapportPacs = totalMariages && totalPacs ? totalPacs / totalMariages : 0;
  const actuelle = existante.lignes.find((l) => l.conditions.periode === periode.nom).valeurs;
  // Propension totale au mariage (direct, ou après une vie commune) : suit la nuptialité ;
  // le partage entre les deux voies garde le motif de la décennie (réglage).
  const totalAncre = ancre.pMariageDirect + ancre.pMariage;
  const total = totalAncre * (n / ancreNuptialite);
  const partDirecte = actuelle.pMariageDirect / (actuelle.pMariageDirect + actuelle.pMariage);
  const pMariage = total * (1 - partDirecte);
  return {
    conditions: { periode: periode.nom },
    valeurs: {
      pCohabitation: actuelle.pCohabitation,
      pMariageDirect: significatif(total * partDirecte, 3),
      pMariage: significatif(pMariage, 3),
      pPacs: significatif(pMariage * rapportPacs, 3),
      pSeparation: significatif(ancre.pSeparation * (d / ancreDivorce), 3),
    },
  };
});
lignes.push({ conditions: {}, valeurs: lignes.at(-1).valeurs });

ecrireTable('unions', {
  source: `Évolution par décennie d'après l'Insee : taux brut de nuptialité (MAR1) pour les mariages, taux brut de divortialité (T26) pour les séparations, rapport PACS / mariages (MAR3) pour les PACS ; niveaux rapportés à la décennie ${ANCRE}, dont les valeurs restent des réglages de travail. La vie commune hors mariage (pCohabitation) reste à calibrer.`,
  url: 'https://www.insee.fr/fr/statistiques/8560677',
  aCalibrer: true,
  lignes,
});
console.log(
  'unions',
  lignes
    .slice(0, -1)
    .map(
      (l) =>
        `${l.conditions.periode}: m ${l.valeurs.pMariage} sep ${l.valeurs.pSeparation} pacs ${l.valeurs.pPacs}`,
    )
    .join(' | '),
);
