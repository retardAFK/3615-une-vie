<script lang="ts">
  import type { EntreeJournal, EtatPartie, EvenementTire, Jauges } from '../../moteur/types';
  import Avis from '../composants/Avis.svelte';
  import BarreTitre from '../composants/BarreTitre.svelte';
  import BoutonNumerote from '../composants/BoutonNumerote.svelte';
  import Jauge from '../composants/Jauge.svelte';
  import LigneValeur from '../composants/LigneValeur.svelte';
  import Touche from '../composants/Touche.svelte';
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
    onchoisir: (numero: number) => void;
    onenvoi: () => void;
    onauto: () => void;
    onsommaire: () => void;
    onconfirmer: (quitter: boolean) => void;
  } = $props();

  const personnage = $derived(partie.personnage);
  const ageTexte = $derived(`${personnage.age} ${personnage.age > 1 ? 'ANS' : 'AN'}`);
  const titreAvis = $derived(minitel(avis?.tags[0] ?? 'quotidien'));
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
          <Jauge libelle={libelle('jauges', nom)} valeur={personnage.jauges[nom]} />
        {/each}
      </div>
      <LigneValeur
        libelle="EPARGNE"
        valeur={montant(personnage.finances.epargne, partie.annee)}
        ton="valeur"
      />
      {#if personnage.finances.dettes > 0}
        <LigneValeur
          libelle="DETTES"
          valeur={montant(personnage.finances.dettes, partie.annee)}
          ton="valeur"
        />
      {/if}
    </section>

    <section class="droite">
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
        <Avis titre={titreAvis}>
          {#if totalAvis > 1}<p class="discret">AVIS {rangAvis + 1}/{totalAvis}</p>{/if}
          <p>{avis.texte}</p>
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
</style>
