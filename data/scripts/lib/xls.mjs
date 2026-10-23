// Lecteur xls (Excel 97-2003) minimal, sans dépendance : un fichier composé OLE2 contient
// le flux « Workbook » au format BIFF8. On lit les enregistrements de cellules (nombres,
// RK, chaînes partagées, formules à résultat numérique) de chaque feuille. Suffisant pour
// les tableaux de l'Insee et de l'IGEDD ; pas de styles ni de formules à recalculer.

import { readFileSync } from 'node:fs';

const FIN_CHAINE = 0xfffffffe;

/** Flux nommé d'un fichier composé OLE2 (secteurs normaux ou mini-flux). */
function lireFlux(fichier, nom) {
  const taille = 1 << fichier.readUInt16LE(30);
  const tailleMini = 1 << fichier.readUInt16LE(32);
  const secteursFat = fichier.readUInt32LE(44);
  const premierRepertoire = fichier.readUInt32LE(48);
  const seuilMini = fichier.readUInt32LE(56);
  const premierMiniFat = fichier.readUInt32LE(60);
  let premierDifat = fichier.readUInt32LE(68);
  const secteur = (n) => fichier.subarray(512 + n * taille, 512 + (n + 1) * taille);

  // Table d'allocation : les 109 premiers secteurs dans l'en-tête, puis la chaîne DIFAT.
  const secteursDeFat = [];
  for (let i = 0; i < 109 && secteursDeFat.length < secteursFat; i++) {
    secteursDeFat.push(fichier.readUInt32LE(76 + 4 * i));
  }
  while (secteursDeFat.length < secteursFat && premierDifat < FIN_CHAINE) {
    const s = secteur(premierDifat);
    for (let i = 0; i < taille / 4 - 1 && secteursDeFat.length < secteursFat; i++) {
      secteursDeFat.push(s.readUInt32LE(4 * i));
    }
    premierDifat = s.readUInt32LE(taille - 4);
  }
  const fat = [];
  for (const n of secteursDeFat) {
    const s = secteur(n);
    for (let i = 0; i < taille / 4; i++) fat.push(s.readUInt32LE(4 * i));
  }
  const chaine = (debut, table, lire) => {
    const morceaux = [];
    for (let n = debut; n < FIN_CHAINE && morceaux.length <= table.length; n = table[n]) {
      morceaux.push(lire(n));
    }
    return Buffer.concat(morceaux);
  };
  const repertoire = chaine(premierRepertoire, fat, secteur);
  const entrees = [];
  for (let i = 0; i + 128 <= repertoire.length; i += 128) {
    const longueur = repertoire.readUInt16LE(i + 64);
    entrees.push({
      nom: repertoire.toString('utf16le', i, i + Math.max(0, longueur - 2)),
      debut: repertoire.readUInt32LE(i + 116),
      taille: repertoire.readUInt32LE(i + 120),
    });
  }
  const entree = entrees.find((e) => e.nom === nom);
  if (!entree) throw new Error(`Flux ${nom} absent`);
  if (entree.taille >= seuilMini) {
    return chaine(entree.debut, fat, secteur).subarray(0, entree.taille);
  }
  // Petit flux : dans le mini-flux, porté par l'entrée racine.
  const miniFlux = chaine(entrees[0].debut, fat, secteur);
  const miniFat = [];
  const blocMiniFat = chaine(premierMiniFat, fat, secteur);
  for (let i = 0; i < blocMiniFat.length / 4; i++) miniFat.push(blocMiniFat.readUInt32LE(4 * i));
  const mini = (n) => miniFlux.subarray(n * tailleMini, (n + 1) * tailleMini);
  return chaine(entree.debut, miniFat, mini).subarray(0, entree.taille);
}

/** Valeur RK : entier ou flottant compressé, éventuellement divisé par 100. */
function rk(valeur) {
  const centiemes = valeur & 1;
  let nombre;
  if (valeur & 2) nombre = valeur >> 2;
  else {
    const tampon = Buffer.alloc(8);
    tampon.writeInt32LE(valeur & 0xfffffffc, 4);
    nombre = tampon.readDoubleLE(0);
  }
  return centiemes ? nombre / 100 : nombre;
}

/**
 * Chaîne Unicode BIFF8 (longueur, options, caractères) à partir d'une position ; renvoie
 * le texte et la position suivante. Les chaînes de la table partagée peuvent être coupées
 * par des enregistrements CONTINUE : `morceaux` donne les limites à franchir.
 */
