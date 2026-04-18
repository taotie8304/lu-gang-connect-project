# 设计文档 - 知识库自动更新功能

## 概述

本文档描述知识库自动更新功能的技术设计。该功能允许系统自动检测数据源更新，并在发现新数据时自动下载并导入到知识库。

## 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端界面                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ 配置面板     │  │ 识别按钮     │  │ 更新历史     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        API 路由层                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ config.ts    │  │ trigger.ts   │  │ detect.ts    │     │
│  │ history.ts   │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      核心业务逻辑层                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ scraper.ts   │  │ detector.ts  │  │ downloader.ts│     │
│  │ (页面爬取)   │  │ (更新检测)   │  │ (文件下载)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐                                          │
│  │ scheduler.ts │                                          │
│  │ (定时任务)   │                                          │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据持久化层                            │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ MongoDB      │  │ 训练队列     │                        │
│  │ (配置存储)   │  │ (数据导入)   │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## 组件和接口

### 1. 数据库 Schema

#### DatasetCollection 扩展

```typescript
{
  autoUpdateConfig: {
    enabled: Boolean,              // 是否启用自动更新
    source: String,                // 数据源类型 ('hk-gov-data' | 'custom')
    datasetUrl: String,            // 数据集页面 URL
    fileFormat: String,            // 文件格式 ('csv' | 'xlsx' | 'xml' | 'api')
    
    // API 配置（当 fileFormat 为 'api' 时使用）
    api: {
      endpoint: String,            // API 端点
      method: String,              // HTTP 方法
      headers: Object,             // 请求头
      cacheKey: String             // 缓存键
    },
    
    // 检测配置
    detection: {
      yearPattern: [String],       // 年份匹配模式
      checkUpdateTime: Boolean,    // 是否检查更新时间
      detailPageCheck: Boolean     // 是否需要详情页检查
    },
    
    // 导入历史
    history: [
      {
        timestamp: Date,
        status: String,            // 'success' | 'failed'
        message: String,
        fileUrl: String,
        fileName: String,
        fileSize: Number
      }
    ],
    
    lastCheckTime: Date,           // 最后检查时间
    lastUpdateTime: Date,          // 最后更新时间
    
    // 通知设置
    notification: {
      enabled: Boolean,
      email: String
    }
  }
}
```

### 2. 页面爬取模块 (scraper.ts)

#### 接口定义

```typescript
interface ScrapedFileInfo {
  fileName: string;
  fileUrl: string;
  fileSize?: string;
  updateTime?: string;
  detailPageUrl?: string;
}

interface ScrapeResult {
  files: ScrapedFileInfo[];
  error?: string;
}

function scrapeDatasetPage(
  datasetUrl: string,
  fileFormat: string
): Promise<ScrapeResult>

function scrapeDetailPage(
  detailPageUrl: string
): Promise<string | null>
```

#### 实现要点

- 使用 cheerio 解析 HTML
- 支持相对路径和绝对路径的 URL 转换
- 提取文件名、大小、更新时间等元数据
- 识别详情页链接

### 3. 更新检测模块 (detector.ts)

#### 接口定义

```typescript
interface DetectionConfig {
  yearPattern?: string[];
  checkUpdateTime: boolean;
  detailPageCheck: boolean;
}

interface DetectionResult {
  isNewFile: boolean;
  reason: string;
  matchedFile?: ScrapedFileInfo;
}

function detectNewFile(
  files: ScrapedFileInfo[],
  config: DetectionConfig,
  lastUpdateTime?: Date
): DetectionResult

function detectByDetailPage(
  detailPageUpdateTime: string,
  lastUpdateTime?: Date
): DetectionResult

function checkApiUpdate(
  apiEndpoint: string,
  lastUpdateTime?: Date
): Promise<DetectionResult>
```

#### 检测策略

1. **一级检测：文件名年份匹配**
   - 生成当前年份的所有可能模式
   - 检查文件名是否包含当前年份
   - 支持格式：2025/26、2025-2026、2025至2026

2. **二级检测：更新时间对比**
   - 解析文件的更新时间
   - 与上次更新时间比较
   - 支持多种日期格式

3. **三级检测：详情页检查**
   - 访问详情页获取更详细信息
   - 提取更新时间字段
   - 作为最终判断依据

### 4. 文件下载模块 (downloader.ts)

#### 接口定义

```typescript
interface DownloadResult {
  success: boolean;
  rawText?: string;
  formatText?: string;
  fileSize?: number;
  error?: string;
}

function downloadAndParseFile(
  fileInfo: ScrapedFileInfo,
  fileFormat: string
): Promise<DownloadResult>

function downloadApiData(
  apiEndpoint: string,
  method: string,
  headers?: Record<string, string>
): Promise<DownloadResult>
```

#### 文件格式处理

- **CSV**: 使用 papaparse 解析，转换为 Markdown 表格
- **XLSX**: 使用 node-xlsx 解析，转换为 Markdown 表格
- **XML**: 读取原始文本
- **API**: 下载 JSON 数据，格式化为文本

### 5. 定时任务模块 (scheduler.ts)

#### 接口定义

```typescript
function startAutoUpdateScheduler(): void
function stopAutoUpdateScheduler(): void
function triggerAutoUpdate(collectionId: string): Promise<void>
```

