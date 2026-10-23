<script lang="ts">
  import { onMount } from 'svelte';
  import {
    avancerPetiteEnfance,
    choisirAuto,
    creerPartie,
    fermerAnnee,
    jouerAnneeAuto,
    ouvrirAnnee,
  } from '../moteur/boucle';
  import { AGE_FIN_PETITE_ENFANCE } from '../moteur/constantes';
  import { nouveautesDeLAnnee } from '../moteur/modules/contexte';
  import { bornesAnneeNaissance } from '../moteur/naissance';
  import type {
    ChoixJoueur,
    Donnees,
    EntreeJournal,
    EtatPartie,
    OptionsPartie,
  } from '../moteur/types';
  import { actionClavier, type Action } from './clavier';
  import BarreTitre from './composants/BarreTitre.svelte';
  import Touche from './composants/Touche.svelte';
  import { chargerDonnees } from './donnees';
  import Accueil from './ecrans/Accueil.svelte';
  import Connexion from './ecrans/Connexion.svelte';
  import Fin from './ecrans/Fin.svelte';
  import Naissance from './ecrans/Naissance.svelte';
  import Reglages from './ecrans/Reglages.svelte';
  import Tour from './ecrans/Tour.svelte';
  import { lireAnnee, normaliserGraine, nouvelleGraine } from './graine';
  import {
    animationsPermises,
    delaiParCaractere,
    ecrireReglages,
    lireReglages,
    vitesseSuivante,
  } from './reglages';
  import { jouerSon, type NomSon } from './sons';

  type Ecran = 'connexion' | 'erreur' | 'accueil' | 'reglages' | 'naissance' | 'tour' | 'fin';

  /** Une année toutes les 100 ms en mode AUTO, soit environ 10 ans par seconde. */
  const INTERVALLE_AUTO = 100;

  let ecran = $state<Ecran>('connexion');
  let reglages = $state(lireReglages());
  /** Préférence système « moins de mouvement » : aucune animation. */
  let mouvementReduit = $state(false);
  /** La séquence de connexion est terminée (ou passée) : l'accueil peut s'afficher. */
  let connexionVue = $state(false);
  let donnees = $state.raw<Donnees | null>(null);
  let partie = $state.raw<EtatPartie | null>(null);
  let saisieGraine = $state('');
  let erreurGraine = $state<string | null>(null);
  let saisieAnnee = $state('');
  let erreurAnnee = $state<string | null>(null);
  let auto = $state(false);
  let confirmation = $state(false);
  /** Rang de l'avis affiché parmi les événements de l'année ouverte. */
  let rangAvis = $state(0);
  /** Choix faits dans l'année ouverte : id d'événement → id de choix. */
  let choixFaits = $state<Record<string, string>>({});
  let journalAuto = $state.raw<EntreeJournal[]>([]);
  let annonceSeule = $state(false);
  let cadre = $state<HTMLElement>();

  const evenementsOuverts = $derived(partie?.anneeEnCours?.evenements ?? []);
  const avis = $derived(evenementsOuverts[rangAvis] ?? null);
  /** Délai de révélation des textes et animations : coupés en AUTO et en mouvement réduit. */
  const msParCaractere = $derived(delaiParCaractere(reglages, mouvementReduit, auto));
  const anime = $derived(animationsPermises(reglages, mouvementReduit, auto));

  function son(nom: NomSon): void {
    jouerSon(nom, reglages.sons);
  }

  async function charger(): Promise<void> {
    ecran = 'connexion';
    try {
      donnees = await chargerDonnees();
      if (connexionVue || delaiParCaractere(reglages, mouvementReduit, false) === 0)
        ecran = 'accueil';
    } catch (erreur) {
      console.error(erreur);
      ecran = 'erreur';
    }
  }

  /** Fin (ou abandon) de la séquence de connexion : accueil dès que les données sont là. */
  function terminerConnexion(): void {
    connexionVue = true;
    if (donnees && ecran === 'connexion') ecran = 'accueil';
  }

  onMount(() => {
    const requete = matchMedia('(prefers-reduced-motion: reduce)');
    mouvementReduit = requete.matches;
    const changer = (e: MediaQueryListEvent): void => void (mouvementReduit = e.matches);
    requete.addEventListener('change', changer);
    void charger();
    return () => requete.removeEventListener('change', changer);
  });

  function changerReglage(numero: number): void {
    if (numero === 1) reglages = { ...reglages, vitesse: vitesseSuivante(reglages.vitesse) };
    else if (numero === 2) reglages = { ...reglages, sons: !reglages.sons };
    else return;
    ecrireReglages(reglages);
    son('touche');
  }

  // Événement grave affiché : son d'alerte.
  $effect(() => {
    if (avis?.gravite === 3 && ecran === 'tour' && !auto) son('grave');
  });

  function commencer(graine: string, options: OptionsPartie): void {
    if (!donnees) return;
    partie = creerPartie(graine, donnees, options);
    auto = false;
    confirmation = false;
    ecran = 'naissance';
    son('connexion');
  }

  function nouvelleVie(): void {
    if (!donnees) return;
    const saisie = saisieGraine.trim();
    const graine = saisie === '' ? nouvelleGraine() : normaliserGraine(saisie);
    erreurGraine = graine === null ? 'GRAINE INVALIDE : 4 A 16 LETTRES OU CHIFFRES.' : null;
    const { min, max } = bornesAnneeNaissance(donnees.tables);
    const annee = lireAnnee(saisieAnnee, min, max);
    erreurAnnee = annee === null ? `ANNEE INVALIDE : DE ${min} A ${max}.` : null;
    if (graine === null || annee === null) return;
    commencer(graine, annee === 'hasard' ? {} : { anneeNaissance: annee });
  }

  /** Vérifie la fin de partie après chaque étape du moteur. */
  function suivre(etat: EtatPartie): boolean {
    partie = etat;
    if (etat.personnage.vivant) return true;
    auto = false;
    ecran = 'fin';
    son('fin');
    return false;
  }

  function ouvrir(): void {
    if (!donnees || !partie) return;
    rangAvis = 0;
    choixFaits = {};
    // Petite enfance, hors AUTO : les années sans événement défilent sans arrêt.
    const ouverture =
      !auto && partie.personnage.age < AGE_FIN_PETITE_ENFANCE
        ? avancerPetiteEnfance(partie, donnees)
        : ouvrirAnnee(partie, donnees);
    suivre(ouverture.etat);
  }

  /** Ferme l'année ouverte ; les choix manquants sont faits par choisirAuto. */
  function fermer(): boolean {
    if (!donnees || !partie?.anneeEnCours) return true;
    const etat = partie;
    const choix: ChoixJoueur[] = etat
      .anneeEnCours!.evenements.filter((e) => e.choix.length > 0)
      .map((e) =>
        choixFaits[e.id]
          ? { evenementId: e.id, choixId: choixFaits[e.id]! }
          : choisirAuto(etat, e, donnees!),
      );
    return suivre(fermerAnnee(etat, choix, donnees).etat);
  }

  function debuterVie(): void {
    ecran = 'tour';
    ouvrir();
  }

  function choisir(numero: number): void {
    const option = avis?.choix[numero - 1];
    if (!avis || !option) return;
    choixFaits = { ...choixFaits, [avis.id]: option.id };
    annonceSeule = false;
  }

  function envoi(): void {
    if (auto) return arreterAuto();
    annonceSeule = false;
    if (avis && avis.choix.length > 0 && !choixFaits[avis.id]) return;
    if (rangAvis < evenementsOuverts.length - 1) {
      rangAvis += 1;
      return;
    }
    if (fermer()) ouvrir();
  }

  function demarrerAuto(): void {
    confirmation = false;
    if (fermer()) {
      journalAuto = [];
      auto = true;
    }
  }

  /** Pause : l'année suivante s'ouvre pour reprendre la main ; on n'annonce que l'état. */
  function arreterAuto(): void {
    if (!auto) return;
    auto = false;
    annonceSeule = true;
    if (partie?.personnage.vivant && !partie.anneeEnCours) ouvrir();
  }

  function basculerAuto(): void {
    if (auto) arreterAuto();
    else demarrerAuto();
  }

  function anneeAuto(): void {
    if (!donnees || !partie?.personnage.vivant) return;
    const resultat = jouerAnneeAuto(partie, donnees);
    journalAuto = resultat.journal;
    suivre(resultat.etat);
  }

  function demanderSommaire(): void {
    arreterAuto();
    if (ecran === 'tour') confirmation = true;
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
    const minuterie = setInterval(anneeAuto, INTERVALLE_AUTO);
    return () => clearInterval(minuterie);
  });

  // À chaque changement d'écran, le focus revient au cadre (lecteurs d'écran, clavier).
  $effect(() => {
    void ecran;
    cadre?.focus();
  });

  function agir(action: Action): boolean {
    const fait = executer(action);
    if (fait) son('touche');
    return fait;
  }

  function executer(action: Action): boolean {
    switch (ecran) {
      case 'connexion':
        if (action.type !== 'envoi') return false;
        terminerConnexion();
        return true;
      case 'accueil':
        if (action.type === 'envoi' || (action.type === 'choix' && action.numero === 1)) {
          nouvelleVie();
          return true;
        }
        if (action.type === 'choix' && action.numero === 4) {
          ecran = 'reglages';
          return true;
        }
        return false;
      case 'reglages':
        if (action.type === 'choix' && action.numero <= 2) changerReglage(action.numero);
        else if (action.type === 'retour' || action.type === 'envoi') ecran = 'accueil';
        else return false;
        return true;
      case 'naissance':
        if (action.type === 'envoi') debuterVie();
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
        if (action.type === 'choix' && !auto) choisir(action.numero);
        else if (action.type === 'envoi') envoi();
        else if (action.type === 'auto') basculerAuto();
        else if (action.type === 'sommaire' || action.type === 'retour') demanderSommaire();
        else return false;
        return true;
      case 'fin':
        if (action.type === 'envoi' && partie) commencer(partie.graine, partie.options);
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
  {#if ecran === 'connexion'}
    <Connexion
      prete={donnees !== null}
      msParCaractere={delaiParCaractere(reglages, mouvementReduit, false)}
      onterminee={terminerConnexion}
    />
  {:else if ecran === 'erreur'}
    <BarreTitre libelle="CONNEXION" />
    <div class="contenu">
      <p role="alert">ECHEC DE LA CONNEXION. LES DONNEES N'ONT PAS PU ETRE CHARGEES.</p>
    </div>
    <div class="touches">
      <Touche libelle="REESSAYER" principale onclick={charger} />
    </div>
  {:else if ecran === 'accueil'}
    <Accueil
      bind:graine={saisieGraine}
      bind:annee={saisieAnnee}
      {erreurGraine}
      {erreurAnnee}
      onnouvellevie={nouvelleVie}
      onreglages={() => (ecran = 'reglages')}
    />
  {:else if ecran === 'reglages'}
    <Reglages
      {reglages}
      {mouvementReduit}
      onchanger={changerReglage}
      onretour={() => (ecran = 'accueil')}
    />
  {:else if ecran === 'naissance' && partie}
    <Naissance
      {partie}
      msParCaractere={delaiParCaractere(reglages, mouvementReduit, false)}
      onretour={allerAuSommaire}
      oncommencer={debuterVie}
    />
  {:else if ecran === 'tour' && partie}
    <Tour
      {partie}
      {avis}
      {rangAvis}
      totalAvis={evenementsOuverts.length}
      choixFait={avis ? (choixFaits[avis.id] ?? null) : null}
      {auto}
      {journalAuto}
      {annonceSeule}
      {confirmation}
      {msParCaractere}
      {anime}
      actualites={donnees ? nouveautesDeLAnnee(donnees.contexte, partie.annee) : []}
      onchoisir={choisir}
      onenvoi={envoi}
      onauto={basculerAuto}
      onsommaire={demanderSommaire}
      onconfirmer={confirmer}
    />
  {:else if ecran === 'fin' && partie}
    <Fin
      {partie}
      {anime}
      onsommaire={allerAuSommaire}
      onrevivre={() => commencer(partie!.graine, partie!.options)}
    />
  {/if}
</main>

<style>
  .ecran:focus {
    outline: none;
  }
</style>
