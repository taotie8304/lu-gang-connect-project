// 鲁港通 - 香港学校资料助手（FastGPT 新插件格式 v1.x 根入口）
//
// 用 @fastgpt-plugin/sdk-factory 的 defineTool + createToolHandler 封装 src/tool.ts 编排器。
// 本文件只负责 SDK 封装：inputSchema / outputSchema / manifest / handler。
// 数据源全为政府公开数据（教育局 / CHSC / data.gov.hk），无需密钥，故不设 secretSchema。
import {
  createToolHandler,
  defineTool,
  type InputSchemaMetaType,
  type OutputSchemaMetaType,
} from '@fastgpt-plugin/sdk-factory';
import z from 'zod';
import { runTool } from './src/tool';

// ============================================================
// 输入 schema：SDK 要求纯 z.object（不能带 .refine）；字段用 meta 注解
// 10 参数全部可选，缺省由路由层按参数组合推断意图（src/router.ts）
// ============================================================
const inputSchema = z.object({
  query: z.string().optional().meta({
    title: '用户问题（兜底）',
    description: '用户原始问题文本；未提取到结构化参数时从此文本兜底解析',
    toolDescription:
      '用户的原始问题文本，如「沙田区有哪些小学」「喇沙书院学费多少」。当未提取出其他参数时由插件兜底解析',
    isToolParam: true,
  } satisfies InputSchemaMetaType),
  intent: z
    .enum(['nearby', 'search', 'detail', 'net', 'list', 'stats', 'registration'])
    .optional()
    .meta({
      title: '查询意图',
      description: '缺省按参数组合自动推断',
      toolDescription:
        '查询类型：nearby(附近学校)/search(按条件搜校，含按区域/级别/办学类型列校与学校数量统计)/detail(学校档案)/net(校网)/list(五类专项名单)/stats(学生人数统计，仅限「有多少学生/多少人」类问题)/registration(注册资料)。不填则自动推断',
      isToolParam: true,
    } satisfies InputSchemaMetaType),
  schoolName: z.string().optional().meta({
    title: '校名',
    description: '学校名称（简体/繁体皆可），如「喇沙书院」「沙田官立小学」',
    toolDescription: '要查询的学校名称，简繁皆可。用于学校档案、校名反查、名单与注册资料查询',
    isToolParam: true,
  } satisfies InputSchemaMetaType),
  district: z.string().optional().meta({
    title: '区域',
    description: '香港 18 区区域名（如「沙田区」「元朗」；英文亦可）',
    toolDescription: '香港 18 区区域名，如「沙田区」「湾仔」「元朗」。用于按区域搜索、名单过滤、统计查询',
    isToolParam: true,
  } satisfies InputSchemaMetaType),
  level: z.enum(['kg', 'primary', 'secondary']).optional().meta({
    title: '学校级别',
    description: '学校类型：kg(幼稚园) / primary(小学) / secondary(中学)',
    toolDescription:
      '学校级别：kg(幼稚园)/primary(小学)/secondary(中学)。仅当用户问题明确提到级别时才填写（如「小学」「中学」「幼稚园」「幼儿园」）；用户未指明级别时不要填写此参数，否则会漏掉其他级别的学校',
    isToolParam: true,
  } satisfies InputSchemaMetaType),
  schoolCategory: z
    .enum(['international', 'direct_subsidy', 'government', 'aided', 'private', 'esf'])
    .optional()
    .meta({
      title: '办学类型',
      description:
        '办学类型：international(国际学校) / direct_subsidy(直资) / government(政府，含官立与资助) / aided(资助) / private(私立) / esf(英基)',
      toolDescription:
        '办学类型过滤：international(国际学校)/direct_subsidy(直资)/government(政府，含官立与资助)/aided(资助)/private(私立)/esf(英基)。用于「某区有哪些直资中学」「全港有多少所国际学校」等列校与数量问题；用户说「政府学校/公立学校/公办学校/官立学校」时用 government；用户未指明办学类型时不要填写此参数',
      isToolParam: true,
    } satisfies InputSchemaMetaType),
  location: z.string().optional().meta({
    title: '地点',
    description: '地点/坐标（附近学校查询用），如「尖沙咀」「22.2988,114.1722」',
    toolDescription: '查询附近学校的地点：可传 18 区名、地标名（如「尖沙咀」）、校名，或「纬度,经度」坐标',
    isToolParam: true,
  } satisfies InputSchemaMetaType),
  listType: z
    .enum(['through_train', 'dss_fee', 'kg_scheme', 'k1_not_joining', 'non_aided_ccc'])
    .optional()
    .meta({
      title: '名单类型',
      description: '五类名单：一条龙 / 直资学费 / 幼教计划 / K1 非计划 / 附设幼儿中心',
      toolDescription:
        '五类专项名单（仅当用户明确问这些名单时用）：through_train(一条龙)/dss_fee(直资学费)/kg_scheme(免费幼教计划)/k1_not_joining(K1 非计划)/non_aided_ccc(附设幼儿中心)。「某区有哪些小学/直资中学」等普通列校问题请改用 search 意图',
      isToolParam: true,
    } satisfies InputSchemaMetaType),
  netType: z.enum(['poa', 'sspa']).optional().meta({
    title: '校网类型',
    description: 'poa(小一入学学校网) / sspa(中学学位分配校网)',
    toolDescription: '校网类型：poa(小一入学学校网，按区域或 2 位网编号)/sspa(中学派位校网，按校名或 HK1–NT9 编号)',
    isToolParam: true,
  } satisfies InputSchemaMetaType),
  language: z
    .enum(['zh-CN', 'zh-HK', 'en'])
    .optional()
    .meta({
      title: '语言',
      description: '返回数据语言，输出统一为简体中文（保留参数兼容）',
      toolDescription: '返回数据语言：zh-CN(简体)/zh-HK(繁体)/en(英文)。不填默认 zh-CN',
    } satisfies InputSchemaMetaType),
});

