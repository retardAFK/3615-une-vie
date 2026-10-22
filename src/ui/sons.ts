// Sons optionnels, générés en WebAudio (aucun fichier), désactivés par défaut.

export type NomSon = 'touche' | 'connexion' | 'annee' | 'grave' | 'fin';

export interface Note {
  /** Fréquence en hertz. */
  frequence: number;
  /** Début et durée, en millisecondes. */
  debut: number;
  duree: number;
}

/** Partitions courtes, à la manière des bips et du modem d'un Minitel. */
export const PARTITIONS: Readonly<Record<NomSon, readonly Note[]>> = {
  touche: [{ frequence: 1200, debut: 0, duree: 35 }],
  annee: [{ frequence: 880, debut: 0, duree: 25 }],
  connexion: [
    { frequence: 1300, debut: 0, duree: 180 },
    { frequence: 2100, debut: 200, duree: 180 },
    { frequence: 1650, debut: 400, duree: 260 },
  ],
  grave: [
    { frequence: 330, debut: 0, duree: 160 },
    { frequence: 220, debut: 180, duree: 320 },
  ],
  fin: [
    { frequence: 660, debut: 0, duree: 180 },
    { frequence: 440, debut: 200, duree: 180 },
    { frequence: 330, debut: 400, duree: 420 },
  ],
};

let contexte: AudioContext | null = null;

/** Joue un son si les sons sont activés ; silencieux si WebAudio est indisponible. */
export function jouerSon(nom: NomSon, active: boolean): void {
  if (!active) return;
  try {
    contexte ??= new AudioContext();
    if (contexte.state === 'suspended') void contexte.resume();
    const debut = contexte.currentTime;
    for (const note of PARTITIONS[nom]) {
      const oscillateur = contexte.createOscillator();
      const volume = contexte.createGain();
      oscillateur.type = 'square';
      oscillateur.frequency.value = note.frequence;
      const t0 = debut + note.debut / 1000;
      const t1 = t0 + note.duree / 1000;
      volume.gain.setValueAtTime(0.04, t0);
      volume.gain.linearRampToValueAtTime(0, t1);
      oscillateur.connect(volume).connect(contexte.destination);
      oscillateur.start(t0);
      oscillateur.stop(t1);
    }
  } catch {
    // Navigateur sans WebAudio : le jeu reste muet.
  }
}
