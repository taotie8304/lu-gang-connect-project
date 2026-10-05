// 鲁港通 - Vitest 测试配置
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**']
  }
});
