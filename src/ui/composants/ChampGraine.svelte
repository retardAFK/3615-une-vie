<script lang="ts">
  let {
    valeur = $bindable(''),
    erreur = null,
    onvalider,
  }: {
    valeur?: string;
    erreur?: string | null;
    /** Entrée dans le champ. */
    onvalider: () => void;
  } = $props();

  function soumettre(evenement: SubmitEvent): void {
    evenement.preventDefault();
    onvalider();
  }
</script>

<form class="champ" onsubmit={soumettre}>
  <label for="graine">REJOUER UNE GRAINE :</label>
  <input
    id="graine"
    bind:value={valeur}
    maxlength="16"
    autocomplete="off"
    autocapitalize="characters"
    spellcheck="false"
    placeholder="........"
    aria-describedby={erreur ? 'graine-erreur' : undefined}
    aria-invalid={erreur ? 'true' : undefined}
  />
  {#if erreur}<p id="graine-erreur" class="erreur" role="alert">{erreur}</p>{/if}
</form>

<style>
  .champ {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    color: var(--accent);
  }

  input {
    width: 100%;
    min-height: var(--cible-tactile);
    padding: 0 4px;
    border: none;
    border-bottom: 2px dotted var(--pointilles);
    background: transparent;
    color: var(--valeur);
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }

  input::placeholder {
    color: var(--valeur);
    opacity: 0.6;
  }

  .erreur {
    color: var(--alerte);
    font-size: var(--taille-precision);
  }
</style>
