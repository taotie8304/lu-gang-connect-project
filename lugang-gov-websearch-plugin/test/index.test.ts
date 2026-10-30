// 鲁港通 - tool 集成测试（mock global.fetch，不真联网）+ SDK 封装层导出测试
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import z from 'zod';
import { InputType, tool } from '../src/index';
import { buildSearchAttempts, toTraditionalHk } from '../src/query-variants';
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
    expect(manifest.version).toBe('1.5.0');
    expect(manifest.name['zh-CN']).toBe('政府官网联网搜索');
    expect(manifest.name.en).toBe('HK Official-Source Web Search');
    expect(typeof manifest.toolDescription).toBe('string');
    expect(manifest.toolDescription).toContain('【必须调用】');
    expect(manifest.toolDescription).toContain('不要重复调用');
    // 鲁港通 - v1.4.0 大陆档扩到官方媒体：新建节点会从这里复制说明，须写明媒体范围
    expect(manifest.toolDescription).toContain('中央重点新闻网站');
    expect(manifest.toolDescription).toContain('山东省级与济南市级党媒');
    expect(manifest.tags).toContain('tools');
  });

  it('manifest 文案不含内部术语（「知识库」类泄漏词零残留）', () => {
    const manifest = pluginExport.getUserToolManifest();
    const blob = [
      manifest.toolDescription,
      ...Object.values(manifest.description)
    ].join('\n');
    expect(blob).not.toMatch(/知识库|知識庫|knowledge\s+base/i);
  });

  it('secretSchema 声明可选百炼密钥（isSecret 透传后台加密配置）', () => {
    const def = pluginExport.getToolHandler();
    const schema = def.secretSchema as unknown as
      | z.ZodObject<any>
      | undefined;
    expect(schema).toBeDefined();
    expect(schema!.safeParse({}).success).toBe(true);
    expect(schema!.safeParse({ dashscopeApiKey: 'sk-x' }).success).toBe(true);
    const json: any = z.toJSONSchema(schema!);
    expect(json.properties.dashscopeApiKey.isSecret).toBe(true);
    expect(json.properties.dashscopeApiKey.type).toBe('string');
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
    // 鲁港通 - 来源网址清单：与结果一一对应（标题+网址），供聊天底部来源卡片展示可点击链接
    expect(out.citeLinks).toEqual([
      { name: '香港政府一站通', url: 'https://www.gov.hk/tc/' },
      { name: '港聞', url: 'https://hk01.com/article/123' }
    ]);
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
    // 鲁港通 - 清单经 SDK 层透传（未被剔除），且条数与结果一致
    expect(Array.isArray(returned.citeLinks)).toBe(true);
    expect((returned.citeLinks as unknown[]).length).toBe(2);
  });
});

