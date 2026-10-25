import { defineConfig } from 'vite';

// GitHub project Pages serves the site below /grain-war-game/.
// BASE_PATH also supports custom domains and other static hosting targets.
export default defineConfig({
  base: process.env.BASE_PATH || '/grain-war-game/',
});
