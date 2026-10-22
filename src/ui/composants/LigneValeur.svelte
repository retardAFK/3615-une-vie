<script lang="ts">
  let {
    libelle,
    valeur,
    ton = 'accent',
  }: {
    libelle: string;
    valeur: string;
    /** Couleur de la valeur : accent (par défaut) ou jaune pour les valeurs importantes. */
    ton?: 'accent' | 'valeur';
  } = $props();
</script>

<div class="ligne">
  <span class="libelle">{libelle}</span>
  <span class="points" aria-hidden="true"></span>
  <span class="valeur" class:importante={ton === 'valeur'}>{valeur}</span>
</div>

<style>
  .ligne {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .libelle {
    flex: none;
  }

  .points {
    flex: 1;
    min-width: 12px;
    border-bottom: 2px dotted var(--pointilles);
  }

  .valeur {
    color: var(--accent);
    text-align: right;
  }

  .importante {
    color: var(--valeur);
  }
</style>
