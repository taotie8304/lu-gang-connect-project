# Design Document

## Overview

本设计文档描述了如何恢复鲁港通项目中的 FastGPT 商业版权限控制功能。设计采用优雅降级策略，确保在未配置商业版服务时应用仍能正常运行，同时为未来对接商业版服务预留完整接口。

核心设计原则：
1. **优雅降级**：未配置商业版时不抛出错误，而是返回空数据或跳过功能
2. **向后兼容**：保持与 FastGPT-4.14.7.2 最新版本的兼容性
3. **代码复用**：直接使用最新版本的实现，减少维护成本
4. **清晰日志**：记录商业版功能的调用和降级情况

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      鲁港通前端应用                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              前端组件层                               │  │
│  │  - SystemMsgModal (系统消息弹窗)                     │  │
│  │  - DataExport (数据导出)                             │  │
│  │  - UserInform (用户通知)                             │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐  │
│  │           API 路由层                                  │  │
│  │  /api/proApi/[...path].ts (商业版 API 代理)         │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐  │
│  │           服务层                                      │  │
│  │  - plusRequest.ts (商业版请求封装)                  │  │
│  │  - constants.ts (商业版常量)                         │  │
│  │  - config/controller.ts (配置控制器)                │  │
│  └────────────────┬─────────────────────────────────────┘  │
└───────────────────┼──────────────────────────────────────────┘
                    │
                    │ PRO_URL 配置
                    │
         ┌──────────▼──────────┐
         │  FastGPT 商业版服务  │
         │  (可选，未来对接)    │
         └─────────────────────┘
```

### 数据流

1. **有商业版配置时**：
   ```
   前端组件 → API 路由 → plusRequest → FastGPT 商业版 → 返回数据
   ```

2. **无商业版配置时**：
   ```
   前端组件 → API 路由 → 检测到无配置 → 记录日志 → 返回空数据/跳过
   ```

## Components and Interfaces

### 1. 商业版常量模块

**文件**: `packages/service/common/system/constants.ts`

```typescript
// 商业版 URL 常量
export const FastGPTProUrl = process.env.PRO_URL ? `${process.env.PRO_URL}/api` : '';

// 插件 URL 常量
export const FastGPTPluginUrl = process.env.PLUGIN_BASE_URL ? `${process.env.PLUGIN_BASE_URL}` : '';

// 判断是否为商业版服务
export const isFastGPTProService = () => !!global.systemConfig;

// 判断是否为 Pro 版本
export const isProVersion = () => {
  return !!global.feConfigs?.isPlus;
};

// 服务请求最大内容长度
export const serviceRequestMaxContentLength =
  Number(process.env.SERVICE_REQUEST_MAX_CONTENT_LENGTH || 10) * 1024 * 1024;

// 初始化错误枚举
export const InitialErrorEnum = {
  S3_ERROR: 's3_error',
  MONGO_ERROR: 'mongo_error',
  REDIS_ERROR: 'redis_error',
  VECTORDB_ERROR: 'vectordb_error',
  PLUGIN_ERROR: 'plugin_error',
  PRO_ERROR: 'pro_error',
  SANDBOX_ERROR: 'code_sandbox_error',
  MCP_SERVER_ERROR: 'mcp_server_error'
};
```

**设计说明**：
- `FastGPTProUrl` 从环境变量 `PRO_URL` 派生，未配置时为空字符串
- 提供辅助函数判断商业版状态
- 定义错误类型枚举，包含 `PRO_ERROR`

### 2. 商业版请求模块

**文件**: `packages/service/common/api/plusRequest.ts`

```typescript
import { FastGPTProUrl } from '../system/constants';
import { UserError } from '@fastgpt/global/common/error/utils';
import { createProxyAxios } from './axios';
import { getLogger, LogCategories } from '../logger';

const logger = getLogger(LogCategories.HTTP.ERROR);

// 请求配置类型
interface ConfigType {
  headers?: { [key: string]: string };
  hold?: boolean;
  timeout?: number;
}

// 响应数据类型
interface ResponseDataType {
  code: number;
  message: string;
  data: any;
}

// 核心请求函数
export function request(url: string, data: any, config: ConfigType, method: Method): any {
  // 关键：未配置商业版时记录警告并拒绝请求
  if (!FastGPTProUrl) {
    logger.warn('FastGPT Pro API is not configured', { url });
    return Promise.reject(new UserError('The request was denied...'));
  }

  // 移除空值
  for (const key in data) {
    if (data[key] === null || data[key] === undefined) {
      delete data[key];
    }
  }

  return instance
    .request({
      baseURL: FastGPTProUrl,
      url,
      method,
      data: ['POST', 'PUT'].includes(method) ? data : null,
      params: !['POST', 'PUT'].includes(method) ? data : null,
      ...config
    })
    .then((res) => checkRes(res.data))
    .catch((err) => responseError(err));
}

// 导出 HTTP 方法
export function GET<T = undefined>(url: string, params = {}, config: ConfigType = {}): Promise<T> {
  return request(url, params, config, 'GET');
}