describe('tool 业务集成（金融/医疗官方来源放行）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('银行/保险/医疗官网在 official 模式放行，sourceType 正确', async () => {
    const financeHtml =
      '<html><body><ol id="b_results">' +
      '<li class="b_algo"><h2><a href="https://www.hsbc.com.hk/accounts/">滙豐銀行開戶</a></h2><div class="b_caption"><p>滙豐摘要</p></div></li>' +
      '<li class="b_algo"><h2><a href="https://www.aia.com.hk/">友邦保險</a></h2><div class="b_caption"><p>友邦摘要</p></div></li>' +
      '<li class="b_algo"><h2><a href="https://www.hksh.com/">養和醫院</a></h2><div class="b_caption"><p>養和摘要</p></div></li>' +
      '<li class="b_algo"><h2><a href="https://www.gov.hk/tc/">政府一站通</a></h2><div class="b_caption"><p>政府摘要</p></div></li>' +
      '</ol></body></html>';
    stubFetchHtml(financeHtml);

    const input = await InputType.parseAsync({
      query: '香港汇丰银行怎么开户 个人账户'
    });
    const out = await tool(input);

    expect(out.resultCount).toBe(4);
    expect(out.filteredOut).toBe(0);
    expect(out.results.map((r) => r.source)).toEqual([
      'hsbc.com.hk',
      'aia.com.hk',
      'hksh.com',
      'gov.hk'
    ]);
    expect(out.results.map((r) => r.sourceType)).toEqual([
      'finance',
      'finance',
      'medical',
      'gov'
    ]);
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
    expect(out.citeLinks).toEqual([]);
    expect(out.error).toContain('暂未从官方来源检索到');
    // 鲁港通 - 兜底文案不得出现内部术语
    expect(out.error).toContain('已有权威资料');
    expect(out.error).not.toMatch(/知识库|知識庫/);
  });

  it('英文语言返回英文空结果文案（不含 knowledge base）', async () => {
    stubFetchHtml('<html>challenge</html>');
    const input = await InputType.parseAsync({
      query: 'unknown policy',
      language: 'en'
    });
    const out = await tool(input);
    expect(out.resultCount).toBe(0);
    expect(out.error).toMatch(/official-source/i);
    expect(out.error).toMatch(/authoritative material/i);
    expect(out.error).not.toMatch(/knowledge\s+base/i);
  });

  it('繁体语言兜底文案不含知識庫', async () => {
    const socialOnly =
      '<html><body><li class="b_algo"><h2><a href="https://instagram.com/x">ig</a></h2><div class="b_caption"><p>s</p></div></li></body></html>';
    stubFetchHtml(socialOnly);
    const input = await InputType.parseAsync({
      query: '不存在的政策xyz',
      language: 'zh-HK'
    });
    const out = await tool(input);
    expect(out.error).toContain('既有權威資料');
    expect(out.error).not.toContain('知識庫');
  });

  // 鲁港通 - 1.5.0 起简体查询会追加繁体变体，每次尝试含必应 3 次重试（间隔 1.5s），故放宽超时
  it(
    'fetch 直接失败也不抛异常，返回空结果与错误说明',
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network down');
        })
      );
      const input = await InputType.parseAsync({ query: '强积金提取条件' });
      const out = await tool(input);
      expect(out.resultCount).toBe(0);
      expect(out.citeLinks).toEqual([]);
      expect(typeof out.error).toBe('string');
    },
    20_000
  );
});

// ============================================================
// 多源链路（百炼优先；无密钥时必应兜底）+ 科创定向增强补发
// ============================================================
interface BailianPlan {
  mainPages?: Array<{ url: string; title: string; snippet: string }>;
  boostPages?: Array<{ url: string; title: string; snippet: string }>;
  callErrorMessage?: string;
}

function page(url: string, title: string, snippet = '摘要') {
  return { url, title, snippet };
}

function bailianCallBody(
  pages: Array<{ url: string; title: string; snippet: string }>
): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    result: { content: [{ type: 'text', text: JSON.stringify({ pages }) }] }
  });
}

// 鲁港通 - 按 URL 路由的 fetch 桩：百炼走 MCP 信封、必应返回固定 HTML
function stubRoutedFetch(plan: BailianPlan, bingHtml: string) {
  const calls: Array<{ url: string; method: string; query: string }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('dashscope.aliyuncs.com')) {
        const payload = JSON.parse(String(init?.body ?? '{}')) as {
          method: string;
          params?: { name?: string; arguments?: { query?: string } };
        };
        const query = payload.params?.arguments?.query ?? '';
        calls.push({ url, method: payload.method, query });
        if (payload.method === 'initialize') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () =>
              JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })
          };
        }
        if (plan.callErrorMessage) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () =>
              JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                error: { code: -1, message: plan.callErrorMessage }
              })
          };
        }
        const pages =
          query.startsWith('site:') || /\bsite:\S+$/.test(query)
            ? (plan.boostPages ?? [])
            : (plan.mainPages ?? []);
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => bailianCallBody(pages)
        };
      }
      calls.push({ url, method: 'bing', query: '' });
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => bingHtml
      };
    })
  );
  return { calls };
}

const SECRETS = { dashscopeApiKey: 'sk-test' };

