<script lang="ts">
  import type { Motif } from '../pictos';

  // Pictogramme en blocs, façon semi-graphique Minitel. Purement décoratif.
  let { motif }: { motif: Motif } = $props();

  const blocs = $derived(motif.flatMap((ligne) => [...ligne].map((c) => c === '#')));
</script>

<span class="mosaique" style:--colonnes={motif[0]?.length ?? 0} aria-hidden="true">
  {#each blocs as allume, i (i)}<span class="bloc" class:allume></span>{/each}
</span>

<style>
  .mosaique {
    flex: none;
    display: inline-grid;
    grid-template-columns: repeat(var(--colonnes), 4px);
    grid-auto-rows: 4px;
  }

  .allume {
    background: var(--accent);
  }
</style>
