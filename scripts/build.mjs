import { copyFile, rm } from 'node:fs/promises';

import { build } from 'esbuild';

await rm('dist', { force: true, recursive: true });
const builtAt = new Date().toISOString();
await build({
  banner: {
    js: `/* Quantumult X Resource Parser v0.1.0 | Built at ${builtAt} | MIT */`,
  },
  bundle: true,
  entryPoints: ['src/resource-parser.ts'],
  format: 'iife',
  legalComments: 'eof',
  minify: true,
  outfile: 'dist/resource-parser.js',
  platform: 'browser',
  target: ['es2017'],
});

await build({
  banner: {
    js: `/* Quantumult X Single-Node Probe | Built at ${builtAt} | MIT */`,
  },
  bundle: true,
  entryPoints: ['src/resource-parser-probe.ts'],
  format: 'iife',
  legalComments: 'eof',
  minify: true,
  outfile: 'dist/resource-parser-probe.txt',
  platform: 'browser',
  target: ['es2017'],
});

// GitHub Pages serves .js as application/javascript. Quantumult X is more
// reliable with parser URLs served as text/plain, like GitHub raw URLs.
await copyFile('dist/resource-parser.js', 'dist/resource-parser.txt');
await copyFile('dist/resource-parser.js', 'dist/resource-parser-lite.txt');
await copyFile('dist/resource-parser.js', 'dist/resource-parser-native.txt');
await copyFile('src/static-probe.js', 'dist/static-probe.txt');