describe('多源链路（百炼优先；无密钥时必应）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('有密钥且百炼有结果：engine=bailian，必应不被调用', async () => {
    const { calls } = stubRoutedFetch(
      {
        mainPages: [
          page('https://www.gov.hk/a', '政府A'),
          page('https://hk01.com/b', '媒体B'),
          page('https://gov.hk/c', '政府C')
        ]
      },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: '香港人才清单',
      maxResults: 3
    });
    const out = await tool(input, SECRETS);

    expect(out.metadata.engine).toBe('bailian');
    expect(out.resultCount).toBe(3);
    expect(out.filteredOut).toBe(0);
    expect(out.metadata.rawCount).toBe(3);
    expect(out.results.map((r) => r.sourceType)).toEqual([
      'gov',
      'news',
      'gov'
    ]);
    expect(calls.filter((c) => c.method === 'bing')).toHaveLength(0);
  });

  // 鲁港通 - 必应通道已被反爬封死（实测 b_algo=0），不再作为百炼的兜底源
  it('百炼异常（RPC error）：不降级必应，返回可操作错误文案', async () => {
    const { calls } = stubRoutedFetch(
      { callErrorMessage: 'Invalid API-key provided' },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({ query: '香港人才清单' });
    const out = await tool(input, SECRETS);

    expect(out.metadata.engine).toBe('bailian');
    expect(out.resultCount).toBe(0);
    expect(out.error).toContain('联网搜索暂时不可用');
    expect(out.results).toEqual([]);
    expect(calls.filter((c) => c.method === 'bing')).toHaveLength(0);
    expect((out._debug ?? []).join('\n')).toContain('Invalid API-key');
  });

  // 鲁港通 - 百炼偶发空手：主搜重试 1 次；仍空则由主题定向补发兜（此桩补发也空）
  it('百炼空结果（科创题）：主搜重试 1 次 + 主题定向补发，仍空则无结果（不降级必应）', async () => {
    const { calls } = stubRoutedFetch({ mainPages: [] }, buildBingHtml());
    const input = await InputType.parseAsync({ query: '香港科创资助' });
    const out = await tool(input, SECRETS);

    expect(out.metadata.engine).toBe('bailian');
    expect(out.resultCount).toBe(0);
    expect(out.error).toContain('暂未从官方来源检索到');
    expect(calls.filter((c) => c.method === 'bing')).toHaveLength(0);
    const mainCalls = calls.filter(
      (c) => c.method === 'tools/call' && c.query === '香港科创资助'
    );
    expect(mainCalls).toHaveLength(2); // 空手重试 1 次
    // 鲁港通 - 主源 0 条时 active 为空，booster 兜底仍应触发主题定向补发（前缀式 + 繁体官方词）
    expect(calls.some((c) => c.query === 'site:hkstp.org 創科培育計劃 資助')).toBe(true);
    expect(calls.some((c) => c.query === 'site:cyberport.hk 培育計劃 資助')).toBe(true);
  });

  // 鲁港通 - 香港档补发主题定向（前缀式 + 繁体官方词）：hkstp 命中并够数即停
  // 鲁港通 - 补发并发：两条定向查询同时发出（以少量冗余请求换响应速度），结果仍去重后取上限
  it('增强补发（香港档科创题）：前缀式 site: 定向并发发出，结果去重', async () => {
    const { calls } = stubRoutedFetch(
      {
        mainPages: [page('https://www.gov.hk/a', '政府A')],
        boostPages: [page('https://www.hkstp.org/en/x', '科技园A')]
      },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: '香港科创资助',
      maxResults: 2
    });
    const out = await tool(input, SECRETS);

    expect(out.metadata.engine).toBe('bailian');
    const toolsCalls = calls.filter(
      (c) => c.url.includes('dashscope') && c.method === 'tools/call'
    );
    expect(toolsCalls.map((c) => c.query)).toEqual([
      '香港科创资助',
      // 鲁港通 - 1.5.0 简体首搜不够数 → 追加繁体变体重试，再进主题补发
      '香港科創資助',
      'site:hkstp.org 創科培育計劃 資助',
      'site:cyberport.hk 培育計劃 資助'
    ]);
    expect(out.resultCount).toBe(2);
    expect(out.results.map((r) => r.source)).toEqual([
      'gov.hk',
      'hkstp.org'
    ]);
    expect(out.results.map((r) => r.sourceType)).toEqual(['gov', 'public']);
  });

  // 鲁港通 - 第一轮仍不足时补 cyberport 定向；重复 URL 去重、不重复计数
  it('增强补发（香港档科创题）：第一轮不足再补 site:cyberport.hk，重复结果去重', async () => {
    const { calls } = stubRoutedFetch(
      {
        mainPages: [page('https://www.gov.hk/a', '政府A')],
        boostPages: [
          page('https://www.hkstp.org/en/x', '科技园A'),
          page('https://www.cyberport.hk/tc/y', '数码港B')
        ]
      },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: '香港科创资助',
      maxResults: 5
    });
    const out = await tool(input, SECRETS);

    const toolsCalls = calls.filter(
      (c) => c.url.includes('dashscope') && c.method === 'tools/call'
    );
    expect(toolsCalls.map((c) => c.query)).toEqual([
      '香港科创资助',
      '香港科創資助',
      'site:hkstp.org 創科培育計劃 資助',
      'site:cyberport.hk 培育計劃 資助'
    ]);
    expect(out.metadata.rawCount).toBe(3); // 第二轮与第一轮重复，已去重
    expect(out.resultCount).toBe(3);
    expect(out.results.map((r) => r.sourceType)).toEqual([
      'gov',
      'public',
      'public'
    ]);
  });

  // 鲁港通 - 非主题词查询不补发：避免无效站点查询与无关内容混入（人才/民生类走主搜索）
  it('增强补发（香港档）：非主题词（人才清单）不足也不补发', async () => {
    const { calls } = stubRoutedFetch(
      { mainPages: [page('https://www.gov.hk/a', '政府A')] },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: '香港人才清单',
      maxResults: 5
    });
    const out = await tool(input, SECRETS);

    const toolsCalls = calls.filter(
      (c) => c.url.includes('dashscope') && c.method === 'tools/call'
    );
    // 鲁港通 - 1.5.0：简体首搜不足先补繁体变体；人才类无主题词，仍不发 site: 定向
    expect(toolsCalls.map((c) => c.query)).toEqual([
      '香港人才清单',
      '香港人才清單'
    ]);
    expect(out.resultCount).toBe(1);
  });

  // 鲁港通 - 金融语境误匹配防护：出现「创新高/创业板」等词不得触发培育补发
  it('增强补发（香港档）：金融语境词（港股创新高）不误触发补发', async () => {
    const { calls } = stubRoutedFetch(
      { mainPages: [page('https://www.gov.hk/a', '政府A')] },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: '港股创新高 后市走势',
      maxResults: 5
    });
    const out = await tool(input, SECRETS);

    const toolsCalls = calls.filter(
      (c) => c.url.includes('dashscope') && c.method === 'tools/call'
    );
    // 鲁港通 - 繁体变体会补发，但「创新高」已剔除，不得触发培育定向
    expect(toolsCalls.map((c) => c.query)).toEqual([
      '港股创新高 后市走势',
      '港股創新高 後市走勢'
    ]);
    expect(toolsCalls.some((c) => c.query.startsWith('site:'))).toBe(false);
    expect(out.resultCount).toBe(1);
  });

  // 鲁港通 - BUD 主题：只发 bud.hkpc.org 子域定向（hkpc 主域 site: 实测无效）
  it('增强补发（香港档 BUD 题）：site:bud.hkpc.org 定向', async () => {
    const { calls } = stubRoutedFetch(
      {
        mainPages: [page('https://www.gov.hk/a', '政府A')],
        boostPages: [page('https://bud.hkpc.org/tc/x', 'BUD主页')]
      },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: 'BUD 专项基金 申请资格',
      maxResults: 3
    });
    const out = await tool(input, SECRETS);

    const toolsCalls = calls.filter(
      (c) => c.url.includes('dashscope') && c.method === 'tools/call'
    );
    expect(toolsCalls.map((c) => c.query)).toEqual([
      'BUD 专项基金 申请资格',
      'BUD 專項基金 申請資格',
      'site:bud.hkpc.org BUD 專項基金'
    ]);
    expect(out.results.map((r) => r.source)).toEqual(['gov.hk', 'bud.hkpc.org']);
  });

  // 鲁港通 - 河套主题：itib 定向优先，其次科创培育兜底，总查询数封顶 3
  it('增强补发（香港档河套题）：itib 定向 + 科创培育兜底，封顶 3 条', async () => {
    const { calls } = stubRoutedFetch(
      {
        mainPages: [page('https://www.gov.hk/a', '政府A')],
        boostPages: [page('https://www.itib.gov.hk/tc/x', '河套页')]
      },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: '河套培育计划 资助',
      maxResults: 5
    });
    const out = await tool(input, SECRETS);

    const boostQueries = calls
      .filter((c) => c.method === 'tools/call' && c.query.startsWith('site:'))
      .map((c) => c.query);
    expect(boostQueries).toEqual([
      'site:itib.gov.hk 河套 創科',
      'site:hkstp.org 創科培育計劃 資助',
      'site:cyberport.hk 培育計劃 資助'
    ]);
    expect(out.results.map((r) => r.source)).toContain('itib.gov.hk');
  });

  // 鲁港通 - 科技券主题：只发 tvp 子域定向（不含科创培育泛化查询）
  it('增强补发（香港档科技券题）：site:tvp.itf.gov.hk 定向', async () => {
    const { calls } = stubRoutedFetch(
      {
        mainPages: [page('https://www.gov.hk/a', '政府A')],
        boostPages: [page('https://tvp.itf.gov.hk/tc/x', '科技券')]
      },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: '科技券 申请资格 资助金额',
      maxResults: 3
    });
    const out = await tool(input, SECRETS);

    const boostQueries = calls
      .filter((c) => c.method === 'tools/call' && c.query.startsWith('site:'))
      .map((c) => c.query);
    expect(boostQueries).toEqual(['site:tvp.itf.gov.hk 科技券']);
    expect(out.results.map((r) => r.source)).toEqual(['gov.hk', 'tvp.itf.gov.hk']);
  });

  it('open 模式不补发（定向补发仅 official 启用）', async () => {
    const { calls } = stubRoutedFetch(
      { mainPages: [page('https://www.gov.hk/a', '政府A')] },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: '维港好去处',
      searchScope: 'open'
    });
    const out = await tool(input, SECRETS);

    const toolsCalls = calls.filter(
      (c) => c.url.includes('dashscope') && c.method === 'tools/call'
    );
    expect(toolsCalls).toHaveLength(1);
    expect(out.searchScope).toBe('open');
    expect(out.resultCount).toBe(1);
  });

  it('无密钥：纯必应链路，不触发任何百炼请求', async () => {
    const { calls } = stubRoutedFetch({}, buildBingHtml());
    const input = await InputType.parseAsync({ query: '香港人才清单' });
    const out = await tool(input);

    expect(calls.filter((c) => c.url.includes('dashscope'))).toHaveLength(0);
    expect(out.metadata.engine).toBe('bing');
    expect(out.resultCount).toBe(2);
  });

  it('密钥为空白字符串：视为未配置（纯必应）', async () => {
    const { calls } = stubRoutedFetch({}, buildBingHtml());
    const input = await InputType.parseAsync({ query: '香港人才清单' });
    const out = await tool(input, { dashscopeApiKey: '   ' });

    expect(calls.filter((c) => c.url.includes('dashscope'))).toHaveLength(0);
    expect(out.metadata.engine).toBe('bing');
  });

  // 鲁港通 - 1.5.0 简转繁兜底：简体首搜只命中内地/营销页（全被拒）时，繁体变体命中港府官网
  it('简体首搜全被拒 → 繁体变体命中 edb.gov.hk，两次尝试与被拒域名写入诊断', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes('dashscope.aliyuncs.com')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () => buildBingHtml()
          };
        }
        const payload = JSON.parse(String(init?.body ?? '{}')) as {
          method: string;
          params?: { arguments?: { query?: string } };
        };
        if (payload.method === 'initialize') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () =>
              JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })
          };
        }
        const query = payload.params?.arguments?.query ?? '';
        const pages = query.includes('統一')
          ? [page('https://www.edb.gov.hk/tc/student/p1', '小一入學統籌辦法')]
          : [page('https://zhuanlan.zhihu.com/p/1', '知乎专栏')];
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => bailianCallBody(pages)
        };
      })
    );
    const input = await InputType.parseAsync({
      query: '小一入学统筹办法 自行分配学位 统一派位 时间表 申请日期 教育局'
    });
    const out = await tool(input, SECRETS);

    expect(out.metadata.engine).toBe('bailian');
    expect(out.resultCount).toBe(1);
    expect(out.results[0].source).toBe('edb.gov.hk');
    expect(out.results[0].sourceType).toBe('gov');
    // 逐次命中：简体 0 条放行 → 繁体 1 条放行
    expect(out.metadata.attempts).toHaveLength(2);
    expect(out.metadata.attempts?.[0]).toContain('allowed=0');
    expect(out.metadata.attempts?.[1]).toContain('allowed=1');
    expect(out.metadata.rejectedHosts).toContain('zhuanlan.zhihu.com×1');
  });
});

