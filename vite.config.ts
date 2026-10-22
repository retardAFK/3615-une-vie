import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/3615-une-vie/',
  plugins: [svelte()],
  test: {
    include: ['tests/**/*.test.ts'],
    // Les tests lisent les feuilles de style brutes (?raw) : ne pas les vider.
    css: true,
  },
});
