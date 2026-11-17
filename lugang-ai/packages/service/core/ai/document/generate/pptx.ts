// 鲁港通 - 服务端 PPT 生成：pptxgenjs 16:9，封面/章节/要点/图文/表格/图表六种版式
import PptxGenJS from 'pptxgenjs';
import type { GeneratedSlide } from '../../llm/agentLoop/domain/systemTool/document/schema';
import {
  assertGenerateInputWithinLimits,
  DocumentGenerationError,
  type DocumentGenerateInput
} from '../types';

const FONT_FACE = 'Microsoft YaHei';
const LAYOUT_NAME = 'LUGANG_16X9';
const SLIDE_WIDTH_INCH = 40 / 3;
const SLIDE_HEIGHT_INCH = 7.5;

const TEXT_COLOR = '1F2937';
const MUTED_COLOR = '4B5563';
const ACCENT_COLOR = '2F5D8A';
const SOFT_BG_COLOR = 'F4F7FA';
const BORDER_COLOR = 'D9E2EC';

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml'
};

type SlideLayout = NonNullable<GeneratedSlide['layout']>;

/** 鲁港通 - 图文页图片读取通道：只能取本次对话文件清单里的地址，由执行器注入 */
export type PptxImageLoader = (
  sourceUrl: string
) => Promise<{ buffer: Buffer; extension: string }>;

export type GeneratePptxOptions = { loadImage?: PptxImageLoader };

const resolveLayout = (slide: GeneratedSlide): SlideLayout => {
  if (slide.layout) return slide.layout;
  if (slide.chart) return 'chart';
  if (slide.table) return 'table';
  if (slide.image) return 'image';
  return 'bullets';
};

const addCoverSlide = (
  pptx: PptxGenJS,
  title: string,
  subtitle: string | undefined
): PptxGenJS.Slide => {
  const slide = pptx.addSlide();
  slide.background = { color: SOFT_BG_COLOR };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH_INCH,
    h: 0.18,
    fill: { color: ACCENT_COLOR },
    line: { color: ACCENT_COLOR }
  });
  slide.addText(title, {
    x: 0.8,
    y: 2.2,
    w: SLIDE_WIDTH_INCH - 1.6,
    h: 1.4,
    fontSize: 34,
    bold: true,
    color: TEXT_COLOR,
    align: 'center',
    valign: 'middle',
    fontFace: FONT_FACE
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 1.2,
      y: 3.7,
      w: SLIDE_WIDTH_INCH - 2.4,
      h: 0.9,
      fontSize: 16,
      color: MUTED_COLOR,
      align: 'center',
      fontFace: FONT_FACE
    });
  }
  return slide;
};

const addSectionAccent = (pptx: PptxGenJS, slide: PptxGenJS.Slide) => {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.3,
    h: SLIDE_HEIGHT_INCH,
    fill: { color: ACCENT_COLOR },
    line: { color: ACCENT_COLOR }
  });
};

const addSlideTitle = (slide: PptxGenJS.Slide, title: string) => {
  slide.addText(title, {
    x: 0.7,
    y: 0.45,
    w: SLIDE_WIDTH_INCH - 1.4,
    h: 0.9,
    fontSize: 26,
    bold: true,
    color: TEXT_COLOR,
    fontFace: FONT_FACE
  });
};

const loadImageData = async (
  image: NonNullable<GeneratedSlide['image']>,
  loader: PptxImageLoader | undefined
): Promise<string> => {
  if (!loader) {
    throw new DocumentGenerationError(
      '图文页的图片只能取自本次对话上传的文件，请先上传图片后再生成。'
    );
  }
  const loaded = await loader(image.sourceUrl).catch((error) => {
    throw new DocumentGenerationError(
      error instanceof Error && error.message
        ? error.message
        : '读取图片失败，请重新上传图片后再试。'
    );
  });
  const mime = IMAGE_MIME_BY_EXTENSION[loaded.extension.toLowerCase()];
  if (!mime) {
    throw new DocumentGenerationError(
      '图文页只支持 PNG、JPEG、GIF、WebP 或 SVG 图片，请换一张再试。'
    );
  }
  return `${mime};base64,${loaded.buffer.toString('base64')}`;
};

