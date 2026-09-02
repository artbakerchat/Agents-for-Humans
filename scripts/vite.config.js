import { defineConfig } from 'vite';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../html', import.meta.url)),
  // Relative assets work for both a user/organization site and a project site.
  base: './',
  plugins: [{
    name: 'flatten-html-output',
    async writeBundle(options) {
      if (!options.dir) return;

      const outputDir = fileURLToPath(new URL('../dist/', import.meta.url));
      const htmlDir = resolve(outputDir, 'html');
      let entries;
      try {
        entries = await fs.readdir(htmlDir);
      } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
      }
      await Promise.all(entries.filter((entry) => entry.endsWith('.html')).map(async (entry) => {
        const source = resolve(htmlDir, entry);
        const target = resolve(outputDir, entry);
        const contents = await fs.readFile(source, 'utf8');
        await fs.writeFile(target, contents.replaceAll('../assets/', 'assets/'));
        await fs.unlink(source);
      }));

      if (!(await fs.readdir(htmlDir)).length) {
        await fs.rmdir(htmlDir);
      }
    }
  }],
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('../html/index.html', import.meta.url)),
        events: fileURLToPath(new URL('../html/events.html', import.meta.url)),
        approximation: fileURLToPath(new URL('../html/approximation.html', import.meta.url)),
        vision: fileURLToPath(new URL('../html/vision.html', import.meta.url)),
        ABC: fileURLToPath(new URL('../html/ABC.html', import.meta.url)),
        index_fr: fileURLToPath(new URL('../html/index_fr.html', import.meta.url)),
        events_fr: fileURLToPath(new URL('../html/events_fr.html', import.meta.url)),
        approximation_fr: fileURLToPath(new URL('../html/approximation_fr.html', import.meta.url)),
        vision_fr: fileURLToPath(new URL('../html/vision_fr.html', import.meta.url)),
        ABC_fr: fileURLToPath(new URL('../html/ABC_fr.html', import.meta.url)),
        poetry: fileURLToPath(new URL('../html/poetry.html', import.meta.url)),
        poetry_fr: fileURLToPath(new URL('../html/poetry_fr.html', import.meta.url)),
        advisory: fileURLToPath(new URL('../html/advisory.html', import.meta.url)),
        advisory_fr: fileURLToPath(new URL('../html/advisory_fr.html', import.meta.url)),
        expressions: fileURLToPath(new URL('../html/expressions.html', import.meta.url)),
        expressions_fr: fileURLToPath(new URL('../html/expressions_fr.html', import.meta.url)),
        threeD: fileURLToPath(new URL('../html/3D.html', import.meta.url)),
        threeD_fr: fileURLToPath(new URL('../html/3D_fr.html', import.meta.url)),
        portraits: fileURLToPath(new URL('../html/portraits.html', import.meta.url)),
        portraits_fr: fileURLToPath(new URL('../html/portraits_fr.html', import.meta.url))
      }
    }
  }
});
