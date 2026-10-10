// 鲁港通 - 政府官网联网搜索插件 SDK 封装层
// 只负责 defineTool + createToolHandler + manifest + meta 注解；业务逻辑在 src/index.ts。
// 百炼（DashScope）联网搜索为第一搜索源，密钥经 secretSchema 在后台配置后运行时注入；
// 未配置密钥时自动只用必应抓取（与旧版行为一致），历史数据不阻塞。
import {
  createToolHandler,
  defineTool,
  type InputSchemaMetaType,
  type OutputSchemaMetaType,
  type SecretSchemaMetaType
} from '@fastgpt-plugin/sdk-factory';
import z from 'zod';
import {
  InputType,
  tool as searchTool,
  SearchResultSchema
} from './src/index';

// ============================================================
// 输入 schema：SDK 要求纯 z.object（不能带 .refine），字段用 meta 注解
// ============================================================
const inputSchema = z.object({
  query: z
    .string()
    .meta({
      title: '搜索词',
      description: '要向官方来源检索的关键词或问题',
      toolDescription:
        '需要联网核实的政策/民生/金融问题关键词，如“香港人才清单 2025”“强积金提取条件”“汇丰银行个人开户”。传入越具体越好',
      isToolParam: true
    } satisfies InputSchemaMetaType),
  searchScope: z
    .enum(['official', 'open'])
    .optional()
    .meta({
      title: '搜索范围',
      description:
        'official=只搜政府/公营/学术/非盈利/金融/医疗/媒体/电视台（默认）；open=完全不过滤，仅“香港本地生活小助手”节点用',
      toolDescription:
        '搜索范围。默认 official（严格只搜权威官网）。仅“香港本地生活小助手”节点（休闲类）传 open（不过滤）',
      isToolParam: true
    } satisfies InputSchemaMetaType),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .meta({
      title: '最大结果数',
      description: '最多返回几条来源，默认 5',
      toolDescription: '最多返回的来源条数，默认 5，最大 10',
      isToolParam: true
    } satisfies InputSchemaMetaType),
  language: z
    .enum(['zh-CN', 'zh-HK', 'en'])
    .optional()
    .meta({
      title: '语言',
      description: '返回与错误文案的语言，默认简体中文',
      toolDescription:
        '返回语言：zh-CN(简体)/zh-HK(繁体)/en(英文)。不填默认简体'
    } satisfies InputSchemaMetaType)
});

// ============================================================
// 输出 schema：不含 _debug（本地诊断，不外传模型）
// ============================================================
const outputSchema = z.object({
  results: z
    .array(SearchResultSchema)
    .meta({
      title: '权威来源列表',
      description: '经过白名单过滤的政府/公营/学术/非盈利/金融/医疗/媒体/电视台来源'
    } satisfies OutputSchemaMetaType),
  resultCount: z
    .number()
    .meta({
      title: '结果数',
      description: '过滤后返回条数'
    } satisfies OutputSchemaMetaType),
  filteredOut: z
    .number()
    .meta({
      title: '过滤数',
      description: '被白名单/黑名单过滤掉的条数'
    } satisfies OutputSchemaMetaType),
  query: z
    .string()
    .meta({ title: '查询词', description: '回显' } satisfies OutputSchemaMetaType),
  searchScope: z
    .enum(['official', 'open'])
    .meta({
      title: '生效范围',
      description: '回显'
    } satisfies OutputSchemaMetaType),
  metadata: z
    .object({
      timestamp: z.string(),
      engine: z.string(),
      rawCount: z.number()
    })
    .meta({
      title: '元数据',
      description: '搜索引擎与时间戳'
    } satisfies OutputSchemaMetaType),
  error: z
    .string()
    .optional()
    .meta({
      title: '错误信息',
      description: '无结果或失败时的可操作中文说明'
    } satisfies OutputSchemaMetaType)
});

// ============================================================
// 密钥 schema：百炼 API 密钥（可选）。后台配置后加密存储，运行时经 ctx.secrets 注入；
// 留空 = 不启用百炼搜索源，自动只用必应抓取（与旧版行为一致）
// ============================================================
const secretSchema = z.object({
  dashscopeApiKey: z
    .string()
    .optional()
    .meta({
      title: '百炼 API 密钥',
      description:
        '阿里云百炼(DashScope) API Key，作为联网搜索第一来源；留空则自动只用必应抓取',
      isSecret: true
    } satisfies SecretSchemaMetaType)
});

