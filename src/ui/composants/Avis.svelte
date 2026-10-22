<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Motif } from '../pictos';
  import Mosaique from './Mosaique.svelte';

  let {
    titre,
    annonce = false,
    grave = false,
    grandMoment = false,
    picto = null,
    anime = false,
    children,
  }: {
    titre: string;
    /** Annonce le contenu aux lecteurs d'écran quand il change. */
    annonce?: boolean;
    /** Événement grave : le cadre clignote (si les animations sont permises). */
    grave?: boolean;
    /** Grand moment de la vie : titre en double hauteur. */
    grandMoment?: boolean;
    picto?: Motif | null;
    anime?: boolean;
    children: Snippet;
  } = $props();
</script>

<section class="avis" class:clignote={grave && anime} aria-live={annonce ? 'polite' : undefined}>
  <div class="entete">
    {#if picto}<Mosaique motif={picto} />{/if}
    <h2 class="titre" class:double={grandMoment}>*** AVIS : {titre} ***</h2>
  </div>
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

  .entete {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .titre {
    color: var(--alerte);
    font-size: inherit;
    font-weight: normal;
  }

  /* Double hauteur Minitel : caractères étirés verticalement. */
  .double {
    display: inline-block;
    transform: scaleY(2);
    transform-origin: center;
    margin: 0.5em 0;
  }

  /* Trois clignotements du cadre pour un événement grave. */
  .clignote {
    animation: clignoter 0.5s steps(1) 3;
  }

  @keyframes clignoter {
    50% {
      border-color: var(--fond);
    }
  }
</style>
