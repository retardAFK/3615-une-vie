import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/3615-une-vie/',
  plugins: [svelte()],
  test: {
    include: ['tests/**/*.test.ts'],
    // Les tests lisent les feuilles de style brutes (?raw) : ne pas les vider.
    css: true,
    // Le cache de modules sur disque réutilise une transformation tant que le fichier
    // ne change pas, même si un import.meta.glob correspond à de nouveaux fichiers.
    fsModuleCache: false,
    // Fichiers de test l'un après l'autre : les tests lourds (10 000 vies) ne se
    // disputent pas le processeur, et la mesure de performance reste fiable.
    fileParallelism: false,
  },
});
