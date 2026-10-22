<script lang="ts">
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import ChampGraine from '../composants/ChampGraine.svelte';
  import Touche from '../composants/Touche.svelte';

  let {
    graine = $bindable(''),
    annee = $bindable(''),
    erreurGraine,
    erreurAnnee,
    onnouvellevie,
    onreglages,
  }: {
    graine?: string;
    annee?: string;
    erreurGraine: string | null;
    erreurAnnee: string | null;
    onnouvellevie: () => void;
    onreglages: () => void;
  } = $props();

  function soumettre(evenement: SubmitEvent): void {
    evenement.preventDefault();
    onnouvellevie();
  }
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
        <BoutonNumerote numero={4} libelle="REGLAGES" onclick={onreglages} />
      </nav>
      <!-- Entrée dans l'un ou l'autre champ lance NOUVELLE VIE. -->
      <form class="champs" onsubmit={soumettre}>
        <ChampGraine
          id="graine"
          libelle="REJOUER UNE GRAINE :"
          bind:valeur={graine}
          erreur={erreurGraine}
        />
        <ChampGraine
          id="annee"
          libelle="ANNEE DE NAISSANCE :"
          indication="VIDE = HASARD"
          bind:valeur={annee}
          erreur={erreurAnnee}
          maxlength={4}
          placeholder="...."
          numerique
        />
        <button type="submit" class="lecteur-seulement" tabindex="-1">NOUVELLE VIE</button>
      </form>
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

  .champs {
    display: flex;
    flex-direction: column;
    gap: var(--ecart-blocs);
  }

  .avertissement {
    color: var(--alerte);
    font-size: var(--taille-precision);
  }
</style>
