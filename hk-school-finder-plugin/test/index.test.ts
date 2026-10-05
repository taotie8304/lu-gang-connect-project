// 鲁港通 - 插件入口测试（FastGPT 插件 SDK v1.x）：manifest 元数据 + inputSchema 9 参数 + outputSchema 镜像
// 端到端行为（七意图）由 tool.test.ts 以 fixtures 注入覆盖；本文件不触发网络。
import { describe, it, expect } from 'vitest';
import pluginExport from '../index';

describe('根 index.ts（FastGPT 插件 SDK v1.x 格式）', () => {
  it('manifest：pluginId/版本/三语名称/必须调用/反重试', () => {
    const manifest = pluginExport.getUserToolManifest();

    expect(manifest.pluginId).toBe('hk_school_finder');
    expect(manifest.version).toBe('1.1.2');
    expect(manifest.name['zh-CN']).toBe('香港学校资料助手');
    expect(manifest.name['zh-Hant']).toBe('香港學校資料助手');
    expect(manifest.name.en).toBeDefined();
    expect(manifest.description['zh-CN']).toContain('必须');
    expect(manifest.toolDescription).toBeDefined();
    expect(manifest.toolDescription).toContain('不要重复调用');
    expect(manifest.tags).toContain('tools');
  });

  it('inputSchema：10 参数全接受 + 非法枚举拒绝 + 未知字段剥离', () => {
    const { inputSchema } = pluginExport.getToolHandler();

    // 10 参数样本（全部可选）
    const sample = {
      query: '沙田区有哪些小学',
      intent: 'search',
      schoolName: '喇沙书院',
      district: '沙田区',
      level: 'primary',
      schoolCategory: 'direct_subsidy',
      location: '尖沙咀',
      listType: 'kg_scheme',
      netType: 'poa',
      language: 'zh-CN',
    };
    expect(inputSchema.safeParse(sample).success).toBe(true);
    expect(inputSchema.safeParse({}).success).toBe(true);

    // 非法枚举拒绝
    expect(inputSchema.safeParse({ level: 'university' }).success).toBe(false);
    expect(inputSchema.safeParse({ intent: 'foo' }).success).toBe(false);
    expect(inputSchema.safeParse({ listType: 'foo' }).success).toBe(false);
    expect(inputSchema.safeParse({ netType: 'foo' }).success).toBe(false);
    expect(inputSchema.safeParse({ schoolCategory: 'foo' }).success).toBe(false);

    // 未知字段剥离（运行时宽容；additionalProperties:false 仅为 LLM 提示）
    const stripped = inputSchema.safeParse({ query: '沙田', foo: 'bar' });
    expect(stripped.success).toBe(true);
    expect((stripped.data as Record<string, unknown>).foo).toBeUndefined();
  });

  it('outputSchema：接受 ToolResult 形状；缺 summary 拒绝', () => {
    const { outputSchema } = pluginExport.getToolHandler();

    const sample = {
      summary: '共查询到 44 所小学。',
      items: [
        {
          name: '圣公会圣马太小学',
          nameEn: "SKH St. Matthew's Primary School",
          level: 'primary',
          district: '沙田区',
          address: '沙田某地址',
          telephone: '12345678',
          website: 'https://example.com',
          distanceMeters: 245,
          extra: { category: '资助小学', sessions: ['上午', '下午'] },
        },
      ],
      dataDate: '2025/26 学年',
      sources: ['资料来源：教育局《学校位置总表》'],
      tips: ['距离为直线距离，仅供参考。'],
    };
    expect(outputSchema.safeParse(sample).success).toBe(true);
    expect(outputSchema.safeParse({ items: [] }).success).toBe(false);
    expect(outputSchema.safeParse({ error: 'x' }).success).toBe(false);
  });

  it('handler 已注册（类型为函数）', () => {
    const { handler } = pluginExport.getToolHandler();
    expect(typeof handler).toBe('function');
  });
});
