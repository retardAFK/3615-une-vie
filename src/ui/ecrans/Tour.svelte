<script lang="ts">
  import type {
    EntreeContexte,
    EntreeJournal,
    EtatPartie,
    EvenementTire,
    Jauges,
  } from '../../moteur/types';
  import Avis from '../composants/Avis.svelte';
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import Jauge from '../composants/Jauge.svelte';
  import LigneValeur from '../composants/LigneValeur.svelte';
  import TexteMinitel from '../composants/TexteMinitel.svelte';
  import Touche from '../composants/Touche.svelte';
  import { estSalarie } from '../../moteur/modules/emploi';
  import { PRODUITS } from '../../moteur/types';
  import { RESSOURCES } from '../donnees';
  import { pictoPour } from '../pictos';
  import { libelle, minitel, montant } from '../texte';

  let {
    partie,
    avis,
    rangAvis,
    totalAvis,
    choixFait,
    auto,
    journalAuto,
    annonceSeule,
    confirmation,
    msParCaractere = 0,
    anime = false,
    actualites = [],
    onchoisir,
    onenvoi,
    onauto,
    onsommaire,
    onconfirmer,
  }: {
    partie: EtatPartie;
    /** Avis affiché (événement de l'année ouverte), ou null. */
    avis: EvenementTire | null;
    rangAvis: number;
    totalAvis: number;
    /** Choix fait pour l'avis affiché. */
    choixFait: string | null;
    auto: boolean;
    /** Lignes de journal de la dernière année jouée en AUTO. */
    journalAuto: readonly EntreeJournal[];
    /** Après une pause : n'annoncer que l'âge et l'année. */
    annonceSeule: boolean;
    /** Encadré « QUITTER CETTE VIE ? » ouvert. */
    confirmation: boolean;
    /** Révélation du texte des avis (0 : d'un coup). */
    msParCaractere?: number;
    /** Animations permises : transitions, jauges, clignotements (jamais en AUTO). */
    anime?: boolean;
    /** Contexte historique qui commence cette année : bandeau FLASH INFO. */
    actualites?: readonly EntreeContexte[];
    onchoisir: (numero: number) => void;
    onenvoi: () => void;
    onauto: () => void;
    onsommaire: () => void;
    onconfirmer: (quitter: boolean) => void;
  } = $props();

  const personnage = $derived(partie.personnage);
  const finances = $derived(personnage.finances);
  const totalAides = $derived(
    Object.values(finances.aides).reduce((somme, m) => somme + (m ?? 0), 0),
  );
  const endettement = $derived.by(() => {
    const { planApurement } = finances;
    if (planApurement > 0) return `PLAN · ${planApurement} AN${planApurement > 1 ? 'S' : ''}`;
    return libelle('endettement', finances.endettement);
  });
  /**
   * Nouvelles du tour : addictions de l'année écoulée (écrites à sa fermeture), puis
   * argent de l'année (aides, dettes, écrites à son ouverture).
   */
  const nouvelles = $derived.by(() => {
    const lignes: EntreeJournal[] = [];
    const { historique } = partie;
    for (let i = historique.length - 1; i >= 0; i--) {
      const entree = historique[i]!;
      if (entree.annee < partie.annee - 1) break;
      const recente =
        (entree.type === 'argent' && entree.annee === partie.annee) ||
        (entree.type === 'addiction' && entree.annee === partie.annee - 1);
      if (recente) lignes.unshift(entree);
    }
    return lignes;
  });
  /** Addictions qui pèsent : usage régulier, dépendance, sevrage. */
  const addictions = $derived(
    PRODUITS.filter((produit) =>
      ['usage_regulier', 'dependance', 'sevrage'].includes(personnage.etats.addictions[produit]),
    ),
  );
  const jeu = $derived(personnage.etats.jeu);
  /** Scolarité tant que les études durent, puis état d'emploi et métier. */
  const situation = $derived.by(() => {
    const { scolarite, emploi, education, travail } = personnage.etats;
    if (scolarite === 'lycee' && education.voie) return libelle('voie', education.voie);
    if (scolarite === 'superieur' && education.filiere)
      return libelle('filiere', education.filiere);
    if (scolarite !== 'sortie') return libelle('scolarite', scolarite);
    const metier = travail.pcs && estSalarie(emploi) ? ` · ${libelle('pcs', travail.pcs)}` : '';
    return `${libelle('emploi', emploi)}${metier}`;
  });
  const ageTexte = $derived(`${personnage.age} ${personnage.age > 1 ? 'ANS' : 'AN'}`);
  const titreAvis = $derived(minitel((avis?.tags[0] ?? 'quotidien').replaceAll('_', ' ')));
  const envoiBloque = $derived(!auto && !confirmation && !!avis?.choix.length && !choixFait);
  const evenementsAuto = $derived(journalAuto.filter((e) => e.type === 'evenement'));
  const annonce = $derived.by(() => {
    if (auto) return '';
    const etat = `${ageTexte}, ${partie.annee}.`;
    if (annonceSeule) return etat;
    return `${etat} ${avis ? avis.texte : 'AUCUN EVENEMENT CETTE ANNEE.'}`;
  });

  const NOMS_JAUGES: (keyof Jauges)[] = [
    'santePhysique',
    'santeMentale',
    'bienEtre',
    'liens',
    'competences',
  ];