// ============================================================
// 输出 schema：镜像 ToolResult（summary/items/dataDate/sources/tips/error）
// ============================================================
const outputSchema = z.object({
  summary: z.string().meta({
    title: '答案摘要',
    description: '预格式化的简体中文摘要（LLM 直接引用即可，数字均来自官方数据）',
  } satisfies OutputSchemaMetaType),
  items: z
    .array(
      z.object({
        name: z.string().optional(),
        nameEn: z.string().optional(),
        level: z.string().optional(),
        district: z.string().optional(),
        address: z.string().optional(),
        telephone: z.string().optional(),
        website: z.string().optional(),
        distanceMeters: z.number().optional(),
        extra: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])).optional(),
      })
    )
    .meta({
      title: '结构化条目',
      description: '结构化结果条目（学校/名单/统计行等）',
    } satisfies OutputSchemaMetaType),
  dataDate: z.string().meta({
    title: '数据日期',
    description: '数据日期/学年（如「2026/27 学年」「实时数据」）',
  } satisfies OutputSchemaMetaType),
  sources: z.array(z.string()).meta({
    title: '数据来源',
    description: '来源标注（政府官方数据集）',
  } satisfies OutputSchemaMetaType),
  tips: z.array(z.string()).meta({
    title: '提示',
    description: '数据更新节奏、防重试、数据边界等提示',
  } satisfies OutputSchemaMetaType),
  error: z.string().optional().meta({
    title: '错误信息',
    description: '查询失败时的可操作中文说明',
  } satisfies OutputSchemaMetaType),
});

// ============================================================
// handler：桥接 SDK 与 src/tool.ts 编排器（默认缓存目录 /tmp/lugang-school-finder）
// ============================================================
const handler = createToolHandler({
  inputSchema,
  outputSchema,
  handler: async (input) => runTool(input),
});

