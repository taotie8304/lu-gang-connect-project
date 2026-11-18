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

const PRESENTATION_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/></p:sldIdLst></p:presentation>`;

const PRESENTATION_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/></Relationships>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/></Types>`;

const slideXml = (paragraphs: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

const run = (text: string, properties = ''): string =>
  `<a:r><a:rPr ${properties || 'lang="zh-CN"'}/><a:t>${text}</a:t></a:r>`;

const paragraph = (...runs: string[]): string => `<a:p>${runs.join('')}</a:p>`;

// 鲁港通 - 夹具：第 1 页有跨 run 段落（加粗+斜体），另有独立页与其它部件
const createFixture = async (): Promise<Buffer> => {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', PRESENTATION_XML);
  zip.file('ppt/_rels/presentation.xml.rels', PRESENTATION_RELS);
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file(
    'ppt/slides/slide1.xml',
    slideXml(
      paragraph(run('2023年', 'b="1"'), run('申请须知', 'i="1"')) +
        paragraph(run('2023年补充', 'b="1"'))
    )
  );
  zip.file('ppt/slides/slide2.xml', slideXml(paragraph(run('2023年说明'))));
  zip.file('ppt/slides/slide3.xml', slideXml(paragraph(run('其他年份'))));
  zip.file(
    'ppt/slides/_rels/slide2.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`
  );
  zip.file(
    'ppt/notesSlides/notesSlide1.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'
  );
  zip.file(
    'ppt/notesSlides/_rels/notesSlide1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
  );
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

const NEW_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);
const NEW_IMAGE_URL = 'https://files.example.com/chat/user/new.png';
const loadPng = async () => ({ buffer: NEW_PNG, extension: 'png' });

const loadPart = async (buffer: Buffer, path: string): Promise<string | undefined> => {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(path);
  return entry ? entry.async('string') : undefined;
};

describe('PPT 图片替换', () => {
  it('按图片清单替换媒体字节，幻灯片与页序保持不变', async () => {
    const fixture = await createFixture();
    const result = await editPptx({
      buffer: fixture,
      operations: [{ op: 'replace_image', image: 'image1.png', sourceUrl: NEW_IMAGE_URL }],
      loadImage: loadPng
    });

    expect(result.applied).toBe(1);
    const after = await JSZip.loadAsync(result.buffer);
    expect(
      Buffer.compare(await after.file('ppt/media/image1.png')!.async('nodebuffer'), NEW_PNG)
    ).toBe(0);
    expect(await after.file('ppt/presentation.xml')!.async('string')).toBe(PRESENTATION_XML);
    for (const path of ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'custom/marker.bin']) {
      expect(Buffer.compare(await after.file(path)!.async('nodebuffer'),
        await (await JSZip.loadAsync(fixture)).file(path)!.async('nodebuffer'))).toBe(0);
    }
  });

  it('图片清单里没有的名字给出可核对提示', async () => {
    const result = await editPptx({
      buffer: await createFixture(),
      operations: [
        { op: 'replace_image', image: 'image9.png', sourceUrl: NEW_IMAGE_URL },
        { op: 'replace_text', find: '2023', replace: '2024' }
      ],
      loadImage: loadPng
    });

    expect(result.applied).toBe(3);
    expect(result.skipped.join('')).toContain('图片清单');
  });

  it('新图格式与原图不一致时跳过并说明', async () => {
    const result = await editPptx({
      buffer: await createFixture(),
      operations: [
        { op: 'replace_image', image: 'image1.png', sourceUrl: NEW_IMAGE_URL },
        { op: 'replace_text', find: '其他年份', replace: '其他年度' }
      ],
      loadImage: async () => ({ buffer: NEW_PNG, extension: 'jpg' })
    });

    expect(result.applied).toBe(1);
    expect(result.skipped.join('')).toContain('格式');
    expect(result.skipped.join('')).toContain('png');
  });

  it('没有图片读取通道时给出可操作提示', async () => {
    await expect(
      editPptx({
        buffer: await createFixture(),
        operations: [{ op: 'replace_image', image: 'image1.png', sourceUrl: NEW_IMAGE_URL }]
      })
    ).rejects.toThrow('对话');
  });
});

