<script lang="ts">
  import BarreTitre from '../composants/BarreTitre.svelte';
  import TexteMinitel from '../composants/TexteMinitel.svelte';
  import Touche from '../composants/Touche.svelte';
  import { dureeRevelation } from '../revelation';

  // Séquence de connexion, pendant le chargement des données. Passable avec ENVOI.
  let {
    prete,
    msParCaractere,
    onterminee,
  }: {
    /** Données chargées : la connexion peut aboutir. */
    prete: boolean;
    msParCaractere: number;
    onterminee: () => void;
  } = $props();

  const LIGNES = ['APPEL DU 3615...', 'TONALITE.', 'CONNEXION AU SERVICE UNE VIE...'];
  const FIN = 'CONNECTE.';

  /** Pause entre deux lignes, seulement quand le texte s'anime. */
  const pause = $derived(msParCaractere > 0 ? 150 : 0);

  /** Début de chaque ligne : chacune attend la fin de la précédente. */
  const delais = $derived.by(() => {
    let t = 0;
    return LIGNES.map((ligne) => {
      const debutLigne = t;
      t += dureeRevelation(ligne.length, msParCaractere) + pause;
      return debutLigne;
    });
  });
  const finSequence = $derived(
    LIGNES.reduce((t, ligne) => t + dureeRevelation(ligne.length, msParCaractere) + pause, 0),
  );

  const debut = performance.now();

  // Une fois les données chargées et la séquence affichée, l'accueil arrive seul.
  $effect(() => {
    if (!prete) return;
    const reste =
      finSequence + dureeRevelation(FIN.length, msParCaractere) + 500 - (performance.now() - debut);
    const minuterie = setTimeout(onterminee, Math.max(0, reste));
    return () => clearTimeout(minuterie);
  });
</script>

<BarreTitre libelle="CONNEXION" />

<div class="contenu" aria-live="polite">
  <div class="lignes">
    {#each LIGNES as ligne, i (ligne)}
      <p><TexteMinitel texte={ligne} {msParCaractere} delai={delais[i]} /></p>
    {/each}
    {#if prete}
      <p class="connecte">
        <TexteMinitel
          texte={FIN}
          {msParCaractere}
          delai={Math.max(0, finSequence - (performance.now() - debut))}
        />
      </p>
    {/if}
  </div>
</div>

<div class="touches">
  <Touche libelle="PASSER" raccourci="ENTREE" principale onclick={onterminee} />
</div>

<style>
  .lignes {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .connecte {
    color: var(--valeur);
  }
</style>
