<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    titre,
    annonce = false,
    children,
  }: {
    titre: string;
    /** Annonce le contenu aux lecteurs d'écran quand il change. */
    annonce?: boolean;
    children: Snippet;
  } = $props();
</script>

<section class="avis" aria-live={annonce ? 'polite' : undefined}>
  <h2 class="titre">*** AVIS : {titre} ***</h2>
  {@render children()}
</section>

<style>
  .avis {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border: 2px solid var(--alerte);
  }

  .titre {
    color: var(--alerte);
    font-size: inherit;
    font-weight: normal;
  }
</style>