</script>

<BarreTitre libelle="TOUR {personnage.age}" />

<p class="lecteur-seulement" aria-live={auto ? 'off' : 'polite'} aria-atomic="true">{annonce}</p>

<div class="contenu">
  {#if actualites.length > 0}
    <!-- Contexte historique de l'année : actualités, crises, lois, mouvements. -->
    <section class="flash" aria-label="Flash info">
      {#each actualites as actualite (actualite.id)}
        <p>
          <span class="etiquette">FLASH INFO</span>
          <span class="titre-flash">{partie.annee} · {actualite.titre}</span>
        </p>
        <p class="discret">{actualite.texte}</p>
      {/each}
    </section>
  {/if}
  <div class="zones">
    <section class="gauche">
      <div>
        <h1 class="titre-valeur">{partie.annee}</h1>
        <p>{minitel(personnage.prenom)} · {ageTexte}</p>
        <p class="discret">
          {libelle('sexe', personnage.origine.sexe)} · {libelle(
            'region',
            personnage.origine.region,
          )}
        </p>
      </div>
      <div class="pile">
        {#each NOMS_JAUGES as nom (nom)}
          <Jauge libelle={libelle('jauges', nom)} valeur={personnage.jauges[nom]} {anime} />
        {/each}
      </div>
      <div class="pile-serree">
        <LigneValeur libelle="SITUATION" valeur={situation} />
        <LigneValeur libelle="REVENU" valeur="{montant(finances.revenuAnnuel, partie.annee)}/AN" />
        <LigneValeur
          libelle="EPARGNE"
          valeur={montant(finances.epargne, partie.annee)}
          ton="valeur"
        />
        {#if totalAides > 0}
          <LigneValeur libelle="AIDES" valeur="{montant(totalAides, partie.annee)}/AN" />
        {/if}
        <LigneValeur
          libelle="DETTES"
          valeur={montant(finances.dettes, partie.annee)}
          ton="valeur"
        />
        {#if finances.endettement !== 'sain'}
          <LigneValeur libelle="ENDETTEMENT" valeur={endettement} ton="valeur" />
        {/if}
        {#each addictions as produit (produit)}
          <LigneValeur
            libelle={libelle('produits', produit)}
            valeur={libelle('etatsAddiction', personnage.etats.addictions[produit])}
            ton="valeur"
          />
        {/each}
        {#if jeu.totalMise > 0}
          <!-- Garde-fou : le total misé et récupéré au jeu reste toujours visible. -->
          <LigneValeur libelle="JEU · MISE" valeur={montant(jeu.totalMise, partie.annee)} />
          <LigneValeur libelle="JEU · RECUPERE" valeur={montant(jeu.totalRecupere, partie.annee)} />
        {/if}
        {#each nouvelles as entree, i (i)}
          <p class="nouvelle">{entree.texte}</p>
        {/each}
      </div>
    </section>

    <!-- Nouvelle année ou nouvel avis : l'encadré se redessine de haut en bas. -->
    {#key `${partie.annee}-${rangAvis}-${confirmation}`}
      <section class="droite" class:balayage={anime}>
        {#if confirmation}
          <Avis titre="SOMMAIRE">
            <p>QUITTER CETTE VIE ? ELLE NE SERA PAS SAUVEGARDEE.</p>
            <div class="pile">
              <BoutonNumerote numero={1} libelle="OUI, QUITTER" onclick={() => onconfirmer(true)} />
              <BoutonNumerote
                numero={2}
                libelle="NON, CONTINUER"
                onclick={() => onconfirmer(false)}
              />
            </div>
          </Avis>
        {:else if auto}
          <Avis titre="AUTO">
            {#each evenementsAuto as entree, i (i)}
              <p>{entree.texte}</p>
            {:else}
              <p>AUCUN EVENEMENT CETTE ANNEE.</p>
            {/each}
          </Avis>
        {:else if avis}
          <Avis
            titre={titreAvis}
            picto={pictoPour(avis.tags)}
            grave={avis.gravite === 3}
            grandMoment={avis.gravite === 3 || avis.tags.includes('etape')}
            {anime}
          >
            {#if totalAvis > 1}<p class="discret">AVIS {rangAvis + 1}/{totalAvis}</p>{/if}
            <p><TexteMinitel texte={avis.texte} {msParCaractere} /></p>
            {#each avis.ressources as id (id)}
              {#if RESSOURCES[id]}
                <p class="ressource">AIDE : {RESSOURCES[id].contact} · {RESSOURCES[id].nom}</p>
              {/if}
            {/each}
            {#if avis.choix.length > 0}
              <div class="pile" role="group" aria-label="Choix">
                {#each avis.choix as option, i (option.id)}
                  <BoutonNumerote
                    numero={i + 1}
                    libelle={option.libelle}
                    selectionne={choixFait === option.id}
                    onclick={() => onchoisir(i + 1)}
                  />
                {/each}
              </div>
            {/if}
          </Avis>
        {:else}
          <Avis titre="QUOTIDIEN">
            <p>AUCUN EVENEMENT CETTE ANNEE.</p>
          </Avis>
        {/if}
      </section>
    {/key}
  </div>
</div>

<div class="touches">
  <Touche libelle="SOMMAIRE" raccourci="S" onclick={onsommaire} />
  <Touche libelle={auto ? 'PAUSE' : 'AUTO'} raccourci="A" onclick={onauto} />
  <Touche
    libelle="ENVOI"
    raccourci="ENTREE"
    principale
    desactive={envoiBloque}
    mention={envoiBloque ? 'CHOISIS' : undefined}
    onclick={onenvoi}
  />
</div>

<style>
  .pile {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .flash {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: var(--ecart-blocs);
    padding-bottom: 8px;
    border-bottom: 2px dotted var(--pointilles);
  }

  .etiquette {
    padding: 0 6px;
    background: var(--valeur);
    color: var(--fond);
  }

  .titre-flash {
    margin-left: 8px;
    color: var(--valeur);
  }

  .nouvelle {
    color: var(--accent);
    font-size: var(--taille-precision);
  }

  .ressource {
    color: var(--accent);
    font-size: var(--taille-precision);
  }

  /* Rafraîchissement façon Minitel : l'encadré se redessine de haut en bas. */
  .balayage {
    animation: balayer 240ms steps(8) both;
  }

  @keyframes balayer {
    from {
      clip-path: inset(0 0 100% 0);
    }
    to {
      clip-path: inset(0);
    }
  }

  .pile-serree {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
