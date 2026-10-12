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
  searchRegion: z
    .enum(['hk', 'cn'])
    .optional()
    .meta({
      title: '检索地域',
      description:
        'hk=香港官方来源（默认）；cn=中央部委 + 山东省/市/区县政务与山东高校。由工作流节点固定配置，模型不可改'
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
  citeLinks: z
    .array(
      z.object({
        name: z.string(),
        url: z.string()
      })
    )
    .meta({
      title: '可点击来源链接',
      description:
        '随检索结果返回的标题+网址清单，聊天底部来源卡片据此展示可点击的网页链接'
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
    version: '1.3.1',
    name: {
      en: 'HK Official-Source Web Search',
      'zh-CN': '政府官网联网搜索',
      'zh-Hant': '政府官網聯網搜索'
    },
    description: {
      en: '[MUST invoke to verify policy/livelihood/finance answers] Searches ONLY official sources inside the region fixed on the tool node — Hong Kong (government, public bodies, universities, non-profits, licensed banks/insurers/securities funds, medical institutions, licensed media and TV stations) or Mainland (State Council and central ministries, Shandong province/city/district government sites, Shandong universities) — then filters out all social media and marketing sites.',
      'zh-CN':
        '【必须调用来核实政策/民生/金融答案】只在工具节点设定的检索地域内检索官方来源——香港档：政府、公营机构、学术机构、非盈利团体、持牌金融机构（银行/保险/证券基金）、医疗机构、正规新闻媒体与电视台；大陆档：国务院与中央部委、山东省及区市县政府网、山东高校。所有社交媒体与营销网站自动过滤。',
      'zh-Hant':
        '【必須調用來核實政策/民生/金融答案】只在工具節點設定的檢索地域內檢索官方來源——香港檔：政府、公營機構、學術機構、非營利團體、持牌金融機構（銀行/保險/證券基金）、醫療機構、正規新聞媒體與電視台；大陸檔：國務院與中央部委、山東省及区市縣政府網、山東高校。所有社交媒體與營銷網站自動過濾。'
    },
    toolDescription:
      '【必须调用】当需要核实或补充政策/民生/金融/经贸/教育/医疗类信息、或已有资料可能过期时，调用此工具从官方来源检索最新资料。传入 query=用户问题的核心关键词。\n【重要】检索地域由工作流节点固定，无需你指定：香港档覆盖政府(*.gov.hk)、公营机构(港交所/港铁/证监会/医管局等)、学术机构(*.edu.hk/*.sch.hk/大学)、非盈利(*.org.hk)、持牌金融机构官网（银行/保险/证券基金，如汇丰银行、中银香港、友邦保险等）、医疗机构官网（公私立医院/医学会等）、正规新闻媒体与电视台；大陆档覆盖国务院与中央部委官网（发改、人社、教育、公安、移民、港澳台办、税务、人民银行、外汇、商务、宣传、政府采购等）、山东省及16地市与区县政府网、山东高校官网。两档均自动排除社交媒体（含微信公众号）与营销网站。\n【重要】“官方来源”不限于政府网站：持牌银行/保险/证券基金等金融机构官网与公私立医疗机构官网均属检索范围内的官方来源，涉及银行开户、投保理赔、预约就医等问题时照常调用本工具检索官方页面。\n【重要】若返回 results 为空数组，说明官方来源暂未检索到相关内容，请直接依据已有权威资料作答并注明“未能核实最新官方信息”，不要重复调用此工具——重复调用无法改变结果。\n【重要】仅当本工具被“香港本地生活小助手”节点调用（休闲类：美食/景点/行程）时才传 searchScope=open（该节点不做来源过滤）；其余所有政策/民生/金融/经贸/教育节点一律用默认 official。',
    tags: ['tools'],
    author: '鲁港通 (Lugang Connect)',
    versionDescription: {
      en: 'Add a mainland search region with its own whitelist (State Council and central ministries, Shandong province/city/district government sites, Shandong universities) so the Shandong branch can verify answers against official sources; tighten the mainland tier to Shandong only — the State Taxation Administration entry now matches exactly, so other provinces tax bureaus are no longer admitted; add four more measured Shandong district sites; reword the no-result fallback so it no longer exposes internal terminology; treat WeChat public accounts as social-media noise.',
      'zh-CN':
        '新增检索地域档：大陆档自带白名单（国务院与中央部委、山东省及区市县政府网、山东高校），山东支线可据此从官方来源核实答案；大陆档收紧为「仅国家级 + 山东」——税务总局本级改为精确匹配，外省税务局不再放行，并补入 4 个实测命中的山东区县政务网；兜底提示语改写为不暴露内部术语的表述；微信公众号归入社交媒体过滤。',
      'zh-Hant':
        '新增檢索地域檔：大陸檔自帶白名單（國務院與中央部委、山東省及区市縣政府網、山東高校），山東支線可據此從官方來源核實答案；大陸檔收緊為「僅國家級 + 山東」——稅務總局本級改為精確匹配，外省稅務局不再放行，並補入 4 個實測命中的山東區縣政務網；兜底提示語改為不暴露內部術語的表述；微信公眾號歸入社交媒體過濾。'
    }
  },
  handler
});
