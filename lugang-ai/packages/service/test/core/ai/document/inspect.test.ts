// @vitest-environment node
// 鲁港通 - 源文件读取提纲：各格式结构可定位、后缀与内容不符要拒绝、压缩包超限要拦下
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { generateDocx } from '@fastgpt/service/core/ai/document/generate/docx';
import { generatePptx } from '@fastgpt/service/core/ai/document/generate/pptx';
import { generateXlsx } from '@fastgpt/service/core/ai/document/generate/xlsx';
import { formatDocumentOutline, inspectDocument } from '@fastgpt/service/core/ai/document/inspect';
import {
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_UNCOMPRESSED_BYTES,
  MAX_DOCUMENT_SOURCE_BYTES,
  assertArchiveEntriesWithinLimit,
  assertSourceBytesWithinLimit
} from '@fastgpt/service/core/ai/document/limits';

const source = (buffer: Buffer, filename: string) => ({ buffer, filename });

const buildZip = async (files: Record<string, string>): Promise<Buffer> => {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'nodebuffer' });
};

const buildDocx = (paragraphs: string[], tableCount = 0): Promise<Buffer> => {
  const tables = Array.from(
    { length: tableCount },
    (_, index) =>
      `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>表${index}甲</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>表${index}乙</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>值</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>值</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`
  ).join('');
  const body = paragraphs.map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`).join('');
  return buildZip({
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}${tables}</w:body></w:document>`
  });
};

