// @vitest-environment node
// 鲁港通 - PDF 编辑：表单域填写与文字层标签旁叠加，中文正常、原件不动，不支持场景给中文提示
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import { PDFBool, PDFDocument, PDFName } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore
import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
import { describe, expect, it } from 'vitest';

import { editPdf } from '@fastgpt/service/core/ai/document/edit/pdf';
import { DocumentEditError } from '@fastgpt/service/core/ai/document/types';

const FONT_PATH = fileURLToPath(
  new URL('../../../../core/ai/document/assets/NotoSansSC-Regular.otf', import.meta.url)
);

const embedTestFont = async (pdf: PDFDocument) => {
  pdf.registerFontkit(fontkit);
  return pdf.embedFont(new Uint8Array(await readFile(FONT_PATH)), { subset: true });
};

// 鲁港通 - 表单夹具：中文文本域、下拉与复选框
const createFormPdf = async (): Promise<Buffer> => {
  const pdf = await PDFDocument.create();
  const font = await embedTestFont(pdf);
  const page = pdf.addPage([595, 842]);
  page.drawText('申请表', { x: 260, y: 790, size: 16, font });
  const form = pdf.getForm();
  const name = form.createTextField('姓名');
  name.addToPage(page, { x: 120, y: 700, width: 220, height: 22 });
  const gender = form.createDropdown('性别');
  gender.addOptions(['男', '女']);
  gender.addToPage(page, { x: 120, y: 650, width: 120, height: 22 });
  const agree = form.createCheckBox('同意');
  agree.addToPage(page, { x: 120, y: 600, width: 14, height: 14 });
  return Buffer.from(await pdf.save());
};

// 鲁港通 - 文字层夹具：标签逐字绘制，贴近真实表单的文本项切分
const createTextPdf = async (): Promise<Buffer> => {
  const pdf = await PDFDocument.create();
  const font = await embedTestFont(pdf);
  const page = pdf.addPage([595, 842]);
  page.drawText('申请人：', { x: 72, y: 760, size: 14, font });
  page.drawText('日期：', { x: 72, y: 700, size: 14, font });
  return Buffer.from(await pdf.save());
};

const createBlankPdf = async (): Promise<Buffer> => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  page.drawRectangle({ x: 50, y: 50, width: 220, height: 120 });
  return Buffer.from(await pdf.save());
};

// 鲁港通 - pdf-lib 1.x 的 save 不支持加密，用标准安全处理器字典手工构造一个带密码标记的 PDF
const createEncryptedPdf = (): Buffer => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
    '<< /Filter /Standard /V 1 /R 2 /O <00000000000000000000000000000000> /U <00000000000000000000000000000000> /P -44 >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 4 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
};

const extractText = async (buffer: Buffer): Promise<string> => {
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false
  }).promise;
  const texts: string[] = [];
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      texts.push(content.items.map((item) => (item as { str?: string }).str ?? '').join(''));
    }
  } finally {
    await document.destroy().catch(() => undefined);
  }
  return texts.join('\n');
};

