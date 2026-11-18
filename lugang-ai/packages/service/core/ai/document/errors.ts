// 鲁港通 - 文档源文件错误：message 为可直接展示的中文说明
export class DocumentSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentSourceError';
  }
}
