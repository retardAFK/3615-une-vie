<script lang="ts">
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import Touche from '../composants/Touche.svelte';
  import type { Reglages, Vitesse } from '../reglages';

  let {
    reglages,
    mouvementReduit,
    onchanger,
    onretour,
  }: {
    reglages: Reglages;
    mouvementReduit: boolean;
    /** 1 : vitesse suivante ; 2 : sons activés ou coupés. */
    onchanger: (numero: number) => void;
    onretour: () => void;
  } = $props();

  const NOMS_VITESSE: Readonly<Record<Vitesse, string>> = {
    lente: 'LENTE',
    normale: 'NORMALE',
    rapide: 'RAPIDE',
    instantanee: 'INSTANTANEE',
  };
</script>

<BarreTitre libelle="REGLAGES" />

<div class="contenu">
  <div class="zones">
    <section class="gauche">
      <h1 class="titre-valeur">REGLAGES</h1>
      <p class="discret">
        LES ANIMATIONS SONT TOUJOURS COUPEES EN MODE AUTO, ET QUAND TON SYSTEME DEMANDE MOINS DE
        MOUVEMENT.
      </p>
      {#if mouvementReduit}
        <p class="avertissement">MOUVEMENT REDUIT ACTIF : TEXTES AFFICHES D'UN COUP.</p>
      {/if}
    </section>
    <section class="droite">
      <div class="pile">
        <BoutonNumerote
          numero={1}
          libelle="VITESSE D'AFFICHAGE : {NOMS_VITESSE[reglages.vitesse]}"
          onclick={() => onchanger(1)}
        />
        <BoutonNumerote
          numero={2}
          libelle="SONS : {reglages.sons ? 'OUI' : 'NON'}"
          selectionne={reglages.sons}
          onclick={() => onchanger(2)}
        />
      </div>
    </section>
  </div>
</div>

<div class="touches">
  <Touche libelle="RETOUR" raccourci="ECHAP" principale onclick={onretour} />
</div>

<style>
  .pile {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .avertissement {
    color: var(--alerte);
    font-size: var(--taille-precision);
  }
</style>
