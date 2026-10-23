<script lang="ts">
  // Champ de saisie Minitel : libellé accent, saisie jaune sur soulignement pointillé.
  // Sert au seed et à l'année de naissance ; le formulaire est fourni par l'écran.
  let {
    id,
    libelle,
    valeur = $bindable(''),
    erreur = null,
    indication,
    maxlength = 16,
    placeholder = '........',
    numerique = false,
    focus = false,
  }: {
    id: string;
    libelle: string;
    valeur?: string;
    erreur?: string | null;
    /** Précision affichée sous le libellé, par exemple « VIDE = HASARD ». */
    indication?: string;
    maxlength?: number;
    placeholder?: string;
    /** Clavier numérique sur mobile. */
    numerique?: boolean;
    /** Le curseur va dans le champ dès qu'il apparaît. */
    focus?: boolean;
  } = $props();

  let champ = $state<HTMLInputElement>();
  $effect(() => {
    if (focus) champ?.focus();
  });

  const decrit = $derived(
    [indication ? `${id}-indication` : '', erreur ? `${id}-erreur` : ''].join(' ').trim(),
  );
</script>

<div class="champ">
  <label for={id}>{libelle}</label>
  {#if indication}<p id="{id}-indication" class="indication">{indication}</p>{/if}
  <input
    bind:this={champ}
    {id}
    bind:value={valeur}
    {maxlength}
    {placeholder}
    inputmode={numerique ? 'numeric' : undefined}
    autocomplete="off"
    autocapitalize="characters"
    spellcheck="false"
    aria-describedby={decrit || undefined}
    aria-invalid={erreur ? 'true' : undefined}
  />
  {#if erreur}<p id="{id}-erreur" class="erreur" role="alert">{erreur}</p>{/if}
</div>

<style>
  .champ {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    color: var(--accent);
  }

  .indication {
    color: var(--texte-discret);
    font-size: var(--taille-precision);
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
