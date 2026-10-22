<script lang="ts">
  let { libelle }: { libelle: string } = $props();
</script>

<header class="barre-titre">
  <span>3615 UNE VIE</span>
  <span>{libelle}</span>
</header>

<style>
  .barre-titre {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 2px 8px;
    background: var(--accent);
    color: var(--fond);
    font-size: var(--taille-barre);
    line-height: var(--interligne);
    text-transform: uppercase;
    white-space: nowrap;
  }

  @media (min-width: 900px) {
    .barre-titre {
      padding: 4px 32px;
    }
  }
</style>
