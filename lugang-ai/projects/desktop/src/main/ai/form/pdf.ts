// 鲁港通 - 可填写 PDF 解析：只接受带表单域的 PDF，扫描件/图片 PDF 明确拒绝
import { readFile } from 'node:fs/promises';
import {
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField
} from 'pdf-lib';
import type { PDFDocument } from 'pdf-lib';
import { FormParseError, type RawFormField, type RawFormParse } from './types';
import { PdfDecryptError } from './pdfDecrypt';
import { loadPdfDocument } from './pdfLoad';

const readFields = (document: PDFDocument, warnings: Set<string>): RawFormField[] => {
  const form = document.getForm();
  if (form.hasXFA()) {
    warnings.add(
      '该 PDF 使用 XFA 动态表单，自动填写可能不完整；如结果异常，请用 Adobe Acrobat 另存为标准表单后再试。'
    );
  }

  const fields: RawFormField[] = [];
  for (const field of form.getFields()) {
    const name = field.getName().trim();
    if (!name) continue;

    if (field instanceof PDFSignature) {
      warnings.add('该 PDF 含电子签名域，签名部分不会自动填写。');
      continue;
    }

    if (field instanceof PDFTextField) {
      fields.push({
        label: name,
        kind: 'text',
        required: field.isRequired(),
        locator: { type: 'pdf-field', name }
      });
      continue;
    }

    if (field instanceof PDFDropdown) {
      fields.push({
        label: name,
        kind: 'choice',
        required: field.isRequired(),
        options: field.getOptions(),
        locator: { type: 'pdf-field', name }
      });
      continue;
    }

    if (field instanceof PDFOptionList) {
      fields.push({
        label: name,
        kind: 'choice',
        required: field.isRequired(),
        options: field.getOptions(),
        locator: { type: 'pdf-field', name }
      });
      continue;
    }

    if (field instanceof PDFRadioGroup) {
      fields.push({
        label: name,
        kind: 'choice',
        required: field.isRequired(),
        options: field.getOptions(),
        locator: { type: 'pdf-field', name }
      });
      continue;
    }

    if (field instanceof PDFCheckBox) {
      fields.push({
        label: name,
        kind: 'checkbox',
        required: field.isRequired(),
        locator: { type: 'pdf-field', name }
      });
    }
  }

  return fields;
};

export const parsePdfForm = async (filePath: string): Promise<RawFormParse> => {
  let document: PDFDocument;
  try {
    const bytes = new Uint8Array(await readFile(filePath));
    document = await loadPdfDocument(bytes);
  } catch (error) {
    if (error instanceof PdfDecryptError) {
      throw new FormParseError(
        'form_parse_failed',
        '这个 PDF 有密码保护，暂时无法自动读取；请先用 PDF 阅读器另存为未加密的 PDF 后再试。'
      );
    }
    throw new FormParseError(
      'form_parse_failed',
      '无法读取这个 PDF 文件，可能已损坏；请确认文件能正常打开后再试。'
    );
  }

  const warnings = new Set<string>();
  const fields = readFields(document, warnings);
  if (fields.length === 0) {
    throw new FormParseError(
      'form_not_fillable',
      '这个 PDF 没有可填写的表单域，可能是扫描件或普通 PDF；请选择可填写（带输入框）的 PDF，或改用 Word / Excel 版本的表格。'
    );
  }

  const title = document.getTitle()?.trim();
  return {
    format: 'pdf',
    ...(title ? { title } : {}),
    fields,
    ...(warnings.size > 0 ? { warnings: [...warnings] } : {})
  };
};
