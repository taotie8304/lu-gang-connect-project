export type ReadRawTextProps<T> = {
  extension: string;
  buffer: T;
  encoding: string;
};

export type ReadRawTextByBuffer = ReadRawTextProps<Buffer>;

export type UploadedFileResult = {
  key: string;
  previewUrl?: string;
};

export type UploadFileHandler = (data: {
  name: string;
  mime: string;
  buffer: ArrayBuffer;
}) => Promise<UploadedFileResult>;

/**
 * 鲁港通 - 扫描页视觉识别回调：由主线程调用视觉模型，worker 只负责切图与拼装文本
 */
export type OcrPageHandler = (data: {
  imageData: Uint8Array;
  width: number;
  height: number;
}) => Promise<string | undefined>;

export type ReadFileOptions = {
  ocr?: OcrPageHandler;
};

export type TextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  fontSize?: number;
  confidence?: number;
};

export type ParsedPage = {
  pageNum: number;
  width: number;
  height: number;
  text: string;
  textItems: TextItem[];
};

export type ReadFileResponse = {
  rawText: string;
  formatText?: string;
  sourceMetadata?: {
    filename?: string;
    contentType?: string;
    extension?: string;
    encoding?: string;
  };
  tableInfo?: {
    sheetCount: number;
    mergedCellCount: number;
  };
};
