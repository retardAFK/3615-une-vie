// Génère public/data/mortalite.json : table de travail NON sourcée.
// Loi de Gompertz par sexe, h(x) = a × e^(b × x), dont le paramètre a est ajusté
// pour viser un âge moyen de décès donné. À remplacer par les tables INSEE (jalon 8).
//
// Usage : node data/scripts/mortalite-gompertz.js

import { writeFileSync } from 'node:fs';

const AGE_MAXIMAL = 110;

// Paramètres de travail : pente b choisie à la main, âge moyen de décès visé.
const PARAMETRES = {
  homme: { b: 0.095, cible: 79 },
  femme: { b: 0.105, cible: 85 },
};

/** q(x) : probabilité de décéder entre x et x + 1 ans. */
function qParAge(a, b) {
  const q = [];
  for (let x = 0; x <= AGE_MAXIMAL; x++) {
    const cumul = (a / b) * Math.exp(b * x) * (Math.exp(b) - 1);
    q.push(x === AGE_MAXIMAL ? 1 : Number((1 - Math.exp(-cumul)).toPrecision(6)));
  }
  return q;
}

/**
 * Âge moyen de décès avec la convention de src/moteur/boucle.ts :
 * chaque année, on teste q à l'âge vécu, puis l'âge augmente.
 */
function ageMoyenDeces(q) {
  let survie = 1;
  let moyenne = 0;
  for (let x = 0; x <= AGE_MAXIMAL; x++) {
    const deces = survie * q[x];
    moyenne += x * deces;
    survie -= deces;
  }
  return moyenne;
}

/** Ajuste a par dichotomie (en échelle logarithmique) pour atteindre la cible. */
function ajuster({ b, cible }) {
  let bas = Math.log(1e-9);
  let haut = Math.log(1e-1);
  for (let i = 0; i < 200; i++) {
    const milieu = (bas + haut) / 2;
    // Plus a est grand, plus on meurt tôt.
    if (ageMoyenDeces(qParAge(Math.exp(milieu), b)) > cible) bas = milieu;
    else haut = milieu;
  }
  return qParAge(Math.exp((bas + haut) / 2), b);
}

const homme = ajuster(PARAMETRES.homme);
const femme = ajuster(PARAMETRES.femme);
// Ligne sans condition (repli) : moyenne des deux sexes.
const ensemble = homme.map((q, x) => Number(((q + femme[x]) / 2).toPrecision(6)));

const table = {
  table: 'mortalite',
  source:
    'Valeurs de travail non sourcees : loi de Gompertz (data/scripts/mortalite-gompertz.js), ' +
    `age moyen de deces vise ${PARAMETRES.homme.cible} ans (hommes) et ${PARAMETRES.femme.cible} ans (femmes).`,
  url: null,
  aCalibrer: true,
  lignes: [
    { conditions: { sexe: 'homme' }, qParAge: homme },
    { conditions: { sexe: 'femme' }, qParAge: femme },
    { conditions: {}, qParAge: ensemble },
  ],
};

const chemin = new URL('../../public/data/mortalite.json', import.meta.url);
writeFileSync(chemin, JSON.stringify(table, null, 2) + '\n');
console.log(
  `mortalite.json : hommes ${ageMoyenDeces(homme).toFixed(1)} ans, femmes ${ageMoyenDeces(femme).toFixed(1)} ans`,
);
