<script lang="ts">
  import type { EtatPartie, Jauges } from '../../moteur/types';
  import Avis from '../composants/Avis.svelte';
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import Jauge from '../composants/Jauge.svelte';
  import LigneValeur from '../composants/LigneValeur.svelte';
  import Touche from '../composants/Touche.svelte';
  import { libelle, minitel, montant } from '../texte';

  let {
    partie,
    auto,
    confirmation,
    onenvoi,
    onauto,
    onsommaire,
    onconfirmer,
  }: {
    partie: EtatPartie;
    auto: boolean;
    /** Encadré « QUITTER CETTE VIE ? » ouvert. */
    confirmation: boolean;
    onenvoi: () => void;
    onauto: () => void;
    onsommaire: () => void;
    onconfirmer: (quitter: boolean) => void;
  } = $props();

  const personnage = $derived(partie.personnage);
  const NOMS_JAUGES: (keyof Jauges)[] = [
    'santePhysique',
    'santeMentale',
    'bienEtre',
    'liens',
    'competences',
  ];
</script>

<BarreTitre libelle="TOUR {personnage.age}" />

<div class="contenu">
  <div class="zones">
    <section class="gauche">
      <div aria-live="polite" aria-atomic="true">
        <h1 class="titre-valeur">{partie.annee}</h1>
        <p>
          {minitel(personnage.prenom)} · {personnage.age}
          {personnage.age > 1 ? 'ANS' : 'AN'}
          <span class="lecteur-seulement">. AUCUN EVENEMENT CETTE ANNEE.</span>
        </p>
        <p class="discret">
          {libelle('sexe', personnage.origine.sexe)} · {libelle(
            'region',
            personnage.origine.region,
          )}
        </p>
      </div>
      <div class="jauges">
        {#each NOMS_JAUGES as nom (nom)}
          <Jauge libelle={libelle('jauges', nom)} valeur={personnage.jauges[nom]} />
        {/each}
      </div>
      <LigneValeur
        libelle="EPARGNE"
        valeur={montant(personnage.finances.epargne, partie.annee)}
        ton="valeur"
      />
    </section>

    <section class="droite">
      {#if confirmation}
        <Avis titre="SOMMAIRE" annonce>
          <p>QUITTER CETTE VIE ? ELLE NE SERA PAS SAUVEGARDEE.</p>
          <div class="choix">
            <BoutonNumerote numero={1} libelle="OUI, QUITTER" onclick={() => onconfirmer(true)} />
            <BoutonNumerote
              numero={2}
              libelle="NON, CONTINUER"
              onclick={() => onconfirmer(false)}
            />
          </div>
        </Avis>
      {:else}
        <Avis titre="QUOTIDIEN">
          <p>AUCUN EVENEMENT CETTE ANNEE.</p>
        </Avis>
      {/if}
    </section>
  </div>
</div>

<div class="touches">
  <Touche libelle="SOMMAIRE" raccourci="S" onclick={onsommaire} />
  <Touche libelle={auto ? 'PAUSE' : 'AUTO'} raccourci="A" onclick={onauto} />
  <Touche libelle="ENVOI" raccourci="ENTREE" principale onclick={onenvoi} />
</div>

<style>
  .jauges,
  .choix {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
