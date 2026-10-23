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
  import { bilan as bilanDe, rejouer, type Comparaison } from '../moteur/bilan';
  import { AGE_FIN_PETITE_ENFANCE } from '../moteur/constantes';
  import { nouveautesDeLAnnee } from '../moteur/modules/contexte';
  import { bornesAnneeNaissance, frequencePrenom } from '../moteur/naissance';
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
  import Bilan from './ecrans/Bilan.svelte';
  import Connexion from './ecrans/Connexion.svelte';
  import Journal from './ecrans/Journal.svelte';
  import Naissance from './ecrans/Naissance.svelte';
  import Reglages from './ecrans/Reglages.svelte';
  import Tour from './ecrans/Tour.svelte';
  import Vies from './ecrans/Vies.svelte';
  import { lireAnnee, normaliserGraine, nouvelleGraine } from './graine';
  import { lignesJournal, nombreDePages } from './journal';
  import { lienDePartage, lireLien } from './partage';
  import { comparerVies } from './simulation';
  import {
    ouvrirStockage,
    partieSauvee,
    vieSauvee,
    type PartieSauvee,
    type Stockage,
    type VieSauvee,
  } from '../stockage/parties';
  import {
    animationsPermises,
    delaiParCaractere,
    ecrireReglages,
    lireReglages,
    vitesseSuivante,
  } from './reglages';
  import { jouerSon, type NomSon } from './sons';

  type Ecran =
    | 'connexion'
    | 'erreur'
    | 'accueil'
    | 'reglages'
    | 'naissance'
    | 'tour'
    | 'journal'
    | 'bilan'
    | 'vies';

  /** En AUTO, la partie en cours est sauvegardée tous les 10 ans (et à chaque pause). */
  const SAUVEGARDE_AUTO = 10;

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
  let stockage = $state.raw<Stockage | null>(null);
  let enCours = $state.raw<PartieSauvee | null>(null);
  let vies = $state.raw<VieSauvee[]>([]);
  /** Bilan comparatif du worker : null pendant le calcul. */
  let comparaison = $state.raw<Comparaison | null | 'erreur'>(null);
  let messageBilan = $state<string | null>(null);
  /** Écran d'où l'on a ouvert le journal, et page affichée. */
  let retourJournal = $state<'tour' | 'bilan'>('tour');
  let pageJournal = $state(0);

  const evenementsOuverts = $derived(partie?.anneeEnCours?.evenements ?? []);
  const avis = $derived(evenementsOuverts[rangAvis] ?? null);
  /** Délai de révélation des textes et animations : coupés en AUTO et en mouvement réduit. */
  const msParCaractere = $derived(delaiParCaractere(reglages, mouvementReduit, auto));
  const anime = $derived(animationsPermises(reglages, mouvementReduit, auto));
  const bilanCourant = $derived(
    donnees && partie && !partie.personnage.vivant ? bilanDe(partie, donnees) : null,
  );
  const lignes = $derived(
    donnees && partie ? lignesJournal(partie.historique, donnees.evenements) : [],
  );

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
    const lien = lireLien(location.search);
    if (lien) {
      saisieGraine = lien.graine;
      saisieAnnee = lien.annee;
    }
    void ouvrirStockage().then((ouvert) => {
      stockage = ouvert;
      void rafraichirSauvegardes();
    });
    return () => requete.removeEventListener('change', changer);
  });

  async function rafraichirSauvegardes(): Promise<void> {
    if (!stockage) return;
    try {
      enCours = await stockage.lireEnCours();
      vies = await stockage.listerVies();
    } catch (erreur) {
      console.error(erreur);
    }
  }

  /** Sauvegarde de la partie en cours (graine et choix), sans bloquer le jeu. */
  function sauver(etat: EtatPartie): void {
    if (!stockage || !etat.personnage.vivant) return;
    const sauvee = partieSauvee(etat);
    enCours = sauvee;
    stockage.sauverEnCours(sauvee).catch((erreur: unknown) => console.error(erreur));
  }

  /** Vie terminée : elle rejoint les vies passées, la partie en cours s'efface. */
  function archiver(etat: EtatPartie): void {
    enCours = null;
    if (!stockage) return;
    const ouvert = stockage;
    void ouvert
      .ajouterVie(vieSauvee(etat, Date.now()))
      .then(() => ouvert.effacerEnCours())
      .then(rafraichirSauvegardes)
      .catch((erreur: unknown) => console.error(erreur));
  }

  /** Affiche le bilan d'une vie terminée et lance le calcul comparatif dans le worker. */
  function montrerBilan(etat: EtatPartie): void {
    partie = etat;
    auto = false;
    messageBilan = null;
    comparaison = null;
    ecran = 'bilan';
    if (!donnees) return;
    comparerVies(etat, donnees)
      .then((resultat) => {
        if (partie === etat) comparaison = resultat;
      })
      .catch((erreur: unknown) => {
        console.error(erreur);
        if (partie === etat) comparaison = 'erreur';
      });
  }

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
    archiver(etat);
    montrerBilan(etat);
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
    if (suivre(ouverture.etat) && !auto) sauver(ouverture.etat);
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
    if (suivre(resultat.etat) && resultat.etat.personnage.age % SAUVEGARDE_AUTO === 0) {
      sauver(resultat.etat);
    }
  }

  /** Reprend la partie sauvegardée sur l'année que le joueur avait ouverte. */
  function reprendre(): void {
    if (!donnees || !enCours) return;
    const { graine, options, decisions, ageOuvert } = enCours;
    const etat = rejouer(graine, options, decisions, donnees, ageOuvert);
    auto = false;
    confirmation = false;
    rangAvis = 0;
    choixFaits = {};
    annonceSeule = false;
    if (!etat.personnage.vivant) return montrerBilan(etat);
    partie = etat;
    ecran = 'tour';
    son('connexion');
  }

  /** Bilan d'une vie passée, reconstruite par sa graine et ses choix. */
  function ouvrirVie(rang: number): void {
    const vie = vies[rang];
    if (!donnees || !vie) return;
    montrerBilan(rejouer(vie.graine, vie.options, vie.decisions, donnees));
  }

  function ouvrirJournal(depuis: 'tour' | 'bilan'): void {
    if (depuis === 'tour') arreterAuto();
    retourJournal = depuis;
    // En cours de vie, les dernières années ; au bilan, la vie depuis le début.
    pageJournal = depuis === 'tour' ? nombreDePages(lignes.length) - 1 : 0;
    ecran = 'journal';
  }

  function fermerJournal(): void {
    ecran = retourJournal;
  }

  async function partager(): Promise<void> {
    if (!partie) return;
    const lien = lienDePartage(location.href, partie.graine, partie.options);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: '3615 UNE VIE', text: 'REJOUE MA GRAINE', url: lien });
        messageBilan = 'LIEN PARTAGE.';
      } else {
        await navigator.clipboard.writeText(lien);
        messageBilan = 'LIEN COPIE.';
      }
    } catch {
      messageBilan = lien;
    }
  }

  /** Vivre l'autre naissance : même graine, origine de l'autre bout de l'échelle. */
  function vivreAutreNaissance(): void {
    if (!partie || !comparaison || comparaison === 'erreur') return;
    commencer(partie.graine, comparaison.autre.options);
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
    void rafraichirSauvegardes();
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
        if (action.type === 'choix' && action.numero === 2 && enCours) {
          reprendre();
          return true;
        }
        if (action.type === 'choix' && action.numero === 3 && vies.length > 0) {
          ecran = 'vies';
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
        else if (action.type === 'journal') ouvrirJournal('tour');
        else if (action.type === 'sommaire' || action.type === 'retour') demanderSommaire();
        else return false;
        return true;
      case 'journal': {
        const derniere = nombreDePages(lignes.length) - 1;
        if (action.type === 'journal') fermerJournal();
        else if (action.type === 'envoi') {
          if (pageJournal < derniere) pageJournal += 1;
          else fermerJournal();
        } else if (action.type === 'retour') {
          if (pageJournal > 0) pageJournal -= 1;
          else fermerJournal();
        } else return false;
        return true;
      }
      case 'bilan':
        if (action.type === 'envoi' && partie) commencer(partie.graine, partie.options);
        else if (action.type === 'journal') ouvrirJournal('bilan');
        else if (action.type === 'partager') void partager();
        else if (action.type === 'choix' && action.numero === 1) vivreAutreNaissance();
        else if (action.type === 'sommaire' || action.type === 'retour') allerAuSommaire();
        else return false;
        return true;
      case 'vies':
        if (action.type === 'choix') ouvrirVie(action.numero - 1);
        else if (action.type === 'retour' || action.type === 'sommaire') ecran = 'accueil';
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
      enCours={enCours ? { prenom: enCours.prenom, age: enCours.ageOuvert } : null}
      nombreVies={vies.length}
      onnouvellevie={nouvelleVie}
      onreprendre={reprendre}
      onvies={() => (ecran = 'vies')}
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
      frequence={donnees
        ? frequencePrenom(partie.personnage.prenom, partie.personnage.origine, donnees.tables)
        : null}
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
      onjournal={() => ouvrirJournal('tour')}
    />
  {:else if ecran === 'journal' && partie}
    <Journal
      prenom={partie.personnage.prenom}
      {lignes}
      bind:page={pageJournal}
      onreprendre={fermerJournal}
    />
  {:else if ecran === 'bilan' && partie && bilanCourant}
    <Bilan
      bilan={bilanCourant}
      graine={partie.graine}
      {comparaison}
      message={messageBilan}
      {anime}
      onpartager={() => void partager()}
      onjournal={() => ouvrirJournal('bilan')}
      onrevivre={() => commencer(partie!.graine, partie!.options)}
      onautre={vivreAutreNaissance}
    />
  {:else if ecran === 'vies'}
    <Vies {vies} onouvrir={ouvrirVie} onretour={() => (ecran = 'accueil')} />
  {/if}
</main>

<style>
  .ecran:focus {
    outline: none;
  }
</style>
