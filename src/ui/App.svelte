<script lang="ts">
  import { onMount } from 'svelte';
  import { creerPartie, jouerAnnee } from '../moteur/boucle';
  import type { EtatPartie, Tables } from '../moteur/types';
  import { actionClavier, type Action } from './clavier';
  import BarreTitre from './composants/BarreTitre.svelte';
  import Touche from './composants/Touche.svelte';
  import { chargerTables } from './donnees';
  import Accueil from './ecrans/Accueil.svelte';
  import Fin from './ecrans/Fin.svelte';
  import Naissance from './ecrans/Naissance.svelte';
  import Tour from './ecrans/Tour.svelte';
  import { normaliserGraine, nouvelleGraine } from './graine';

  type Ecran = 'chargement' | 'erreur' | 'accueil' | 'naissance' | 'tour' | 'fin';

  /** Une année toutes les 100 ms en mode AUTO, soit environ 10 ans par seconde. */
  const INTERVALLE_AUTO = 100;

  let ecran = $state<Ecran>('chargement');
  let tables = $state.raw<Tables | null>(null);
  let partie = $state.raw<EtatPartie | null>(null);
  let saisieGraine = $state('');
  let erreurGraine = $state<string | null>(null);
  let auto = $state(false);
  let confirmation = $state(false);
  let cadre = $state<HTMLElement>();

  async function charger(): Promise<void> {
    ecran = 'chargement';
    try {
      tables = await chargerTables();
      ecran = 'accueil';
    } catch (erreur) {
      console.error(erreur);
      ecran = 'erreur';
    }
  }

  onMount(charger);

  function commencer(graine: string): void {
    if (!tables) return;
    partie = creerPartie(graine, tables);
    auto = false;
    confirmation = false;
    ecran = 'naissance';
  }

  function nouvelleVie(): void {
    const saisie = saisieGraine.trim();
    const graine = saisie === '' ? nouvelleGraine() : normaliserGraine(saisie);
    if (graine === null) {
      erreurGraine = 'GRAINE INVALIDE : 4 A 16 LETTRES OU CHIFFRES.';
      return;
    }
    erreurGraine = null;
    commencer(graine);
  }

  function jouerUneAnnee(): void {
    if (!tables || !partie?.personnage.vivant) return;
    partie = jouerAnnee(partie, null, tables).etat;
    if (!partie.personnage.vivant) {
      auto = false;
      ecran = 'fin';
    }
  }

  function envoi(): void {
    // ENVOI arrête le mode AUTO ; sinon, il joue une année.
    if (auto) auto = false;
    else jouerUneAnnee();
  }

  function demanderSommaire(): void {
    auto = false;
    confirmation = true;
  }

  function confirmer(quitter: boolean): void {
    confirmation = false;
    if (quitter) allerAuSommaire();
  }

  function allerAuSommaire(): void {
    auto = false;
    confirmation = false;
    partie = null;
    ecran = 'accueil';
  }

  $effect(() => {
    if (!auto || ecran !== 'tour') return;
    const minuterie = setInterval(jouerUneAnnee, INTERVALLE_AUTO);
    return () => clearInterval(minuterie);
  });

  // À chaque changement d'écran, le focus revient au cadre (lecteurs d'écran, clavier).
  $effect(() => {
    void ecran;
    cadre?.focus();
  });

  function agir(action: Action): boolean {
    switch (ecran) {
      case 'accueil':
        if (action.type === 'envoi' || (action.type === 'choix' && action.numero === 1)) {
          nouvelleVie();
          return true;
        }
        return false;
      case 'naissance':
        if (action.type === 'envoi') ecran = 'tour';
        else if (action.type === 'retour') allerAuSommaire();
        else return false;
        return true;
      case 'tour':
        if (confirmation) {
          if (action.type === 'choix' && action.numero <= 2) confirmer(action.numero === 1);
          else if (action.type === 'retour') confirmer(false);
          else return false;
          return true;
        }
        if (action.type === 'envoi') envoi();
        else if (action.type === 'auto') auto = !auto;
        else if (action.type === 'sommaire' || action.type === 'retour') demanderSommaire();
        else return false;
        return true;
      case 'fin':
        if (action.type === 'envoi' && partie) commencer(partie.graine);
        else if (action.type === 'sommaire') allerAuSommaire();
        else return false;
        return true;
      default:
        return false;
    }
  }

  function surTouche(evenement: KeyboardEvent): void {
    const cible = evenement.target;
    const dansChampSaisie =
      cible instanceof HTMLInputElement ||
      cible instanceof HTMLTextAreaElement ||
      (cible instanceof HTMLElement && cible.isContentEditable);
    const action = actionClavier(evenement, dansChampSaisie);
    // preventDefault évite qu'Entrée sur un bouton focalisé ne déclenche l'action deux fois.
    if (action && agir(action)) evenement.preventDefault();
  }
</script>

<svelte:window onkeydown={surTouche} />

<main class="ecran" bind:this={cadre} tabindex="-1">
  {#if ecran === 'chargement'}
    <BarreTitre libelle="CONNEXION" />
    <div class="contenu" aria-live="polite">
      <p>CONNEXION EN COURS...</p>
    </div>
  {:else if ecran === 'erreur'}
    <BarreTitre libelle="CONNEXION" />
    <div class="contenu">
      <p role="alert">ECHEC DE LA CONNEXION. LES DONNEES N'ONT PAS PU ETRE CHARGEES.</p>
    </div>
    <div class="touches">
      <Touche libelle="REESSAYER" principale onclick={charger} />
    </div>
  {:else if ecran === 'accueil'}
    <Accueil bind:graine={saisieGraine} {erreurGraine} onnouvellevie={nouvelleVie} />
  {:else if ecran === 'naissance' && partie}
    <Naissance {partie} onretour={allerAuSommaire} oncommencer={() => (ecran = 'tour')} />
  {:else if ecran === 'tour' && partie}
    <Tour
      {partie}
      {auto}
      {confirmation}
      onenvoi={envoi}
      onauto={() => (auto = !auto)}
      onsommaire={demanderSommaire}
      onconfirmer={confirmer}
    />
  {:else if ecran === 'fin' && partie}
    <Fin {partie} onsommaire={allerAuSommaire} onrevivre={() => commencer(partie!.graine)} />
  {/if}
</main>

<style>
  .ecran:focus {
    outline: none;
  }
</style>
