<script lang="ts">
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import ChampGraine from '../composants/ChampGraine.svelte';
  import Touche from '../composants/Touche.svelte';

  // Lancement d'une vie : l'année de naissance est laissée au hasard (pondérée par les
  // naissances réelles) ou choisie dans les bornes de la table des naissances.
  let {
    min,
    max,
    choisir = $bindable(false),
    annee = $bindable(''),
    erreur = null,
    onhasard,
    onvalider,
    onretour,
  }: {
    min: number;
    max: number;
    /** Le joueur a choisi de donner son année : le champ est affiché. */
    choisir?: boolean;
    annee?: string;
    erreur?: string | null;
    onhasard: () => void;
    onvalider: () => void;
    onretour: () => void;
  } = $props();

  function soumettre(evenement: SubmitEvent): void {
    evenement.preventDefault();
    onvalider();
  }
</script>

<BarreTitre libelle="NOUVELLE VIE" />

<div class="contenu">
  <div class="zones">
    <section class="gauche">
      <h1 class="titre-valeur">EN QUELLE ANNEE NAIS-TU ?</h1>
      <p class="discret">LE HASARD SUIT LES NAISSANCES REELLES DE CHAQUE ANNEE.</p>
    </section>

    <section class="droite">
      <nav class="menu" aria-label="Annee de naissance">
        <BoutonNumerote numero={1} libelle="LAISSER LE HASARD" onclick={onhasard} />
        <BoutonNumerote
          numero={2}
          libelle="CHOISIR MON ANNEE"
          selectionne={choisir}
          onclick={() => (choisir = true)}
        />
      </nav>
      {#if choisir}
        <form class="champs" onsubmit={soumettre}>
          <ChampGraine
            id="annee"
            libelle="ANNEE DE NAISSANCE :"
            indication="DE {min} A {max}"
            bind:valeur={annee}
            {erreur}
            maxlength={4}
            placeholder="...."
            numerique
            focus
          />
          <button type="submit" class="lecteur-seulement" tabindex="-1">COMMENCER</button>
        </form>
      {/if}
    </section>
  </div>
</div>

<div class="touches">
  <Touche libelle="RETOUR" raccourci="ECHAP" onclick={onretour} />
  <Touche
    libelle={choisir ? 'ENVOI · NAITRE' : 'ENVOI · HASARD'}
    raccourci="ENTREE"
    principale
    onclick={choisir ? onvalider : onhasard}
  />
</div>

<style>
  .menu,
  .champs {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .champs {
    margin-top: 16px;
  }
</style>
