import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('projects/app/src'),
      '@fastgpt': resolve('packages'),
      '@test': resolve('test')
    }
  },
  test: {
    environment: 'jsdom',
    include: ['packages/**/*.test.ts', 'projects/app/test/**/*.test.ts'],
    testTimeout: 20000
  }
});
