import { rm } from 'node:fs/promises';

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
  target: ['es2020'],
});
