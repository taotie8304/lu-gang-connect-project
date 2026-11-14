// 鲁港通 - 内置浏览器 P2 场景模板类型
import type { IconNameType } from '@fastgpt/web/components/common/Icon/type';

export type ScenarioId = 'forms' | 'transport' | 'service' | 'generic';

export type ScenarioPlatform = 'desktop' | 'web';

/** 鲁港通 - all：全端可用（网页端走查询提示词）；desktop-only：办事操作只在桌面客户端提供 */
export type ScenarioAvailability = 'all' | 'desktop-only';

export type ScenarioFieldOption = {
  value: string;
  labelKey: string;
};

export type ScenarioField = {
  key: string;
  labelKey: string;
  kind: 'text' | 'textarea' | 'chips' | 'select';
  required?: boolean;
  placeholderKey?: string;
  options?: ScenarioFieldOption[];
  defaultValue?: string;
  /** 鲁港通 - 文本长度上限，缺省 120 字；通用办理描述为 300 字 */
  maxLength?: number;
};

export type ScenarioFormValues = Record<string, string>;

export type ScenarioPrompt = { id: number; text: string };

export type ScenarioFocus = { nonce: number; id?: ScenarioId };

export type ScenarioTemplate = {
  id: ScenarioId;
  icon: IconNameType;
  titleKey: string;
  descKey: string;
  /** 卡片上的高频示例 chip，点击填入第一个字段 */
  exampleKeys?: string[];
  /** 鲁港通 - 端可用性：办事类场景仅桌面客户端可提交 */
  availability: ScenarioAvailability;
  fields: ScenarioField[];
  /** 纯函数：把表单值拼成发给模型的中文指令；platform 缺省按桌面端 */
  buildPrompt: (values: ScenarioFormValues, platform?: ScenarioPlatform) => string;
};
