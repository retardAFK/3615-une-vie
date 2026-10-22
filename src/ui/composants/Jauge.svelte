<script lang="ts">
  let { libelle, valeur }: { libelle: string; valeur: number } = $props();

  const arrondie = $derived(Math.round(Math.min(100, Math.max(0, valeur))));
</script>

<div
  class="jauge"
  class:basse={arrondie < 50}
  role="meter"
  aria-label={libelle}
  aria-valuenow={arrondie}
  aria-valuemin={0}
  aria-valuemax={100}
>
  <span class="libelle">{libelle}</span>
  <span class="piste"><span class="remplissage" style:width="{arrondie}%"></span></span>
  <span class="valeur">{arrondie}</span>
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

  .valeur {
    flex: none;
    width: 2.2em;
    text-align: right;
    color: var(--couleur);
  }
</style>
