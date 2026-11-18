// 鲁港通 - 内置表格模板：固定地址白名单 → 镜像内 PDF 资产，供补贴自评等场景直接填写
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocumentSourceError } from './errors';

export type DocumentTemplate = {
  url: string;
  fileName: string;
  assetName: string;
};

const TEMPLATE_ASSET_DIR = 'form-templates';

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    url: 'https://www.airscend.com/form-templates/jinan-subsidy-intake.pdf',
    fileName: '济南市外资与人才补贴自评及申报基础信息表.pdf',
    assetName: 'jinan-subsidy-intake.pdf'
  },
  {
    url: 'https://www.airscend.com/form-templates/hk-study-facts-intake.pdf',
    fileName: '香港留学申请事实采集表.pdf',
    assetName: 'hk-study-facts-intake.pdf'
  },
  {
    url: 'https://www.airscend.com/form-templates/hk-company-setup-checklist.pdf',
    fileName: '香港公司设立信息与确认表.pdf',
    assetName: 'hk-company-setup-checklist.pdf'
  }
];

const TEMPLATE_MISSING_MESSAGE =
  '平台内置表格模板暂时不可用，请稍后重试；也可以把要填写的信息直接告诉我，我改用 Word 或 Markdown 输出。';

/** 鲁港通 - 只按完整地址精确匹配，杜绝把任意地址映射成本地文件读取 */
export const findDocumentTemplate = (sourceUrl: string): DocumentTemplate | undefined =>
  DOCUMENT_TEMPLATES.find((template) => template.url === sourceUrl);

// 鲁港通 - 资产候选路径：源码调试、standalone 容器与仓库根启动都能命中（同 pdfFont 的解析策略）
const resolveTemplatePath = (assetName: string): string | null => {
  const candidates = [
    fileURLToPath(new URL(`./assets/${TEMPLATE_ASSET_DIR}/${assetName}`, import.meta.url)),
    join(
      process.cwd(),
      'packages/service/core/ai/document/assets',
      TEMPLATE_ASSET_DIR,
      assetName
    ),
    join(
      process.cwd(),
      '../../packages/service/core/ai/document/assets',
      TEMPLATE_ASSET_DIR,
      assetName
    ),
    join(process.cwd(), 'document/assets', TEMPLATE_ASSET_DIR, assetName)
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

export const loadDocumentTemplate = async (template: DocumentTemplate): Promise<Buffer> => {
  const path = resolveTemplatePath(template.assetName);
  if (!path) throw new DocumentSourceError(TEMPLATE_MISSING_MESSAGE);

  try {
    return await readFile(path);
  } catch {
    throw new DocumentSourceError(TEMPLATE_MISSING_MESSAGE);
  }
};
