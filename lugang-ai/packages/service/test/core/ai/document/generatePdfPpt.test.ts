// @vitest-environment node
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { generatePdf } from '@fastgpt/service/core/ai/document/generate/pdf';
import { generatePptx } from '@fastgpt/service/core/ai/document/generate/pptx';
import { DocumentGenerationError } from '@fastgpt/service/core/ai/document/types';

// 鲁港通 - 用 pdfjs 抽取文本，验证生成的中文 PDF 可复制可检索
const extractPdfText = async (buffer: Buffer) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false
  }).promise;
  let text = '';
  for (let index = 1; index <= doc.numPages; index++) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    text += content.items.map((item) => ('str' in item ? item.str : '')).join('');
  }
  return { text, pages: doc.numPages };
};

describe('PDF 生成器', () => {
  it('生成可解析的 A4 PDF，包含标题、中文段落与页脚页码', async () => {
    const buffer = await generatePdf({
      format: 'pdf',
      fileName: '办事指南',
      title: '香港身份证办理指南',
      blocks: [
        { type: 'heading', level: 2, text: '准备材料' },
        { type: 'paragraph', text: '携带有效旅行证件前往人事登记办事处。' },
        { type: 'list', ordered: true, items: ['预约', '填表'] },
        { type: 'table', header: ['材料', '说明'], rows: [['旅行证件', '原件']] },
        { type: 'divider' }
      ]
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');

    const doc = await PDFDocument.load(buffer);
    expect(doc.getPageCount()).toBe(1);
    const pages = doc.getPages();
    expect(pages[0].getWidth()).toBeCloseTo(595.28, 1);
    expect(pages[0].getHeight()).toBeCloseTo(841.89, 1);

    const { text } = await extractPdfText(buffer);
    expect(text).toContain('香港身份证办理指南');
    expect(text).toContain('携带有效旅行证件前往人事登记办事处。');
    expect(text).toContain('准备材料');
    expect(text).toContain('第 1 页');
  });

  it('分页块与超长表格会续排到新页', async () => {
    const buffer = await generatePdf({
      format: 'pdf',
      fileName: '长文档',
      blocks: [
        { type: 'paragraph', text: '第一页内容' },
        { type: 'pageBreak' },
        { type: 'paragraph', text: '第二页内容' }
      ]
    });
    const doc = await PDFDocument.load(buffer);
    expect(doc.getPageCount()).toBe(2);
    const { text } = await extractPdfText(buffer);
    expect(text).toContain('第一页内容');
    expect(text).toContain('第二页内容');

    const tableBuffer = await generatePdf({
      format: 'pdf',
      fileName: '大表格',
      blocks: [
        {
          type: 'table',
          header: ['编号', '内容'],
          rows: Array.from({ length: 120 }, (_, index) => [`${index + 1}`, `第 ${index + 1} 行内容`])
        }
      ]
    });
    const tableDoc = await PDFDocument.load(tableBuffer);
    expect(tableDoc.getPageCount()).toBeGreaterThan(1);
  });

  it('正文从页面顶部向下排版，不会挤在页面底部', async () => {
    const buffer = await generatePdf({
      format: 'pdf',
      fileName: '排版',
      blocks: [
        { type: 'paragraph', text: '第一段内容' },
        { type: 'paragraph', text: '第二段内容' }
      ]
    });
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false
    }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const findBaseline = (needle: string) => {
      const item = content.items.find(
        (raw) => 'str' in raw && String(raw.str).includes(needle)
      ) as { transform: number[] } | undefined;
      expect(item).toBeTruthy();
      return item!.transform[5];
    };
    const firstY = findBaseline('第一段内容');
    const secondY = findBaseline('第二段内容');
    // 鲁港通 - PDFKit 以左上角为原点：首段应落在页面上半部，后续段落基线更低
    expect(firstY).toBeGreaterThan(841.89 * 0.75);
    expect(secondY).toBeLessThan(firstY);
    await doc.destroy();
  });

  it('没有 blocks 时按行渲染 content，并支持空标题', async () => {
    const buffer = await generatePdf({
      format: 'pdf',
      fileName: '说明',
      content: '第一段说明\n第二段说明'
    });
    const { text } = await extractPdfText(buffer);
    expect(text).toContain('第一段说明');
    expect(text).toContain('第二段说明');
  });

  it('内置字体按子集嵌入，曾经丢字形的常用字完整可检索', async () => {
    const buffer = await generatePdf({
      format: 'pdf',
      fileName: '字体检查',
      blocks: [
        { type: 'paragraph', text: '预约填表与《往来港澳通行证》办理说明' },
        { type: 'table', header: ['事项', '说明'], rows: [['预约', '提前填表']] }
      ]
    });
    // 全量嵌入字体时文件会达到数 MB，这里守住子集嵌入
    expect(buffer.length).toBeLessThan(400 * 1024);
    const { text } = await extractPdfText(buffer);
    expect(text).toContain('预约填表');
    expect(text).toContain('往来港澳通行证');
    expect(text).toContain('提前填表');
  });

  it('超限或空内容返回可操作错误', async () => {
    await expect(
      generatePdf({
        format: 'pdf',
        fileName: 'x',
        blocks: Array.from({ length: 121 }, () => ({ type: 'paragraph', text: 'x' }))
      })
    ).rejects.toThrow(/120/);

    await expect(generatePdf({ format: 'pdf', fileName: 'x' })).rejects.toThrow(
      DocumentGenerationError
    );
    await expect(generatePdf({ format: 'pdf', fileName: 'x' })).rejects.toThrow(
      '需要提供文档内容后再生成'
    );
  });
});

describe('PPT 生成器', () => {
  it('生成 16:9 演示文稿，标题页与内容页包含标题与要点', async () => {
    const buffer = await generatePptx({
      format: 'pptx',
      fileName: '季度总结',
      title: '2026 年第二季度总结',
      slides: [
        { title: '工作回顾', bullets: ['完成率 90%', '重点事项按期交付'], notes: '讲稿备注' },
        { title: '下一步计划' }
      ]
    });

    const zip = await JSZip.loadAsync(buffer);
    const fileNames = Object.keys(zip.files);
    expect(fileNames).toContain('ppt/presentation.xml');
    const slideNames = fileNames.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    // 标题页 + 两张内容页
    expect(slideNames).toHaveLength(3);

    const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
    expect(presentationXml).toContain('12192000');
    expect(presentationXml).toContain('6858000');

    const allSlideXml = await Promise.all(
      slideNames.map((name) => zip.file(name)!.async('string'))
    );
    const joined = allSlideXml.join('');
    expect(joined).toContain('2026 年第二季度总结');
    expect(joined).toContain('工作回顾');
    expect(joined).toContain('完成率 90%');
    expect(joined).toContain('下一步计划');

    const notesNames = fileNames.filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
    const notesXml = await Promise.all(
      notesNames.map((name) => zip.file(name)!.async('string'))
    );
    expect(notesXml.join('')).toContain('讲稿备注');
  });

  it('没有标题时用第一段内容作为标题页副标题', async () => {
    const buffer = await generatePptx({
      format: 'pptx',
      fileName: '简报',
      blocks: [{ type: 'paragraph', text: '第一段摘要' }],
      slides: [{ title: '正文页' }]
    });
    const zip = await JSZip.loadAsync(buffer);
    const slide1 = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(slide1).toContain('第一段摘要');
  });

  it('六种版式生成封面、章节、要点、图文、表格与图表页', async () => {
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const buffer = await generatePptx(
      {
        format: 'pptx',
        fileName: '全版式',
        title: '全版式示例',
        slides: [
          { layout: 'cover', title: '年度汇报', subtitle: '2026 年第二季度' },
          { layout: 'section', title: '第一部分', subtitle: '工作回顾' },
          { layout: 'bullets', title: '要点页', bullets: ['甲要点', '乙要点'] },
          {
            layout: 'image',
            title: '图示页',
            image: { sourceUrl: 'https://files.example.com/a.png', caption: '示意图说明' }
          },
          { layout: 'table', title: '对照页', table: { header: ['项目', '说明'], rows: [['A', '说明A']] } },
          {
            layout: 'chart',
            title: '趋势页',
            chart: {
              type: 'bar',
              categories: ['一月', '二月'],
              series: [{ name: '销量', values: [10, 20] }]
            }
          }
        ]
      },
      { loadImage: async () => ({ buffer: pngBuffer, extension: 'png' }) }
    );

    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files);
    const slideNames = names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    expect(slideNames).toHaveLength(6);

    const slidesXml = (
      await Promise.all(slideNames.map((name) => zip.file(name)!.async('string')))
    ).join('');
    expect(slidesXml).toContain('年度汇报');
    expect(slidesXml).toContain('2026 年第二季度');
    expect(slidesXml).toContain('第一部分');
    expect(slidesXml).toContain('甲要点');
    expect(slidesXml).toContain('示意图说明');
    expect(slidesXml).toContain('说明A');
    expect(slidesXml).toContain('<a:tbl>');
    expect(names.some((name) => /^ppt\/media\/image.*\.png$/.test(name))).toBe(true);

    const chartNames = names.filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
    expect(chartNames).toHaveLength(1);
    const chartXml = await zip.file(chartNames[0])!.async('string');
    expect(chartXml).toContain('一月');
    expect(chartXml).toMatch(/barChart/);
  });

  it('图文页没有图片读取通道时给出可操作提示', async () => {
    await expect(
      generatePptx({
        format: 'pptx',
        fileName: '缺图',
        title: '缺图',
        slides: [
          {
            layout: 'image',
            title: '图示页',
            image: { sourceUrl: 'https://files.example.com/a.png' }
          }
        ]
      })
    ).rejects.toThrow('本次对话上传');
  });

  it('超限或空内容返回可操作错误', async () => {
    await expect(
      generatePptx({
        format: 'pptx',
        fileName: 'x',
        slides: Array.from({ length: 31 }, () => ({ title: 'x' }))
      })
    ).rejects.toThrow(/30/);

    await expect(generatePptx({ format: 'pptx', fileName: 'x' })).rejects.toThrow(
      '生成 PPT 需要用 slides 提供每页内容'
    );
  });
});
