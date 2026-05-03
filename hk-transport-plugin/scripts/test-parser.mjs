import { build as esbuildBuild } from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'dist', '.cache');
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

const testFile = join(CACHE_DIR, '_parser.js');
writeFileSync(testFile + '.ts', `
import { extractLocations } from '../../src/parser';
const qs = [
  '从中环到尖沙咀怎么走',
  '旺角到铜锣湾',
  '由中环到尖沙咀',
  '中环到尖沙咀',
  '从屯门到沙田',
  '去尖沙咀怎么走',
  '铜锣湾到旺角怎么去',
  '从落马洲口岸到香港立法会',
];
qs.forEach(q => {
  const r = extractLocations(q);
  console.log(q, '→', JSON.stringify(r));
});
`);

const res = await esbuildBuild({
  entryPoints: [testFile + '.ts'],
  bundle: true, outfile: testFile, platform: 'node', format: 'cjs', target: 'node18',
});
if (res.errors.length) { console.error(res.errors); process.exit(1); }
await import('file://' + testFile);
