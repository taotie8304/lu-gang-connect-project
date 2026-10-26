import { describe, expect, it, vi } from 'vitest';
import type { FilePickerDialogOptions } from '../src/main/ai/filePicker';
import { createFilePicker } from '../src/main/ai/filePicker';

const created = (filePaths: string[]) => ({ canceled: false, filePaths });

describe('本机文件选择', () => {
  it('默认定位到最近生成的文件，只允许选择单个文件', async () => {
    const showOpenDialog = vi.fn(async (_options: FilePickerDialogOptions) =>
      created(['C:\\Users\\tester\\Downloads\\鲁港通生成文件\\申请书.docx'])
    );
    const picker = createFilePicker({
      showOpenDialog,
      getDefaultPath: () => 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\申请书.docx'
    });

    await expect(picker()).resolves.toBe(
      'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\申请书.docx'
    );
    expect(showOpenDialog).toHaveBeenCalledTimes(1);
    expect(showOpenDialog.mock.calls[0][0]).toMatchObject({
      properties: ['openFile'],
      filters: expect.arrayContaining([{ name: '文档文件', extensions: expect.any(Array) }])
    });
    expect((showOpenDialog.mock.calls[0][0] as { defaultPath?: string }).defaultPath).toContain(
      '申请书.docx'
    );
  });

  it('用户取消选择时返回空，不指定任何路径', async () => {
    const picker = createFilePicker({
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      getDefaultPath: () => undefined
    });
    await expect(picker()).resolves.toBeNull();
  });

  it('没有最近生成文件时打开普通文件对话框', async () => {
    const showOpenDialog = vi.fn(async (_options: FilePickerDialogOptions) =>
      created(['C:\\资料\\证明.pdf'])
    );
    const picker = createFilePicker({ showOpenDialog, getDefaultPath: () => undefined });
    await expect(picker()).resolves.toBe('C:\\资料\\证明.pdf');
    expect((showOpenDialog.mock.calls[0][0] as { defaultPath?: string }).defaultPath).toBeUndefined();
  });

  it('选择表单时改用表单标题与可填写格式过滤', async () => {
    const showOpenDialog = vi.fn(async (_options: FilePickerDialogOptions) =>
      created(['C:\\表单\\申请表.docx'])
    );
    const picker = createFilePicker({ showOpenDialog, getDefaultPath: () => undefined });

    await expect(
      picker({
        title: '选择要填写的空白表单',
        buttonLabel: '选择表单',
        filters: [{ name: '可填写表单', extensions: ['docx', 'xlsx', 'pdf'] }]
      })
    ).resolves.toBe('C:\\表单\\申请表.docx');
    expect(showOpenDialog.mock.calls[0][0]).toMatchObject({
      title: '选择要填写的空白表单',
      buttonLabel: '选择表单',
      filters: [{ name: '可填写表单', extensions: ['docx', 'xlsx', 'pdf'] }]
    });
  });
});
