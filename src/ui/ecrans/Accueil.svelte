<script lang="ts">
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import ChampGraine from '../composants/ChampGraine.svelte';
  import Touche from '../composants/Touche.svelte';
  import { minitel } from '../texte';

  let {
    graine = $bindable(''),
    erreurGraine,
    enCours = null,
    nombreVies = 0,
    onnouvellevie,
    onreprendre,
    onvies,
    onreglages,
  }: {
    graine?: string;
    erreurGraine: string | null;
    /** Partie sauvegardée, à reprendre : prénom et âge. */
    enCours?: { prenom: string; age: number } | null;
    nombreVies?: number;
    onnouvellevie: () => void;
    onreprendre: () => void;
    onvies: () => void;
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
        {#if enCours}
          <BoutonNumerote
            numero={2}
            libelle="REPRENDRE {minitel(enCours.prenom)} · {enCours.age} ANS"
            onclick={onreprendre}
          />
        {:else}
          <BoutonNumerote numero={2} libelle="REPRENDRE" desactive mention="AUCUNE PARTIE" />
        {/if}
        <BoutonNumerote
          numero={3}
          libelle="VIES PASSEES"
          desactive={nombreVies === 0}
          mention={nombreVies > 0 ? String(nombreVies) : undefined}
          onclick={onvies}
        />
        <BoutonNumerote numero={4} libelle="REGLAGES" onclick={onreglages} />
      </nav>
      <!-- Entrée dans le champ lance NOUVELLE VIE (puis le choix de l'année). -->
      <form class="champs" onsubmit={soumettre}>
        <ChampGraine
          id="graine"
          libelle="REJOUER UN SEED :"
          indication="VIDE = NOUVEAU SEED"
          bind:valeur={graine}
          erreur={erreurGraine}
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
