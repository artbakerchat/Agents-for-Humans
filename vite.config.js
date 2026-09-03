import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const html = (name) => resolve(process.cwd(), name);

export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787'
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: html('index.html'), events: html('events.html'), approximation: html('approximation.html'),
        vision: html('vision.html'), ABC: html('ABC.html'), index_fr: html('index_fr.html'),
        events_fr: html('events_fr.html'), approximation_fr: html('approximation_fr.html'),
        vision_fr: html('vision_fr.html'), ABC_fr: html('ABC_fr.html'), poetry: html('poetry.html'),
        poetry_fr: html('poetry_fr.html'), advisory: html('advisory.html'), advisory_fr: html('advisory_fr.html'),
        expressions: html('expressions.html'), expressions_fr: html('expressions_fr.html'), threeD: html('3D.html'),
        threeD_fr: html('3D_fr.html'), portraits: html('portraits.html'), portraits_fr: html('portraits_fr.html')
      }
    }
  }
});
