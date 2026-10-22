<script lang="ts">
  import type { EtatPartie } from '../../moteur/types';
  import BarreTitre from '../composants/BarreTitre.svelte';
  import LigneValeur from '../composants/LigneValeur.svelte';
  import Touche from '../composants/Touche.svelte';
  import { decile, libelle, minitel } from '../texte';

  let {
    partie,
    onretour,
    oncommencer,
  }: {
    partie: EtatPartie;
    onretour: () => void;
    oncommencer: () => void;
  } = $props();

  const origine = $derived(partie.personnage.origine);

  // Lignes dans l'ordre du tirage (règles, section 3).
  const lignes = $derived([
    { libelle: 'ANNEE', valeur: String(origine.anneeNaissance) },
    { libelle: 'SEXE', valeur: libelle('sexe', origine.sexe) },
    { libelle: 'REGION', valeur: libelle('region', origine.region) },
    { libelle: 'TERRITOIRE', valeur: libelle('territoire', origine.territoire) },
    { libelle: 'PARENTS', valeur: libelle('pcsParents', origine.pcsParents) },
    { libelle: 'DIPLOME PARENTS', valeur: libelle('diplomeParents', origine.diplomeParents) },
    { libelle: 'REVENU FOYER', valeur: decile(origine.decileRevenuFoyer) },
    { libelle: 'FAMILLE', valeur: libelle('structureFamiliale', origine.structureFamiliale) },
    { libelle: 'FRATRIE', valeur: libelle('fratrie', origine.fratrie) },
    { libelle: 'LOGEMENT', valeur: libelle('logementFamilial', origine.logementFamilial) },
    ...(origine.santeNaissance === 'normale'
      ? []
      : [{ libelle: 'SANTE', valeur: libelle('santeNaissance', origine.santeNaissance) }]),
  ]);
</script>

<BarreTitre libelle="NAISSANCE" />

<div class="contenu">
  <div class="zones">
    <section class="gauche">
      <p class="discret">TIRAGE EN COURS · GRAINE {partie.graine}</p>
      <h1 class="titre-valeur">{origine.sexe === 'femme' ? 'TU ES NEE.' : 'TU ES NE.'}</h1>
      <div class="lignes">
        {#each lignes as ligne (ligne.libelle)}
          <LigneValeur libelle={ligne.libelle} valeur={ligne.valeur} />
        {/each}
      </div>
    </section>

    <section class="droite">
      <div class="prenom">
        <p>TON PRENOM : <span class="valeur">{minitel(partie.personnage.prenom)}</span></p>
        <p class="discret">[N] BEBES SUR 100 NES EN {origine.anneeNaissance} PORTENT CE PRENOM.</p>
      </div>
      <p class="discret">TES TRAITS RESTENT CACHES.<br />TU LES DECOUVRIRAS EN VIVANT.</p>
    </section>
  </div>
</div>

<div class="touches">
  <Touche libelle="RETOUR" raccourci="ECHAP" onclick={onretour} />
  <Touche libelle="ENVOI · COMMENCER" raccourci="ENTREE" principale onclick={oncommencer} />
</div>

<style>
  .lignes {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .prenom {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border: 2px solid var(--valeur);
  }

  .valeur {
    color: var(--valeur);
  }
</style>
