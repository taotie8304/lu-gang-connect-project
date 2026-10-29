import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  extractPdfOutline,
  extractPdfTextPages,
  planPdfOverlay,
  writePdfOverlayCopy
} from '../src/main/ai/document/pdfOverlay';

const hasCjkFont = existsSync('C:/Windows/Fonts/simhei.ttf');

const makePdf = async (): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([595.28, 841.89]);
  first.drawText('Name:', { x: 100, y: 700, size: 12, font });
  first.drawText('School:', { x: 100, y: 670, size: 12, font });
  first.drawText('', { x: 100, y: 640, size: 12, font });
  const second = document.addPage([595.28, 841.89]);
  second.drawText('Phone:', { x: 100, y: 700, size: 12, font });
  return new Uint8Array(await document.save());
};

const makeSectionedPdf = async (): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([595.28, 841.89]);
  const draw = (text: string, y: number, x = 90) => page.drawText(text, { x, y, size: 12, font });
  draw('Trip Info', 800, 250);
  draw('Name', 720);
  draw('Gender', 682);
  draw('Guardian', 620);
  draw('1', 620.1, 90 + font.widthOfTextAtSize('Guardian', 12) + 3);
  draw('Name', 582);
  draw('ID', 545);
  draw('Phone', 508);
  draw('Guardian', 430);
  draw('2', 430.1, 90 + font.widthOfTextAtSize('Guardian', 12) + 3);
  draw('Name', 392);
  draw('ID', 355);
  draw('Phone', 318);
  draw('Relation', 240);
  return new Uint8Array(await document.save());
};

const makeCrossPageSectionedPdf = async (): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const guardian of [1, 2]) {
    const page = document.addPage([595.28, 841.89]);
    page.drawText('Guardian', { x: 90, y: 620, size: 12, font });
    page.drawText(String(guardian), {
      x: 90 + font.widthOfTextAtSize('Guardian', 12) + 3,
      y: 620.1,
      size: 12,
      font
    });
    page.drawText('Name', { x: 90, y: 582, size: 12, font });
  }
  return new Uint8Array(await document.save());
};

const makeMultiColumnPdf = async (): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([595.28, 841.89]);
  page.drawText('Name', { x: 90, y: 700, size: 12, font });
  page.drawText('Phone', { x: 300, y: 700, size: 12, font });
  return new Uint8Array(await document.save());
};

const makeOccupiedPdf = async (): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([595.28, 841.89]);
  page.drawText('Name', { x: 100, y: 700, size: 12, font });
  page.drawText('Existing', { x: 150, y: 700, size: 12, font });
  return new Uint8Array(await document.save());
};

const makeCloseRowsPdf = async (): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([595.28, 841.89]);
  page.drawText('Name', { x: 100, y: 700, size: 12, font });
  page.drawText('School', { x: 100, y: 688, size: 12, font });
  return new Uint8Array(await document.save());
};

const rectsOverlap = (
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
): boolean =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

const tempDirs: string[] = [];

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-pdf-overlay-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe('extractPdfTextPages', () => {
  it('读取每页文字与基线坐标，空文字不占位', async () => {
    const pages = await extractPdfTextPages(await makePdf());

    expect(pages).toHaveLength(2);
    const name = pages[0].items.find((item) => item.text === 'Name:');
    expect(name).toBeDefined();
    expect(name?.x).toBeCloseTo(100, 0);
    expect(name?.y).toBeCloseTo(700, 0);
    expect(name?.height).toBeGreaterThan(8);
    expect(pages[0].items.some((item) => item.text.trim() === '')).toBe(false);
    expect(pages[1].items.map((item) => item.text)).toContain('Phone:');
  });

  it('提取标签候选：带冒号的短文字优先，页数一并返回', async () => {
    const outline = await extractPdfOutline(await makePdf());

    expect(outline.pages).toBe(2);
    expect(outline.labels).toContain('Name:');
    expect(outline.labels).toContain('Phone:');
    expect(outline.labels.length).toBeLessThanOrEqual(150);
  });

  it('合并同一视觉行的分区标题，并保留同名字段及所属分区', async () => {
    const outline = await extractPdfOutline(await makeSectionedPdf());

    expect(outline.fields).toEqual([
      { page: 1, label: 'Name' },
      { page: 1, label: 'Gender' },
      { page: 1, label: 'Name', section: 'Guardian 1' },
      { page: 1, label: 'ID', section: 'Guardian 1' },
      { page: 1, label: 'Phone', section: 'Guardian 1' },
      { page: 1, label: 'Name', section: 'Guardian 2' },
      { page: 1, label: 'ID', section: 'Guardian 2' },
      { page: 1, label: 'Phone', section: 'Guardian 2' },
      { page: 1, label: 'Relation' }
    ]);
    expect(outline.fields.map((field) => field.label)).not.toContain('1');
    expect(outline.fields.map((field) => field.label)).not.toContain('Guardian 1');
    expect(outline.fields.map((field) => field.label)).not.toContain('Trip Info');
  });

  it('跨页的同名字段仍保留各自分区', async () => {
    const outline = await extractPdfOutline(await makeCrossPageSectionedPdf());

    expect(outline.fields).toEqual([
      { page: 1, label: 'Name', section: 'Guardian 1' },
      { page: 2, label: 'Name', section: 'Guardian 2' }
    ]);
  });

  it('同一视觉行的多列字段都进入提纲', async () => {
    const outline = await extractPdfOutline(await makeMultiColumnPdf());

    expect(outline.fields).toEqual([
      { page: 1, label: 'Name' },
      { page: 1, label: 'Phone' }
    ]);
  });
});