export function POST<T = undefined>(url: string, data = {}, config: ConfigType = {}): Promise<T> {
  return request(url, data, config, 'POST');
}

export function PUT<T = undefined>(url: string, data = {}, config: ConfigType = {}): Promise<T> {
  return request(url, data, config, 'PUT');
}

export function DELETE<T = undefined>(url: string, data = {}, config: ConfigType = {}): Promise<T> {
  return request(url, data, config, 'DELETE');
}
```

**设计说明**：
- 未配置商业版时记录警告日志，不抛出异常
- 返回 `UserError` 以便上层捕获处理
- 自动移除请求数据中的 null/undefined 值
- 提供完整的 CRUD 方法

### 3. 商业版 API 代理

**文件**: `projects/app/src/pages/api/proApi/[...path].ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { FastGPTProUrl } from '@fastgpt/service/common/system/constants';
import { Readable } from 'stream';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { path = [], ...query } = req.query as any;
    const requestPath = `/api/${path?.join('/')}?${new URLSearchParams(query).toString()}`;

    if (!requestPath) {
      throw new Error('url is empty');
    }
    
    // 关键：未配置商业版时抛出明确错误
    if (!FastGPTProUrl) {
      throw new Error(`未配置商业版链接: ${path}`);
    }

    const targetUrl = new URL(requestPath, FastGPTProUrl);

    // 过滤敏感请求头
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key === 'rootkey' || key === 'host' || key === 'connection') continue;
      if (value) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    // 使用 fetch API 代理请求
    const request = new Request(targetUrl, {
      // @ts-ignore
      duplex: 'half',
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? null : (req as any)
    });

    const response = await fetch(request);

    // 复制响应头（排除编码相关）
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'content-encoding' || lowerKey === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    res.status(response.status);

    // 流式返回响应体
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
```

**设计说明**：
- 使用最新的 fetch API 替代旧的 http.request
- 正确处理流式响应
- 过滤敏感请求头（rootkey, host, connection）
- 排除编码相关响应头避免冲突

### 4. 系统配置控制器

**文件**: `packages/service/common/system/config/controller.ts`

```typescript
import { FastGPTProUrl } from '../constants';
import { MongoSystemConfigs } from './schema';
import { SystemConfigsTypeEnum } from '@fastgpt/global/common/system/config/constants';

export const getFastGPTConfigFromDB = async (): Promise<{
  fastgptConfig: FastGPTConfigFileType;
  licenseData?: LicenseDataType;
}> => {
  // 关键：未配置商业版时返回空配置
  if (!FastGPTProUrl) {
    return {
      fastgptConfig: {} as FastGPTConfigFileType
    };
  }

  // 从数据库获取配置
  const [fastgptConfig, licenseConfig] = await Promise.all([
    MongoSystemConfigs.findOne({
      type: SystemConfigsTypeEnum.fastgpt
    }).sort({ createTime: -1 }),
    MongoSystemConfigs.findOne({
      type: SystemConfigsTypeEnum.license
    }).sort({ createTime: -1 })
  ]);

  const config = fastgptConfig?.value || {};
  const licenseData = licenseConfig?.value?.data as LicenseDataType | undefined;

  // 设置缓存 ID
  const fastgptConfigTime = fastgptConfig?.createTime.getTime().toString();
  const licenseConfigTime = licenseConfig?.createTime.getTime().toString();
  global.systemInitBufferId = fastgptConfigTime
    ? `${fastgptConfigTime}-${licenseConfigTime}`
    : undefined;

  return {
    fastgptConfig: config as FastGPTConfigFileType,
    licenseData
  };
};
```

**设计说明**：
- 未配置商业版时直接返回空配置对象
- 使用 MongoDB 存储配置数据
- 利用创建时间实现配置缓存

### 5. 用户通知 API

**文件**: `projects/app/src/service/support/user/inform/api.ts`

```typescript
import { POST } from '@fastgpt/service/common/api/plusRequest';
import { type SendInform2UserProps } from '@fastgpt/global/support/user/inform/type';
import { FastGPTProUrl } from '@fastgpt/service/common/system/constants';

export function sendOneInform(data: SendInform2UserProps) {
  // 关键：未配置商业版时直接返回
  if (!FastGPTProUrl) return;
  
  return POST('/support/user/inform/create', data);
}
```

**设计说明**：
- 未配置商业版时静默跳过，不影响主流程
- 使用 plusRequest 模块发送请求

### 6. 文件 URL 验证器

**文件**: `packages/service/common/security/fileUrlValidator.ts`

```typescript
// 提取商业版 URL 的主机名
if (process.env.PRO_URL) {
  try {
    const urlData = new URL(process.env.PRO_URL);
    list.push(urlData.hostname);
  } catch (error) {
    // 静默处理无效 URL
  }
}
```

**设计说明**：
- 将商业版域名添加到白名单
- 优雅处理无效 URL

### 7. 外链工具模块

**文件**: `packages/service/support/outLink/tools.ts`

```typescript
import { FastGPTProUrl } from '../../common/system/constants';

