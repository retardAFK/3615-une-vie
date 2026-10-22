// Raccourcis clavier (docs/design-minitel.md, section « Clavier »).

export type Action =
  | { type: 'choix'; numero: number }
  | { type: 'envoi' }
  | { type: 'retour' }
  | { type: 'sommaire' }
  | { type: 'auto' }
  | { type: 'guide' };

export interface Touche {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/** Traduit une touche en action, ou null. Inactif dans un champ de saisie. */
export function actionClavier(touche: Touche, dansChampSaisie: boolean): Action | null {
  if (dansChampSaisie || touche.ctrlKey || touche.altKey || touche.metaKey) return null;
  if (/^[1-9]$/.test(touche.key)) return { type: 'choix', numero: Number(touche.key) };
  switch (touche.key) {
    case 'Enter':
      return { type: 'envoi' };
    case 'Escape':
      return { type: 'retour' };
    case 's':
    case 'S':
      return { type: 'sommaire' };
    case 'a':
    case 'A':
      return { type: 'auto' };
    case 'g':
    case 'G':
      return { type: 'guide' };
    default:
      return null;
  }
}
