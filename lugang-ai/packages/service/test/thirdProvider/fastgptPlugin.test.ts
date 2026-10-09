import { describe, expect, it, vi } from 'vitest';

vi.mock('@fastgpt/service/env', () => ({
  serviceEnv: {
    PLUGIN_BASE_URL: 'http://plugin.local',
    PLUGIN_TOKEN: 'test-token'
  }
}));

const { parseSseData } = await import('@fastgpt/service/thirdProvider/fastgptPlugin');

describe('parseSseData', () => {
  it('解析标准 SSE data: 前缀事件', () => {
    const result = parseSseData('data: {"type":"response","data":{"ok":true}}');
    expect(result).toEqual({ type: 'response', data: { ok: true } });
  });

  it('解析插件无流式输出时的裸 JSON 响应（无 data: 前缀）', () => {
    const result = parseSseData('{"type":"response","data":{"ok":true}}');
    expect(result).toEqual({ type: 'response', data: { ok: true } });
  });

  it('解析裸 JSON 的 error 事件', () => {
    const result = parseSseData('{"type":"error","data":"boom"}');
    expect(result).toEqual({ type: 'error', data: 'boom' });
  });

  it('多行 data: 事件按换行拼接后解析', () => {
    const result = parseSseData('data: {"type":"stream",\ndata: "data":{"text":"hi"}}');
    expect(result).toEqual({ type: 'stream', data: { text: 'hi' } });
  });

  it('空内容与非法 JSON 均返回 null', () => {
    expect(parseSseData('')).toBeNull();
    expect(parseSseData('data: not-json')).toBeNull();
  });
});
