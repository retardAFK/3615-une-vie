<script lang="ts">
  let {
    numero,
    libelle,
    onclick,
    desactive = false,
    mention,
  }: {
    numero: number;
    libelle: string;
    onclick?: () => void;
    desactive?: boolean;
    /** Précision affichée à droite, par exemple « BIENTOT ». */
    mention?: string;
  } = $props();
</script>

<button class="bouton" type="button" disabled={desactive} {onclick}>
  <span class="pastille" aria-hidden="true">{numero}</span>
  <span class="libelle">{libelle}</span>
  {#if mention}<span class="mention">{mention}</span>{/if}
</button>

<style>
  .bouton {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: var(--cible-tactile);
    padding: 6px 8px;
    border: 1px solid var(--texte);
    background: var(--fond);
    text-align: left;
    cursor: pointer;
  }

  .bouton:hover:not(:disabled) {
    background: var(--piste);
  }

  .pastille {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 1.2em;
    padding: 0 3px;
    background: var(--texte);
    color: var(--fond);
  }

  .libelle {
    flex: 1;
  }

  .mention {
    font-size: var(--taille-precision);
  }

  .bouton:disabled {
    border-color: var(--pointilles);
    color: var(--texte-discret);
    cursor: not-allowed;
  }

  .bouton:disabled .pastille {
    background: var(--texte-discret);
  }
</style>
