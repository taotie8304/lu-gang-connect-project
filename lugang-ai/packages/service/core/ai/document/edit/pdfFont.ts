// 鲁港通 - PDF 编辑中文字体：读取内置 Noto Sans SC 子集嵌入，写入的中文既能显示也能被检索
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';
import { DocumentEditError } from '../types';

const FONT_ASSET_NAME = 'NotoSansSC-Regular.otf';
const FONT_MISSING_MESSAGE =
  '这份文件需要写入中文，但服务器上的中文字体资源暂时不可用；请稍后重试，或改用 Word / Excel 格式修改。';

// 鲁港通 - 字体资产候选路径：源码调试、standalone 容器与仓库根启动都能命中
const resolveFontPath = (): string | null => {
  const candidates = [
    fileURLToPath(new URL(`../assets/${FONT_ASSET_NAME}`, import.meta.url)),
    join(process.cwd(), 'packages/service/core/ai/document/assets', FONT_ASSET_NAME),
    join(process.cwd(), '../../packages/service/core/ai/document/assets', FONT_ASSET_NAME),
    join(process.cwd(), 'document/assets', FONT_ASSET_NAME)
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

export const embedPdfEditFont = async (document: PDFDocument): Promise<PDFFont> => {
  const path = resolveFontPath();
  if (!path) throw new DocumentEditError(FONT_MISSING_MESSAGE);

  document.registerFontkit(fontkit);
  try {
    // 鲁港通 - 子集嵌入：实测该字体子集后中文渲染与文本抽取都正常，产物只增加约 40KB
    return await document.embedFont(new Uint8Array(await readFile(path)), { subset: true });
  } catch {
    throw new DocumentEditError(FONT_MISSING_MESSAGE);
  }
};