// ============================================================
// 检索地域档（cn = 中央部委 + 山东官方来源，山东支线专用）
// ============================================================
describe('检索地域档 cn（大陆白名单）', () => {
  afterEach(() => vi.unstubAllGlobals());

  function item(href: string, title: string): string {
    return `<li class="b_algo"><h2><a href="${href}">${title}</a></h2><div class="b_caption"><p>摘要</p></div></li>`;
  }

  const cnHtml = `<html><body><ol id="b_results">${item(
    'https://www.shandong.gov.cn/policy/x',
    '山东省政府'
  )}${item('https://www.mohrss.gov.cn/service/y', '人社部')}${item(
    'https://www.zhuhai.gov.cn/z',
    '外省政务'
  )}${item('https://mp.weixin.qq.com/s/abc', '微信公众号')}${item(
    'https://www.sdu.edu.cn/a',
    '山东大学'
  )}${item(
    'https://random-blog.com/post',
    '个人博客'
  )}</ol></body></html>`;

  it('cn 档：山东政务/部委/山东高校放行，外省政务与微信公众号拒绝', async () => {
    stubFetchHtml(cnHtml);
    const input = await InputType.parseAsync({
      query: '港澳台居民在山东创办企业',
      searchRegion: 'cn'
    });
    const out = await tool(input);

    expect(out.resultCount).toBe(3);
    expect(out.results.map((r) => r.source)).toEqual([
      'shandong.gov.cn',
      'mohrss.gov.cn',
      'sdu.edu.cn'
    ]);
    expect(out.results.map((r) => r.sourceType)).toEqual([
      'gov',
      'gov',
      'academic'
    ]);
    expect(out.filteredOut).toBe(3);
    expect((out._debug ?? []).join('\n')).toContain('region=cn');
  });

  // 鲁港通 - v1.4.0 媒体档端到端：cn 档官方媒体报道须与政务一并进入 results；
  // 商业门户与身份未核实的地方网站仍被过滤，守住「去营销噪音」这一核心优势
  const cnMediaHtml = `<html><body><ol id="b_results">${item(
    'https://www.xinhuanet.com/fortune/a',
    '新华网'
  )}${item('https://news.iqilu.com/shandong/b', '齐鲁网')}${item(
    'https://jinan.sdchina.com/news/c',
    '中国山东网济南频道'
  )}${item('https://sd.china.com/shandong/d', '商业门户')}${item(
    'https://www.lznews.cn/news/e',
    '鲁中网'
  )}</ol></body></html>`;

  it('cn 档：官方媒体放行并标注 news，商业门户与非在册地方网拒绝', async () => {
    stubFetchHtml(cnMediaHtml);
    const input = await InputType.parseAsync({
      query: '济南吸引港资企业优惠政策',
      searchRegion: 'cn'
    });
    const out = await tool(input);

    expect(out.results.map((r) => r.source)).toEqual([
      'xinhuanet.com',
      'news.iqilu.com',
      'jinan.sdchina.com'
    ]);
    expect(out.results.map((r) => r.sourceType)).toEqual([
      'news',
      'news',
      'news'
    ]);
    expect(out.filteredOut).toBe(2);
    // 鲁港通 - 来源卡的可点击链接须跟着媒体结果一起给出，否则前端只剩纯文本出处
    expect(out.citeLinks.map((c) => c.url)).toEqual([
      'https://www.xinhuanet.com/fortune/a',
      'https://news.iqilu.com/shandong/b',
      'https://jinan.sdchina.com/news/c'
    ]);
  });

  // 鲁港通 - 1.5.0 港档也放行中央部委（跨境资金/税务/出入境口径在内地部委官网），
  // 但山东省与外省政务仍只在 cn 档生效，港档一律拒绝
  it('未传 searchRegion 时仍为香港档：中央部委放行，山东/外省政务拒绝', async () => {
    stubFetchHtml(cnHtml);
    const input = await InputType.parseAsync({ query: '香港人才清单' });
    const out = await tool(input);

    expect((out._debug ?? []).join('\n')).toContain('region=hk');
    expect(out.results.map((r) => r.source)).toEqual(['mohrss.gov.cn']);
    expect(out.results.map((r) => r.sourceType)).toEqual(['gov']);
    expect(out.filteredOut).toBe(5);
    // 诊断字段：被拒域名 Top5 便于判断缺口
    expect(out.metadata.rejectedHosts).toContain('shandong.gov.cn×1');
  });

  // 鲁港通 - 香港档补发已改科创定向（见上）；cn 档维持原 site:shandong.gov.cn 语法
  it('cn 档补发用 site:shandong.gov.cn 后缀式', async () => {
    const { calls } = stubRoutedFetch(
      {
        mainPages: [page('https://mp.weixin.qq.com/s/x', '微信公众号')],
        boostPages: [page('https://www.shandong.gov.cn/a', '山东省政府')]
      },
      buildBingHtml()
    );
    const input = await InputType.parseAsync({
      query: '山东人才引进住房补贴',
      searchRegion: 'cn'
    });
    const out = await tool(input, SECRETS);

    expect(out.metadata.engine).toBe('bailian');
    expect(
      calls
        .filter((c) => c.url.includes('dashscope') && c.method === 'tools/call')
        .map((c) => c.query)
    ).toEqual([
      '山东人才引进住房补贴',
      '山东人才引进住房补贴 site:shandong.gov.cn'
    ]);
    expect(out.resultCount).toBe(1);
    expect(out.results[0].source).toBe('shandong.gov.cn');
  });

  it('cn + open：完全不过滤（含外省政务与微信公众号）', async () => {
    stubFetchHtml(cnHtml);
    const input = await InputType.parseAsync({
      query: '山东生活好去处',
      searchScope: 'open',
      searchRegion: 'cn'
    });
    const out = await tool(input);

    expect(out.resultCount).toBe(5); // 默认 maxResults=5，6 条全部通过过滤后截断
    expect(out.filteredOut).toBe(0);
  });

  it('SDK 层 searchRegion 为节点固定参数（非模型可改）', () => {
    const def = pluginExport.getToolHandler();
    const json = z.toJSONSchema(def.inputSchema as z.ZodTypeAny) as any;
    expect(def.inputSchema.safeParse({ query: '山东创业', searchRegion: 'cn' })
      .success).toBe(true);
    expect(json.properties.searchRegion.enum).toEqual(['hk', 'cn']);
    expect(json.properties.searchRegion.isToolParam).toBeUndefined();
    expect(json.properties.searchRegion.title).toBe('检索地域');
  });
});

