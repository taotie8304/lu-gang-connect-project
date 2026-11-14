// 鲁港通 - 文档能力字体资产守卫：PDF 生成/填写依赖随仓库分发的中文字体
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASSET_DIR = path.resolve(process.cwd(), 'packages/service/core/ai/document/assets');

describe('文档能力字体资产', () => {
  it('中文字体存在且体积正常', () => {
    const bytes = readFileSync(path.join(ASSET_DIR, 'NotoSansSC-Regular.otf'));
    expect(bytes.byteLength).toBeGreaterThan(1 * 1024 * 1024);
  });

  it('随附 OFL 许可证与来源说明', () => {
    const license = readFileSync(path.join(ASSET_DIR, 'OFL.txt'), 'utf8');
    expect(license).toContain('SIL Open Font License');
    const readme = readFileSync(path.join(ASSET_DIR, 'README.md'), 'utf8');
    expect(readme).toContain('SHA-256');
  });
});
