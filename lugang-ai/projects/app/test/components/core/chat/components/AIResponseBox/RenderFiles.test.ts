import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatFileCardType } from '@fastgpt/global/core/chat/type';

const { toast, getPresignedChatFileGetUrl } = vi.hoisted(() => ({
  toast: vi.fn(),
  getPresignedChatFileGetUrl: vi.fn()
}));

vi.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('@fastgpt/web/hooks/useToast', () => ({
  useToast: () => ({ toast })
}));

vi.mock('@/web/common/file/api', () => ({
  getPresignedChatFileGetUrl
}));

vi.mock('@/web/common/system/useSystemStore', () => ({
  useSystemStore: (selector: (state: any) => unknown) =>
    selector({ feConfigs: { lugangChatFileRetentionDays: 7 } })
}));

vi.mock('@/web/core/chat/utils', () => ({
  useChatAuthApiTarget: () => ({ appId: 'app_1' })
}));

vi.mock('@chakra-ui/react', async () => {
  const React = await import('react');
  const host = (tag: string) =>
    React.forwardRef((props: any, ref: any) => {
      const { children, ...rest } = props;
      const domProps: Record<string, unknown> = { ref };
      for (const key of ['type', 'disabled', 'title', 'download', 'href']) {
        if (rest[key] !== undefined) domProps[key] = rest[key];
      }
      domProps.onClick = rest.onClick;
      return React.createElement(tag, domProps, children);
    });
  return {
    Box: host('div'),
    Flex: host('div'),
    Text: host('span'),
    Button: host('button')
  };
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as any).act as (callback: () => void | Promise<void>) => Promise<void>;

// 鲁港通 - 项目 tsconfig 为 jsx preserve，vitest 走经典转换，组件文件依赖全局 React
vi.stubGlobal('React', React);

const { WorkflowRuntimeContext } = await import(
  '@/components/core/chat/ChatContainer/context/workflowRuntimeContext'
);
const { default: RenderFiles } = await import(
  '@/components/core/chat/components/AIResponseBox/RenderFiles'
);

const files: ChatFileCardType[] = [
  { key: 'file-1', name: '年度报告.docx', format: 'docx', size: 2 * 1024 * 1024 },
  { key: 'file-2', name: '预算表.xlsx', format: 'xlsx' }
];

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

const renderFiles = async (items?: ChatFileCardType[] | null) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });

  await act(async () => {
    root.render(
      React.createElement(
        WorkflowRuntimeContext.Provider,
        {
          value: {
            chatId: 'chat_1',
            sourceTarget: { sourceType: 'app', sourceId: 'app_1' },
            outLinkAuthData: {},
            sourceKey: 'app:app_1',
            fileUploadMode: 'runtime',
            fileUploading: false,
            setFileUploadingCount: () => {}
          }
        },
        React.createElement(RenderFiles, { files: items })
      )
    );
  });

  return container;
};

const findDownloadButton = (container: ParentNode): HTMLButtonElement => {
  const button = Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent === 'chat:chat_file_card_download'
  );
  if (!button) throw new Error('download button not found');
  return button;
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
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('聊天文件卡片', () => {
  it('渲染文件名、大小、格式、保留期与下载按钮', async () => {
    const container = await renderFiles(files);

    expect(container.textContent).toContain('年度报告.docx');
    expect(container.textContent).toContain('DOCX');
    expect(container.textContent).toContain('chat:chat_file_card_size_mb');
    expect(container.textContent).toContain('chat:chat_file_card_expiry');
    expect(findDownloadButton(container)).toBeTruthy();
  });

  it('无文件时不渲染', async () => {
    const container = await renderFiles([]);
    expect(container.textContent).toBe('');
  });

  it('下载失败时提示文件可能已过期', async () => {
    getPresignedChatFileGetUrl.mockRejectedValueOnce(new Error('expired'));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const container = await renderFiles(files);

    await click(findDownloadButton(container));

    expect(getPresignedChatFileGetUrl).toHaveBeenCalledWith({
      key: 'file-1',
      chatId: 'chat_1',
      appId: 'app_1'
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'chat:chat_file_card_download_failed' })
    );
  });

  it('下载成功时使用预签名链接触发浏览器下载', async () => {
    getPresignedChatFileGetUrl.mockResolvedValueOnce('https://s3.example.com/file-1?sig=1');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const container = await renderFiles(files);

    await click(findDownloadButton(container));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });
});
