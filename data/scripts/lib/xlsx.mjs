// Lecteur xlsx minimal, sans dépendance : un classeur est une archive zip de fichiers
// XML. On lit le répertoire central de l'archive, on décompresse (deflate) les entrées
// utiles, puis on extrait les cellules des feuilles. Suffisant pour les tableaux de
// l'Insee (valeurs, chaînes partagées, chaînes en ligne) ; pas de formules ni de styles.

import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/**
 * Entrées d'une archive zip (chemin ou contenu) : nom → contenu décompressé. Seules les
 * entrées retenues par `garder` sont décompressées.
 */
export function lireZip(source, garder = () => true) {
  const chemin = Buffer.isBuffer(source) ? 'archive' : source;
  const zip = Buffer.isBuffer(source) ? source : readFileSync(source);
  // Fin du répertoire central : signature 0x06054b50, cherchée depuis la fin.
  let fin = zip.length - 22;
  while (fin >= 0 && zip.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error(`${chemin} : archive zip invalide`);
  const nombre = zip.readUInt16LE(fin + 10);
  let position = zip.readUInt32LE(fin + 16);
  const entrees = new Map();
  for (let i = 0; i < nombre; i++) {
    if (zip.readUInt32LE(position) !== 0x02014b50) throw new Error(`${chemin} : répertoire zip`);
    const methode = zip.readUInt16LE(position + 10);
    const taille = zip.readUInt32LE(position + 20);
    const longueurNom = zip.readUInt16LE(position + 28);
    const longueurExtra = zip.readUInt16LE(position + 30);
    const longueurCommentaire = zip.readUInt16LE(position + 32);
    const local = zip.readUInt32LE(position + 42);
    const nom = zip.toString('utf8', position + 46, position + 46 + longueurNom);
    const debutDonnees = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    if (garder(nom)) {
      const brut = zip.subarray(debutDonnees, debutDonnees + taille);
      entrees.set(nom, methode === 8 ? inflateRawSync(brut) : Buffer.from(brut));
    }
    position += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }
  return entrees;
}

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decoder = (texte) =>
  texte.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (entite, code) =>
    code[0] === '#'
      ? String.fromCodePoint(
          code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1)),
        )
      : (ENTITES[code] ?? entite),
  );

/** Colonne d'une référence de cellule : « AB12 » → 27 (index à partir de 0). */
function colonne(reference) {
  let n = 0;
  for (const c of reference.replace(/\d+$/, '')) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Feuilles d'un classeur (chemin ou contenu) : nom → tableau de lignes (tableaux de
 * valeurs : nombre, texte ou null). Les lignes et colonnes vides sont gardées à leur
 * place. `feuilles` limite la lecture aux feuilles retenues (gros classeurs).
 */
export function lireClasseur(source, { feuilles: retenues = () => true } = {}) {
  const contenu = Buffer.isBuffer(source) ? source : readFileSync(source);
  const zip = lireZip(contenu, (nom) => !nom.startsWith('xl/worksheets/'));
  const texte = (nom) => zip.get(nom)?.toString('utf8') ?? '';
  const partagees = [...texte('xl/sharedStrings.xml').matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
    decoder([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join('')),
  );
  const liens = new Map(
    [...texte('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*>/g)].map((m) => [
      /Id="([^"]+)"/.exec(m[0])[1],
      /Target="([^"]+)"/.exec(m[0])[1].replace(/^\/?(xl\/)?/, 'xl/'),
    ]),
  );
  const aLire = [...texte('xl/workbook.xml').matchAll(/<sheet [^>]*>/g)]
    .map((m) => ({
      nom: decoder(/name="([^"]*)"/.exec(m[0])[1]),
      fichier: liens.get(/r:id="([^"]+)"/.exec(m[0])[1]),
    }))
    .filter((f) => retenues(f.nom));
  const fichiers = new Set(aLire.map((f) => f.fichier));
  for (const [nom, donnees] of lireZip(contenu, (n) => fichiers.has(n))) zip.set(nom, donnees);
  const feuilles = new Map();
  for (const { nom, fichier } of aLire) {
    const lignes = [];
    for (const ligne of texte(fichier).matchAll(/<row [^>]*?r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
      const valeurs = [];
      for (const cellule of ligne[2].matchAll(/<c ([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
        const attributs = cellule[1];
        const reference = /r="([A-Z]+\d+)"/.exec(attributs)[1];
        const type = /t="(\w+)"/.exec(attributs)?.[1];
        const contenu = cellule[2] ?? '';
        const v = /<v>(.*?)<\/v>/s.exec(contenu)?.[1];
        let valeur = null;
        if (type === 's') valeur = partagees[Number(v)];
        else if (type === 'inlineStr')
          valeur = decoder(/<t[^>]*>(.*?)<\/t>/s.exec(contenu)?.[1] ?? '');
        else if (type === 'str') valeur = decoder(v ?? '');
        else if (v !== undefined) valeur = Number(v);
        valeurs[colonne(reference)] = valeur;
      }
      lignes[Number(ligne[1]) - 1] = Array.from(valeurs, (v) => v ?? null);
    }
    feuilles.set(
      nom,
      Array.from(lignes, (l) => l ?? []),
    );
  }
  return feuilles;
}
