// 鲁港通 - 冒烟补充：仅 query 原话（无结构化参数）时的兜底表现摸底
const { default: plugin } = await import(new URL('./index.js', import.meta.url).href);
const { handler } = plugin.getToolHandler();

console.log('=== A: 仅 query=「沙田区有哪些小学」（模型未拆分参数）===');
const a = await handler({ query: '沙田区有哪些小学' });
console.log('summary:', (a.summary || '').slice(0, 160));
console.log('items:', (a.items || []).length);

console.log('=== B: 仅 query=「喇沙书院的学费」（查具体学校）===');
const b = await handler({ query: '喇沙书院的学费' });
console.log('summary:', (b.summary || '').slice(0, 160));
console.log('items:', (b.items || []).length);

console.log('=== C: intent=stats + query=「沙田区学生人数」（原话作区域）===');
const c = await handler({ intent: 'stats', query: '沙田区学生人数' });
console.log('summary:', (c.summary || '').slice(0, 160));
console.log('items:', (c.items || []).length);

console.log('=== D: 仅 query=「喇沙书院」（纯校名原话）===');
const d = await handler({ query: '喇沙书院' });
console.log('summary:', (d.summary || '').slice(0, 160));
console.log('items:', (d.items || []).length);

console.log('=== DONE ===');
