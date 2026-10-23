<script lang="ts">
  import BarreTitre from '../composants/BarreTitre.svelte';
  import Touche from '../composants/Touche.svelte';
  import { nombreDePages, page as pageDe, type LigneJournal } from '../journal';
  import { minitel } from '../texte';

  let {
    prenom,
    lignes,
    page = $bindable(0),
    onreprendre,
  }: {
    prenom: string;
    lignes: readonly LigneJournal[];
    /** Page affichée, de 0 à nombreDePages - 1. */
    page?: number;
    onreprendre: () => void;
  } = $props();

  const total = $derived(nombreDePages(lignes.length));
  const visibles = $derived(pageDe(lignes, page));
</script>

<BarreTitre libelle="JOURNAL" />

<div class="contenu">
  <div class="entete">
    <h1 class="titre-valeur">{minitel(prenom)}</h1>
    <p class="discret">PAGE {page + 1}/{total}</p>
  </div>
  <ul class="legende" aria-label="Legende">
    <li><span class="carre argent"></span>ARGENT</li>
    <li><span class="carre jeu"></span>JEU</li>
    <li><span class="carre choc"></span>CHOC</li>
  </ul>
  <ol class="liste">
    {#each visibles as ligne, i (`${page}-${i}`)}
      <li class="ligne">
        <p class="date">
          <span class="annee">{ligne.annee}</span>
          <span class="age">{ligne.age} {ligne.age > 1 ? 'ANS' : 'AN'}</span>
        </p>
        <p class="texte {ligne.categorie}">{ligne.texte}</p>
      </li>
    {/each}
  </ol>
</div>

<div class="touches">
  <Touche
    libelle="RETOUR"
    raccourci="ECHAP"
    desactive={page === 0}
    onclick={() => (page = Math.max(0, page - 1))}
  />
  <Touche
    libelle="SUITE"
    raccourci="ENTREE"
    desactive={page >= total - 1}
    onclick={() => (page = Math.min(total - 1, page + 1))}
  />
  <Touche libelle="REPRENDRE" raccourci="J" principale onclick={onreprendre} />
</div>

<style>
  .entete {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  .legende {
    display: flex;
    gap: 16px;
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
    font-size: var(--taille-precision);
    color: var(--texte-discret);
  }

  .carre {
    display: inline-block;
    width: 0.6em;
    height: 0.6em;
    margin-right: 6px;
  }

  .carre.argent {
    background: var(--valeur);
  }

  .carre.jeu {
    background: var(--alerte);
  }

  .carre.choc {
    background: var(--choc);
  }

  .liste {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ligne {
    display: grid;
    grid-template-columns: 4.5em 1fr;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--piste);
  }

  .date {
    margin: 0;
    display: flex;
    flex-direction: column;
  }

  .annee {
    color: var(--accent);
  }

  .age {
    font-size: var(--taille-precision);
    color: var(--texte-discret);
  }

  .texte {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .texte.argent {
    color: var(--valeur);
  }

  .texte.jeu {
    color: var(--alerte);
  }

  .texte.choc {
    color: var(--choc);
  }

  .texte.actualite {
    color: var(--texte-discret);
  }
</style>