describe('planPdfOverlay', () => {
  it('内容写在标签右侧，坐标为页面比例且不越界', async () => {
    const pages = await extractPdfTextPages(await makePdf());
    const plan = planPdfOverlay(pages, [{ label: 'Name：', value: '张三' }]);

    const placement = plan.placements[0];
    expect(placement.status).toBe('placed');
    expect(placement.page).toBe(1);
    expect(placement.labelRect?.x).toBeCloseTo(100 / 595.28, 2);
    expect(placement.valueRect!.x).toBeGreaterThan(placement.labelRect!.x + placement.labelRect!.width);
    expect(placement.valueRect!.x + placement.valueRect!.width).toBeLessThanOrEqual(1);
    expect(placement.valueRect!.y).toBeGreaterThanOrEqual(0);
    expect(placement.x).toBeGreaterThan(100);
  });

  it('按页提示匹配，找不到标签返回 missing 而不是猜位置', async () => {
    const pages = await extractPdfTextPages(await makePdf());
    const plan = planPdfOverlay(pages, [
      { page: 2, label: 'Phone', value: '123' },
      { label: 'Fax', value: '456' }
    ]);

    expect(plan.placements[0].status).toBe('placed');
    expect(plan.placements[0].page).toBe(2);
    expect(plan.placements[1].status).toBe('missing');
    expect(plan.placements[1].valueRect).toBeUndefined();
  });

  it('同一个标签不会被两条内容重复占用', async () => {
    const pages = await extractPdfTextPages(await makePdf());
    const plan = planPdfOverlay(pages, [
      { label: 'Name:', value: '张三' },
      { label: 'Name:', value: '李四' }
    ]);

    expect(plan.placements[0].status).toBe('placed');
    expect(plan.placements[1].status).toBe('missing');
  });

  it('按分区定位同名字段，并在预览中保留分区说明', async () => {
    const pages = await extractPdfTextPages(await makeSectionedPdf());
    const plan = planPdfOverlay(pages, [
      { section: 'Guardian 2', label: 'Name', value: 'Second' },
      { section: 'Guardian 1', label: 'Name', value: 'First' }
    ]);

    expect(plan.placements[0]).toMatchObject({
      status: 'placed',
      section: 'Guardian 2',
      label: 'Name'
    });
    expect(plan.placements[0].y).toBeCloseTo(392, 0);
    expect(plan.placements[1].y).toBeCloseTo(582, 0);
  });

  it('按分区定位跨页同名字段', async () => {
    const pages = await extractPdfTextPages(await makeCrossPageSectionedPdf());
    const plan = planPdfOverlay(pages, [
      { section: 'Guardian 2', label: 'Name', value: 'Second' }
    ]);

    expect(plan.placements[0]).toMatchObject({
      status: 'placed',
      page: 2,
      section: 'Guardian 2'
    });
    expect(plan.placements[0].y).toBeCloseTo(582, 0);
  });

  it('合并视觉行时不会改写调用方持有的原始文字坐标', async () => {
    const pages = await extractPdfTextPages(await makeSectionedPdf());
    const original = structuredClone(pages);

    planPdfOverlay(pages, [{ section: 'Guardian 1', label: 'Name', value: 'First' }]);

    expect(pages).toEqual(original);
  });

  it('不带分区的同名标签仍按页面顺序逐个消费', async () => {
    const pages = await extractPdfTextPages(await makeSectionedPdf());
    const plan = planPdfOverlay(pages, [
      { label: 'Name', value: 'Student' },
      { label: 'Name', value: 'First' },
      { label: 'Name', value: 'Second' }
    ]);

    expect(plan.placements.map((placement) => placement.status)).toEqual([
      'placed',
      'placed',
      'placed'
    ]);
    expect(plan.placements[0].y).toBeCloseTo(720, 0);
    expect(plan.placements[1].y).toBeCloseTo(582, 0);
    expect(plan.placements[2].y).toBeCloseTo(392, 0);
  });

  it('分区名称不准确时回退到普通标签匹配', async () => {
    const pages = await extractPdfTextPages(await makeSectionedPdf());
    const plan = planPdfOverlay(pages, [
      { section: 'Unknown', label: 'Name', value: 'Student' }
    ]);

    expect(plan.placements[0].status).toBe('placed');
    expect(plan.placements[0].y).toBeCloseTo(720, 0);
  });

  it('右侧已有原文字时自动改到下方空白处', async () => {
    const pages = await extractPdfTextPages(await makeOccupiedPdf());
    const plan = planPdfOverlay(pages, [{ label: 'Name', value: 'A long value' }]);
    const placement = plan.placements[0];
    const existing = pages[0].items.find((item) => item.text === 'Existing')!;
    const existingTop = existing.y + existing.height * 0.9;
    const existingRect = {
      x: existing.x / pages[0].width,
      y: 1 - existingTop / pages[0].height,
      width: existing.width / pages[0].width,
      height: (existing.height * 1.2) / pages[0].height
    };

    expect(placement.status).toBe('placed');
    expect(placement.y).toBeLessThan(700);
    expect(rectsOverlap(placement.valueRect!, existingRect)).toBe(false);
  });

  it('后规划的内容不会压住前一条已规划内容', async () => {
    const pages = await extractPdfTextPages(await makeCloseRowsPdf());
    const plan = planPdfOverlay(pages, [
      { label: 'Name', value: 'A long first value' },
      { label: 'School', value: 'A long second value' }
    ]);

    expect(plan.placements[1].status).toBe('placed');
    expect(plan.placements[1].y).toBeLessThan(688);
    expect(rectsOverlap(plan.placements[0].valueRect!, plan.placements[1].valueRect!)).toBe(false);
  });
});

