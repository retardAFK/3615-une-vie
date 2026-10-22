<script lang="ts">
  import type { EtatPartie } from '../../moteur/types';
  import BarreTitre from '../composants/BarreTitre.svelte';
  import Touche from '../composants/Touche.svelte';
  import { minitel } from '../texte';

  // Écran de fin provisoire : le bilan complet arrive au jalon 7.
  let {
    partie,
    onsommaire,
    onrevivre,
  }: {
    partie: EtatPartie;
    onsommaire: () => void;
    onrevivre: () => void;
  } = $props();

  const personnage = $derived(partie.personnage);
</script>

<BarreTitre libelle="FIN DE CONNEXION" />

<div class="contenu">
  <div class="zones pleine">
    <section class="gauche">
      <h1 class="titre-valeur">{minitel(personnage.prenom)}</h1>
      <p>
        {personnage.origine.anneeNaissance} - {partie.annee} · {personnage.age}
        {personnage.age > 1 ? 'ANS' : 'AN'}
      </p>
      <p class="discret">GRAINE {partie.graine}</p>
    </section>
  </div>
</div>

<div class="touches">
  <Touche libelle="SOMMAIRE" raccourci="S" onclick={onsommaire} />
  <Touche libelle="REVIVRE" raccourci="ENTREE" principale onclick={onrevivre} />
</div>