export const pushOutLinkUsageToQueue = async ({
  shareId,
  outLinkUid,
  flowResponses
}: {
  shareId?: string;
  outLinkUid?: string;
  flowResponses?: ChatHistoryItemResType[];
}) => {
  // 关键：未配置商业版时直接返回
  if (!shareId || !outLinkUid || !FastGPTProUrl) return;
  
  // 发送追踪数据
  // ...
};
```

**设计说明**：
- 未配置商业版时跳过追踪
- 不影响主要功能流程

## Data Models

### 环境变量

```typescript
// packages/service/type/env.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PRO_URL: string;  // 商业版服务地址，格式：https://pro.example.com
      // ... 其他环境变量
    }
  }
}
```

### 配置对象

```typescript
interface FastGPTConfigFileType {
  // 商业版配置字段
  // 具体字段由商业版定义
}

interface LicenseDataType {
  // 许可证数据
  // 具体字段由商业版定义
}
```

## Correctness Properties

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式声明。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: 商业版 URL 配置一致性

*For any* 代码模块，当访问商业版 URL 时，应该使用统一的 `FastGPTProUrl` 常量，而不是直接访问 `process.env.PRO_URL`

**Validates: Requirements 2.1, 2.2**

### Property 2: 优雅降级行为

*For any* 商业版 API 调用，当 `FastGPTProUrl` 为空时，应该记录警告日志并返回空数据或跳过操作，而不是抛出未捕获的异常

**Validates: Requirements 1.1, 1.2, 10.1, 10.3, 10.4**

### Property 3: 请求头过滤

*For any* 通过 Pro API 代理的请求，敏感请求头（rootkey, host, connection）应该被过滤掉，不应该转发到商业版服务

**Validates: Requirements 1.5**

### Property 4: 空值清理

*For any* 通过 plusRequest 发送的请求数据，null 和 undefined 值应该被移除，不应该出现在最终请求中

**Validates: Requirements 3.6**

### Property 5: 配置缓存一致性

*For any* 系统配置更新，`global.systemInitBufferId` 应该同步更新，确保前端能够检测到配置变化

**Validates: Requirements 4.5**

### Property 6: 日志记录完整性

*For any* 商业版功能调用失败，应该记录包含 URL 和错误信息的日志，便于问题排查

**Validates: Requirements 1.2, 3.3**

## Error Handling

### 错误分类

1. **配置错误**：
   - PRO_URL 未配置
   - PRO_URL 格式无效
   - 处理：记录警告，返回空数据

2. **网络错误**：
   - 商业版服务不可达
   - 请求超时
   - 处理：记录错误，返回友好提示

3. **认证错误**：
   - rootkey 无效
   - 权限不足
   - 处理：返回 401/403 错误

4. **数据错误**：
   - 响应格式错误
   - 数据验证失败
   - 处理：记录错误，返回默认值

### 错误处理策略

```typescript
// 1. API 代理层错误处理
try {
  if (!FastGPTProUrl) {
    throw new Error(`未配置商业版链接: ${path}`);
  }
  // ... 代理逻辑
} catch (error) {
  jsonRes(res, {
    code: 500,
    error
  });
}

// 2. 请求模块错误处理
if (!FastGPTProUrl) {
  logger.warn('FastGPT Pro API is not configured', { url });
  return Promise.reject(new UserError('The request was denied...'));
}

// 3. 业务逻辑错误处理
if (!FastGPTProUrl) return; // 静默跳过
```

## Testing Strategy

### 单元测试

使用 Vitest 进行单元测试，覆盖以下场景：

1. **常量模块测试**：
   - 测试 FastGPTProUrl 在有/无 PRO_URL 时的值
   - 测试辅助函数的返回值

2. **请求模块测试**：
   - 测试未配置商业版时的错误处理
   - 测试空值清理逻辑
   - 测试请求拦截器

3. **配置控制器测试**：
   - 测试未配置商业版时返回空配置
   - 测试缓存 ID 生成逻辑

### 属性测试

使用 fast-check 进行属性测试（最少 100 次迭代）：

1. **Property 1 测试**：
   - 生成随机代码路径
   - 验证所有路径都使用 FastGPTProUrl 常量

2. **Property 2 测试**：
   - 生成随机 API 调用
   - 验证未配置时不抛出异常

3. **Property 3 测试**：
   - 生成随机请求头
   - 验证敏感头被过滤

4. **Property 4 测试**：
   - 生成包含 null/undefined 的随机数据
   - 验证这些值被移除

### 集成测试

1. **商业版配置场景**：
   - 配置 PRO_URL
   - 测试完整的请求流程
   - 验证数据正确返回

2. **无商业版配置场景**：
   - 不配置 PRO_URL
   - 测试应用正常启动
   - 验证商业版功能被跳过

3. **降级行为测试**：
   - 测试系统消息弹窗不显示
   - 测试数据导出功能禁用
   - 测试用户通知静默跳过

### 测试配置

```typescript
// vitest.config.mts
export default defineConfig({
  test: {
    // 属性测试最少 100 次迭代
    // 每个测试标记：Feature: fastgpt-pro-integration, Property N: ...
  }
});
```