const buildPptx = (slideCount: number): Promise<Buffer> => {
  const slides = Object.fromEntries(
    Array.from({ length: slideCount }, (_, index) => [
      `ppt/slides/slide${index + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>第 ${index + 1} 页标题</a:t></a:r></a:p><a:p><a:r><a:t>要点一</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
    ])
  );
  return buildZip({
    'ppt/presentation.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
    ...slides
  });
};

const buildSheetXml = (label: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${label}</t></is></c></row></sheetData></worksheet>`;

const buildXlsx = (sheetCount: number): Promise<Buffer> => {
  const names = Array.from({ length: sheetCount }, (_, index) => `表${index}`);
  return buildZip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`,
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId0" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
      .map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
      .map(
        (_, index) =>
          `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
      )
      .join('')}</Relationships>`,
    ...Object.fromEntries(
      names.map((name, index) => [`xl/worksheets/sheet${index + 1}.xml`, buildSheetXml(name)])
    )
  });
};

const createTextPdf = async (): Promise<Buffer> => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  ['Applicant:', 'Region:', 'Agree:'].forEach((label, index) => {
    page.drawText(label, { x: 50, y: 760 - index * 40, size: 14, font });
  });
  return Buffer.from(await pdf.save());
};

const createFormPdf = async ({ withText }: { withText: boolean }): Promise<Buffer> => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  if (withText) {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText('Name:', { x: 50, y: 760, size: 14, font });
  }
  const form = pdf.getForm();
  const name = form.createTextField('applicant_name');
  name.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
  const region = form.createDropdown('region');
  region.addOptions(['Hong Kong', 'Kowloon']);
  region.addToPage(page, { x: 50, y: 650, width: 200, height: 20 });
  const agree = form.createCheckBox('agree');
  agree.addToPage(page, { x: 50, y: 600, width: 14, height: 14 });
  return Buffer.from(await pdf.save());
};

// 鲁港通 - pdf-lib 1.x 的 save 不支持加密，用标准安全处理器字典手工构造一个带打开密码标记的 PDF
const createEncryptedPdf = async (): Promise<Buffer> => {
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

describe('inspectDocument Word', () => {
  it('返回段落编号、表格编号与提示', async () => {
    const buffer = await generateDocx({
      format: 'docx',
      fileName: '家长会通知',
      title: '家长会通知',
      blocks: [
        { type: 'paragraph', text: '尊敬的家长：' },
        { type: 'paragraph', text: '本周五下午召开家长会。' },
        { type: 'table', header: ['班级', '时间'], rows: [['三年一班', '周五']] }
      ]
    });

    const outline = await inspectDocument(source(buffer, '家长会通知.docx'));

    expect(outline.format).toBe('docx');
    expect(outline.paragraphCount).toBeGreaterThanOrEqual(3);
    expect(outline.paragraphs?.[0]).toMatchObject({ index: 0, text: expect.stringContaining('家长会通知') });
    expect(outline.paragraphs?.some((item) => item.text.includes('尊敬的家长'))).toBe(true);
    expect(outline.tables?.[0]).toMatchObject({
      index: 0,
      rows: 2,
      cells: 2,
      header: ['班级', '时间']
    });
  });

  it('段落与表格超过提纲上限时截断并标记', async () => {
    const buffer = await buildDocx(
      Array.from({ length: 305 }, (_, index) => `第${index}段`),
      21
    );
    const outline = await inspectDocument(source(buffer, '超长文档.docx'));

    expect(outline.paragraphCount).toBe(305);
    expect(outline.paragraphs).toHaveLength(300);
    expect(outline.paragraphsTruncated).toBe(true);
    expect(outline.tableCount).toBe(21);
    expect(outline.tables).toHaveLength(20);
  });
});

describe('inspectDocument Excel', () => {
  it('返回工作表、表头与带地址的示例单元格', async () => {
    const buffer = await generateXlsx({
      format: 'xlsx',
      fileName: '名单',
      sheets: [{ name: '名单', header: ['姓名', '电话'], rows: [['张三', '13800000000']] }]
    });

    const outline = await inspectDocument(source(buffer, '名单.xlsx'));

    expect(outline.format).toBe('xlsx');
    expect(outline.sheetCount).toBe(1);
    expect(outline.sheets?.[0]).toMatchObject({
      name: '名单',
      rowCount: 2,
      columnCount: 2,
      headerRow: 1,
      header: ['姓名', '电话']
    });
    expect(outline.sheets?.[0].samples?.[0]).toMatchObject({
      row: 2,
      cells: [
        { ref: 'A2', text: '张三' },
        { ref: 'B2', text: '13800000000' }
      ]
    });
  });

  it('工作表超过提纲上限时截断并标记', async () => {
    const buffer = await buildXlsx(13);
    const outline = await inspectDocument(source(buffer, '多表工作簿.xlsx'));

    expect(outline.sheetCount).toBe(13);
    expect(outline.sheets).toHaveLength(12);
    expect(outline.sheetsTruncated).toBe(true);
  });
});

describe('inspectDocument PowerPoint', () => {
  it('按页序返回标题与文字行', async () => {
    const buffer = await generatePptx({
      format: 'pptx',
      fileName: '年度汇报',
      title: '年度汇报',
      slides: [{ title: '营收情况', bullets: ['营收增长', '成本下降'] }]
    });

    const outline = await inspectDocument(source(buffer, '年度汇报.pptx'));

    expect(outline.format).toBe('pptx');
    expect(outline.slideCount).toBe(2);
    expect(outline.slides?.[0]).toMatchObject({ index: 1, title: '年度汇报' });
    expect(outline.slides?.[1].title).toBe('营收情况');
    expect(outline.slides?.[1].lines.join('')).toContain('营收增长');
  });

  it('幻灯片超过提纲上限时截断并标记', async () => {
    const buffer = await buildPptx(61);
    const outline = await inspectDocument(source(buffer, '长演示.pptx'));

    expect(outline.slideCount).toBe(61);
    expect(outline.slides).toHaveLength(60);
    expect(outline.slidesTruncated).toBe(true);
    expect(outline.slides?.[0]).toMatchObject({ index: 1, title: '第 1 页标题' });
  });

  it('列出演示文稿里的图片清单', async () => {
    const buffer = await buildZip({
      'ppt/presentation.xml':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
      'ppt/slides/slide1.xml':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree/></p:cSld></p:sld>',
      'ppt/media/image1.png': 'png',
      'ppt/media/image10.jpeg': 'jpeg',
      'ppt/media/thumb.png': 'png'
    });
    const outline = await inspectDocument(source(buffer, '图集.pptx'));

    expect(outline.images).toEqual(['image1.png', 'image10.jpeg', 'thumb.png']);
  });
});

describe('inspectDocument PDF', () => {
  it('返回页数、文字层与表单域类型', async () => {
    const buffer = await createFormPdf({ withText: true });
    const outline = await inspectDocument(source(buffer, '申请表.pdf'));

    expect(outline.format).toBe('pdf');
    expect(outline.pages).toBe(1);
    expect(outline.hasTextLayer).toBe(true);
    expect(outline.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'applicant_name', type: 'text' }),
        expect.objectContaining({ name: 'region', type: 'dropdown', options: ['Hong Kong', 'Kowloon'] }),
        expect.objectContaining({ name: 'agree', type: 'checkbox' })
      ])
    );
  });

  it('有文字层时给出可定位的文本标签', async () => {
    const buffer = await createTextPdf();
    const outline = await inspectDocument(source(buffer, '说明页.pdf'));

    expect(outline.hasTextLayer).toBe(true);
    expect(outline.labels).toEqual(expect.arrayContaining(['Applicant:', 'Region:']));
  });

  it('扫描件没有文字层时给出提示', async () => {
    const buffer = await createFormPdf({ withText: false });
    const outline = await inspectDocument(source(buffer, '扫描件.pdf'));

    expect(outline.hasTextLayer).toBe(false);
    expect(outline.warnings?.join('')).toContain('文字层');
    expect(outline.fields?.length).toBe(3);
  });

  it('带打开密码的 PDF 返回中文说明', async () => {
    const buffer = await createEncryptedPdf();
    await expect(inspectDocument(source(buffer, '加密.pdf'))).rejects.toThrow('密码保护');
  });
});

describe('inspectDocument Markdown', () => {
  it('返回标题结构、字数与正文预览', async () => {
    const text = '# 办事指南\n\n## 准备材料\n\n携带身份证前往办事处。\n';
    const outline = await inspectDocument(source(Buffer.from(text, 'utf8'), '指南.md'));

    expect(outline.format).toBe('md');
    expect(outline.charCount).toBe(text.length);
    expect(outline.headings).toEqual([
      { level: 1, text: '办事指南' },
      { level: 2, text: '准备材料' }
    ]);
    expect(outline.preview).toContain('携带身份证前往办事处');
    expect(outline.previewTruncated).toBe(false);
  });

  it('正文过长时只保留预览并标记', async () => {
    const text = `# 长文\n\n${'内容'.repeat(3000)}`;
    const outline = await inspectDocument(source(Buffer.from(text, 'utf8'), '长文.md'));

    expect(outline.charCount).toBe(text.length);
    expect(outline.previewTruncated).toBe(true);
    expect(outline.preview?.length).toBeLessThan(text.length);
  });
});