// ============================================================
// manifest：pluginId 发布后保持稳定；name/description 提供简/繁/英
// toolDescription 为面向模型的单字符串调用说明（含【必须调用】、防重试与数据边界）
// ============================================================
export default defineTool({
  manifest: {
    pluginId: 'hk_school_finder',
    version: '1.1.2',
    name: {
      en: 'HK School Finder',
      'zh-CN': '香港学校资料助手',
      'zh-Hant': '香港學校資料助手',
    },
    description: {
      en: '[MUST invoke for ALL HK school questions] Official data for all HK kindergartens, primary and secondary schools — locations, profiles, class structure, fees, through-train status, POA/SSPA school nets, kindergarten scheme lists, DSS fees, K1-K3 vacancies, district student statistics, school registration records.',
      'zh-CN':
        '【必须对任何香港学校问题调用此工具】查询全港幼稚园、小学、中学的官方资料——学校位置与列表、学校档案（学费/班级/教师/校训）、一条龙关系、小一与中学校网（POA/SSPA）、免费幼教计划与 K1 收生名单、直资学费、学位空缺、分区学生人数统计、学校注册资料。数据来自教育局和家庭与学校合作事宜委员会官方发布。',
      'zh-Hant':
        '【必須對任何香港學校問題調用此工具】查詢全港幼稚園、小學、中學的官方資料——學校位置與列表、學校檔案（學費/班級/教師/校訓）、一條龍關係、小一與中學校網（POA/SSPA）、免費幼教計劃與 K1 收生名單、直資學費、學位空缺、分區學生人數統計、學校註冊資料。數據來自教育局和家庭與學校合作事宜委員會官方發布。',
    },
    toolDescription:
      '香港学校资料万能查询工具。当用户问「某学校怎么样/资料/学费/班数/教师」「附近有哪些学校」「某区有哪些小学/中学/幼稚园」「某区有哪些直资/国际学校」「全港/某区有多少所 XX 学校」「是不是一条龙」「某区学生人数」「学校注册资料」「校网/派位范围」「学位空缺」等任何香港学校问题时，必须调用此工具。优先传入结构化参数（校名 schoolName、区域 district、级别 level、办学类型 schoolCategory、地点 location、名单类型 listType、校网类型 netType）；仅有用户原话时传 query 兜底。\n【问法映射】「某区有哪些小学」「某区有哪些直资中学」等列校问题 → search + district/level/schoolCategory；「政府学校/公立学校/公办学校/官立学校」→ schoolCategory=government（含官立与资助）；「有多少所 XX 学校」等学校数量问题 → search（数量统计）；「有多少学生/中学生」等人数问题 → stats。\n【参数纪律】level 与 schoolCategory 仅在用户问题明确提到时才填写；用户未指明级别时绝不填 level，未指明办学类型时绝不填 schoolCategory，否则会漏查（如「全港有多少所国际学校」不要填 level）。\n【重要】不要重复调用本工具：同一问题返回空结果即表示官方名单/数据中确实没有记录，请直接告知用户；查询失败时按错误说明转达用户，重复调用无法改变结果。\n【边界】本工具只提供官方客观数据，不评价学校质量、不提供排名。',
    tags: ['tools'],
    author: '鲁港通 (Lugang Connect)',
    versionDescription: {
      en: 'Fix: «government schools» only matched government-operated schools; now covers aided schools too (government + aided). Tool descriptions also clarified that level/schoolCategory must not be set unless the user explicitly mentions them',
      'zh-CN':
        '修复：「政府学校」只匹配官立学校的问题；现涵盖资助学校（官立+资助合并口径，摘要附构成拆分）。另明确「用户未指明级别/办学类型时不要填写对应参数」以避免漏查',
      'zh-Hant':
        '修復：「政府學校」只匹配官立學校的問題；現涵蓋資助學校（官立+資助合併口徑，摘要附構成拆分）。另明確「用戶未指明級別/辦學類型時不要填寫對應參數」以避免漏查',
    },
  },
  handler,
});
