// 鲁港通 - 百炼搜索源单测：响应解析（纯函数）+ MCP 协议交互（mock global.fetch，不真联网）
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  BailianProvider,
  extractRpcMessage,
  pagesText2Results,
  parseBailianResponse
} from '../src/bailian-provider';

// 鲁港通 - 构造一条 tools/call 成功响应（JSON-RPC 信封 + 内嵌 text JSON 字符串）
function callOkBody(pages: Array<Record<string, unknown>>): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    result: {
      content: [{ type: 'text', text: JSON.stringify({ pages }) }]
    }
  });
}

interface MockReply {
  ok?: boolean;
  status?: number;
  sessionId?: string | null;
  body: string;
}

function mockResponse(reply: MockReply) {
  return {
    ok: reply.ok ?? true,
    status: reply.status ?? 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'mcp-session-id'
          ? (reply.sessionId ?? null)
          : null
    },
    text: async () => reply.body
  };
}

type CallLog = {
  url: string;
  payload: { method: string; id?: number; params?: Record<string, unknown> };
  headers: Record<string, string>;
};

describe('响应解析（纯函数）', () => {
  it('extractRpcMessage 解析纯 JSON', () => {
    const msg = extractRpcMessage('{"jsonrpc":"2.0","id":1,"result":{}}') as {
      id: number;
    };
    expect(msg.id).toBe(1);
  });

  it('extractRpcMessage 兼容 SSE：data: 行取最后一条可解析 JSON', () => {
    const sse =
      'event: message\n' +
      'data: {"jsonrpc":"2.0","id":1,"result":{"note":"first"}}\n\n' +
      'event: message\n' +
      'data: {"jsonrpc":"2.0","id":2,"result":{"note":"last"}}\n\n';
    const msg = extractRpcMessage(sse) as {
      id: number;
      result: { note: string };
    };
    expect(msg.id).toBe(2);
    expect(msg.result.note).toBe('last');
  });

  it('extractRpcMessage 对空串/无 JSON 返回 null', () => {
    expect(extractRpcMessage('')).toBeNull();
    expect(extractRpcMessage('data: not-json')).toBeNull();
  });

  it('pagesText2Results 解析 pages、折叠空白、按 URL 去重、跳过无 URL', () => {
    const text = JSON.stringify({
      pages: [
        {
          title: ' 政府  首页 ',
          url: 'https://www.gov.hk/tc/',
          snippet: 'a\nb'
        },
        { title: 'dup', url: 'https://www.gov.hk/tc/', snippet: 'x' },
        { title: 'no-url', url: '', snippet: 'y' },
        { title: 'hk01', url: 'https://hk01.com/a', snippet: 'z' }
      ]
    });
    expect(pagesText2Results(text)).toEqual([
      { title: '政府 首页', url: 'https://www.gov.hk/tc/', snippet: 'a b' },
      { title: 'hk01', url: 'https://hk01.com/a', snippet: 'z' }
    ]);
  });

  it('pagesText2Results 对非法 JSON / 无 pages 返回空数组', () => {
    expect(pagesText2Results('not-json')).toEqual([]);
    expect(pagesText2Results('{"items":[]}')).toEqual([]);
  });

  it('parseBailianResponse 从信封提取 content text 并解析 pages', () => {
    const out = parseBailianResponse(
      callOkBody([{ title: 't', url: 'https://gov.hk/x', snippet: 's' }])
    );
    expect(out).toEqual([{ title: 't', url: 'https://gov.hk/x', snippet: 's' }]);
  });

  it('parseBailianResponse：无 content / 内层非 JSON 均返回空数组', () => {
    expect(
      parseBailianResponse('{"jsonrpc":"2.0","id":2,"result":{}}')
    ).toEqual([]);
    expect(
      parseBailianResponse(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          result: { content: [{ type: 'text', text: 'not-json' }] }
        })
      )
    ).toEqual([]);
  });
});