describe('格式识别与拒绝', () => {
  it('不支持的扩展名给出可操作提示', async () => {
    await expect(
      inspectDocument(source(Buffer.from('纯文本'), '说明.txt'))
    ).rejects.toThrow('暂不支持');
  });

  it('后缀是 Word 但内容是 PDF 时拒绝', async () => {
    const buffer = await createTextPdf();
    await expect(inspectDocument(source(buffer, '伪装.docx'))).rejects.toThrow('Word');
  });

  it('后缀是 Excel 但内容是 Word 时拒绝', async () => {
    const buffer = await buildDocx(['正文']);
    await expect(inspectDocument(source(buffer, '伪装.xlsx'))).rejects.toThrow('Excel');
  });

  it('后缀是 PDF 但内容不是 PDF 时拒绝', async () => {
    await expect(
      inspectDocument(source(Buffer.from('not a pdf'), '伪装.pdf'))
    ).rejects.toThrow('PDF');
  });

  it('后缀是 Markdown 但内容是二进制时拒绝', async () => {
    await expect(
      inspectDocument(source(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]), '伪装.md'))
    ).rejects.toThrow('Markdown');
  });
});

describe('大小与压缩包防护', () => {
  it('源文件超过 20MB 时拒绝', () => {
    expect(() => assertSourceBytesWithinLimit(MAX_DOCUMENT_SOURCE_BYTES)).not.toThrow();
    expect(() => assertSourceBytesWithinLimit(MAX_DOCUMENT_SOURCE_BYTES + 1)).toThrow('20MB');
  });

  it('压缩包条目数超过上限时拒绝', () => {
    const entries = Array.from({ length: MAX_ARCHIVE_ENTRIES + 1 }, (_, index) => ({
      name: `entry-${index}`,
      dir: false,
      uncompressedBytes: 1
    }));
    expect(() => assertArchiveEntriesWithinLimit(entries)).toThrow('条目过多');
  });

  it('压缩包声明解压总量超过上限时拒绝', () => {
    expect(() =>
      assertArchiveEntriesWithinLimit([
        { name: 'a.xml', dir: false, uncompressedBytes: MAX_ARCHIVE_UNCOMPRESSED_BYTES + 1 }
      ])
    ).toThrow('解压后体积过大');
  });

  it('条目过多的工作簿在读取阶段被拦下', async () => {
    const files = Object.fromEntries(
      Array.from({ length: MAX_ARCHIVE_ENTRIES + 10 }, (_, index) => [`pad/${index}.xml`, '<x/>'])
    );
    const buffer = await buildZip({
      'xl/workbook.xml':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>',
      ...files
    });
    await expect(inspectDocument(source(buffer, '膨胀.xlsx'))).rejects.toThrow('条目过多');
  });
});

describe('formatDocumentOutline', () => {
  it('把提纲转成带编号的说明文本', async () => {
    const buffer = await generateDocx({
      format: 'docx',
      fileName: '通知',
      blocks: [{ type: 'paragraph', text: '正文第一段' }]
    });
    const text = formatDocumentOutline(
      await inspectDocument(source(buffer, '通知.docx'))
    );

    expect(text).toContain('通知.docx');
    expect(text).toContain('[0]');
    expect(text).toContain('正文第一段');
    expect(text).toContain('edit');
  });

  it('超长提纲整体截断，避免撑爆上下文', async () => {
    const buffer = await buildDocx(
      Array.from({ length: 300 }, (_, index) => `第${index}段${'内容'.repeat(50)}`)
    );
    const text = formatDocumentOutline(
      await inspectDocument(source(buffer, '超长文档.docx'))
    );

    expect(text.length).toBeLessThanOrEqual(12200);
    expect(text).toContain('提纲较长');
  });

  it('PPT 提纲附图片清单与可用的编辑动作', () => {
    const text = formatDocumentOutline({
      format: 'pptx',
      fileName: '图集.pptx',
      sizeBytes: 1024,
      warnings: [],
      slides: [{ index: 1, title: '封面', lines: [] }],
      slideCount: 1,
      images: ['image1.png']
    });

    expect(text).toContain('image1.png');
    expect(text).toContain('replace_image');
    expect(text).toContain('delete_slide');
    expect(text).toContain('move_slide');
    expect(text).toContain('从 1 开始');
  });
});
