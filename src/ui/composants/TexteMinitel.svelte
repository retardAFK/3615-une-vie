<script lang="ts">
  import { caracteresVisibles, dureeRevelation } from '../revelation';

  // Texte révélé caractère par caractère, avec un curseur, comme sur un Minitel.
  // Le texte complet reste toujours lisible par les lecteurs d'écran.
  let {
    texte,
    msParCaractere = 0,
    delai = 0,
  }: {
    texte: string;
    /** 0 : texte affiché d'un coup. */
    msParCaractere?: number;
    /** Attente avant le premier caractère, en millisecondes. */
    delai?: number;
  } = $props();

  let visibles = $state(0);

  $effect(() => {
    const longueur = texte.length;
    const ms = msParCaractere;
    const attente = delai;
    if (ms <= 0) {
      visibles = longueur;
      return;
    }
    visibles = 0;
    const debut = performance.now() + attente;
    const fin = debut + dureeRevelation(longueur, ms);
    let image = 0;
    const avancer = (maintenant: number): void => {
      visibles = caracteresVisibles(longueur, maintenant - debut, ms);
      if (maintenant < fin) image = requestAnimationFrame(avancer);
    };
    image = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(image);
  });

  const enCours = $derived(visibles < texte.length);
</script>

<span class="lecteur-seulement">{texte}</span><span aria-hidden="true"
  >{texte.slice(0, visibles)}{#if enCours}<span class="curseur">█</span>{/if}</span
>

<style>
  .curseur {
    animation: curseur 0.6s steps(1) infinite;
  }

  @keyframes curseur {
    50% {
      opacity: 0;
    }
  }
</style>
