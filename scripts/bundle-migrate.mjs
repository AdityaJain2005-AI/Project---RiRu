#!/usr/bin/env node
// Bundles migrate.js + pg into a self-contained migrate.cjs using
// esbuild. The runtime container has no node_modules alongside
// migrate.js - pg is inside .next/standalone/node_modules. Bundling
// avoids NODE_PATH workarounds and is more reliable across deploys.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const phase1 = readFileSync(new URL('../db/phase1.sql', import.meta.url), 'utf8');
const phase2 = readFileSync(new URL('../db/phase2.sql', import.meta.url), 'utf8');
const phase3 = readFileSync(new URL('../db/phase3.sql', import.meta.url), 'utf8');

await build({
  entryPoints: ['migrate.js'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'migrate.cjs',
  external: [],
  define: {
    __PHASE1_SQL__: JSON.stringify(phase1),
    __PHASE2_SQL__: JSON.stringify(phase2),
    __PHASE3_SQL__: JSON.stringify(phase3),
  },
});

console.log('Bundled migrate.js -> migrate.cjs');
