<script lang="ts">
  let {
    libelle,
    valeur,
    anime = false,
  }: {
    libelle: string;
    valeur: number;
    /** Remplissage animé et écart affiché quelques instants après un changement. */
    anime?: boolean;
  } = $props();

  const arrondie = $derived(Math.round(Math.min(100, Math.max(0, valeur))));

  /** Écart avec la valeur précédente, affiché 1,5 s. */
  let ecart = $state(0);
  let precedente: number | null = null;
  let minuterie: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const actuelle = arrondie;
    if (anime && precedente !== null && actuelle !== precedente) {
      ecart = actuelle - precedente;
      clearTimeout(minuterie);
      minuterie = setTimeout(() => (ecart = 0), 1500);
    } else if (!anime) {
      ecart = 0;
    }
    precedente = actuelle;
  });

  $effect(() => () => clearTimeout(minuterie));
</script>

<div
  class="jauge"
  class:basse={arrondie < 50}
  class:anime
  role="meter"
  aria-label={libelle}
  aria-valuenow={arrondie}
  aria-valuemin={0}
  aria-valuemax={100}
>
  <span class="libelle">{libelle}</span>
  <span class="piste"><span class="remplissage" style:width="{arrondie}%"></span></span>
  <span class="valeur">{arrondie}</span>
  <span class="ecart" class:hausse={ecart > 0} aria-hidden="true"
    >{ecart === 0 ? '' : `${ecart > 0 ? '+' : ''}${ecart}`}</span
  >
</div>

<style>
  .jauge {
    --couleur: var(--bien);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .basse {
    --couleur: var(--alerte);
  }

  .libelle {
    flex: none;
    width: 96px;
  }

  .piste {
    flex: 1;
    height: 16px;
    background: var(--piste);
  }

  .remplissage {
    display: block;
    height: 100%;
    background: repeating-linear-gradient(90deg, var(--couleur) 0 18px, var(--fond) 18px 22px);
  }

  /* Remplissage par à-coups, comme un écran qui se redessine. */
  .anime .remplissage {
    transition: width 400ms steps(6);
  }

  .valeur {
    flex: none;
    width: 2.2em;
    text-align: right;
    color: var(--couleur);
  }

  .ecart {
    flex: none;
    width: 2.2em;
    color: var(--alerte);
    font-size: var(--taille-precision);
  }

  .hausse {
    color: var(--bien);
  }
</style>
