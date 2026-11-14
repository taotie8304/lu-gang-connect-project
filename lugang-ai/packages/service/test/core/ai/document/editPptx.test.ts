// @vitest-environment node
// 鲁港通 - PPT 文字替换：可指定页或全片，跨 run 命中保留首个 run 样式，其余部件不变
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { editPptx } from '@fastgpt/service/core/ai/document/edit/pptx';
import { DocumentEditError } from '@fastgpt/service/core/ai/document/types';

const EXTRA_PARTS: Record<string, Buffer> = {
  'ppt/media/image1.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 8, 7]),
  'custom/marker.bin': Buffer.from('ppt-keep-me', 'utf8')
};

const slideXml = (paragraphs: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

const run = (text: string, properties = ''): string =>
  `<a:r><a:rPr ${properties || 'lang="zh-CN"'}/><a:t>${text}</a:t></a:r>`;

const paragraph = (...runs: string[]): string => `<a:p>${runs.join('')}</a:p>`;

// 鲁港通 - 夹具：第 1 页有跨 run 段落（加粗+斜体），另有独立页与其它部件
const createFixture = async (): Promise<Buffer> => {
  const zip = new JSZip();
  zip.file(
    'ppt/presentation.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'
  );
  zip.file(
    'ppt/slides/slide1.xml',
    slideXml(
      paragraph(run('2023年', 'b="1"'), run('申请须知', 'i="1"')) +
        paragraph(run('2023年补充', 'b="1"'))
    )
  );
  zip.file('ppt/slides/slide2.xml', slideXml(paragraph(run('2023年说明'))));
  zip.file('ppt/slides/slide3.xml', slideXml(paragraph(run('其他年份'))));
  for (const [name, content] of Object.entries(EXTRA_PARTS)) zip.file(name, content);
  return zip.generateAsync({ type: 'nodebuffer' });
};

const readText = async (buffer: Buffer, path: string): Promise<string> => {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(path);
  if (!entry) throw new Error(`missing ${path}`);
  return entry.async('string');
};

describe('PPT 副本编辑', () => {
  it('全片替换统计正确并改写每页文字', async () => {
    const result = await editPptx({
      buffer: await createFixture(),
      operations: [{ op: 'replace_text', find: '2023', replace: '2024' }]
    });

    expect(result.applied).toBe(3);
    for (const index of [1, 2]) {
      const xml = await readText(result.buffer, `ppt/slides/slide${index}.xml`);
      expect(xml).toContain('2024');
      expect(xml).not.toContain('2023');
    }
    expect(await readText(result.buffer, 'ppt/slides/slide3.xml')).toContain('其他年份');
  });

  it('指定页替换只影响该页（页码从 1 起）', async () => {
    const fixture = await createFixture();
    const result = await editPptx({
      buffer: fixture,
      operations: [{ op: 'replace_text', find: '2023', replace: '2024', slide: 2 }]
    });

    expect(result.applied).toBe(1);
    expect(await readText(fixture, 'ppt/slides/slide1.xml')).toContain('2023');
    const slide2 = await readText(result.buffer, 'ppt/slides/slide2.xml');
    expect(slide2).toContain('2024年说明');
    expect(slide2).not.toContain('2023');
    expect(await readText(result.buffer, 'ppt/slides/slide1.xml')).toContain('2023年');
    expect(await readText(result.buffer, 'ppt/slides/slide1.xml')).toContain('申请须知');
  });

  it('跨 run 命中保留首个 run 样式，其余 run 只清空命中部分', async () => {
    const result = await editPptx({
      buffer: await createFixture(),
      operations: [{ op: 'replace_text', find: '2023年申请', replace: '2024年度申请', slide: 1 }]
    });

    expect(result.applied).toBe(1);
    const xml = await readText(result.buffer, 'ppt/slides/slide1.xml');
    expect(xml).toContain('<a:rPr b="1"/>');
    expect(xml).toContain('2024年度申请');
    expect(xml).toContain('<a:rPr i="1"/>');
    expect(xml).toContain('须知');
    expect(xml).toContain('2023年补充');
    expect(xml).not.toContain('<a:t>2023年</a:t>');
  });

  it('非 PPT 操作被跳过并说明；Excel/Word 专属操作同样提示', async () => {
    const result = await editPptx({
      buffer: await createFixture(),
      operations: [
        { op: 'set_cell', sheet: '名单', cell: 'A1', value: 'x' },
        { op: 'set_paragraph', paragraph: 0, text: 'y' },
        { op: 'replace_text', find: '2023', replace: '2024', paragraph: 0 },
        { op: 'append_paragraph', text: 'z' },
        { op: 'replace_text', find: '2023', replace: '2024' }
      ]
    });

    expect(result.applied).toBe(3);
    const skipped = result.skipped.join('');
    expect(skipped).toContain('Excel');
    expect(skipped).toContain('Word');
    expect(skipped).toContain('按段落替换');
  });

  it('非幻灯片部件逐字节保持不变', async () => {
    const fixture = await createFixture();
    const result = await editPptx({
      buffer: fixture,
      operations: [{ op: 'replace_text', find: '2023', replace: '2024' }]
    });

    const before = await JSZip.loadAsync(fixture);
    const after = await JSZip.loadAsync(result.buffer);
    for (const [name, content] of Object.entries(EXTRA_PARTS)) {
      expect(Buffer.compare(await after.file(name)!.async('nodebuffer'), content)).toBe(0);
    }
    expect(await after.file('ppt/presentation.xml')!.async('string')).toBe(
      await before.file('ppt/presentation.xml')!.async('string')
    );
  });

  it('找不到文字时跳过；全部未命中不生成新文件', async () => {
    const skippedOnly = await editPptx({
      buffer: await createFixture(),
      operations: [
        { op: 'replace_text', find: '不存在的文字', replace: 'x' },
        { op: 'replace_text', find: '2023', replace: '2024', slide: 9 }
      ]
    }).catch((reason) => reason);

    expect(skippedOnly).toBeInstanceOf(DocumentEditError);
    expect(skippedOnly.message).toContain('没有找到与要求匹配的内容');
    expect(skippedOnly.message).toContain('未生成新文件');

    const partial = await editPptx({
      buffer: await createFixture(),
      operations: [
        { op: 'replace_text', find: '不存在的文字', replace: 'x' },
        { op: 'replace_text', find: '2023', replace: '2024' }
      ]
    });
    expect(partial.applied).toBe(3);
    expect(partial.skipped.join('')).toContain('没有找到「不存在的文字」');
  });

  it('不是 PowerPoint 文件时给出可操作提示', async () => {
    const zip = new JSZip();
    zip.file('docProps/app.xml', '<Properties/>');
    const error = await editPptx({
      buffer: await zip.generateAsync({ type: 'nodebuffer' }),
      operations: [{ op: 'replace_text', find: 'a', replace: 'b' }]
    }).catch((reason) => reason);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('PowerPoint');
  });
});
