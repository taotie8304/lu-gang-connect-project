import { createRoot, type Root } from 'react-dom/client';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('@fastgpt/web/components/common/Icon', async () => {
  const React = await import('react');
  return {
    default: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon': name })
  };
});

vi.mock('@chakra-ui/react', async () => {
  const React = await import('react');
  const host = (tag: string) =>
    React.forwardRef((props: any, ref: any) => {
      const { children, ...rest } = props;
      const domProps: Record<string, unknown> = { ref };
      for (const key of [
        'type',
        'value',
        'placeholder',
        'maxLength',
        'rows',
        'disabled',
        'href',
        'target',
        'rel',
        'aria-expanded',
        'title'
      ]) {
        if (rest[key] !== undefined) domProps[key] = rest[key];
      }
      domProps.onClick = rest.onClick;
      domProps.onChange = rest.onChange;
      return React.createElement(tag, domProps, children);
    });
  return {
    Box: host('div'),
    Flex: host('div'),
    Text: host('span'),
    Button: host('button'),
    Link: host('a'),
    Input: host('input'),
    Select: host('select'),
    Textarea: host('textarea')
  };
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as any).act as (callback: () => void | Promise<void>) => Promise<void>;

// 鲁港通 - 项目 tsconfig 为 jsx preserve，vitest 走经典转换，组件文件依赖全局 React
vi.stubGlobal('React', React);

const { default: ScenarioSection } = await import(
  '@/pageComponents/chat/builtinBrowser/scenario/ScenarioSection'
);

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

const renderSection = async (platform?: 'desktop' | 'web') => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSubmit = vi.fn();
  mounted.push({ root, container });
  await act(async () => {
    root.render(React.createElement(ScenarioSection, { platform, onSubmit }));
  });
  return { container, onSubmit };
};

const findLeaf = (container: ParentNode, text: string): HTMLElement => {
  const element = Array.from(container.querySelectorAll<HTMLElement>('*')).find(
    (node) => node.children.length === 0 && node.textContent === text
  );
  if (!element) throw new Error(`Unable to find element with text: ${text}`);
  return element;
};

const click = async (element: Element) => {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    await act(async () => root.unmount());
    container.remove();
  }
});

describe('场景卡平台分支', () => {
  it('网页端办事卡片显示「需桌面客户端」并给出说明与下载入口', async () => {
    const { container, onSubmit } = await renderSection('web');

    expect(container.textContent).toContain('common:builtin_browser_scenario_desktop_only');

    await click(findLeaf(container, 'builtin_browser_scenario_forms_title'));

    expect(container.textContent).toContain(
      'common:builtin_browser_scenario_desktop_only_desc'
    );
    const download = container.querySelector('a[href="/#home-download"]');
    expect(download).toBeTruthy();
    expect(download?.textContent).toBe('common:builtin_browser_scenario_download_client');
    expect(container.querySelector('input')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('网页端查询卡片提交查询型提示词', async () => {
    const { container, onSubmit } = await renderSection('web');

    await click(findLeaf(container, 'builtin_browser_scenario_transport_title'));
    await click(findLeaf(container, 'builtin_browser_scenario_transport_topic_idp'));
    await click(findLeaf(container, 'common:builtin_browser_scenario_start'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const prompt = onSubmit.mock.calls[0][0] as string;
    expect(prompt).toContain('国际驾驶许可证');
    expect(prompt).toContain('官方入口');
    expect(prompt).not.toContain('办事浏览器');
  });

  it('网页端办事卡片标注「进阶版及以上」并给出套餐入口', async () => {
    const { container } = await renderSection('web');

    expect(container.textContent).toContain('common:builtin_browser_scenario_plan_required');

    await click(findLeaf(container, 'builtin_browser_scenario_forms_title'));

    expect(container.textContent).toContain(
      'common:builtin_browser_scenario_plan_required_desc'
    );
    const planLink = container.querySelector('a[href="/price"]');
    expect(planLink).toBeTruthy();
    expect(planLink?.textContent).toBe('common:builtin_browser_scenario_view_plan');
  });

  it('网页端查询卡片不标注会员要求', async () => {
    const { container } = await renderSection('web');

    const badgeOwners = Array.from(container.querySelectorAll<HTMLElement>('*'))
      .filter(
        (node) =>
          node.children.length === 0 &&
          node.textContent === 'common:builtin_browser_scenario_plan_required'
      )
      .map((badge) => {
        let node: HTMLElement = badge;
        while (
          node.parentElement &&
          !/scenario_(forms|generic|transport|service)_title/.test(node.textContent ?? '')
        ) {
          node = node.parentElement;
        }
        return node.textContent ?? '';
      });

    expect(badgeOwners).toHaveLength(2);
    expect(
      badgeOwners.every(
        (text) => text.includes('forms_title') || text.includes('generic_title')
      )
    ).toBe(true);
  });

  it('桌面端不出现「需桌面客户端」，办事卡片照常展开表单', async () => {
    const { container } = await renderSection('desktop');

    expect(container.textContent).not.toContain('common:builtin_browser_scenario_desktop_only');
    expect(container.textContent).not.toContain('common:builtin_browser_scenario_plan_required');

    await click(findLeaf(container, 'builtin_browser_scenario_forms_title'));
    expect(container.textContent).toContain('common:builtin_browser_scenario_privacy_note');
    expect(container.querySelector('input')).toBeTruthy();
  });

  it('缺省平台按桌面端处理，提交桌面办事提示词', async () => {
    const { container, onSubmit } = await renderSection();

    await click(findLeaf(container, 'builtin_browser_scenario_transport_title'));
    await click(findLeaf(container, 'builtin_browser_scenario_transport_topic_idp'));
    await click(findLeaf(container, 'common:builtin_browser_scenario_start'));

    const prompt = onSubmit.mock.calls[0][0] as string;
    expect(prompt).toContain('请用办事浏览器打开运输署官网');
  });
});
