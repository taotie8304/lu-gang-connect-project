import { describe, expect, it } from 'vitest';
import {
  getScenarioTemplate,
  scenarioTemplates
} from '@/pageComponents/chat/builtinBrowser/scenario/templates';

const transport = getScenarioTemplate('transport')!;
const service = getScenarioTemplate('service')!;
const forms = getScenarioTemplate('forms')!;
const generic = getScenarioTemplate('generic')!;

const BROWSER_PHRASES = ['办事浏览器', '打开浏览器', '20 个浏览器操作'];

describe('场景模板按端分派', () => {
  it('查询类场景全端可用，办事类场景仅桌面端', () => {
    expect(transport.availability).toBe('all');
    expect(service.availability).toBe('all');
    expect(forms.availability).toBe('desktop-only');
    expect(generic.availability).toBe('desktop-only');
  });

  it('网页端运输署模板输出查询提示词，不含浏览器操作要求', () => {
    const prompt = transport.buildPrompt({ topic: '国际驾驶许可证' }, 'web');
    expect(prompt).toContain('【场景模板】');
    expect(prompt).toContain('国际驾驶许可证');
    expect(prompt).toContain('官方');
    expect(prompt).toContain('办理条件');
    expect(prompt).toContain('所需材料');
    expect(prompt).toContain('费用');
    expect(prompt).toContain('官方入口');
    expect(prompt).toContain('简体中文');
    for (const phrase of BROWSER_PHRASES) {
      expect(prompt).not.toContain(phrase);
    }
  });

  it('网页端身份证模板输出查询提示词，保留地区偏好', () => {
    const prompt = service.buildPrompt({ region: '九龙' }, 'web');
    expect(prompt).toContain('身份证');
    expect(prompt).toContain('九龙');
    expect(prompt).toContain('预约');
    expect(prompt).toContain('所需证件');
    expect(prompt).toContain('本人');
    for (const phrase of BROWSER_PHRASES) {
      expect(prompt).not.toContain(phrase);
    }
  });

  it('网页端办事模板不产生浏览器指令', () => {
    for (const template of [forms, generic]) {
      const prompt = template.buildPrompt({}, 'web');
      for (const phrase of BROWSER_PHRASES) {
        expect(prompt).not.toContain(phrase);
      }
    }
  });

  it('桌面端四个模板提示词与现状一致', () => {
    expect(transport.buildPrompt({ topic: '国际驾驶许可证' })).toContain(
      '请用办事浏览器打开运输署官网（www.td.gov.hk）'
    );
    expect(transport.buildPrompt({ topic: '国际驾驶许可证' }, 'desktop')).toContain(
      '20 个浏览器操作'
    );
    expect(forms.buildPrompt({ formName: 'MPF 转账表格' }, 'desktop')).toContain(
      '请用办事浏览器打开香港政府一站通（www.gov.hk）'
    );
    expect(service.buildPrompt({ region: '九龙' }, 'desktop')).toContain(
      '请用办事浏览器打开入境事务处官网（www.immd.gov.hk）'
    );
    expect(generic.buildPrompt({ task: '公司注册' }, 'desktop')).toContain(
      '确认前不要调用办事浏览器'
    );
  });

  it('所有模板都声明 availability', () => {
    for (const template of scenarioTemplates) {
      expect(['all', 'desktop-only']).toContain(template.availability);
    }
  });
});
