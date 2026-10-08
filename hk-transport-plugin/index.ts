// 鲁港通 - 香港智能交通助手（FastGPT 新插件格式 v1.x 根入口）
//
// 用 @fastgpt-plugin/sdk-factory 的 defineTool + createToolHandler 封装 src/ 交通引擎。
// 业务 schema 与核心逻辑保留在 src/index.ts，本文件只负责 SDK 封装、manifest 与 meta 注解。
// 数据源全为政府公开 API（etabus/etagmb/mtr/data.gov.hk/openstreetmap 等），无需密钥，故不设 secretSchema。
import {
  createToolHandler,
  defineTool,
  type InputSchemaMetaType,
  type OutputSchemaMetaType
} from '@fastgpt-plugin/sdk-factory';
import z from 'zod';
import {
  InputType,
  tool as transportTool,
  RouteOptionSchema,
  StopETAListSchema,
  PaymentInfoSchema,
  MetadataSchema
} from './src/index';

// ============================================================
// 输入 schema：SDK 要求纯 z.object（不能带 .refine），字段用 meta 注解
// ============================================================
const inputSchema = z.object({
  origin: z.string().optional().meta({
    title: '起点',
    description: '起点名称（由上层 LLM 提取），如“落马洲口岸”、“尖沙咀”',
    toolDescription: '起点/出发地点名称，如“落马洲口岸”、“尖沙咀”、“中环”',
    isToolParam: true
  } satisfies InputSchemaMetaType),
  destination: z.string().optional().meta({
    title: '终点',
    description: '终点名称（由上层 LLM 提取），如“铜锣湾”、“中环”',
    toolDescription: '终点/目的地点名称，如“铜锣湾”、“旺角”、“元朗”',
    isToolParam: true
  } satisfies InputSchemaMetaType),
  transportMode: z.string().optional().meta({
    title: '交通方式',
    description: '交通方式偏好（由上层 LLM 提取）',
    toolDescription:
      '用户偏好的交通方式：bus(巴士)/mtr(港铁)/gmb(小巴)/nlb(大屿山巴士)/ferry(渡轮)/tram(电车)。不填则自动选择',
    isToolParam: true
  } satisfies InputSchemaMetaType),
  question: z.string().optional().meta({
    title: '用户问题（兜底）',
    description: '当起点/终点未提供时，从此问题文本中解析',
    toolDescription:
      '用户的原始问题文本，如“从落马洲到尖沙咀怎么走”。当未提取 origin/destination 时由插件自动解析',
    isToolParam: true
  } satisfies InputSchemaMetaType),
  language: z
    .enum(['zh-CN', 'zh-HK', 'en'])
    .optional()
    .meta({
      title: '语言',
      description: '返回数据的语言，默认简体中文',
      toolDescription: '返回数据语言：zh-CN(简体)/zh-HK(繁体)/en(英文)。不填默认简体'
    } satisfies InputSchemaMetaType)
});

// ============================================================
// 输出 schema：复用 src 的嵌套 schema，顶层字段带 meta
// 不含 _debug（本地诊断噪声，不外传模型）
// ============================================================
const outputSchema = z.object({
  routes: z.array(RouteOptionSchema).meta({
    title: '路线方案',
    description: '推荐的路线方案列表'
  } satisfies OutputSchemaMetaType),
  stopETAs: StopETAListSchema.optional().meta({
    title: '站点到站时间',
    description: '站点实时到站时间列表'
  } satisfies OutputSchemaMetaType),
  paymentInfo: PaymentInfoSchema.meta({
    title: '付款信息',
    description: '付款方式和费用信息'
  } satisfies OutputSchemaMetaType),
  tips: z.array(z.string()).meta({
    title: '注意事项',
    description: '出行建议和注意事项'
  } satisfies OutputSchemaMetaType),
  metadata: MetadataSchema.meta({
    title: '元数据',
    description: '数据时间戳和 API 调用状态'
  } satisfies OutputSchemaMetaType),
  error: z.string().optional().meta({
    title: '错误信息',
    description: '查询失败或无结果时的可操作说明'
  } satisfies OutputSchemaMetaType)
});

// ============================================================
// handler：桥接 SDK 与 src 交通引擎
// ============================================================
const handler = createToolHandler({
  inputSchema,
  outputSchema,
  handler: async (input) => {
    // 用 src 业务 schema 兜底校验（补 language 默认值 + 至少一个地点），再调用交通引擎
    const parsed = await InputType.parseAsync(input);
    const output = await transportTool(parsed);
    // 剔除仅用于本地调试的 _debug 字段，避免作为工具结果噪声传给模型
    const { _debug, ...result } = output;
    return result;
  }
});

// ============================================================
// manifest：pluginId 发布后保持稳定；name/description 提供简/繁/英
// toolDescription 为面向模型的单字符串调用说明（含【必须调用】与反重试措辞）
// ============================================================
export default defineTool({
  manifest: {
    pluginId: 'hk_transport_assistant',
    version: '1.0.2',
    name: {
      en: 'HK Smart Transport Assistant',
      'zh-CN': '香港智能交通助手',
      'zh-Hant': '香港智能交通助手'
    },
    description: {
      en: '[MUST invoke for ALL HK transport questions] Handles all HK public transport needs — route planning from A to B, real-time ETA, last train/bus, fares, payment. Covers KMB/CTB/NLB/LWB bus, GMB minibus, MTR, ferry, tram, Peak Tram.',
      'zh-CN':
        '【必须对任何香港交通问题调用此工具】处理所有香港公共交通需求——从A到B怎么走、乘车路线规划、实时到站时间、末班车查询、费用和付款方式。覆盖巴士(KMB/CTB/NLB/LWB)、小巴(GMB)、港铁(MTR)、渡轮、电车、山顶缆车。',
      'zh-Hant':
        '【必須對任何香港交通問題調用此工具】處理所有香港公共交通需求——從A到B怎麼走、乘車路線規劃、實時到站時間、末班車查詢、費用和付款方式。覆蓋巴士(KMB/CTB/NLB/LWB)、小巴(GMB)、港鐵(MTR)、渡輪、電車、山頂纜車。'
    },
    toolDescription:
      '香港公共交通万能查询工具。当用户问“从X到Y怎么走/怎么去/坐什么车/路线/乘车方案/几时到/末班车/首班车/到站时间/票价”等任何香港交通问题时，必须调用此工具。传入起点(origin)和终点(destination)直接规划路线；或传入用户原始问题文本(question)自动解析。覆盖全港所有巴士、小巴、港铁、渡轮、电车。\n【重要】传入的地名必须是具体地理位置（如“尖沙咀”“中环”“落马洲口岸”）。如果用户提到的是组织/机构名称（如“联合会”“协会”“大厦”“公司”“学校”“医院”），请先联网搜索该组织的具体地址，再将搜索到的最近地铁站或街道名称传入此工具，不要直接传入组织名称。\n【重要】如果此工具返回空路线(routes为空数组)，说明确实无直达公共交通方案，请直接告知用户而不要重复调用此工具——重复调用无法改变结果。',
    tags: ['tools'],
    author: '鲁港通 (Lugang Connect)',
    versionDescription: {
      en: 'Daytime ranking fix: overnight (N/NA) bus routes now sink to the bottom of route suggestions during HK daytime',
      'zh-CN': '日间排序优化：通宵巴士线（N/NA 字头）在香港日间时段自动排到末尾，优先推荐日间线路',
      'zh-Hant': '日間排序優化：通宵巴士線（N/NA 字頭）在香港日間時段自動排到末尾，優先推薦日間線路'
    }
  },
  handler
});
