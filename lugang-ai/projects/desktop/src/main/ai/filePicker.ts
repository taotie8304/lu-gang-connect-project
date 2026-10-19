// 鲁港通 - 本机文件选择：始终由用户亲手选择，AI 不能指定任意路径
export type FilePickerDialogOptions = {
  properties: ['openFile'];
  title: string;
  buttonLabel: string;
  defaultPath?: string;
  filters: { name: string; extensions: string[] }[];
};

export type FilePickerDialogResult = {
  canceled: boolean;
  filePaths: string[];
};

export type CreateFilePickerOptions = {
  showOpenDialog: (options: FilePickerDialogOptions) => Promise<FilePickerDialogResult>;
  getDefaultPath: () => string | undefined;
};

export const createFilePicker = ({
  showOpenDialog,
  getDefaultPath
}: CreateFilePickerOptions) => {
  return async (): Promise<string | null> => {
    const defaultPath = getDefaultPath();
    const result = await showOpenDialog({
      properties: ['openFile'],
      title: '选择要上传的文件',
      buttonLabel: '选择文件',
      ...(defaultPath ? { defaultPath } : {}),
      filters: [
        {
          name: '文档文件',
          extensions: ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'jpg', 'jpeg', 'png']
        },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  };
};
