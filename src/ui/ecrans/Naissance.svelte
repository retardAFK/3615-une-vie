<script lang="ts">
  import type { EtatPartie } from '../../moteur/types';
  import BarreTitre from '../composants/BarreTitre.svelte';
  import LigneValeur from '../composants/LigneValeur.svelte';
  import TexteMinitel from '../composants/TexteMinitel.svelte';
  import Touche from '../composants/Touche.svelte';
  import { decile, libelle, minitel } from '../texte';

  let {
    partie,
    frequence = null,
    msParCaractere = 0,
    onretour,
    oncommencer,
  }: {
    partie: EtatPartie;
    /** Bébés sur 1 000 nés du même sexe dans la décennie qui ont reçu ce prénom. */
    frequence?: number | null;
    /** Révélation du titre ; les lignes de l'origine apparaissent ensuite une à une. */
    msParCaractere?: number;
    onretour: () => void;
    oncommencer: () => void;
  } = $props();

  const origine = $derived(partie.personnage.origine);
  const decennie = $derived(Math.floor(origine.anneeNaissance / 10) * 10);
  /** « 52 », ou « 2,3 » sous 10 (virgule décimale). */
  const frequenceTexte = (n: number): string =>
    n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',');

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
      <p class="discret">TIRAGE EN COURS · SEED {partie.graine}</p>
      <h1 class="titre-valeur">
        <TexteMinitel
          texte={origine.sexe === 'femme' ? 'TU ES NEE.' : 'TU ES NE.'}
          {msParCaractere}
        />
      </h1>
      <!-- Origine révélée ligne par ligne, dans l'ordre du tirage. -->
      <div class="lignes" class:revelees={msParCaractere > 0} style:--pas="{msParCaractere * 9}ms">
        {#each lignes as ligne, i (ligne.libelle)}
          <div class="ligne" style:--rang={i + 1}>
            <LigneValeur libelle={ligne.libelle} valeur={ligne.valeur} />
          </div>
        {/each}
      </div>
    </section>

    <section class="droite">
      <div class="prenom">
        <p>TON PRENOM : <span class="valeur">{minitel(partie.personnage.prenom)}</span></p>
        {#if frequence !== null}
          <p class="discret">
            {frequenceTexte(frequence)}
            {origine.sexe === 'femme' ? 'FILLES' : 'GARCONS'} SUR 1 000 NES DANS LES ANNEES
            {decennie} ONT RECU CE PRENOM.
          </p>
        {/if}
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

  .revelees .ligne {
    animation: apparaitre 0s steps(1) both;
    animation-delay: calc(var(--rang) * var(--pas));
  }

  @keyframes apparaitre {
    from {
      visibility: hidden;
    }
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
