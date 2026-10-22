import '@fontsource/vt323';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import { mount } from 'svelte';
import App from './ui/App.svelte';

const cible = document.getElementById('app');
if (!cible) throw new Error('Element #app introuvable');

export default mount(App, { target: cible });
