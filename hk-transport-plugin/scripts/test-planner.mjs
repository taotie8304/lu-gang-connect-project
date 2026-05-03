// 本地快速测试：planner 是否能找到中环→尖沙咀的多模式路线
//
// 跑法：node scripts/test-planner.mjs

import { build as esbuildBuild } from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'dist', '.cache');
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

// 只 bundle planner 部分，跑出来
const testFile = join(CACHE_DIR, '_test.js');

const wrapper = `
import { planPublicTransit } from '../../src/planner';

(async () => {
  const cases = [
    { name: '中环→尖沙咀', oLat: 22.2819, oLng: 114.1585, dLat: 22.2988, dLng: 114.1722 },
    { name: '旺角→铜锣湾', oLat: 22.3193, oLng: 114.1694, dLat: 22.2801, dLng: 114.1840 },
    { name: '落马洲→香港机场', oLat: 22.5144, oLng: 114.0683, dLat: 22.3080, dLng: 113.9185 },
    { name: '屯门→沙田', oLat: 22.3908, oLng: 113.9731, dLat: 22.3813, dLng: 114.1886 },
    { name: '尖沙咀→中环（反向）', oLat: 22.2988, oLng: 114.1722, dLat: 22.2819, dLng: 114.1585 },
  ];

  for (const c of cases) {
    const res = await planPublicTransit(c.oLat, c.oLng, c.dLat, c.dLng);
    console.log('\\n==== ' + c.name + ' ====');
    console.log('候选数:', res.candidates.length);
    if (res.indexError) console.log('错误:', res.indexError);
    if (res.noNearbyStops) console.log('附近无站点');
    res.candidates.slice(0, 5).forEach((cd, i) => {
      console.log(\`  [\${i+1}] \${cd.mode}/\${cd.company} \${cd.route} \${cd.bound} (\${cd.numStops}站) \` +
        \`走\${cd.walkInMeters}m→"\${cd.boardStopName}" → "\${cd.alightStopName}"→走\${cd.walkOutMeters}m, \` +
        \`fare=\${cd.fare}, score=\${cd.score.toFixed(2)}\`);
    });
  }
})();
`;

writeFileSync(testFile + '.ts', wrapper);

const res = await esbuildBuild({
  entryPoints: [testFile + '.ts'],
  bundle: true,
  outfile: testFile,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  loader: { '.ts': 'ts' },
  external: [],
});

if (res.errors.length > 0) {
  console.error('bundle err', res.errors);
  process.exit(1);
}

// 执行
await import('file://' + testFile);
