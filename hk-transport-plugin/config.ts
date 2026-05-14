// 鲁港通 - 香港智能交通助手 config.ts
// FastGPT 系统插件配置（按照官方 defineTool 格式）
//
// 注意：当部署到 fastgpt-plugin 仓库时，需要使用官方的 defineTool 和枚举：
//   import { defineTool } from '@tool/type';
//   import { WorkflowIOValueTypeEnum, FlowNodeInputTypeEnum } from '@tool/type/fastgpt';
//   import { ToolTagEnum } from '@tool/type/tags';
//
// 当前在独立项目中开发，使用本地定义的等效值。

// ============================================================
// FastGPT 枚举值（与官方 @tool/type/fastgpt 一致）
// ============================================================

const WorkflowIOValueTypeEnum = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  object: 'object',
  arrayString: 'arrayString',
  arrayNumber: 'arrayNumber',
  arrayBoolean: 'arrayBoolean',
  arrayObject: 'arrayObject',
  arrayAny: 'arrayAny',
  any: 'any',
  chatHistory: 'chatHistory',
  datasetQuote: 'datasetQuote',
  dynamic: 'dynamic',
  selectApp: 'selectApp',
  selectDataset: 'selectDataset'
} as const;

const FlowNodeInputTypeEnum = {
  reference: 'reference',
  input: 'input',
  numberInput: 'numberInput',
  switch: 'switch',
  select: 'select',
  slider: 'slider',
  hidden: 'hidden',
  addInputParam: 'addInputParam',
  JSONEditor: 'JSONEditor',
  settingLLMModel: 'settingLLMModel',
  textarea: 'textarea',
  settingDatasetQuotePrompt: 'settingDatasetQuotePrompt'
} as const;

const ToolTagEnum = {
  tools: 'tools',
  search: 'search',
  multimodal: 'multimodal',
  communication: 'communication',
  other: 'other'
} as const;

// ============================================================
// Plugin config (compatible with defineTool format)
// ============================================================

