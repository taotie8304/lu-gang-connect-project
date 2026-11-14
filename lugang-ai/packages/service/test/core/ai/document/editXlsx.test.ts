// @vitest-environment node
// 鲁港通 - Excel 手术式补丁：只改目标单元格，其余内容与压缩包其它部件原样保留
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { editXlsx } from '@fastgpt/service/core/ai/document/edit/xlsx';
import { generateXlsx } from '@fastgpt/service/core/ai/document/generate/xlsx';
import { DocumentEditError } from '@fastgpt/service/core/ai/document/types';

const ROSTER = '名单';
const NOTES = '备注';

const EXTRA_PARTS: Record<string, Buffer> = {
  'xl/media/image1.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
  'xl/printerSettings/printerSettings1.bin': Buffer.from([0xde, 0xad, 0xbe, 0xef, 5, 6, 7]),
  'custom/marker.bin': Buffer.from('keep-me-unchanged', 'utf8')
};

// 鲁港通 - 夹具：两张表 + 合并单元格 + 公式 + 计算链；另放图片/打印设置等部件用于校验「原样保留」
const createFixture = async (): Promise<Buffer> => {
  const base = await generateXlsx({
    format: 'xlsx',
    fileName: '报名名单',
    sheets: [
      {
        name: ROSTER,
        header: ['姓名', '年龄', '分数', '合计'],
        rows: [
          ['张三', '18', '80', '=B2+C2'],
          ['李四', '20', '90', '=B3+C3']
        ],
        merges: ['E1:E2']
      },
      {
        name: NOTES,
        header: ['说明'],
        rows: [['原始备注：请核对名单']]
      }
    ]
  });

  const zip = await JSZip.loadAsync(base);
  for (const [name, content] of Object.entries(EXTRA_PARTS)) zip.file(name, content);

  const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
  zip.file(
    '[Content_Types].xml',
    contentTypes.replace(
      '</Types>',
      '<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>'
    )
  );
  const workbookRels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  zip.file(
    'xl/_rels/workbook.xml.rels',
    workbookRels.replace(
      '</Relationships>',
      '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>'
    )
  );
  zip.file(
    'xl/calcChain.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>'
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const openZip = (buffer: Buffer): Promise<JSZip> => JSZip.loadAsync(buffer);

const readText = async (buffer: Buffer, path: string): Promise<string> => {
  const zip = await openZip(buffer);
  const entry = zip.file(path);
  if (!entry) throw new Error(`missing ${path}`);
  return entry.async('string');
};

const readWorkbook = async (buffer: Buffer): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
};

describe('Excel 副本编辑', () => {
  it('set_cell 写入文本与数字，保留单元格样式，其余内容不变', async () => {
    const fixture = await createFixture();
    const result = await editXlsx({
      buffer: fixture,
      operations: [
        { op: 'set_cell', sheet: ROSTER, cell: 'A1', value: '学生姓名' },
        { op: 'set_cell', sheet: ROSTER, cell: 'C2', value: '95' }
      ]
    });

    expect(result.applied).toBe(2);
    expect(result.skipped).toEqual([]);

    const workbook = await readWorkbook(result.buffer);
    const roster = workbook.getWorksheet(ROSTER)!;
    expect(roster.getCell('A1').value).toBe('学生姓名');
    expect(roster.getCell('A1').font?.bold).toBe(true);
    expect(roster.getCell('C2').value).toBe(95);
    expect(roster.getCell('A2').value).toBe('张三');
    expect(roster.getCell('D2').value).toMatchObject({ formula: 'B2+C2' });
    expect(workbook.getWorksheet(NOTES)!.getCell('A2').value).toBe('原始备注：请核对名单');
  });

  it('合并区域写入落到主格', async () => {
    const result = await editXlsx({
      buffer: await createFixture(),
      operations: [{ op: 'set_cell', sheet: ROSTER, cell: 'E2', value: '合并备注' }]
    });

    expect(result.applied).toBe(1);
    const workbook = await readWorkbook(result.buffer);
    const roster = workbook.getWorksheet(ROSTER)!;
    expect(roster.getCell('E1').value).toBe('合并备注');
    expect(roster.getCell('E2').value).toBe('合并备注');
  });

  it('set_cell 写入白名单公式，并要求 Excel 打开时重算、移除计算链', async () => {
    const result = await editXlsx({
      buffer: await createFixture(),
      operations: [{ op: 'set_cell', sheet: ROSTER, cell: 'E3', value: '=SUM(C2:C3)' }]
    });

    expect(result.applied).toBe(1);
    const workbook = await readWorkbook(result.buffer);
    expect(workbook.getWorksheet(ROSTER)!.getCell('E3').value).toMatchObject({
      formula: 'SUM(C2:C3)'
    });

    const sheetXml = await readText(result.buffer, 'xl/worksheets/sheet1.xml');
    expect(sheetXml).toContain('<f>SUM(C2:C3)</f>');
    const workbookXml = await readText(result.buffer, 'xl/workbook.xml');
    expect(workbookXml).toContain('fullCalcOnLoad="1"');

    const zip = await openZip(result.buffer);
    expect(zip.file('xl/calcChain.xml')).toBeNull();
    expect(await zip.file('[Content_Types].xml')!.async('string')).not.toContain('calcChain');
    expect(await zip.file('xl/_rels/workbook.xml.rels')!.async('string')).not.toContain(
      'calcChain'
    );
  });

  it('危险公式不能写入，按文本保存并给出提示', async () => {
    const dangerous = '=WEBSERVICE("http://example.com")';
    const result = await editXlsx({
      buffer: await createFixture(),
      operations: [{ op: 'set_cell', sheet: ROSTER, cell: 'A2', value: dangerous }]
    });

    expect(result.applied).toBe(1);
    expect(result.warnings.join('')).toContain('公式安全限制');
    const workbook = await readWorkbook(result.buffer);
    expect(workbook.getWorksheet(ROSTER)!.getCell('A2').value).toBe(dangerous);
    const sheetXml = await readText(result.buffer, 'xl/worksheets/sheet1.xml');
    expect(sheetXml).not.toContain('<f>WEBSERVICE');
  });

  it('公式单元格不能被普通值覆盖，跳过并说明原因', async () => {
    const result = await editXlsx({
      buffer: await createFixture(),
      operations: [
        { op: 'set_cell', sheet: ROSTER, cell: 'D2', value: '100' },
        { op: 'set_cell', sheet: ROSTER, cell: 'A2', value: '张三丰' }
      ]
    });

    expect(result.applied).toBe(1);
    expect(result.skipped.join('')).toContain('是公式单元格');
    const workbook = await readWorkbook(result.buffer);
    expect(workbook.getWorksheet(ROSTER)!.getCell('D2').value).toMatchObject({
      formula: 'B2+C2'
    });
  });

  it('append_row 在末行追加并更新 dimension，沿用上一行样式', async () => {
    const result = await editXlsx({
      buffer: await createFixture(),
      operations: [
        { op: 'append_row', sheet: ROSTER, values: ['王五', '22', '88', '=B4+C4'] }
      ]
    });

    expect(result.applied).toBe(4);
    const workbook = await readWorkbook(result.buffer);
    const roster = workbook.getWorksheet(ROSTER)!;
    expect(roster.getCell('A4').value).toBe('王五');
    expect(roster.getCell('B4').value).toBe(22);
    expect(roster.getCell('C4').value).toBe(88);
    expect(roster.getCell('D4').value).toMatchObject({ formula: 'B4+C4' });

    const sheetXml = await readText(result.buffer, 'xl/worksheets/sheet1.xml');
    expect(sheetXml).toContain('dimension ref="A1:E4"');
  });

  it('set_cell 写到表格范围外时扩展 dimension', async () => {
    const result = await editXlsx({
      buffer: await createFixture(),
      operations: [{ op: 'set_cell', sheet: ROSTER, cell: 'F10', value: '额外说明' }]
    });

    expect(result.applied).toBe(1);
    const workbook = await readWorkbook(result.buffer);
    expect(workbook.getWorksheet(ROSTER)!.getCell('F10').value).toBe('额外说明');
    const sheetXml = await readText(result.buffer, 'xl/worksheets/sheet1.xml');
    expect(sheetXml).toContain('dimension ref="A1:F10"');
  });

  it('replace_text 只改指定工作表的字符串，公式与其它工作表不受影响', async () => {
    const result = await editXlsx({
      buffer: await createFixture(),
      operations: [{ op: 'replace_text', find: '张三', replace: '张三丰', sheet: ROSTER }]
    });

    expect(result.applied).toBe(1);
    const workbook = await readWorkbook(result.buffer);
    const roster = workbook.getWorksheet(ROSTER)!;
    expect(roster.getCell('A2').value).toBe('张三丰');
    expect(roster.getCell('D2').value).toMatchObject({ formula: 'B2+C2' });
    expect(workbook.getWorksheet(NOTES)!.getCell('A2').value).toBe('原始备注：请核对名单');

    const sheetXml = await readText(result.buffer, 'xl/worksheets/sheet1.xml');
    expect(sheetXml).toContain('张三丰');
    expect(sheetXml).not.toContain('<f>张三');
  });

  it('replace_text 处理内联字符串', async () => {
    const buildInlineWorkbook = async (): Promise<Buffer> => {
      const zip = new JSZip();
      zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>'
      );
      zip.file(
        '_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId0" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
      );
      zip.file(
        'xl/workbook.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="名单" sheetId="1" r:id="rId1"/></sheets></workbook>'
      );
      zip.file(
        'xl/_rels/workbook.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
      );
      zip.file(
        'xl/worksheets/sheet1.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>原始说明文字</t></is></c></row></sheetData></worksheet>'
      );
      return zip.generateAsync({ type: 'nodebuffer' });
    };

    const result = await editXlsx({
      buffer: await buildInlineWorkbook(),
      operations: [{ op: 'replace_text', find: '原始说明', replace: '更新说明' }]
    });

    expect(result.applied).toBe(1);
    const sheetXml = await readText(result.buffer, 'xl/worksheets/sheet1.xml');
    expect(sheetXml).toContain('更新说明文字');
    expect(sheetXml).not.toContain('原始说明');
  });

  it('非工作表部件（图片、打印设置、自定义部件）逐字节保持不变', async () => {
    const fixture = await createFixture();
    const result = await editXlsx({
      buffer: fixture,
      operations: [
        { op: 'set_cell', sheet: ROSTER, cell: 'A2', value: '张三丰' },
        { op: 'append_row', sheet: NOTES, values: ['补充备注'] }
      ]
    });

    const before = await openZip(fixture);
    const after = await openZip(result.buffer);
    for (const [name, content] of Object.entries(EXTRA_PARTS)) {
      const entry = after.file(name);
      expect(entry).not.toBeNull();
      expect(Buffer.compare(await entry!.async('nodebuffer'), content)).toBe(0);
      expect(await before.file(name)!.async('nodebuffer')).toEqual(content);
    }
  });

  it('工作表不存在、单元格格式不正确时跳过并说明', async () => {
    const result = await editXlsx({
      buffer: await createFixture(),
      operations: [
        { op: 'set_cell', sheet: '不存在的表', cell: 'A1', value: 'x' },
        { op: 'set_cell', sheet: ROSTER, cell: 'A1', value: '有效修改' }
      ]
    });

    expect(result.applied).toBe(1);
    expect(result.skipped.join('')).toContain('工作表「不存在的表」不存在');
  });

  it('没有任何改动成功时不生成新文件', async () => {
    const error = await editXlsx({
      buffer: await createFixture(),
      operations: [
        { op: 'set_cell', sheet: '不存在的表', cell: 'A1', value: 'x' },
        { op: 'append_paragraph', text: '只适用于 Word' }
      ]
    }).catch((reason) => reason);

    expect(error).toBeInstanceOf(DocumentEditError);
    expect(error.message).toContain('没有找到与要求匹配的内容');
    expect(error.message).toContain('未生成新文件');
  });

  it('非 Excel 文件会被拒绝', async () => {
    const error = await editXlsx({
      buffer: Buffer.from('not a workbook'),
      operations: [{ op: 'set_cell', sheet: ROSTER, cell: 'A1', value: 'x' }]
    }).catch((reason) => reason);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Excel');
  });
});
