// 鲁港通 - 内置浏览器 P2 场景模板：四个内置模板与指令构建（纯函数，可单测）
import type {
  ScenarioFormValues,
  ScenarioId,
  ScenarioTemplate
} from './types';

export const DEFAULT_SCENARIO_TEXT_LIMIT = 120;
export const GENERIC_SCENARIO_TEXT_LIMIT = 300;

const requiredKey = 'builtin_browser_scenario_error_required';
const tooLongKey = 'builtin_browser_scenario_error_too_long';

// 鲁港通 - 所有模板统一的执行边界：官方来源、操作上限、停止条件与输出语言
const COMMON_RULES = `要求：
1. 只使用政府官方来源（gov.hk、td.gov.hk、immd.gov.hk、cr.gov.hk 等），不引用转载站或营销内容，不编造链接；
2. 最多约 20 个浏览器操作、10 分钟内完成；达到上限就停下并说明已完成部分与未完成原因；
3. 遇到登录、验证码、付款或要求填写、提交个人资料时立即停下，用简体中文说明“这一步需要你本人完成”，等我本人处理；
4. 结束后用简体中文总结，附官方入口链接与下一步建议。`;

const valueOf = (values: ScenarioFormValues, key: string, fallback: string) => {
  const value = (values[key] ?? '').trim();
  return value || fallback;
};

const buildFormsPrompt = (values: ScenarioFormValues) => `【场景模板】下载政府常用表格
表格名称：${valueOf(values, 'formName', '（未填写）')}
请用办事浏览器打开香港政府一站通（www.gov.hk），搜索该表格的官方页面，确认版本年度与适用对象后，下载最新版官方文件。
下载完成后说明文件名、保存位置（下载条或个人资料库）与来源链接。
${COMMON_RULES}`;

const buildTransportPrompt = (values: ScenarioFormValues) => `【场景模板】查询运输署牌照与驾驶事务
主题：${valueOf(values, 'topic', '（未填写）')}
请用办事浏览器打开运输署官网（www.td.gov.hk），查询该事项的办理条件、所需材料、费用与官方办理入口。
${COMMON_RULES}
5. 总结中请写清：办理条件、所需材料、费用与官方入口链接。`;

const buildServicePrompt = (values: ScenarioFormValues) => `【场景模板】预约办理香港身份证
地区偏好：${valueOf(values, 'region', '不限')}
请用办事浏览器打开入境事务处官网（www.immd.gov.hk），进入身份证预约入口，查询指定地区最近的可预约时段，并说明预约所需证件与材料。
到达需要填写申请人姓名、证件号码或联系方式的页面时必须停下，不要代填任何个人资料。
${COMMON_RULES}
5. 总结中请写清：可预约时段、所需证件与材料、官方预约入口链接。`;

const buildGenericPrompt = (values: ScenarioFormValues) => `【场景模板】通用办理
我要办的事：${valueOf(values, 'task', '（未填写）')}
地区/身份：${valueOf(values, 'region', '未填写')}
希望做到：${valueOf(values, 'goal', '查流程')}
请先给 3–6 步计划，等我确认后再执行。计划中写明每一步要打开哪个官方网站、要做什么，确认前不要调用办事浏览器，也不要代替我填写个人资料。
${COMMON_RULES}
5. 计划里不要包含代替我登录、接收验证码、付款或提交个人资料的步骤。`;