// ============================================================
// 查询变体：简体→香港繁体、超长查询截断（v1.5.0）
// ============================================================
describe('查询变体 buildSearchAttempts', () => {
  it('香港官方档：简体查询追加繁体变体（原查询保持首位）', () => {
    expect(buildSearchAttempts('香港人才清单', 'hk', 'official')).toEqual([
      '香港人才清单',
      '香港人才清單'
    ]);
  });

  it('简繁同形：不追加重复查询', () => {
    expect(buildSearchAttempts('不存在的政策xyz', 'hk', 'official')).toEqual([
      '不存在的政策xyz'
    ]);
  });

  // 鲁港通 - 大陆官网本身用简体，转繁会降低命中；开放档不做权威过滤，无需变体
  it('大陆档与开放档：不加繁体变体', () => {
    expect(buildSearchAttempts('山东人才引进住房补贴', 'cn', 'official')).toEqual([
      '山东人才引进住房补贴'
    ]);
    expect(buildSearchAttempts('维港好去处', 'hk', 'open')).toEqual(['维港好去处']);
  });

  it('超长查询（>6 词）追加「繁体前 6 词」截断变体', () => {
    expect(
      buildSearchAttempts(
        '香港 公司 注册 需要 什么 资料 费用 时间 流程',
        'hk',
        'official'
      )
    ).toEqual([
      '香港 公司 注册 需要 什么 资料 费用 时间 流程',
      '香港 公司 註冊 需要 什麼 資料 費用 時間 流程',
      '香港 公司 註冊 需要 什麼 資料'
    ]);
  });

  it('toTraditionalHk 转出香港繁体用字', () => {
    expect(toTraditionalHk('单 后 资 专 项 开 什么')).toBe('單 後 資 專 項 開 什麼');
  });
});

