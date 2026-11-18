// @vitest-environment node
// 鲁港通 - 内置表格模板：固定地址精确匹配、资产读取、无文件上下文回退与表单回填
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  DOCUMENT_TEMPLATES,
  findDocumentTemplate,
  loadDocumentTemplate
} from '@fastgpt/service/core/ai/document/templates';
import {
  resolveDocumentSource,
  DocumentSourceError
} from '@fastgpt/service/core/ai/document/source';
import { editPdf } from '@fastgpt/service/core/ai/document/edit/pdf';

const TEMPLATE_URL = 'https://www.airscend.com/form-templates/jinan-subsidy-intake.pdf';

describe('内置表格模板注册表', () => {
  it('按固定地址精确匹配济南补贴模板', () => {
    const template = findDocumentTemplate(TEMPLATE_URL);
    expect(template?.assetName).toBe('jinan-subsidy-intake.pdf');
    expect(template?.fileName.endsWith('.pdf')).toBe(true);
  });

  it('未知地址不命中模板，避免任意本地文件读取', () => {
    expect(
      findDocumentTemplate('https://www.airscend.com/form-templates/unknown.pdf')
    ).toBeUndefined();
    expect(findDocumentTemplate('file:///etc/passwd')).toBeUndefined();
  });

  it('读取模板资产返回有效 PDF', async () => {
    expect(DOCUMENT_TEMPLATES.length).toBeGreaterThan(0);
    for (const template of DOCUMENT_TEMPLATES) {
      const buffer = await loadDocumentTemplate(template);
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(buffer.length).toBeGreaterThan(1000);
    }
  });
});

describe('文档源解析的模板回退', () => {
  it('没有对话文件上下文时，模板地址仍可解析', async () => {
    const resolved = await resolveDocumentSource(TEMPLATE_URL);
    expect(resolved.extension).toBe('pdf');
    expect(resolved.filename).toContain('补贴');
    expect(resolved.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('普通外部地址没有对话文件上下文时仍按原口径报缺失', async () => {
    const error = await resolveDocumentSource('https://files.example/other.pdf').catch(
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(DocumentSourceError);
    expect((error as Error).message).toContain('本次对话');
  });
});

describe('模板表单回填', () => {
  it('fill_field 写入模板表单域并可从产物读回', async () => {
    const template = findDocumentTemplate(TEMPLATE_URL)!;
    const buffer = await loadDocumentTemplate(template);

    const result = await editPdf({
      buffer,
      operations: [
        { op: 'fill_field', label: '企业名称', value: '香港示例科技有限公司' },
        { op: 'fill_field', label: '申报年度', value: '2026' }
      ]
    });

    expect(result.applied).toBe(2);
    const filled = await PDFDocument.load(new Uint8Array(result.buffer));
    const form = filled.getForm();
    expect(form.getTextField('企业名称').getText()).toBe('香港示例科技有限公司');
    expect(form.getTextField('申报年度').getText()).toBe('2026');
  });
});
