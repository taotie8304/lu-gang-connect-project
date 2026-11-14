import { describe, expect, it } from 'vitest';
import {
  scenarioTemplates,
  getScenarioTemplate,
  validateScenarioValues
} from '@/pageComponents/chat/builtinBrowser/scenario/templates';

const transport = getScenarioTemplate('transport')!;
const forms = getScenarioTemplate('forms')!;
const service = getScenarioTemplate('service')!;
const generic = getScenarioTemplate('generic')!;

describe('场景模板数据模型', () => {
  it('四个模板 id 唯一且齐全', () => {
    const ids = scenarioTemplates.map((t) => t.id);
    expect(ids).toEqual(['forms', 'transport', 'service', 'generic']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('必填与可选字段标记正确', () => {
    expect(forms.fields.find((f) => f.key === 'formName')?.required).toBe(true);
    expect(transport.fields.find((f) => f.key === 'topic')?.required).toBe(true);
    expect(service.fields.find((f) => f.key === 'region')?.required).toBeFalsy();
    expect(generic.fields.find((f) => f.key === 'task')?.required).toBe(true);
    expect(generic.fields.find((f) => f.key === 'goal')?.required).toBeFalsy();
  });

  it('每个字段都有四语种文案 key', () => {
    for (const template of scenarioTemplates) {
      expect(template.titleKey).toMatch(/^builtin_browser_scenario_/);
      expect(template.descKey).toMatch(/^builtin_browser_scenario_/);
      for (const field of template.fields) {
        expect(field.labelKey).toMatch(/^builtin_browser_scenario_/);
      }
    }
  });
});

describe('表单校验', () => {
  it('必填为空返回提示 key', () => {
    expect(validateScenarioValues(forms, {})).toBe('builtin_browser_scenario_error_required');
    expect(validateScenarioValues(forms, { formName: '   ' })).toBe(
      'builtin_browser_scenario_error_required'
    );
    expect(validateScenarioValues(generic, { task: '' })).toBe(
      'builtin_browser_scenario_error_required'
    );
  });

  it('超长文本被拒绝，普通字段上限 120 字', () => {
    expect(validateScenarioValues(forms, { formName: '表'.repeat(121) })).toBe(
      'builtin_browser_scenario_error_too_long'
    );
    expect(validateScenarioValues(forms, { formName: '表'.repeat(120) })).toBeNull();
  });

  it('通用办理描述上限 300 字', () => {
    expect(validateScenarioValues(generic, { task: '事'.repeat(301) })).toBe(
      'builtin_browser_scenario_error_too_long'
    );
    expect(validateScenarioValues(generic, { task: '事'.repeat(300) })).toBeNull();
  });

  it('合法值通过，可选字段可缺省', () => {
    expect(validateScenarioValues(forms, { formName: 'MPF 转账表格' })).toBeNull();
    expect(validateScenarioValues(service, {})).toBeNull();
    expect(validateScenarioValues(transport, { topic: '国际驾驶许可证' })).toBeNull();
  });
});

describe('指令构建', () => {
  it('运输署模板包含参数、官方站点、上限与停止条件', () => {
    const prompt = transport.buildPrompt({ topic: '国际驾驶许可证' });
    expect(prompt).toContain('【场景模板】');
    expect(prompt).toContain('国际驾驶许可证');
    expect(prompt).toContain('www.td.gov.hk');
    expect(prompt).toContain('20 个浏览器操作');
    expect(prompt).toContain('10 分钟');
    expect(prompt).toContain('登录');
    expect(prompt).toContain('验证码');
    expect(prompt).toContain('付款');
    expect(prompt).toContain('个人资料');
    expect(prompt).toContain('简体中文');
    expect(prompt).toContain('官方');
  });

  it('表格下载模板要求官方来源与文件说明', () => {
    const prompt = forms.buildPrompt({ formName: 'MPF 转账表格' });
    expect(prompt).toContain('MPF 转账表格');
    expect(prompt).toContain('gov.hk');
    expect(prompt).toContain('下载');
    expect(prompt).toContain('文件名');
  });

  it('身份证预约模板包含地区偏好并禁止代填', () => {
    const prompt = service.buildPrompt({ region: '九龙' });
    expect(prompt).toContain('身份证');
    expect(prompt).toContain('九龙');
    expect(prompt).toContain('immd.gov.hk');
    expect(prompt).toContain('停下');
  });

  it('通用办理要求先给 3–6 步计划并等待确认', () => {
    const prompt = generic.buildPrompt({
      task: '了解香港公司注册要准备什么',
      region: '内地居民',
      goal: '查流程'
    });
    expect(prompt).toContain('了解香港公司注册要准备什么');
    expect(prompt).toContain('内地居民');
    expect(prompt).toContain('查流程');
    expect(prompt).toContain('先给 3–6 步计划，等我确认后再执行');
    expect(prompt).toContain('确认前不要调用办事浏览器');
  });

  it('所有模板指令都带统一执行边界', () => {
    for (const template of scenarioTemplates) {
      const prompt = template.buildPrompt({});
      expect(prompt).toContain('只使用政府官方来源');
      expect(prompt).toContain('约 20 个浏览器操作');
      expect(prompt).toContain('这一步需要你本人完成');
      expect(prompt).toContain('用简体中文');
    }
  });
});