const config = {
  tags: [ToolTagEnum.tools],
  name: {
    'zh-CN': '香港智能交通助手',
    'zh-Hant': '香港智能交通助手',
    en: 'HK Smart Transport Assistant'
  },
  description: {
    'zh-CN': '【必须对任何香港交通问题调用此工具】处理所有香港公共交通需求——从A到B怎么走、乘车路线规划、实时到站时间、末班车查询、费用和付款方式。覆盖巴士(KMB/CTB/NLB/LWB)、小巴(GMB)、港铁(MTR)、渡轮、电车、山顶缆车。当用户问"怎么走""怎么去""坐什么车""路线""几时到""末班车"等问题时必须调用。',
    'zh-Hant': '【必須對任何香港交通問題調用此工具】處理所有香港公共交通需求——從A到B怎麼走、乘車路線規劃、實時到站時間、末班車查詢、費用和付款方式。覆蓋巴士(KMB/CTB/NLB/LWB)、小巴(GMB)、港鐵(MTR)、渡輪、電車、山頂纜車。當用戶問"怎麼走""怎麼去""坐什麼車""路線""幾時到""末班車"等問題時必須調用。',
    en: '[MUST invoke for ALL HK transport questions] Handles all HK public transport needs — route planning from A to B, real-time ETA, last train/bus, fares, payment. Covers KMB/CTB/NLB/LWB bus, GMB minibus, MTR, ferry, tram, Peak Tram. Invoke when user asks about getting from one place to another, which bus/train to take, schedules, directions.'
  },
  toolDescription: {
    'zh-CN': '香港公共交通万能查询工具。当用户问"从X到Y怎么走/怎么去/坐什么车/路线/乘车方案/几时到/末班车/首班车/到站时间/票价"等任何香港交通问题时，必须调用此工具。传入起点(origin)和终点(destination)直接规划路线；或传入用户原始问题文本(question)自动解析。覆盖全港所有巴士、小巴、港铁、渡轮、电车。\n【重要】传入的地名必须是具体地理位置（如"尖沙咀""中环""落马洲口岸"）。如果用户提到的是组织/机构名称（如"联合会""协会""大厦""公司""学校""医院"），请先联网搜索该组织的具体地址，再将搜索到的最近地铁站或街道名称传入此工具，不要直接传入组织名称。\n【重要】如果此工具返回空路线(routes为空数组)，说明确实无直达公共交通方案，请直接告知用户而不要重复调用此工具——重复调用无法改变结果。',
    en: 'Universal HK public transport query tool. MUST invoke when user asks route planning (how to get from X to Y), schedules (ETA, first/last bus), fares, or any HK transport question. Pass origin/destination for direct route planning, or pass the user question text for auto-parsing. Covers all HK bus, minibus, MTR, ferry, tram.\n[IMPORTANT] If this tool returns empty routes, it means no direct transit route exists. Do NOT call this tool again - just inform the user directly. Retrying will not change the result.'
  },
  versionList: [
    {
      value: '0.1.0',
      description: 'Initial version',
      inputs: [
        {
          renderTypeList: [FlowNodeInputTypeEnum.reference, FlowNodeInputTypeEnum.input],
          selectedTypeIndex: 0,
          valueType: WorkflowIOValueTypeEnum.string,
          key: 'origin',
          label: '起点',
          description: '起点名称（由上层 LLM 提取），如"落马洲口岸"、"尖沙咀"',
          required: false,
          toolDescription: '起点/出发地点名称，如"落马洲口岸"、"尖沙咀"、"中环"'
        },
        {
          renderTypeList: [FlowNodeInputTypeEnum.reference, FlowNodeInputTypeEnum.input],
          selectedTypeIndex: 0,
          valueType: WorkflowIOValueTypeEnum.string,
          key: 'destination',
          label: '终点',
          description: '终点名称（由上层 LLM 提取），如"铜锣湾"、"中环"',
          required: false,
          toolDescription: '终点/目的地点名称，如"铜锣湾"、"旺角"、"元朗"'
        },
        {
          renderTypeList: [FlowNodeInputTypeEnum.select],
          selectedTypeIndex: 0,
          valueType: WorkflowIOValueTypeEnum.string,
          key: 'transportMode',
          label: '交通方式',
          description: '交通方式偏好（由上层 LLM 提取）',
          required: false,
          enumList: [
            { label: '不限定', value: '' },
            { label: '巴士', value: 'bus' },
            { label: '港铁', value: 'mtr' },
            { label: '小巴', value: 'gmb' },
            { label: '大屿山巴士', value: 'nlb' },
            { label: '渡轮', value: 'ferry' },
            { label: '电车', value: 'tram' },
          ],
          toolDescription: '用户偏好的交通方式：bus(巴士)/mtr(港铁)/gmb(小巴)/ferry(渡轮)/tram(电车)。不填则自动选择'
        },
        {
          renderTypeList: [FlowNodeInputTypeEnum.reference, FlowNodeInputTypeEnum.input],
          selectedTypeIndex: 0,
          valueType: WorkflowIOValueTypeEnum.string,
          key: 'question',
          label: '用户问题（兜底）',
          description: '当起点/终点未提供时，从此问题文本中解析',
          required: false,
          toolDescription: '用户的原始问题文本，如"从落马洲到尖沙咀怎么走"。当未提取origin/destination时由插件自动解析'
        },
        {
          renderTypeList: [FlowNodeInputTypeEnum.select],
          selectedTypeIndex: 0,
          valueType: WorkflowIOValueTypeEnum.string,
          key: 'language',
          label: '语言',
          description: '返回数据的语言',
          required: false,
          defaultValue: 'zh-CN'
        }
      ],
      outputs: [
        {
          valueType: WorkflowIOValueTypeEnum.arrayObject,
          key: 'routes',
          label: '路线方案',
          description: '推荐的路线方案列表'
        },
        {
          valueType: WorkflowIOValueTypeEnum.arrayObject,
          key: 'stopETAs',
          label: '站点到站时间',
          description: '站点实时到站时间列表'
        },
        {
          valueType: WorkflowIOValueTypeEnum.object,
          key: 'paymentInfo',
          label: '付款信息',
          description: '付款方式和费用信息'
        },
        {
          valueType: WorkflowIOValueTypeEnum.arrayString,
          key: 'tips',
          label: '注意事项',
          description: '出行建议和注意事项'
        },
        {
          valueType: WorkflowIOValueTypeEnum.object,
          key: 'metadata',
          label: '元数据',
          description: '数据时间戳和 API 调用状态'
        }
      ]
    }
  ]
};

export default config;
