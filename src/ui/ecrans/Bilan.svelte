<script lang="ts">
  import type { Bilan, Comparaison, VieResumee } from '../../moteur/bilan';
  import type { Origine } from '../../moteur/types';
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import LigneValeur from '../composants/LigneValeur.svelte';
  import Touche from '../composants/Touche.svelte';
  import { libelle, minitel, montant } from '../texte';

  let {
    bilan,
    graine,
    comparaison,
    message = null,
    anime = false,
    onpartager,
    onjournal,
    onrevivre,
    onautre,
  }: {
    bilan: Bilan;
    graine: string;
    /** Calcul du worker : null pendant le calcul, 'erreur' s'il a échoué. */
    comparaison: Comparaison | null | 'erreur';
    /** Retour du partage (« LIEN COPIE »...). */
    message?: string | null;
    anime?: boolean;
    onpartager: () => void;
    onjournal: () => void;
    onrevivre: () => void;
    /** Vivre l'autre naissance (mêmes graine, autre origine). */
    onautre: () => void;
  } = $props();

  const ans = (n: number): string => `${n} ${n > 1 ? 'ANS' : 'AN'}`;
  const decileCourt = (d: number): string => `D${d}`;
  /** Moment où l'argent est compté : francs avant 2002. */
  const anneeArgent = $derived(bilan.anneeDeces);

  const cause = $derived.by(() => {
    if (bilan.causeTexte) return minitel(bilan.causeTexte);
    if (bilan.causeMaladie) return libelle('maladies', bilan.causeMaladie);
    return bilan.age >= 65 ? 'CAUSES NATURELLES' : 'MALADIE OU ACCIDENT';
  });

  /** « NEE FILLE DE CADRES, GRANDE VILLE » : l'origine de l'autre naissance en une ligne. */
  function origineCourte(origine: Origine): string {
    const ne = origine.sexe === 'femme' ? 'NEE FILLE' : 'NE FILS';
    const parents = libelle('pcsParents', origine.pcsParents);
    return `${ne} DE ${parents}, ${libelle('territoire', origine.territoire)}`;
  }

  /** Une vie résumée en une ligne : âge, diplôme, métier, décile final. */
  function resume(vie: VieResumee | { bilan: Bilan }): string {
    const b = vie.bilan;
    const metier = b.pcs ? libelle('pcs', b.pcs) : 'SANS METIER';
    return `${ans(b.age)} · ${libelle('diplome', b.diplome)} · ${metier} · ${decileCourt(b.decileFinal)}`;
  }

  const jeu = $derived(bilan.jeu);
</script>

<BarreTitre libelle="FIN DE CONNEXION" />

