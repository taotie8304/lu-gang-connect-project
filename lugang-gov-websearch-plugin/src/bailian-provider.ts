// 鲁港通 - 百炼（阿里云 DashScope）联网搜索源：走 MCP 协议 WebSearch 服务
// 协议实测序列：initialize →（仅当响应头下发 mcp-session-id 时）notifications/initialized → tools/call
// 响应为 JSON-RPC 信封：可能是纯 JSON 或 SSE（data: 行）；内层 content[].text 是 {"pages":[...]} 字符串
import type { RawSearchResult, SearchProvider, SearchProviderName } from './types';

export const BAILIAN_MCP_URL =
  'https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp';
const TOOL_NAME = 'bailian_web_search';
const PROTOCOL_VERSION = '2025-03-26';
const INIT_TIMEOUT_MS = 3_000;
const CALL_TIMEOUT_MS = 6_000;
const MAX_COUNT = 10;

// 鲁港通 - 折叠摘要里的换行与连续空白
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// 鲁港通 - 从响应正文提取 JSON-RPC 消息：兼容纯 JSON 与 SSE（data: 行取最后一条可解析 JSON）
export function extractRpcMessage(body: string): unknown {
  const trimmed = (body || '').trim();
  if (!trimmed) return null;

  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct !== null) return direct;

  if (trimmed.includes('data:')) {
    const datas = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    for (let i = datas.length - 1; i >= 0; i--) {
      const parsed = tryParse(datas[i]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

// 鲁港通 - 解析百炼返回的内层 text（JSON 字符串）：取 pages 数组转标准结果
// pages 项形如 {snippet, hostname, hostlogo, title, url}；hostname 不可信，主机名一律由 url 层反解
export function pagesText2Results(text: string): RawSearchResult[] {
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const pages = Array.isArray((parsed as { pages?: unknown } | null)?.pages)
    ? ((parsed as { pages: unknown[] }).pages as unknown[])
    : [];
  const out: RawSearchResult[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (!page || typeof page !== 'object') continue;
    const { title, url, snippet } = page as Record<string, unknown>;
    const u = typeof url === 'string' ? url.trim() : '';
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push({
      title: collapseWhitespace(typeof title === 'string' ? title : ''),
      url: u,
      snippet: collapseWhitespace(typeof snippet === 'string' ? snippet : '')
    });
  }
  return out;
}

// 鲁港通 - 从完整响应正文解析搜索结果列表
export function parseBailianResponse(body: string): RawSearchResult[] {
  const msg = extractRpcMessage(body) as {
    result?: { content?: Array<{ type?: string; text?: string }> };
  } | null;
  const content = msg?.result?.content;
  if (!Array.isArray(content)) return [];
  const textPart = content.find(
    (c) => c && typeof c.text === 'string' && c.text
  );
  return textPart?.text ? pagesText2Results(textPart.text) : [];
}

interface RpcReply {
  text: string;
  sessionId: string | null;
}

// 鲁港通 - 百炼搜索源：密钥未配置时业务层不会走到这里（见 src/index.ts 的 buildProviderChain）
export class BailianProvider implements SearchProvider {
  readonly name: SearchProviderName = 'bailian';
  readonly supportsSiteBoost = true;

  constructor(private readonly apiKey: string) {}

  async search(
    query: string,
    opts?: { maxResults?: number; lang?: string }
  ): Promise<RawSearchResult[]> {
    const count = Math.min(Math.max(opts?.maxResults ?? 5, 1), MAX_COUNT);

    // 1. initialize：建立协议会话（实测服务端无状态，通常不下发 session id）
    const init = await this.rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'lugang-websearch-plugin', version: '1.1.0' }
        }
      },
      INIT_TIMEOUT_MS
    );
    this.throwIfRpcError(init.text, 'initialize');

    // 2. 仅当服务端下发 session id 时补发 initialized 通知（通知无响应体，失败可忽略）
    if (init.sessionId) {
      await this.notifyInitialized(init.sessionId);
    }

    // 3. tools/call：发起搜索
    const call = await this.rpc(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: TOOL_NAME, arguments: { query, count } }
      },
      CALL_TIMEOUT_MS,
      init.sessionId ?? undefined
    );
    this.throwIfRpcError(call.text, 'tools/call');
    return parseBailianResponse(call.text).slice(0, count);
  }

  // 鲁港通 - 单次 JSON-RPC 调用：HTTP 非 2xx 直接抛错（交由业务层降级到下一搜索源）
  private async rpc(
    payload: Record<string, unknown>,
    timeoutMs: number,
    sessionId?: string
  ): Promise<RpcReply> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${this.apiKey}`
      };
      if (sessionId) headers['mcp-session-id'] = sessionId;
      const res = await fetch(BAILIAN_MCP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`Bailian HTTP ${res.status}`);
      return {
        text: await res.text(),
        sessionId: res.headers.get('mcp-session-id') || null
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // 鲁港通 - JSON-RPC 层错误（如密钥无效）显式抛出，交由业务层降级
  private throwIfRpcError(text: string, stage: string): void {
    const msg = extractRpcMessage(text) as {
      error?: { code?: number; message?: string };
    } | null;
    if (msg?.error) {
      throw new Error(
        `Bailian ${stage} error ${msg.error.code ?? ''}: ${
          msg.error.message ?? 'unknown'
        }`
      );
    }
  }

  // 鲁港通 - initialized 通知：无状态服务端不依赖它，失败静默忽略
  private async notifyInitialized(sessionId: string): Promise<void> {
    try {
      await fetch(BAILIAN_MCP_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${this.apiKey}`,
          'mcp-session-id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized'
        })
      });
    } catch {
      // 忽略：通知失败不影响后续 tools/call
    }
  }
}