export const scenarioTemplates: ScenarioTemplate[] = [
  {
    id: 'forms',
    icon: 'common/download',
    titleKey: 'builtin_browser_scenario_forms_title',
    descKey: 'builtin_browser_scenario_forms_desc',
    exampleKeys: [
      'builtin_browser_scenario_forms_ex_mpf',
      'builtin_browser_scenario_forms_ex_rates',
      'builtin_browser_scenario_forms_ex_allowance'
    ],
    fields: [
      {
        key: 'formName',
        labelKey: 'builtin_browser_scenario_forms_field_name',
        kind: 'text',
        required: true,
        placeholderKey: 'builtin_browser_scenario_forms_field_name_ph'
      }
    ],
    buildPrompt: buildFormsPrompt
  },
  {
    id: 'transport',
    icon: 'common/globalLine',
    titleKey: 'builtin_browser_scenario_transport_title',
    descKey: 'builtin_browser_scenario_transport_desc',
    fields: [
      {
        key: 'topic',
        labelKey: 'builtin_browser_scenario_transport_field_topic',
        kind: 'chips',
        required: true,
        options: [
          {
            value: '续领车辆牌照',
            labelKey: 'builtin_browser_scenario_transport_topic_plate'
          },
          {
            value: '国际驾驶许可证',
            labelKey: 'builtin_browser_scenario_transport_topic_idp'
          },
          {
            value: '驾驶考试',
            labelKey: 'builtin_browser_scenario_transport_topic_exam'
          },
          {
            value: '其他运输署事务',
            labelKey: 'builtin_browser_scenario_transport_topic_other'
          }
        ]
      }
    ],
    buildPrompt: buildTransportPrompt
  },
  {
    id: 'service',
    icon: 'date',
    titleKey: 'builtin_browser_scenario_service_title',
    descKey: 'builtin_browser_scenario_service_desc',
    fields: [
      {
        key: 'region',
        labelKey: 'builtin_browser_scenario_service_field_region',
        kind: 'select',
        defaultValue: '不限',
        options: [
          { value: '不限', labelKey: 'builtin_browser_scenario_service_region_any' },
          { value: '港岛', labelKey: 'builtin_browser_scenario_service_region_hk' },
          { value: '九龙', labelKey: 'builtin_browser_scenario_service_region_kln' },
          { value: '新界', labelKey: 'builtin_browser_scenario_service_region_nt' }
        ]
      }
    ],
    buildPrompt: buildServicePrompt
  },
  {
    id: 'generic',
    icon: 'common/list',
    titleKey: 'builtin_browser_scenario_generic_title',
    descKey: 'builtin_browser_scenario_generic_desc',
    fields: [
      {
        key: 'task',
        labelKey: 'builtin_browser_scenario_generic_field_task',
        kind: 'textarea',
        required: true,
        maxLength: GENERIC_SCENARIO_TEXT_LIMIT,
        placeholderKey: 'builtin_browser_scenario_generic_field_task_ph'
      },
      {
        key: 'region',
        labelKey: 'builtin_browser_scenario_generic_field_region',
        kind: 'select',
        defaultValue: '内地居民',
        options: [
          { value: '内地居民', labelKey: 'builtin_browser_scenario_generic_region_mainland' },
          { value: '香港居民', labelKey: 'builtin_browser_scenario_generic_region_hk' },
          { value: '在港学生', labelKey: 'builtin_browser_scenario_generic_region_student' },
          { value: '企业', labelKey: 'builtin_browser_scenario_generic_region_company' },
          { value: '其他', labelKey: 'builtin_browser_scenario_generic_region_other' }
        ]
      },
      {
        key: 'goal',
        labelKey: 'builtin_browser_scenario_generic_field_goal',
        kind: 'chips',
        defaultValue: '查流程',
        options: [
          { value: '查流程', labelKey: 'builtin_browser_scenario_generic_goal_read' },
          { value: '下载表格', labelKey: 'builtin_browser_scenario_generic_goal_download' },
          { value: '开始办理', labelKey: 'builtin_browser_scenario_generic_goal_start' }
        ]
      }
    ],
    buildPrompt: buildGenericPrompt
  }
];

export const getScenarioTemplate = (id: ScenarioId) =>
  scenarioTemplates.find((template) => template.id === id);

export const validateScenarioValues = (
  template: ScenarioTemplate,
  values: ScenarioFormValues
): string | null => {
  for (const field of template.fields) {
    const value = (values[field.key] ?? '').trim();
    if (field.required && !value) return requiredKey;
    if (value.length > (field.maxLength ?? DEFAULT_SCENARIO_TEXT_LIMIT)) return tooLongKey;
  }
  return null;
};