<div class="contenu">
  <div class="zones">
    <section class="gauche">
      <!-- Grand moment : le nom en double hauteur. -->
      <h1 class="titre-valeur double" class:apparait={anime}>{minitel(bilan.prenom)}</h1>
      <p>{bilan.anneeNaissance} - {bilan.anneeDeces} · {ans(bilan.age)}</p>
      <p class="discret">CAUSE : {cause}</p>
      <p class="discret">
        ESPERANCE DE TA GENERATION : {ans(Math.round(bilan.esperanceGeneration))}
      </p>

      {#if bilan.moralParDecennie.length > 0}
        <p class="rubrique">MORAL PAR DECENNIE</p>
        <div
          class="barres"
          role="img"
          aria-label={`Moral moyen par decennie : ${bilan.moralParDecennie.map((m, i) => `${i * 10} ans ${Math.round(m)}`).join(', ')}`}
        >
          {#each bilan.moralParDecennie as moral, i (i)}
            <div class="colonne">
              <div class="piste">
                <div
                  class="barre"
                  class:bas={moral < 50}
                  style:height="{Math.max(4, Math.round(moral))}%"
                ></div>
              </div>
              <span class="decennie">{i * 10}</span>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="droite">
      <div class="valeurs">
        <LigneValeur libelle="DECILE NAISSANCE" valeur={decileCourt(bilan.decileNaissance)} />
        <LigneValeur
          libelle="DECILE A {bilan.ageDecileFinal} ANS"
          valeur={decileCourt(bilan.decileFinal)}
        />
        <LigneValeur libelle="DIPLOME" valeur={libelle('diplome', bilan.diplome)} />
        <LigneValeur
          libelle="METIER"
          valeur={bilan.pcs ? libelle('pcs', bilan.pcs) : 'SANS METIER'}
        />
        <LigneValeur libelle="ANNEES AU CHOMAGE" valeur={String(bilan.anneesChomage)} />
        <LigneValeur
          libelle="REVENUS DE LA VIE"
          valeur={montant(bilan.revenusCumules, anneeArgent)}
        />
        {#if bilan.anneesDependance > 0}
          <LigneValeur
            libelle="ANNEES EN DEPENDANCE"
            valeur={String(bilan.anneesDependance)}
            ton="valeur"
          />
          <LigneValeur
            libelle="COUT DES ADDICTIONS"
            valeur={montant(bilan.coutAddictions, anneeArgent)}
          />
        {/if}
        <LigneValeur
          libelle="PATRIMOINE TRANSMIS"
          valeur={montant(bilan.patrimoineTransmis, anneeArgent)}
          ton="valeur"
        />
      </div>

      {#if jeu.mise > 0}
        <!-- Garde-fou : le total misé et récupéré reste visible, solde compris. -->
        <div class="encadre jeu">
          <p class="rubrique-jeu">JEUX D'ARGENT SUR TOUTE LA VIE</p>
          <LigneValeur libelle="MISE" valeur={montant(jeu.mise, anneeArgent)} />
          <LigneValeur libelle="RECUPERE" valeur={montant(jeu.recupere, anneeArgent)} />
          <LigneValeur
            libelle="SOLDE"
            valeur={montant(jeu.recupere - jeu.mise, anneeArgent)}
            ton="valeur"
          />
        </div>
      {/if}

      {#if bilan.enfants > 0}
        <p class="rubrique">TES ENFANTS</p>
        {#if comparaison && comparaison !== 'erreur'}
          <ul class="enfants">
            {#each comparaison.enfants as enfant, i (i)}
              <li>
                <span class="valeur">{minitel(enfant.bilan.prenom)}</span>, NE{enfant.origine
                  .sexe === 'femme'
                  ? 'E'
                  : ''} EN {enfant.bilan.anneeNaissance}
                <span class="discret">{resume(enfant)}</span>
              </li>
            {/each}
          </ul>
        {:else if comparaison === null}
          <p class="discret">CALCUL EN COURS...</p>
        {/if}
      {/if}

      <p class="rubrique">MEMES CHOIX, AUTRE NAISSANCE ?</p>
      {#if comparaison === null}
        <p class="discret">CALCUL EN COURS...</p>
      {:else if comparaison === 'erreur'}
        <p class="discret">CALCUL IMPOSSIBLE.</p>
      {:else}
        <BoutonNumerote
          numero={1}
          libelle={origineCourte(comparaison.autre.origine)}
          onclick={onautre}
        />
        <p class="comparaison">
          <span class="discret">TOI · {resume({ bilan })}</span>
          <span>AUTRE · {resume(comparaison.autre)}</span>
        </p>
      {/if}

      <p class="discret">SEED {graine} · CHIFFRES PROVISOIRES, DONNEES A CALIBRER.</p>
      {#if message}<p class="message" role="status">{message}</p>{/if}
    </section>
  </div>
</div>

<div class="touches">
  <Touche libelle="PARTAGER" raccourci="P" onclick={onpartager} />
  <Touche libelle="JOURNAL" raccourci="J" onclick={onjournal} />
  <Touche libelle="REVIVRE" raccourci="ENTREE" principale onclick={onrevivre} />
</div>

<style>
  .double {
    display: inline-block;
    transform: scaleY(2);
    transform-origin: top left;
    margin-bottom: 0.6em;
  }

  .apparait {
    animation: apparaitre 0.9s steps(6) both;
  }

  @keyframes apparaitre {
    from {
      clip-path: inset(0 100% 0 0);
    }
    to {
      clip-path: inset(0);
    }
  }

  .rubrique {
    margin: 12px 0 6px;
    color: var(--accent);
  }

  .barres {
    display: flex;
    gap: 6px;
    align-items: flex-end;
  }

  .colonne {
    flex: 1;
    max-width: 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .piste {
    width: 100%;
    height: 72px;
    display: flex;
    align-items: flex-end;
  }

  .barre {
    width: 100%;
    background: var(--bien);
  }

  .barre.bas {
    background: var(--alerte);
  }

  .decennie {
    font-size: var(--taille-precision-petite);
    color: var(--texte-discret);
  }

  .valeurs {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .encadre {
    margin-top: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .encadre.jeu {
    border: 2px solid var(--alerte);
  }

  .rubrique-jeu {
    margin: 0 0 4px;
    color: var(--alerte);
  }

  .enfants {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .enfants .discret {
    display: block;
  }

  .valeur {
    color: var(--valeur);
  }

  .message {
    color: var(--valeur);
  }

  .comparaison {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--taille-precision);
  }
</style>
