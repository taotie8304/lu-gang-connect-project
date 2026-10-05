// 鲁港通 - tool 集成测试（mock global.fetch，不真联网）+ SDK 封装层导出测试
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputType, tool } from '../src/index';
import pluginExport from '../index';

// 鲁港通 - 构造一段固定 Bing HTML：政府/媒体/社交/营销/未知各一条
function buildBingHtml(): string {
  const item = (href: string, title: string, snippet: string) => `
    <li class="b_algo">
      <h2><a href="${href}">${title}</a></h2>
      <div class="b_caption"><p>${snippet}</p></div>
    </li>`;
  return (
    '<html><body><ol id="b_results">' +
    item('https://www.gov.hk/tc/', '香港政府一站通', '政府摘要') +
    item('https://hk01.com/article/123', '港聞', '媒體摘要') +
    item('https://facebook.com/govpage', 'FB 官方賬號', '社交摘要') +
    item('https://klook.com/activity', 'Klook 門票', '營銷摘要') +
    item('https://random-blog.com/post', '個人博客', '未知摘要') +
    '</ol></body></html>'
  );
}

function stubFetchHtml(html: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => html
    }))
  );
}

describe('SDK 封装层导出（defineTool）', () => {
  it('manifest pluginId 使用下划线、三语名称、toolDescription 为字符串', () => {
    const manifest = pluginExport.getUserToolManifest();
    expect(manifest.pluginId).toBe('hk_gov_websearch');
    expect(manifest.pluginId).not.toContain('-');
    expect(manifest.version).toBe('1.0.1');
    expect(manifest.name['zh-CN']).toBe('政府官网联网搜索');
    expect(manifest.name.en).toBe('HK Official-Source Web Search');
    expect(typeof manifest.toolDescription).toBe('string');
    expect(manifest.toolDescription).toContain('【必须调用】');
    expect(manifest.toolDescription).toContain('不要重复调用');
    expect(manifest.tags).toContain('tools');
  });

  it('handler 定义含 inputSchema/outputSchema/handler', () => {
    const def = pluginExport.getToolHandler();
    expect(def.inputSchema).toBeDefined();
    expect(def.outputSchema).toBeDefined();
    expect(typeof def.handler).toBe('function');
    // SDK 层 inputSchema 为纯 object，可校验缺省可选字段的输入
    expect(def.inputSchema.safeParse({ query: '强积金' }).success).toBe(true);
  });
});

describe('tool 业务集成（official 默认过滤）', () => {
  beforeEach(() => stubFetchHtml(buildBingHtml()));
  afterEach(() => vi.unstubAllGlobals());

  it('只保留政府+媒体，社交/营销/未知被剔除，计数正确', async () => {
    const input = await InputType.parseAsync({ query: '香港人才清单' });
    const out = await tool(input);

    expect(out.metadata.rawCount).toBe(5);
    expect(out.resultCount).toBe(2);
    expect(out.filteredOut).toBe(3);
    expect(out.results.map((r) => r.source)).toEqual(['gov.hk', 'hk01.com']);
    expect(out.results.map((r) => r.sourceType)).toEqual(['gov', 'news']);
    // 红线：绝不含任何社交媒体 / 营销平台
    const allUrls = out.results.map((r) => r.url).join(' ');
    expect(allUrls).not.toMatch(/facebook|klook|random-blog/);
    // _debug 存在且为诊断数组、不含密钥类信息（本插件本就无密钥）
    expect(Array.isArray(out._debug)).toBe(true);
  });

  it('SDK handler 返回结果通过 outputSchema 且已剔除 _debug', async () => {
    const def = pluginExport.getToolHandler();
    const returned = (await def.handler(
      { query: '香港人才清单' },
      {} as never
    )) as Record<string, unknown>;

    expect('_debug' in returned).toBe(false);
    expect(def.outputSchema.safeParse(returned).success).toBe(true);
    expect(returned.resultCount).toBe(2);
  });
});

describe('tool 业务集成（open 完全不过滤）', () => {
  beforeEach(() => stubFetchHtml(buildBingHtml()));
  afterEach(() => vi.unstubAllGlobals());

  it('open 模式社交/营销/未知全部放行', async () => {
    const input = await InputType.parseAsync({
      query: '維港好去處',
      searchScope: 'open'
    });
    const out = await tool(input);
    expect(out.resultCount).toBe(5);
    expect(out.filteredOut).toBe(0);
    expect(out.searchScope).toBe('open');
  });
});

describe('tool 空结果与上游失败', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('official 下仅剩社交结果 → 空结果 + 可操作中文错误（反重试）', async () => {
    const socialOnly =
      '<html><body><li class="b_algo"><h2><a href="https://instagram.com/x">ig</a></h2><div class="b_caption"><p>s</p></div></li></body></html>';
    stubFetchHtml(socialOnly);

    const input = await InputType.parseAsync({ query: '不存在的政策xyz' });
    const out = await tool(input);
    expect(out.resultCount).toBe(0);
    expect(out.results).toEqual([]);
    expect(out.error).toContain('暂未从政府及权威官网检索到');
    expect(out.error).toContain('知识库');
  });

  it('英文语言返回英文空结果文案', async () => {
    stubFetchHtml('<html>challenge</html>');
    const input = await InputType.parseAsync({
      query: 'unknown policy',
      language: 'en'
    });
    const out = await tool(input);
    expect(out.resultCount).toBe(0);
    expect(out.error).toMatch(/official-source|knowledge base/i);
  });

  it('fetch 直接失败也不抛异常，返回空结果与错误说明', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    const input = await InputType.parseAsync({ query: '强积金提取条件' });
    const out = await tool(input);
    expect(out.resultCount).toBe(0);
    expect(typeof out.error).toBe('string');
  });
});
