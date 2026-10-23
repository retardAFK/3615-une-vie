// Lecture des fichiers bruts de data/brut/ et écriture des tables de public/data/.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const BRUT = join(RACINE, 'data', 'brut');
export const SORTIE = join(RACINE, 'public', 'data');

/** CSV à séparateur « ; » (Insee : latin1, virgule décimale) → objets par en-tête. */
export function lireCsv(chemin, { encodage = 'latin1', separateur = ';' } = {}) {
  const lignes = readFileSync(chemin)
    .toString(encodage)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  const entetes = lignes[0].split(separateur).map((e) => e.replace(/^"|"$/g, '').trim());
  return lignes.slice(1).map((ligne) => {
    const valeurs = ligne.split(separateur).map((v) => v.replace(/^"|"$/g, '').trim());
    return Object.fromEntries(entetes.map((e, i) => [e, valeurs[i] ?? '']));
  });
}

/** Nombre au format français (« 1 234,5 »), ou null. */
export function nombre(texte) {
  if (typeof texte === 'number') return texte;
  const propre = String(texte ?? '')
    // \s couvre aussi les espaces insécables (fines ou non) des fichiers Insee.
    .replace(/\s/g, '')
    .replace(',', '.');
  if (propre === '' || !/^-?\d*\.?\d+(e-?\d+)?$/i.test(propre)) return null;
  return Number(propre);
}

/** Série annuelle d'un fichier SDMX de la BDM Insee : année → valeur. */
export function lireSerieSdmx(chemin) {
  const xml = readFileSync(chemin, 'utf8');
  const serie = new Map();
  for (const m of xml.matchAll(/<Obs ([^>]*)\/>/g)) {
    const annee = Number(/TIME_PERIOD="(\d{4})"/.exec(m[1])?.[1]);
    const valeur = Number(/OBS_VALUE="([^"]+)"/.exec(m[1])?.[1]);
    if (Number.isFinite(annee) && Number.isFinite(valeur)) serie.set(annee, valeur);
  }
  if (serie.size === 0) throw new Error(`${chemin} : aucune observation`);
  return serie;
}

/** Arrondi à n chiffres significatifs (tables lisibles, sans fausse précision). */
export function significatif(valeur, chiffres = 4) {
  return valeur === 0 ? 0 : Number(valeur.toPrecision(chiffres));
}

/**
 * Écrit une table de public/data/ avec ses métadonnées. Une table calibrée cite sa
 * source et son adresse ; aCalibrer passe à false.
 */
export function ecrireTable(nom, { source, url, lignes, aCalibrer = false }) {
  const table = { table: nom, source, url, aCalibrer, lignes };
  writeFileSync(join(SORTIE, `${nom}.json`), `${JSON.stringify(table, null, 2)}\n`);
  return table;
}

/** Table existante de public/data/ (pour garder ses lignes non calibrées). */
export function lireTable(nom) {
  return JSON.parse(readFileSync(join(SORTIE, `${nom}.json`), 'utf8'));
}

/** Périodes décennales du jeu : 1950-1959, ..., 2020-2029. */
export const PERIODES = Array.from({ length: 8 }, (_, i) => {
  const debut = 1950 + 10 * i;
  return { nom: `${debut}-${debut + 9}`, debut, fin: debut + 9 };
});
