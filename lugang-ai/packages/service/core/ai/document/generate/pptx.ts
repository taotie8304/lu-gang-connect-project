// 鲁港通 - 服务端 PPT 生成：pptxgenjs 16:9，标题页 + 内容页，仅文本与基本版式
import PptxGenJS from 'pptxgenjs';
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

export const generatePptx = async (input: DocumentGenerateInput): Promise<Buffer> => {
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

  const cover = pptx.addSlide();
  cover.addText(title, {
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
  if (firstParagraph?.type === 'paragraph') {
    cover.addText(firstParagraph.text, {
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

  for (const slideInput of slides) {
    const slide = pptx.addSlide();
    slide.addText(slideInput.title, {
      x: 0.7,
      y: 0.45,
      w: SLIDE_WIDTH_INCH - 1.4,
      h: 0.9,
      fontSize: 26,
      bold: true,
      color: TEXT_COLOR,
      fontFace: FONT_FACE
    });
    if (slideInput.bullets?.length) {
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
    if (slideInput.notes?.trim()) {
      slide.addNotes(slideInput.notes);
    }
  }

  const data = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
};
