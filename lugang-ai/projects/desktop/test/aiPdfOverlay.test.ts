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