// ============================================================
// handler：桥接 SDK 与 src 业务层
// ============================================================
const handler = createToolHandler({
  inputSchema,
  outputSchema,
  secretSchema,
  handler: async (input, ctx) => {
    const parsed = await InputType.parseAsync(input);
    const output = await searchTool(parsed, {
      dashscopeApiKey: ctx.secrets?.dashscopeApiKey
    });
    const { _debug, ...result } = output; // 鲁港通 - 剔除调试字段，避免噪声传给模型
    return result;
  }
});

// ============================================================
// manifest：pluginId 发布后保持稳定（下划线，无连字符！）
// toolDescription 为面向模型的单字符串（含【必须调用】与反重试措辞）
// ============================================================
export default defineTool({
  manifest: {
    pluginId: 'hk_gov_websearch',
    version: '1.1.1',
    name: {
      en: 'HK Official-Source Web Search',
      'zh-CN': '政府官网联网搜索',
      'zh-Hant': '政府官網聯網搜索'
    },
    description: {
      en: '[MUST invoke to verify policy/livelihood/finance answers] Searches ONLY Hong Kong official sources — government, public bodies, academic institutions, non-profits, regulated financial institutions (banks/insurers/securities & funds), medical institutions, licensed news media and TV stations — then filters out all social media and marketing sites.',
      'zh-CN':
        '【必须调用来核实政策/民生/金融答案】只检索香港官方来源——政府、公营机构、学术机构、非盈利团体、持牌金融机构（银行/保险/证券基金）、医疗机构、正规新闻媒体与电视台，并自动过滤掉所有社交媒体与营销网站。',
      'zh-Hant':
        '【必須調用來核實政策/民生/金融答案】只檢索香港官方來源——政府、公營機構、學術機構、非營利團體、持牌金融機構（銀行/保險/證券基金）、醫療機構、正規新聞媒體與電視台，並自動過濾掉所有社交媒體與營銷網站。'
    },
    toolDescription:
      '【必须调用】当需要核实或补充香港政策/民生/金融/经贸/教育/医疗类信息、或知识库内容可能过期时，调用此工具从官方来源检索最新资料。传入 query=用户问题的核心关键词。检索范围覆盖：政府(*.gov.hk)、公营机构(港交所/港铁/证监会/医管局等)、学术机构(*.edu.hk/*.sch.hk/大学)、非盈利(*.org.hk)、持牌金融机构官网（银行/保险/证券基金，如汇丰银行、中银香港、友邦保险等）、医疗机构官网（公私立医院/医学会等）、正规新闻媒体与电视台；已自动排除所有社交媒体与营销网站。\n【重要】“官方来源”不限于政府网站：持牌银行/保险/证券基金等金融机构官网与公私立医疗机构官网均属检索范围内的官方来源，涉及银行开户、投保理赔、预约就医等问题时照常调用本工具检索官方页面。\n【重要】若返回 results 为空数组，说明官方来源暂未检索到相关内容，请直接依据知识库作答并注明“未能核实最新官方信息”，不要重复调用此工具——重复调用无法改变结果。\n【重要】仅当本工具被“香港本地生活小助手”节点调用（休闲类：美食/景点/行程）时才传 searchScope=open（该节点不做来源过滤）；其余所有政策/民生/金融/经贸/教育节点一律用默认 official。',
    tags: ['tools'],
    author: '鲁港通 (Lugang Connect)',
    versionDescription: {
      en: 'Expand whitelist with financial institutions (banks/insurers/securities & funds) and medical institutions as official sources; align source-category wording so bank and medical sites are recognized as official sources.',
      'zh-CN':
        '白名单新增金融机构（银行/保险/证券基金）与医疗机构为官方来源类别；同步调整来源分类口径与提示文案，避免误判“银行网站不属于检索范围”。',
      'zh-Hant':
        '白名單新增金融機構（銀行/保險/證券基金）與醫療機構為官方來源類別；同步調整來源分類口徑與提示文案，避免誤判「銀行網站不屬於檢索範圍」。'
    }
  },
  handler
});