describe.skipIf(!hasCjkFont)('writePdfOverlayCopy', () => {
  it('只在副本上写入，原文件字节不变，页数保持一致', async () => {
    const bytes = await makePdf();
    const pages = await extractPdfTextPages(bytes);
    const plan = planPdfOverlay(pages, [{ label: 'School:', value: '香港中文大学' }]);
    const dir = await makeTempDir();
    const sourcePath = join(dir, 'source.pdf');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(sourcePath, bytes);

    const copy = await writePdfOverlayCopy({
      pdfBytes: bytes,
      fileName: '报名表.pdf',
      sourcePath,
      placements: plan.placements,
      outputDir: dir
    });

    expect(copy.format).toBe('pdf');
    expect(copy.name).toBe('报名表-已填写.pdf');
    expect(copy.applied).toBe(1);
    expect(copy.path).not.toBe(sourcePath);

    const original = await readFile(sourcePath);
    expect(original.equals(Buffer.from(bytes))).toBe(true);

    const written = await PDFDocument.load(new Uint8Array(await readFile(copy.path)));
    expect(written.getPageCount()).toBe(2);
    const rewritten = await extractPdfTextPages(new Uint8Array(await readFile(copy.path)));
    expect(rewritten[0].items.map((item) => item.text).join('')).toContain('香港中文大学');
  });

  it('找不到标签的内容不会写入副本', async () => {
    const bytes = await makePdf();
    const pages = await extractPdfTextPages(bytes);
    const plan = planPdfOverlay(pages, [{ label: 'Fax:', value: '999' }]);
    const dir = await makeTempDir();

    const copy = await writePdfOverlayCopy({
      pdfBytes: bytes,
      fileName: 'form.pdf',
      sourcePath: join(dir, 'form.pdf'),
      placements: plan.placements,
      outputDir: dir
    });

    expect(copy.applied).toBe(0);
    const rewritten = await extractPdfTextPages(new Uint8Array(await readFile(copy.path)));
    expect(rewritten[0].items.map((item) => item.text).join('')).not.toContain('999');
  });
});
