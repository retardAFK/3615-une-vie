<script lang="ts">
  import type { VieSauvee } from '../../stockage/parties';
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import Touche from '../composants/Touche.svelte';
  import { minitel } from '../texte';

  let {
    vies,
    onouvrir,
    onretour,
  }: {
    /** Vies passées, de la plus récente à la plus ancienne. */
    vies: readonly VieSauvee[];
    onouvrir: (rang: number) => void;
    onretour: () => void;
  } = $props();
</script>

<BarreTitre libelle="VIES PASSEES" />

<div class="contenu">
  {#if vies.length === 0}
    <p>AUCUNE VIE TERMINEE POUR L'INSTANT.</p>
  {:else}
    <p class="discret">CHOISIS UNE VIE POUR REVOIR SON BILAN.</p>
    <nav class="liste" aria-label="Vies passees">
      {#each vies as vie, i (vie.terminee)}
        <BoutonNumerote
          numero={i + 1}
          libelle="{minitel(vie.prenom)} · {vie.anneeNaissance}-{vie.anneeDeces} · {vie.age} ANS"
          onclick={() => onouvrir(i)}
        />
      {/each}
    </nav>
  {/if}
</div>

<div class="touches">
  <Touche libelle="RETOUR" raccourci="ECHAP" principale onclick={onretour} />
</div>

<style>
  .liste {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
