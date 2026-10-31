import { describe, expect, it } from 'vitest';
import { readPdfByLiteParse } from '@fastgpt/service/worker/readFile/utils/LiteParse';

/**
 * 构造单页纯图片 PDF（无文字层），用于触发 LiteParse 的 OCR 分支。
 *
 * 2.0.8 的 wasm 在 OCR 合并阶段直接 panic（ocr_merge.rs 依赖 Tokio runtime），
 * 而 mock 测试无法暴露该问题，因此这里必须使用真实 wasm 做回归。
 */
const buildImageOnlyPdf = (width = 8, height = 8) => {
  const rgb = Buffer.alloc(width * height * 3, 200);
  const content = 'q 400 0 0 400 100 100 cm /Im0 Do Q';

  const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1');
  const chunks: Buffer[] = [];
  const offsets: Record<number, number> = {};

  const push = (buf: Buffer | string) =>
    chunks.push(Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'latin1'));
  const mark = (num: number) => {
    offsets[num] = header.length + Buffer.concat(chunks).length;
  };

  mark(1);
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  mark(2);
  push('2 0 obj\n<< /Type /Pages /Kids [5 0 R] /Count 1 >>\nendobj\n');
  mark(3);
  push(
    `3 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgb.length} >>\nstream\n`
  );
  push(rgb);
  push('\nendstream\nendobj\n');
  mark(4);
  push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  mark(5);
  push(
    '5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /XObject << /Im0 3 0 R >> >> /Contents 4 0 R >>\nendobj\n'
  );

  const body = Buffer.concat(chunks);
  const xrefOffset = header.length + body.length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let n = 1; n <= 5; n++) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.concat([header, body, Buffer.from(xref + trailer, 'latin1')]);
};

const buildTextPdf = () => {
  const content =
    'BT /F1 24 Tf 72 700 Td (Hello Lugang OCR test line one) Tj 0 -32 Td (Second line of text content for testing) Tj ET';
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const parts: string[] = [];
  const offsets: Record<number, number> = {};

  const addObject = (num: number, dict: string, stream?: string) => {
    offsets[num] = Buffer.byteLength(parts.join(''), 'latin1');
    parts.push(`${num} 0 obj\n${dict}\n`);
    if (stream !== undefined) parts.push(`stream\n${stream}\nendstream\n`);
    parts.push('endobj\n');
  };

  addObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObject(
    3,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'
  );
  addObject(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObject(5, `<< /Length ${content.length} >>`, content);

  const body = Buffer.from(parts.join(''), 'latin1');
  const xrefOffset = Buffer.byteLength(header, 'latin1') + body.length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let n = 1; n <= 5; n++) {
    xref += `${String(offsets[n] + Buffer.byteLength(header, 'latin1')).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.concat([Buffer.from(header, 'latin1'), body, Buffer.from(xref + trailer, 'latin1')]);
};

describe('readPdfByLiteParse 真实 WASM OCR', () => {
  it(
    '带文字层的 PDF 在开启 OCR 回调时正常解析文字层',
    async () => {
      const result = await readPdfByLiteParse(
        { extension: 'pdf', encoding: 'utf-8', buffer: buildTextPdf() },
        { ocr: async () => '这里不应被使用' }
      );

      expect(result.rawText).toContain('Hello Lugang OCR test line one');
      expect(result.rawText).not.toContain('这里不应被使用');
    },
    60000
  );

  it(
    '纯图片 PDF 经 OCR 回调识别后合并进文本',
    async () => {
      const requests: { imageData: Uint8Array; width: number; height: number }[] = [];
      const result = await readPdfByLiteParse(
        { extension: 'pdf', encoding: 'utf-8', buffer: buildImageOnlyPdf() },
        {
          ocr: async ({ imageData, width, height }) => {
            requests.push({ imageData, width, height });
            return '鲁港通扫描件识别测试';
          }
        }
      );

      expect(requests.length).toBeGreaterThan(0);
      const [first] = requests;
      expect(Array.from(first.imageData.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(first.width).toBeGreaterThan(0);
      expect(first.height).toBeGreaterThan(0);
      expect(result.rawText).toContain('鲁港通扫描件识别测试');
    },
    60000
  );

  it(
    '未传 OCR 回调时纯图片 PDF 不崩溃且无文本',
    async () => {
      const result = await readPdfByLiteParse({
        extension: 'pdf',
        encoding: 'utf-8',
        buffer: buildImageOnlyPdf()
      });

      expect(result.rawText.trim()).toBe('');
    },
    60000
  );
});
