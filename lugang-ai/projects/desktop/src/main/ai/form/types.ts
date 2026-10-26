// 鲁港通 - 本地表单解析结构：locator 只在本机回填时使用，绝不发给服务端

export type FormFormat = 'docx' | 'xlsx' | 'pdf';

export type FormFieldKind =
  | 'text'
  | 'choice'
  | 'checkbox'
  | 'date'
  | 'table-cell'
  | 'unknown';

export type FormFieldLocator =
  | { type: 'docx-table-cell'; table: number; row: number; cell: number }
  | {
      type: 'docx-cell-paragraph';
      table: number;
      row: number;
      cell: number;
      paragraph: number;
      labelEnd: number;
    }
  | { type: 'docx-paragraph'; paragraph: number; labelEnd: number }
  | { type: 'xlsx-cell'; sheet: string; row: number; column: number }
  | { type: 'pdf-field'; name: string };

export type ParsedFormField = {
  id: string;
  label: string;
  kind: FormFieldKind;
  required?: boolean;
  options?: string[];
  hint?: string;
  locator: FormFieldLocator;
};

export type ParsedForm = {
  format: FormFormat;
  name: string;
  title?: string;
  fields: ParsedFormField[];
  fieldsTruncated?: boolean;
  warnings?: string[];
  path: string;
};

export type FormSummary = {
  format: FormFormat;
  name: string;
  title?: string;
  fields: Array<Omit<ParsedFormField, 'locator'>>;
  fieldsTruncated?: boolean;
  warnings?: string[];
};

export type RawFormField = Omit<ParsedFormField, 'id'>;

/** 回填时的单条字段写入：value 只在本机内存与副本文件里出现 */
export type FormFillEntry = {
  field: ParsedFormField;
  value: string;
};

export type FormFillValue = {
  id: string;
  value: string;
};

export type FilledFormCopy = {
  name: string;
  format: FormFormat;
  folder: string;
  path: string;
  filled: number;
  skipped: string[];
  warnings: string[];
};

export type FormFillErrorCode = 'form_fill_failed' | 'pdf_font_missing';

export class FormFillError extends Error {
  readonly code: FormFillErrorCode;

  constructor(code: FormFillErrorCode, message: string) {
    super(message);
    this.name = 'FormFillError';
    this.code = code;
  }
}

export type RawFormParse = {
  format: FormFormat;
  title?: string;
  fields: RawFormField[];
  warnings?: string[];
};

export type FormParseErrorCode =
  | 'unsupported_format'
  | 'form_not_fillable'
  | 'form_parse_failed';

export class FormParseError extends Error {
  readonly code: FormParseErrorCode;

  constructor(code: FormParseErrorCode, message: string) {
    super(message);
    this.name = 'FormParseError';
    this.code = code;
  }
}