describe('PPT 删除页', () => {
  it('删除指定页并清理页序、关系、内容类型与备注页', async () => {
    const result = await editPptx({
      buffer: await createFixture(),
      operations: [{ op: 'delete_slide', slide: 2 }]
    });

    expect(result.applied).toBe(1);
    const after = await JSZip.loadAsync(result.buffer);
    expect(after.file('ppt/slides/slide2.xml')).toBeNull();
    expect(after.file('ppt/slides/_rels/slide2.xml.rels')).toBeNull();
    expect(after.file('ppt/notesSlides/notesSlide1.xml')).toBeNull();
    expect(after.file('ppt/notesSlides/_rels/notesSlide1.xml.rels')).toBeNull();
    expect(after.file('ppt/slides/slide1.xml')).not.toBeNull();
    expect(after.file('ppt/slides/slide3.xml')).not.toBeNull();

    const presentation = await after.file('ppt/presentation.xml')!.async('string');
    expect(presentation).not.toContain('rId3');
    expect(presentation.match(/<p:sldId\b/g)).toHaveLength(2);
    const rels = await after.file('ppt/_rels/presentation.xml.rels')!.async('string');
    expect(rels).not.toContain('slide2.xml');
    const contentTypes = await after.file('[Content_Types].xml')!.async('string');
    expect(contentTypes).not.toContain('/ppt/slides/slide2.xml');
    expect(contentTypes).not.toContain('/ppt/notesSlides/notesSlide1.xml');
  });

  it('不能删除全部幻灯片，至少保留 1 页', async () => {
    const error = await editPptx({
      buffer: await createFixture(),
      operations: [
        { op: 'delete_slide', slide: 1 },
        { op: 'delete_slide', slide: 2 },
        { op: 'delete_slide', slide: 3 }
      ]
    }).catch((reason) => reason);

    expect(error).toBeInstanceOf(DocumentEditError);
    expect(error.message).toContain('至少要保留 1 页');
  });

  it('缺少页序信息时给出可操作提示', async () => {
    const zip = new JSZip();
    zip.file(
      'ppt/presentation.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'
    );
    zip.file('ppt/slides/slide1.xml', slideXml(paragraph(run('标题'))));
    const error = await editPptx({
      buffer: await zip.generateAsync({ type: 'nodebuffer' }),
      operations: [{ op: 'delete_slide', slide: 1 }]
    }).catch((reason) => reason);

    expect(error).toBeInstanceOf(DocumentEditError);
    expect(error.message).toContain('页序');
  });
});

describe('PPT 调整页序', () => {
  it('按目标页码重排页序，幻灯片内容不变', async () => {
    const fixture = await createFixture();
    const result = await editPptx({
      buffer: fixture,
      operations: [{ op: 'move_slide', from: 1, to: 3 }]
    });

    expect(result.applied).toBe(1);
    const presentation = (await loadPart(result.buffer, 'ppt/presentation.xml')) ?? '';
    const order = [...presentation.matchAll(/r:id="(rId\d+)"/g)].map((match) => match[1]);
    expect(order).toEqual(['rId3', 'rId4', 'rId2']);
    expect(await loadPart(result.buffer, 'ppt/slides/slide1.xml')).toBe(
      await loadPart(fixture, 'ppt/slides/slide1.xml')
    );
  });

  it('页码相同或目标不存在时跳过并说明', async () => {
    const result = await editPptx({
      buffer: await createFixture(),
      operations: [
        { op: 'move_slide', from: 2, to: 2 },
        { op: 'move_slide', from: 1, to: 9 },
        { op: 'replace_text', find: '其他年份', replace: '其他年度' }
      ]
    });

    expect(result.applied).toBe(1);
    expect(result.skipped.join('')).toContain('已经在该位置');
    expect(result.skipped.join('')).toContain('不存在');
  });
});

describe('PPT 组合操作', () => {
  it('文字、图片、删页与调序按顺序一次生效', async () => {
    const result = await editPptx({
      buffer: await createFixture(),
      operations: [
        { op: 'replace_text', find: '2023', replace: '2024' },
        { op: 'replace_image', image: 'image1.png', sourceUrl: NEW_IMAGE_URL },
        { op: 'delete_slide', slide: 3 },
        { op: 'move_slide', from: 1, to: 2 }
      ],
      loadImage: loadPng
    });

    expect(result.applied).toBe(6);
    const after = await JSZip.loadAsync(result.buffer);
    expect(after.file('ppt/slides/slide3.xml')).toBeNull();
    expect(await loadPart(result.buffer, 'ppt/slides/slide1.xml')).toContain('2024');
    const presentation = (await loadPart(result.buffer, 'ppt/presentation.xml')) ?? '';
    const order = [...presentation.matchAll(/r:id="(rId\d+)"/g)].map((match) => match[1]);
    expect(order).toEqual(['rId3', 'rId2']);
  });

  it('删页与调序同调触及已删页时提示原始页序与重试方式', async () => {
    const result = await editPptx({
      buffer: await createFixture(),
      operations: [
        { op: 'delete_slide', slide: 2 },
        { op: 'move_slide', from: 2, to: 1 }
      ]
    });

    expect(result.applied).toBe(1);
    const note = result.skipped.join('');
    expect(note).toContain('第 2 页已被删除');
    // 鲁港通 - 模型需明确页码按原始页序解释，并按原始页序重新提交调序
    expect(note).toContain('原始页序');
    expect(note).toContain('重新提交');
  });
});
