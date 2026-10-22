// Tables de travail de public/data/, assemblées pour les tests.

import type { Tables } from '../../src/moteur/types';
import anneeNaissance from '../../public/data/anneeNaissance.json';
import decileRevenuFoyer from '../../public/data/decileRevenuFoyer.json';
import diplomeParents from '../../public/data/diplomeParents.json';
import fratrie from '../../public/data/fratrie.json';
import logementFamilial from '../../public/data/logementFamilial.json';
import mortalite from '../../public/data/mortalite.json';
import origineMigratoire from '../../public/data/origineMigratoire.json';
import pcsParents from '../../public/data/pcsParents.json';
import prenoms from '../../public/data/prenoms.json';
import region from '../../public/data/region.json';
import santeNaissance from '../../public/data/santeNaissance.json';
import sexe from '../../public/data/sexe.json';
import structureFamiliale from '../../public/data/structureFamiliale.json';
import territoire from '../../public/data/territoire.json';

// TypeScript type un tableau JSON hétérogène comme une union où les clés absentes
// valent « ?: undefined », ce que Tables refuse. Les JSON n'en contiennent pas
// à l'exécution : la conversion est sûre, et les tests vérifient les valeurs tirées.
export const TABLES = {
  anneeNaissance,
  sexe,
  region,
  territoire,
  pcsParents,
  diplomeParents,
  decileRevenuFoyer,
  structureFamiliale,
  fratrie,
  logementFamilial,
  origineMigratoire,
  santeNaissance,
  prenoms,
  mortalite,
} as unknown as Tables;