describe('BailianProvider 协议交互（mock fetch）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('正常序列：initialize → tools/call，携带密钥并取回结果', async () => {
    const log: CallLog[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? '{}'));
        log.push({
          url: String(url),
          payload,
          headers: (init?.headers ?? {}) as Record<string, string>
        });
        if (payload.method === 'initialize') {
          return mockResponse({
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })
          });
        }
        return mockResponse({
          body: callOkBody([
            { title: ' page1 ', url: 'https://www.gov.hk/a', snippet: ' s1 ' }
          ])
        });
      })
    );

    const provider = new BailianProvider('sk-test');
    const out = await provider.search('香港人才清单', { maxResults: 5 });

    expect(out).toEqual([
      { title: 'page1', url: 'https://www.gov.hk/a', snippet: 's1' }
    ]);
    expect(log).toHaveLength(2);
    expect(log[0].url).toContain('/mcps/WebSearch/mcp');
    expect(log[0].payload.method).toBe('initialize');
    expect(
      (log[0].payload.params as { protocolVersion: string }).protocolVersion
    ).toBe('2025-03-26');
    expect(log[0].headers.authorization).toBe('Bearer sk-test');
    expect(log[1].payload.method).toBe('tools/call');
    expect(log[1].payload.params).toEqual({
      name: 'bailian_web_search',
      arguments: { query: '香港人才清单', count: 5 }
    });
  });

  it('服务端下发 session id 时：补发 initialized 通知且 tools/call 携带会话头', async () => {
    const log: CallLog[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? '{}'));
        log.push({
          url: String(url),
          payload,
          headers: (init?.headers ?? {}) as Record<string, string>
        });
        if (payload.method === 'initialize') {
          return mockResponse({
            sessionId: 'sess-1',
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })
          });
        }
        if (payload.method === 'notifications/initialized') {
          return mockResponse({ body: '' });
        }
        return mockResponse({ body: callOkBody([]) });
      })
    );

    const provider = new BailianProvider('sk-test');
    await provider.search('q');

    expect(log.map((c) => c.payload.method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/call'
    ]);
    expect(log[1].headers['mcp-session-id']).toBe('sess-1');
    expect(log[2].headers['mcp-session-id']).toBe('sess-1');
  });

  it('count 封顶 10（maxResults 超限时）', async () => {
    const bodies: Array<{ name?: string; arguments?: { count?: number } }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? '{}'));
        if (payload.method === 'initialize') {
          return mockResponse({
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })
          });
        }
        bodies.push(payload.params);
        return mockResponse({ body: callOkBody([]) });
      })
    );

    const provider = new BailianProvider('sk-test');
    await provider.search('q', { maxResults: 999 });

    expect(bodies[0].arguments?.count).toBe(10);
  });

  it('HTTP 非 2xx 抛错（交由业务层降级到下一源）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockResponse({ ok: false, status: 401, body: '' }))
    );
    const provider = new BailianProvider('bad-key');
    await expect(provider.search('q')).rejects.toThrow('Bailian HTTP 401');
  });

  it('tools/call 返回 JSON-RPC error 时抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? '{}'));
        if (payload.method === 'initialize') {
          return mockResponse({
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })
          });
        }
        return mockResponse({
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            error: { code: -32000, message: 'Invalid API-key provided' }
          })
        });
      })
    );
    const provider = new BailianProvider('bad-key');
    await expect(provider.search('q')).rejects.toThrow(
      'Invalid API-key provided'
    );
  });

  it('网络异常原样抛出', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    const provider = new BailianProvider('sk-test');
    await expect(provider.search('q')).rejects.toThrow('network down');
  });

  it('SSE 格式响应也能解析出结果', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? '{}'));
        if (payload.method === 'initialize') {
          return mockResponse({
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })
          });
        }
        return mockResponse({
          body: `event: message\ndata: ${callOkBody([
            { title: 't', url: 'https://gov.hk/1', snippet: 's' }
          ])}\n\n`
        });
      })
    );
    const provider = new BailianProvider('sk-test');
    const out = await provider.search('q');
    expect(out).toEqual([{ title: 't', url: 'https://gov.hk/1', snippet: 's' }]);
  });
});
