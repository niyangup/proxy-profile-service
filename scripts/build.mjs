import { cp, mkdir, rm } from 'node:fs/promises';

import { build } from 'esbuild';

await rm('dist', { force: true, recursive: true });
await mkdir('dist', { recursive: true });
await build({
  banner: {
    js: '/* Quantumult X Resource Parser v0.1.0 | MIT | Built from independently authored source */',
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
await cp('public', 'dist', { recursive: true });
