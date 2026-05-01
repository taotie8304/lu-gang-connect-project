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
    'zh-CN': '根据用户问题智能查询香港公共交通路线、实时到站时间、费用和付款方式。支持巴士（KMB/CTB/NLB）、小巴（GMB）、港铁（MTR）等。',
    'zh-Hant': '根據用戶問題智能查詢香港公共交通路線、實時到站時間、費用和付款方式。支持巴士（KMB/CTB/NLB）、小巴（GMB）、港鐵（MTR）等。',
    en: 'Intelligently query HK public transport routes, real-time ETA, fares and payment. Supports KMB, CTB, NLB, GMB, MTR.'
  },
  toolDescription: {
    'zh-CN': '查询香港公共交通路线和实时到站时间的工具，输入交通问题即可获得路线方案、到站时间、费用和出行建议',
    en: 'Tool for querying HK public transport routes and real-time ETA. Input a transport question to get route options, arrival times, fares and travel tips.'
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
          key: 'question',
          label: '用户问题',
          description: '用户的交通问题，如"从落马洲口岸到香港立法会怎么走"',
          required: true,
          toolDescription: '用户询问的香港交通路线问题'
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
