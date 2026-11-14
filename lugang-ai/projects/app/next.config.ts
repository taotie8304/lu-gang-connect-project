import type { NextConfig } from 'next';
import path from 'path';

import { webEnv } from '@fastgpt/web/env';
import { appEnv } from './src/env';

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(self), microphone=(self), camera=(self)'
  }
];

const optimizedPackageImports = [
  '@chakra-ui/react',
  '@chakra-ui/icons',
  'framer-motion',
  '@emotion/react',
  '@emotion/styled'
];

const nextConfig: NextConfig = {
  basePath: webEnv.NEXT_PUBLIC_BASE_URL || undefined,
  env: {
    SYSTEM_NAME: appEnv.SYSTEM_NAME,
    SYSTEM_DESCRIPTION: appEnv.SYSTEM_DESCRIPTION,
    SYSTEM_FAVICON: appEnv.SYSTEM_FAVICON
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-CN', 'zh-Hant', 'ko-KR'],
    localeDetection: false
  },
  output: 'standalone',
  // Strict Mode is development-only; keep it disabled until double-render unsafe code is migrated.
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/((?!chat/share$).*)',
        headers: securityHeaders
      }
    ];
  },
  turbopack: {
    root: path.join(__dirname, '../../'),
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js'
      }
    }
  },
  transpilePackages: ['@modelcontextprotocol/sdk', 'ahooks'],
  serverExternalPackages: [
    '@node-rs/jieba',
    'bullmq',
    '@zilliz/milvus2-sdk-node',
    '@opentelemetry/api-logs',
    '@mariozechner/pi-agent-core',
    '@mariozechner/pi-ai',
    'wuying-agentbay-sdk'
  ],
  // 优化大库的 barrel exports tree-shaking
  experimental: {
    optimizePackageImports: optimizedPackageImports,
    // 减少内存占用
    memoryBasedWorkersCount: true,

    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    // Node 24 resolves @swc/helpers through module-sync, but Next 16.3 does not trace all ESM helpers.
    '*': [
      '../../node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/esm/**/*',
      '../../node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/cjs/**/*',
      // 鲁港通 - 文档工具（exceljs / pdf-lib 字体链 / date-fns）依赖的包在 Node 24 下按 exports
      // 的 module-sync 等条件加载，static tracing 只收集到部分文件，运行期 require 时会因缺文件
      // 导致整个聊天路由 500（2026-11-14 生产实证），这里按包补全运行时文件。
      '../../node_modules/.pnpm/async-function@*/node_modules/async-function/**/*',
      '../../node_modules/.pnpm/es-object-atoms@*/node_modules/es-object-atoms/**/*',
      '../../node_modules/.pnpm/@noble+ciphers@*/node_modules/@noble/ciphers/**/*',
      '../../node_modules/.pnpm/@noble+hashes@*/node_modules/@noble/hashes/**/*',
      '../../node_modules/.pnpm/linebreak@*/node_modules/linebreak/**/*',
      '../../node_modules/.pnpm/restructure@*/node_modules/restructure/**/*',
      '../../node_modules/.pnpm/unicode-properties@*/node_modules/unicode-properties/**/*',
      '../../node_modules/.pnpm/date-fns@*/node_modules/date-fns/**/*',
      // 鲁港通 - playwright-core 启动时动态 require browsers.json，静态追踪收集不到（办事浏览器 SDK 依赖）：
      '../../node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/browsers.json',
      // 鲁港通 - PDF 中文字体通过运行时路径读取，静态追踪收集不到（文档生成/填写依赖）：
      '../../packages/service/core/ai/document/assets/**/*'
    ]
  },
  // Exclude build-time-only packages from standalone output file tracing
  outputFileTracingExcludes: {
    '*': [
      // GNU platform binaries - Alpine uses musl only
      'node_modules/**/*-linux-x64-gnu*/**',
      // typescript - build-time only
      'node_modules/typescript/**',
      // sharp libvips GNU variant (keep musl)
      'node_modules/@img/sharp-libvips-linux-x64/**',
      // bundle-analyzer - build-time only
      'node_modules/@next/bundle-analyzer/**',
      'node_modules/webpack-bundle-analyzer/**'
    ]
  }
};

export default nextConfig;