describe('PDF 副本编辑', () => {
  it('填写文本域、下拉与复选框，中文写入正常', async () => {
    const result = await editPdf({
      buffer: await createFormPdf(),
      operations: [
        { op: 'fill_field', label: '姓名', value: '张三' },
        { op: 'fill_field', label: '性别', value: '女' },
        { op: 'fill_field', label: '同意', value: '是' }
      ]
    });

    expect(result.applied).toBe(3);
    expect(result.skipped).toEqual([]);

    const edited = await PDFDocument.load(result.buffer);
    const form = edited.getForm();
    expect(form.getTextField('姓名').getText()).toBe('张三');
    expect(form.getDropdown('性别').getSelected()).toEqual(['女']);
    expect(form.getCheckBox('同意').isChecked()).toBe(true);
    expect(form.acroForm.dict.get(PDFName.of('NeedAppearances'))).toBe(PDFBool.False);
  });

  it('字段不存在时跳过并说明，其余字段照常填写', async () => {
    const result = await editPdf({
      buffer: await createFormPdf(),
      operations: [
        { op: 'fill_field', label: '姓名', value: '李四' },
        { op: 'fill_field', label: '不存在的字段', value: '值' }
      ]
    });

    expect(result.applied).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toContain('不存在的字段');
    expect(result.skipped[0]).toContain('找不到');
  });

  it('下拉值不在可选项时跳过并说明', async () => {
    const result = await editPdf({
      buffer: await createFormPdf(),
      operations: [
        { op: 'fill_field', label: '姓名', value: '王五' },
        { op: 'fill_field', label: '性别', value: '未知' }
      ]
    });

    expect(result.applied).toBe(1);
    expect(result.skipped[0]).toContain('可选项');
    expect(result.skipped[0]).toContain('未知');
  });

  it('PDF 没有表单域时提示无法填写且不生成文件', async () => {
    await expect(
      editPdf({
        buffer: await createTextPdf(),
        operations: [{ op: 'fill_field', label: '申请人', value: '张三' }]
      })
    ).rejects.toThrow(/表单/);
    await expect(
      editPdf({
        buffer: await createTextPdf(),
        operations: [{ op: 'fill_field', label: '申请人', value: '张三' }]
      })
    ).rejects.toThrow(/未生成新文件/);
  });

  it('所有修改都未命中时不生成文件', async () => {
    const error = await editPdf({
      buffer: await createFormPdf(),
      operations: [{ op: 'fill_field', label: '联系电话', value: '12345678' }]
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DocumentEditError);
    expect((error as Error).message).toContain('没有找到与要求匹配的内容');
    expect((error as Error).message).toContain('未生成新文件');
    expect((error as Error).message).toContain('联系电话');
  });

  it('在标签旁叠加文字，抽取结果包含填写内容且原件不变', async () => {
    const original = await createTextPdf();
    const snapshot = Buffer.from(original);

    const result = await editPdf({
      buffer: original,
      operations: [
        { op: 'add_text', label: '申请人', value: '张三' },
        { op: 'add_text', label: '日期', value: '2026年11月14日' }
      ]
    });

    expect(result.applied).toBe(2);
    const text = await extractText(result.buffer);
    expect(text).toContain('张三');
    expect(text).toContain('2026年11月14日');
    expect(original.equals(snapshot)).toBe(true);
  });

  it('叠加文字找不到标签时跳过', async () => {
    const error = await editPdf({
      buffer: await createTextPdf(),
      operations: [{ op: 'add_text', label: '联系电话', value: '12345678' }]
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DocumentEditError);
    expect((error as Error).message).toContain('未生成新文件');
    expect((error as Error).message).toContain('标签');
  });

  it('没有文字层的 PDF 提示无法按标签定位', async () => {
    const error = await editPdf({
      buffer: await createBlankPdf(),
      operations: [{ op: 'add_text', label: '申请人', value: '张三' }]
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DocumentEditError);
    expect((error as Error).message).toMatch(/文字层|扫描件/);
  });

  it('受密码保护的 PDF 提示先解除保护', async () => {
    await expect(
      editPdf({
        buffer: createEncryptedPdf(),
        operations: [{ op: 'fill_field', label: '姓名', value: '张三' }]
      })
    ).rejects.toThrow(/密码保护/);
  });

  it('非 PDF 文件拒绝处理', async () => {
    await expect(
      editPdf({
        buffer: Buffer.from('not a pdf at all'),
        operations: [{ op: 'fill_field', label: '姓名', value: '张三' }]
      })
    ).rejects.toThrow(/PDF/);
  });

  it('不适用于 PDF 的操作跳过并说明', async () => {
    const result = await editPdf({
      buffer: await createFormPdf(),
      operations: [
        { op: 'fill_field', label: '姓名', value: '赵六' },
        { op: 'set_cell', sheet: 'Sheet1', cell: 'A1', value: 'x' }
      ]
    });

    expect(result.applied).toBe(1);
    expect(result.skipped[0]).toContain('Excel');
  });
});
