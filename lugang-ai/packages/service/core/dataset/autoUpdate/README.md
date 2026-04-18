# 鲁港通 - 知识库自动更新功能

## 功能概述

这个模块为鲁港通知识库提供自动更新功能，特别针对香港政府开放数据集的定期更新需求。系统会自动检测数据源是否有更新，并在发现新数据时自动下载并导入到知识库。

## 核心功能

### 1. 页面爬取 (scraper.ts)
- 爬取香港政府数据集页面
- 自动识别 CSV、XLSX、XML 文件链接
- 提取文件名、文件大小、更新时间等信息
- 支持详情页深度检查

### 2. 更新检测 (detector.ts)
- **一级检测**：文件名年份匹配（支持多种格式：2025/26、2025-2026、2025至2026）
- **二级检测**：更新时间对比
- **三级检测**：详情页更新时间检查
- **API 检测**：通过 HTTP Header 的 Last-Modified 判断 API 是否更新

### 3. 文件下载 (downloader.ts)
- 下载 CSV、XLSX、XML 文件
- 自动解析文件内容
- 转换为知识库可用的格式
- 支持 API 数据下载

### 4. 定时任务 (scheduler.ts)
- 每月1号凌晨2点自动执行
- 遍历所有启用自动更新的知识库
- 记录更新历史
- 支持手动触发更新

## 数据库 Schema

在 `DatasetCollection` 中添加了 `autoUpdateConfig` 字段：

```typescript
{
  enabled: Boolean,              // 是否启用
  source: String,                // 数据源类型
  datasetUrl: String,            // 数据集页面 URL
  fileFormat: String,            // 文件格式 (csv/xlsx/xml/api)
  api: {                         // API 配置
    endpoint: String,
    method: String,
    headers: Object,
    cacheKey: String
  },
  detection: {                   // 检测配置
    yearPattern: [String],
    checkUpdateTime: Boolean,
    detailPageCheck: Boolean
  },
  history: [                     // 更新历史
    {
      timestamp: Date,
      status: String,
      message: String,
      fileUrl: String,
      fileName: String,
      fileSize: Number
    }
  ],
  lastCheckTime: Date,           // 最后检查时间
  lastUpdateTime: Date,          // 最后更新时间
  notification: {                // 通知设置
    enabled: Boolean,
    email: String
  }
}
```

## API 路由

### 1. 配置自动更新
```
POST /api/core/dataset/collection/autoUpdate/config
```

### 2. 手动触发更新
```
POST /api/core/dataset/collection/autoUpdate/trigger
```

### 3. 识别数据集
```
POST /api/core/dataset/collection/autoUpdate/detect
```

### 4. 获取更新历史
```
GET /api/core/dataset/collection/autoUpdate/history
```

## 使用流程

### 1. 配置自动更新
```javascript
// 前端调用 API
await fetch('/api/core/dataset/collection/autoUpdate/config', {
  method: 'POST',
  body: JSON.stringify({
    collectionId: 'xxx',
    enabled: true,
    source: 'hk-gov-data',
    datasetUrl: 'https://data.gov.hk/tc-data/dataset/...',
    fileFormat: 'csv',
    detection: {
      yearPattern: ['2025/26', '2025-2026'],
      checkUpdateTime: true,
      detailPageCheck: true
    }
  })
});
```

### 2. 识别数据集（可选）
```javascript
// 自动识别页面中的数据文件
const result = await fetch('/api/core/dataset/collection/autoUpdate/detect', {
  method: 'POST',
  body: JSON.stringify({
    collectionId: 'xxx',
    datasetUrl: 'https://data.gov.hk/tc-data/dataset/...'
  })
});
// 返回识别到的文件列表
```

### 3. 等待自动更新
- 系统每月1号凌晨2点自动检查
- 或手动触发更新

### 4. 查看更新历史
```javascript
const history = await fetch('/api/core/dataset/collection/autoUpdate/history?collectionId=xxx');
```

## 更新策略

### 文件类型 (CSV/XLSX/XML)
1. 爬取数据集页面
2. 一级检测：文件名年份匹配
3. 二级检测：更新时间对比
4. 三级检测：详情页检查（如果需要）
5. 下载并解析文件
6. 导入到知识库

### API 类型
1. 检查 API 的 Last-Modified 头
2. 如果有更新，下载 API 数据
3. 导入到知识库（作为缓存更新）

## 技术依赖

- **cheerio**: 页面爬取和解析
- **node-cron**: 定时任务
- **axios**: HTTP 请求
- **papaparse**: CSV 解析
- **node-xlsx**: XLSX 解析

## 初始化

在应用启动时自动初始化：

```typescript
// lugang-ai/projects/app/src/instrumentation.ts
import { initAutoUpdate } from '@fastgpt/service/core/dataset/autoUpdate';

// 在系统启动后调用
initAutoUpdate();
```

## 注意事项

1. **更新频率**：固定为每月一次，不可配置
2. **文件格式**：支持 CSV、XLSX、XML、API
3. **检测策略**：文件名 + 更新时间双重验证
4. **历史记录**：每次更新都会记录到数据库
5. **错误处理**：更新失败会记录错误信息，不影响其他集合

## 前端界面（待实现）

需要在知识库管理界面添加：
1. 自动更新配置面板
2. "识别 API" 按钮
3. 更新历史显示
4. 手动触发更新按钮

## 测试

运行测试脚本：
```bash
node test-auto-update.js
```

## 未来扩展

1. 支持更多数据源（不仅限于香港政府）
2. 可配置的更新频率
3. 邮件通知功能
4. 更智能的文件识别算法
5. 增量更新（只更新变化的部分）
