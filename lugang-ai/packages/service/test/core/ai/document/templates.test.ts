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

describe('香港留学事实采集表模板', () => {
  const HK_STUDY_URL = 'https://www.airscend.com/form-templates/hk-study-facts-intake.pdf';

  it('按固定地址精确匹配留学事实采集表', () => {
    const template = findDocumentTemplate(HK_STUDY_URL);
    expect(template?.assetName).toBe('hk-study-facts-intake.pdf');
    expect(template?.fileName).toContain('香港留学');
  });

  it('模板包含完整表单域与学位层次下拉', async () => {
    const buffer = await loadDocumentTemplate(findDocumentTemplate(HK_STUDY_URL)!);
    const doc = await PDFDocument.load(buffer);
    const form = doc.getForm();
    const names = form.getFields().map((field) => field.getName());
    expect(names.length).toBeGreaterThanOrEqual(25);
    expect(names).toContain('姓名（中文）');
    expect(names).toContain('目标学位层次');
    expect(names).toContain('意向院校');
    expect(form.getDropdown('目标学位层次').getOptions()).toContain('硕士学位');
  });

  it('fill_field 写入留学模板并可从产物读回', async () => {
    const buffer = await loadDocumentTemplate(findDocumentTemplate(HK_STUDY_URL)!);
    const result = await editPdf({
      buffer,
      operations: [
        { op: 'fill_field', label: '姓名（中文）', value: '陈小明' },
        { op: 'fill_field', label: '目标学位层次', value: '硕士学位' },
        { op: 'fill_field', label: '意向院校', value: '香港大学、香港中文大学' }
      ]
    });

    expect(result.applied).toBe(3);
    const filled = await PDFDocument.load(new Uint8Array(result.buffer));
    const form = filled.getForm();
    expect(form.getTextField('姓名（中文）').getText()).toBe('陈小明');
    expect(form.getDropdown('目标学位层次').getSelected()).toEqual(['硕士学位']);
    expect(form.getTextField('意向院校').getText()).toContain('香港大学');
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