// ============================================================
// 耗时优化（G5）：变体与补发并发发出，避免串行叠加候选耗时
// ============================================================
describe('耗时优化（并发检索）', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubConcurrencyProbe(
    pages: Array<{ url: string; title: string; snippet: string }>
  ) {
    const state = { now: 0, peak: 0, queries: [] as string[] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes('dashscope.aliyuncs.com')) {
          throw new Error('unexpected non-dashscope fetch');
        }
        const payload = JSON.parse(String(init?.body ?? '{}')) as {
          method: string;
          params?: { arguments?: { query?: string } };
        };
        const envelope = (body: string) => ({
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => body
        });
        if (payload.method === 'initialize') {
          return envelope(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }));
        }
        if (payload.method !== 'tools/call') {
          return envelope(JSON.stringify({ jsonrpc: '2.0', id: 2, result: {} }));
        }
        state.queries.push(payload.params?.arguments?.query ?? '');
        state.now += 1;
        state.peak = Math.max(state.peak, state.now);
        await new Promise((resolve) => setTimeout(resolve, 25));
        state.now -= 1;
        return envelope(bailianCallBody(pages));
      })
    );
    return state;
  }

  it('变体尝试：首轮不足时其余变体并发发出（并发峰值≥2）', async () => {
    const state = stubConcurrencyProbe([]);
    const input = await InputType.parseAsync({
      query: '公屋 轮候 时间 一般 申请 者 最新 安排',
      maxResults: 3
    });
    const out = await tool(input, SECRETS);

    expect(out.resultCount).toBe(0);
    expect(state.queries.length).toBeGreaterThanOrEqual(2);
    expect(state.peak).toBeGreaterThanOrEqual(2);
  });

  it('补发：多条 site: 定向查询并发发出（并发峰值≥2）', async () => {
    const state = stubConcurrencyProbe([
      page('https://www.gov.hk/a', '政府A'),
      page('https://www.hkstp.org/en/x', '科技园A'),
      page('https://www.cyberport.hk/tc/y', '数码港B')
    ]);
    const input = await InputType.parseAsync({
      query: '香港科创资助',
      maxResults: 5
    });
    const out = await tool(input, SECRETS);

    expect(out.resultCount).toBe(3);
    expect(state.peak).toBeGreaterThanOrEqual(2);
  });
});