#### 任务流程

```
1. 查找所有启用自动更新的集合
2. 对每个集合：
   a. 更新 lastCheckTime
   b. 根据 fileFormat 选择处理方式
   c. 执行更新检测
   d. 如果有更新，下载并导入数据
   e. 记录更新历史
3. 记录任务完成日志
```

### 6. API 路由

#### POST /api/core/dataset/collection/autoUpdate/config

配置自动更新

**请求体**:
```typescript
{
  collectionId: string;
  enabled: boolean;
  source?: string;
  datasetUrl?: string;
  fileFormat?: string;
  api?: {...};
  detection?: {...};
  notification?: {...};
}
```

**响应**:
```typescript
{
  success: boolean;
}
```

#### POST /api/core/dataset/collection/autoUpdate/trigger

手动触发更新

**请求体**:
```typescript
{
  collectionId: string;
}
```

**响应**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### POST /api/core/dataset/collection/autoUpdate/detect

识别数据集

**请求体**:
```typescript
{
  collectionId: string;
  datasetUrl: string;
}
```

**响应**:
```typescript
{
  success: boolean;
  files: Array<{
    fileName: string;
    format: string;
    fileUrl: string;
  }>;
  message: string;
}
```

#### GET /api/core/dataset/collection/autoUpdate/history

获取更新历史

**查询参数**:
```typescript
{
  collectionId: string;
}
```

**响应**:
```typescript
{
  enabled: boolean;
  lastCheckTime: Date;
  lastUpdateTime: Date;
  history: Array<{
    timestamp: Date;
    status: string;
    message: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
  }>;
}
```

## 数据模型

### 自动更新配置状态机

```
┌─────────┐
│ 未配置  │
└────┬────┘
     │ 配置启用
     ▼
┌─────────┐
│ 已启用  │◄──────┐
└────┬────┘       │
     │ 等待检查   │ 检查完成
     ▼            │
┌─────────┐       │
│ 检查中  │───────┘
└────┬────┘
     │ 发现更新
     ▼
┌─────────┐
│ 更新中  │
└────┬────┘
     │ 更新完成
     ▼
┌─────────┐
│ 已完成  │
└─────────┘
```

## 正确性属性

### Property 1: 配置持久化
*对于任何*有效的自动更新配置，保存后再查询应该返回相同的配置内容
**验证: 需求 1.2**

### Property 2: 页面爬取幂等性
*对于任何*数据集页面 URL，多次爬取应该返回相同的文件列表（在页面内容不变的情况下）
**验证: 需求 2.2**

### Property 3: 年份检测准确性
*对于任何*包含当前年份的文件名，系统应该能够正确识别为新文件
**验证: 需求 3.2**

### Property 4: 更新时间比较正确性
*对于任何*两个日期，如果日期 A 晚于日期 B，系统应该判定为有更新
**验证: 需求 3.4**

### Property 5: 文件下载完整性
*对于任何*可访问的文件 URL，下载的文件大小应该与服务器返回的 Content-Length 一致
**验证: 需求 5.1, 5.2, 5.3**

### Property 6: 数据导入一致性
*对于任何*成功下载的文件，导入到知识库后应该能够通过搜索找到相关内容
**验证: 需求 6.2**

### Property 7: 历史记录完整性
*对于任何*执行的更新操作，无论成功或失败，都应该在历史记录中留下记录
**验证: 需求 6.4, 6.5**

### Property 8: 定时任务可靠性
*对于任何*启用自动更新的集合，在定时任务执行时都应该被检查
**验证: 需求 7.3**

### Property 9: 权限验证严格性
*对于任何*没有写权限的用户，尝试配置或触发更新应该被拒绝
**验证: 需求 12.1, 12.2**

### Property 10: 错误隔离性
*对于任何*集合的更新失败，不应该影响其他集合的更新处理
**验证: 需求 11.6**

## 错误处理

### 错误类型

1. **网络错误**
   - 页面无法访问
   - 文件下载失败
   - API 请求超时

2. **解析错误**
   - HTML 解析失败
   - 文件格式不支持
   - 日期格式无法识别

3. **业务错误**
   - 权限不足
   - 配置无效
   - 数据导入失败

### 错误处理策略

- 所有错误都记录到日志
- 错误信息包含足够的上下文
- 用户友好的错误提示
- 不影响其他集合的处理

## 测试策略

### 单元测试

- 页面爬取功能测试
- 年份检测逻辑测试
- 日期解析功能测试
- 文件下载和解析测试

### 集成测试

- API 路由端到端测试
- 数据库操作测试
- 权限验证测试

### 属性测试

- 配置持久化属性测试（100次迭代）
- 年份检测准确性测试（100次迭代）
- 更新时间比较测试（100次迭代）

### 手动测试

- 使用真实的香港政府数据集测试
- 测试定时任务执行
- 测试前端界面交互

## 性能考虑

- 页面爬取使用合理的超时时间（30秒）
- 文件下载支持大文件（5分钟超时）
- 定时任务避开高峰时段（凌晨2点）
- 批量处理时使用异步操作

## 安全考虑

- 所有 API 都需要权限验证
- URL 验证防止 SSRF 攻击
- 文件大小限制防止 DoS 攻击
- 敏感信息不记录到日志
