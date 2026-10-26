// 鲁港通 - 可填写 PDF 回填：使用本机中文字体嵌入外观，写入文本域/下拉/单选/复选框
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import {
  PDFBool,
  PDFCheckBox,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  type PDFDocument,
  type PDFFont
} from 'pdf-lib';
import { FormFillError, type FormFillEntry } from './types';

const FONT_CANDIDATES = ['simhei.ttf', 'Deng.ttf', 'msyh.ttc', 'simsun.ttc'];
const CHECKED_PATTERN = /^(是|true|yes|1|√|✔|✓|勾选|已勾选|on)$/i;

const fontPaths = (): string[] => {
  const windir = process.env.WINDIR ?? process.env.SystemRoot ?? 'C:\\Windows';
  return FONT_CANDIDATES.map((name) => join(windir, 'Fonts', name)).filter((path) =>
    existsSync(path)
  );
};

const embedCjkFont = async (document: PDFDocument): Promise<PDFFont> => {
  document.registerFontkit(fontkit);
  for (const path of fontPaths()) {
    try {
      const bytes = new Uint8Array(await readFile(path));
      return await document.embedFont(bytes, { subset: true });
    } catch {
      // TTC 等字体集合可能不被支持，继续尝试下一个候选
    }
  }
  throw new FormFillError(
    'pdf_font_missing',
    '这台电脑上找不到可用的中文字体，无法在 PDF 里写入中文；请改用 Word 或 Excel 表单，或安装黑体/微软雅黑后重试。'
  );
};

const matchOption = (options: string[], value: string): string | undefined => {
  const target = value.trim();
  if (!target) return undefined;
  const exact = options.find((option) => option === target);
  if (exact) return exact;
  const lower = target.toLowerCase();
  const insensitive = options.find((option) => option.trim().toLowerCase() === lower);
  if (insensitive) return insensitive;
  return options.find((option) => option && (target.includes(option) || option.includes(target)));
};

const isChecked = (value: string): boolean => CHECKED_PATTERN.test(value.trim());

export const fillPdfDocument = async (
  document: PDFDocument,
  entries: FormFillEntry[]
): Promise<{ filled: number; skipped: string[] }> => {
  const form = document.getForm();
  const fields = new Map(form.getFields().map((field) => [field.getName(), field]));

  const needsFont = entries.some(
    ({ field }) => field.kind !== 'checkbox' && field.locator.type === 'pdf-field'
  );
  const font = needsFont ? await embedCjkFont(document) : undefined;

  let filled = 0;
  const skipped: string[] = [];

  for (const { field, value } of entries) {
    const locator = field.locator;
    if (locator.type !== 'pdf-field') {
      skipped.push(`「${field.label}」不是 PDF 表单域，已跳过`);
      continue;
    }
    const target = fields.get(locator.name);
    if (!target) {
      skipped.push(`「${field.label}」在 PDF 里找不到对应表单域，已跳过`);
      continue;
    }

    try {
      if (target instanceof PDFTextField) {
        target.setText(value);
        if (font) target.updateAppearances(font);
      } else if (target instanceof PDFDropdown || target instanceof PDFOptionList) {
        const option = matchOption(target.getOptions(), value);
        if (!option) {
          skipped.push(`「${field.label}」的可选项里没有“${value}”，已跳过`);
          continue;
        }
        target.select(option);
        if (font) target.updateAppearances(font);
      } else if (target instanceof PDFRadioGroup) {
        const option = matchOption(target.getOptions(), value);
        if (!option) {
          skipped.push(`「${field.label}」的可选项里没有“${value}”，已跳过`);
          continue;
        }
        target.select(option);
        target.updateAppearances();
      } else if (target instanceof PDFCheckBox) {
        if (isChecked(value)) target.check();
        else target.uncheck();
      } else {
        skipped.push(`「${field.label}」不是可填写的表单域，已跳过`);
        continue;
      }
      filled += 1;
    } catch {
      skipped.push(`「${field.label}」写入失败，请在这台电脑上手动填写该字段`);
    }
  }

  // 鲁港通 - 外观流已用中文字体生成，关掉 NeedAppearances 防止阅读器用默认字体重绘
  if (filled > 0) {
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.False);
  }

  return { filled, skipped };
};