export const generatePptx = async (
  input: DocumentGenerateInput,
  options: GeneratePptxOptions = {}
): Promise<Buffer> => {
  assertGenerateInputWithinLimits(input);

  const slides = input.slides ?? [];
  if (!slides.length) {
    throw new DocumentGenerationError('生成 PPT 需要用 slides 提供每页内容');
  }

  const title = input.title?.trim() || input.fileName;
  const firstParagraph = input.blocks?.find((block) => block.type === 'paragraph');

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: LAYOUT_NAME, width: SLIDE_WIDTH_INCH, height: SLIDE_HEIGHT_INCH });
  pptx.layout = LAYOUT_NAME;
  pptx.title = title;
  pptx.author = '鲁港通';
  pptx.theme = { headFontFace: FONT_FACE, bodyFontFace: FONT_FACE };

  // 鲁港通 - 显式给了封面页就不再补自动标题页，避免出现两张封面
  if (slides[0].layout !== 'cover') {
    addCoverSlide(
      pptx,
      title,
      firstParagraph?.type === 'paragraph' ? firstParagraph.text : undefined
    );
  }

  for (const slideInput of slides) {
    const layout = resolveLayout(slideInput);

    if (layout === 'cover') {
      const cover = addCoverSlide(pptx, slideInput.title, slideInput.subtitle?.trim() || undefined);
      if (slideInput.notes?.trim()) cover.addNotes(slideInput.notes);
      continue;
    }

    const slide = pptx.addSlide();

    if (layout === 'section') {
      addSectionAccent(pptx, slide);
      slide.addText(slideInput.title, {
        x: 1.1,
        y: 2.5,
        w: SLIDE_WIDTH_INCH - 2.2,
        h: 1.1,
        fontSize: 32,
        bold: true,
        color: TEXT_COLOR,
        fontFace: FONT_FACE
      });
      if (slideInput.subtitle?.trim()) {
        slide.addText(slideInput.subtitle, {
          x: 1.1,
          y: 3.7,
          w: SLIDE_WIDTH_INCH - 2.2,
          h: 0.9,
          fontSize: 18,
          color: MUTED_COLOR,
          fontFace: FONT_FACE
        });
      }
    } else {
      addSlideTitle(slide, slideInput.title);

      if (layout === 'image' && slideInput.image) {
        const data = await loadImageData(slideInput.image, options.loadImage);
        const areaW = SLIDE_WIDTH_INCH - 1.8;
        const areaH = slideInput.image.caption ? 4.4 : 4.8;
        slide.addImage({
          data,
          x: 0.9,
          y: 1.55,
          w: areaW,
          h: areaH,
          sizing: { type: 'contain', w: areaW, h: areaH }
        });
        if (slideInput.image.caption?.trim()) {
          slide.addText(slideInput.image.caption, {
            x: 0.9,
            y: 6.1,
            w: areaW,
            h: 0.5,
            fontSize: 12,
            color: MUTED_COLOR,
            align: 'center',
            fontFace: FONT_FACE
          });
        }
      } else if (layout === 'table' && slideInput.table) {
        const table = slideInput.table;
        const headerRow = table.header.map((text) => ({
          text,
          options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT_COLOR } }
        }));
        const bodyRows = table.rows.map((row) => row.map((text) => ({ text })));
        slide.addTable([headerRow, ...bodyRows], {
          x: 0.9,
          y: 1.55,
          w: SLIDE_WIDTH_INCH - 1.8,
          fontSize: 14,
          fontFace: FONT_FACE,
          color: TEXT_COLOR,
          border: { type: 'solid', pt: 0.5, color: BORDER_COLOR },
          valign: 'middle',
          autoPage: false
        });
      } else if (layout === 'chart' && slideInput.chart) {
        const chart = slideInput.chart;
        const chartType =
          chart.type === 'line'
            ? pptx.ChartType.line
            : chart.type === 'pie'
              ? pptx.ChartType.pie
              : pptx.ChartType.bar;
        slide.addChart(
          chartType,
          chart.series.map((item) => ({
            name: item.name,
            labels: chart.categories,
            values: item.values
          })),
          {
            x: 0.9,
            y: 1.55,
            w: SLIDE_WIDTH_INCH - 1.8,
            h: SLIDE_HEIGHT_INCH - 2.1,
            showLegend: chart.type === 'pie' || chart.series.length > 1,
            chartColors: ['2F5D8A', '7FA6C9', 'C7D7E8']
          }
        );
      } else if (slideInput.bullets?.length) {
        slide.addText(
          slideInput.bullets.map((text) => ({
            text,
            options: { bullet: true, breakLine: true }
          })),
          {
            x: 0.9,
            y: 1.55,
            w: SLIDE_WIDTH_INCH - 1.8,
            h: SLIDE_HEIGHT_INCH - 2.1,
            fontSize: 18,
            color: MUTED_COLOR,
            lineSpacingMultiple: 1.3,
            fontFace: FONT_FACE,
            valign: 'top'
          }
        );
      }
    }

    if (slideInput.notes?.trim()) {
      slide.addNotes(slideInput.notes);
    }
  }

  const data = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
};