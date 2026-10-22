<script lang="ts">
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import ChampGraine from '../composants/ChampGraine.svelte';
  import Touche from '../composants/Touche.svelte';

  let {
    graine = $bindable(''),
    erreurGraine,
    onnouvellevie,
  }: {
    graine?: string;
    erreurGraine: string | null;
    onnouvellevie: () => void;
  } = $props();
</script>

<BarreTitre libelle="SOMMAIRE" />

<div class="contenu">
  <div class="zones">
    <section class="gauche">
      <h1 class="titre">UNE VIE<br />EN FRANCE</h1>
      <p>
        TU NAIS QUELQUE PART EN FRANCE, ENTRE 1950 ET 2010. TU NE CHOISIS NI TES PARENTS, NI TA
        VILLE.
      </p>
      <p class="discret">LE RESTE DEPEND DU HASARD ET UN PEU DE TOI.</p>
    </section>

    <section class="droite">
      <nav class="menu" aria-label="Menu">
        <BoutonNumerote numero={1} libelle="NOUVELLE VIE" onclick={onnouvellevie} />
        <BoutonNumerote numero={2} libelle="REPRENDRE" desactive mention="BIENTOT" />
        <BoutonNumerote numero={3} libelle="VIES PASSEES" desactive mention="BIENTOT" />
      </nav>
      <ChampGraine bind:valeur={graine} erreur={erreurGraine} onvalider={onnouvellevie} />
      <p class="avertissement">DECONSEILLE AUX MOINS DE 15 ANS</p>
    </section>
  </div>
</div>

<div class="touches">
  <Touche libelle="GUIDE" raccourci="G" desactive mention="BIENTOT" />
  <Touche libelle="ENVOI" raccourci="ENTREE" principale onclick={onnouvellevie} />
</div>

<style>
  .titre {
    color: var(--valeur);
    font-size: var(--taille-accueil);
    font-weight: normal;
    line-height: 1;
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .avertissement {
    color: var(--alerte);
    font-size: var(--taille-precision);
  }
</style>
