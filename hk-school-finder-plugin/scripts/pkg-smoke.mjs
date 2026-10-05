// 鲁港通 - hk_school_finder 打包产物冒烟（在插件容器内运行，验证 .pkg 产物可加载 + 真实链路）
// 用法：docker exec lugang-ai-plugin node /tmp/hksf-test/pkg-smoke.mjs
const { default: plugin } = await import(new URL('./index.js', import.meta.url).href);

console.log('=== [1] manifest ===');
const manifest = plugin.getUserToolManifest();
console.log('pluginId:', manifest.pluginId);
console.log('version:', manifest.version);
console.log('name.zh-CN:', manifest.name['zh-CN']);
console.log('name.zh-Hant:', manifest.name['zh-Hant']);
console.log('tags:', JSON.stringify(manifest.tags));

console.log('=== [2] schemas / handler ===');
const { inputSchema, outputSchema, handler } = plugin.getToolHandler();
console.log('inputSchema ok:', inputSchema.safeParse({ query: '沙田区有哪些小学', level: 'primary' }).success);
console.log('unknown field stripped:', inputSchema.safeParse({ foo: 1 }).success);
console.log('handler type:', typeof handler);

console.log('=== [3] search 沙田区小学（真实下载教育局《学校位置总表》） ===');
let t0 = Date.now();
const search = await handler({ query: '沙田区有哪些小学', level: 'primary' });
console.log('耗时(ms):', Date.now() - t0);
console.log('outputSchema ok:', outputSchema.safeParse(search).success);
console.log('summary:', search.summary);
console.log('items:', (search.items || []).length);
console.log('dataDate:', search.dataDate);
console.log('error:', search.error);

console.log('=== [4] stats 沙田区（XLSX 解析，验证容器 zlib） ===');
t0 = Date.now();
const stats = await handler({ intent: 'stats', district: '沙田区' });
console.log('耗时(ms):', Date.now() - t0);
console.log('outputSchema ok:', outputSchema.safeParse(stats).success);
console.log('summary:', stats.summary);
console.log('items:', (stats.items || []).length);
console.log('error:', stats.error);

console.log('=== DONE ===');
