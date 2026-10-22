<script lang="ts">
  import BarreTitre from './composants/BarreTitre.svelte';
</script>

<main class="ecran">
  <BarreTitre libelle="SOMMAIRE" />
</main>

<style>
  /* Colonne unique centrée : 390 px de référence, 480 px maximum. */
  .ecran {
    width: 100%;
    max-width: var(--largeur-max);
    min-height: 100dvh;
    margin: 0 auto;
    padding: var(--marge);
  }
</style>