function lireChaine(donnees, position, longueurOctets = 2, limites = []) {
  let nombre = longueurOctets === 2 ? donnees.readUInt16LE(position) : donnees[position];
  position += longueurOctets;
  let options = donnees[position++];
  const runs = options & 0x08 ? donnees.readUInt16LE(position) : 0;
  if (options & 0x08) position += 2;
  const extension = options & 0x04 ? donnees.readUInt32LE(position) : 0;
  if (options & 0x04) position += 4;
  let texte = '';
  while (nombre > 0) {
    const limite = limites.find((l) => l > position) ?? donnees.length;
    const large = options & 0x01;
    const disponibles = Math.floor((limite - position) / (large ? 2 : 1));
    const pris = Math.min(nombre, disponibles);
    texte += large
      ? donnees.toString('utf16le', position, position + 2 * pris)
      : donnees.toString('latin1', position, position + pris);
    position += pris * (large ? 2 : 1);
    nombre -= pris;
    if (nombre > 0) options = donnees[position++]; // octet d'options en tête du CONTINUE
  }
  return { texte, position: position + 4 * runs + extension };
}

/** Feuilles d'un classeur xls : nom → lignes (valeurs nombre, texte ou null). */
export function lireClasseurXls(chemin) {
  const flux = lireFlux(readFileSync(chemin), 'Workbook');
  const enregistrements = [];
  for (let p = 0; p + 4 <= flux.length;) {
    const type = flux.readUInt16LE(p);
    const longueur = flux.readUInt16LE(p + 2);
    enregistrements.push({ type, debut: p, donnees: flux.subarray(p + 4, p + 4 + longueur) });
    p += 4 + longueur;
  }
  // Table des chaînes partagées (SST, 0x00FC) et ses CONTINUE (0x003C).
  const partagees = [];
  const indexSst = enregistrements.findIndex((e) => e.type === 0x00fc);
  if (indexSst !== -1) {
    const morceaux = [enregistrements[indexSst].donnees];
    for (let i = indexSst + 1; enregistrements[i]?.type === 0x003c; i++) {
      morceaux.push(enregistrements[i].donnees);
    }
    const limites = [];
    let cumul = 0;
    for (const m of morceaux) {
      cumul += m.length;
      limites.push(cumul);
    }
    const sst = Buffer.concat(morceaux);
    const total = sst.readUInt32LE(4);
    let position = 8;
    for (let i = 0; i < total && position < sst.length; i++) {
      const { texte, position: suivante } = lireChaine(sst, position, 2, limites);
      partagees.push(texte);
      position = suivante;
    }
  }
  // Feuilles (BOUNDSHEET, 0x0085) : nom et position de leur BOF dans le flux.
  const feuilles = new Map();
  const declarations = enregistrements
    .filter((e) => e.type === 0x0085)
    .map((e) => ({
      position: e.donnees.readUInt32LE(0),
      nom: lireChaine(e.donnees, 6, 1).texte,
    }));
  for (const { position, nom } of declarations) {
    const lignes = [];
    const poser = (ligne, colonne, valeur) => {
      lignes[ligne] ??= [];
      lignes[ligne][colonne] = valeur;
    };
    let i = enregistrements.findIndex((e) => e.debut === position) + 1;
    for (; i < enregistrements.length && enregistrements[i].type !== 0x000a; i++) {
      const { type, donnees: d } = enregistrements[i];
      if (type === 0x0203) poser(d.readUInt16LE(0), d.readUInt16LE(2), d.readDoubleLE(6));
      else if (type === 0x027e) poser(d.readUInt16LE(0), d.readUInt16LE(2), rk(d.readInt32LE(6)));
      else if (type === 0x00fd)
        poser(d.readUInt16LE(0), d.readUInt16LE(2), partagees[d.readUInt32LE(6)]);
      else if (type === 0x00bd) {
        const ligne = d.readUInt16LE(0);
        const premiere = d.readUInt16LE(2);
        const nombre = (d.length - 6) / 6;
        for (let k = 0; k < nombre; k++) poser(ligne, premiere + k, rk(d.readInt32LE(6 + 6 * k)));
      } else if (type === 0x0006 && d.readUInt16LE(12) !== 0xffff) {
        poser(d.readUInt16LE(0), d.readUInt16LE(2), d.readDoubleLE(6));
      } else if (type === 0x0204) {
        poser(d.readUInt16LE(0), d.readUInt16LE(2), lireChaine(d, 6, 2).texte);
      }
    }
    feuilles.set(
      nom,
      Array.from(lignes, (l) => Array.from(l ?? [], (v) => v ?? null)),
    );
  }
  return feuilles;
}
