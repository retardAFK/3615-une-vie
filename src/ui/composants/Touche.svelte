<script lang="ts">
  let {
    libelle,
    raccourci,
    principale = false,
    desactive = false,
    mention,
    onclick,
  }: {
    libelle: string;
    /** Affiché sur ordinateur seulement : « ENVOI (ENTREE) ». */
    raccourci?: string;
    /** Action principale (ENVOI) : plein accent. */
    principale?: boolean;
    desactive?: boolean;
    mention?: string;
    onclick?: () => void;
  } = $props();
</script>

<button class="touche" class:principale type="button" disabled={desactive} {onclick}>
  {libelle}{#if raccourci}<span class="raccourci">({raccourci})</span>{/if}
  {#if mention}<span class="mention">{mention}</span>{/if}
</button>

<style>
  .touche {
    flex: 1;
    min-height: var(--cible-tactile);
    padding: 4px 8px;
    border: 2px solid var(--accent);
    background: var(--fond);
    color: var(--accent);
    font-size: var(--taille-precision);
    cursor: pointer;
  }

  .touche:hover:not(:disabled) {
    background: var(--piste);
  }

  .principale,
  .principale:hover:not(:disabled) {
    background: var(--accent);
    color: var(--fond);
  }

  .touche:disabled {
    border-color: var(--pointilles);
    color: var(--texte-discret);
    cursor: not-allowed;
  }

  .mention {
    display: block;
    font-size: var(--taille-precision-petite);
  }

  .raccourci {
    display: none;
  }

  @media (min-width: 900px) {
    .raccourci {
      display: inline;
      margin-left: 0.5em;
    }
  }
</style>
