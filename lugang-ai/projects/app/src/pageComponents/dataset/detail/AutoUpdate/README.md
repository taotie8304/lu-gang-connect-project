# 知识库自动更新功能 - 前端组件

## 概述

本目录包含知识库自动更新功能的前端组件，允许用户配置和管理知识库集合的自动更新。

## 组件结构

### 主组件

- **index.tsx** - 自动更新配置主页面
  - 启用/禁用开关
  - 数据源 URL 输入
  - 文件格式选择
  - 检测策略配置
  - 保存和手动触发按钮
  - 更新历史显示

### 子组件

- **DetectModal.tsx** - 数据集识别结果弹窗
  - 显示识别到的文件列表
  - 按格式分组显示
  - 支持选择文件

- **HistoryList.tsx** - 更新历史列表
  - 显示历史记录表格
  - 显示最后检查时间和更新时间
  - 支持状态标识（成功/失败）

## 使用方式

### 1. 访问自动更新配置

在知识库集合详情页（DataCard），点击"自动更新"按钮，会跳转到自动更新配置页面。

### 2. 配置自动更新

1. 启用自动更新开关
2. 输入数据集 URL
3. 点击"识别"按钮，系统会自动识别页面中的文件
4. 选择文件格式
5. 配置检测策略
6. 点击"保存"按钮

### 3. 手动触发更新

点击"立即更新"按钮，系统会立即执行一次更新检查。

### 4. 查看更新历史

在配置页面底部可以查看更新历史记录，包括：
- 更新时间
- 状态（成功/失败）
- 文件名
- 消息

## API 接口

### 获取配置
```typescript
GET /api/core/dataset/collection/autoUpdate/config?collectionId={id}
```

### 更新配置
```typescript
POST /api/core/dataset/collection/autoUpdate/config
Body: {
  collectionId: string;
  enabled: boolean;
  source?: string;
  datasetUrl?: string;
  fileFormat?: string;
  detection?: {...};
}
```

### 手动触发更新
```typescript
POST /api/core/dataset/collection/autoUpdate/trigger
Body: { collectionId: string }
```

### 识别数据集
```typescript
POST /api/core/dataset/collection/autoUpdate/detect
Body: {
  collectionId: string;
  datasetUrl: string;
}
```

### 获取更新历史
```typescript
GET /api/core/dataset/collection/autoUpdate/history?collectionId={id}
```

## 类型定义

所有类型定义位于 `src/web/core/dataset/type.d.ts`：

- `AutoUpdateConfigType` - 自动更新配置
- `AutoUpdateHistoryType` - 更新历史记录
- `AutoUpdateHistoryResponseType` - 历史响应
- `DetectResultType` - 识别结果

## 翻译

所有翻译文本位于 `packages/web/i18n/zh-CN/dataset.json`，包括：

- `enable_auto_update` - 启用自动更新
- `dataset_url` - 数据集 URL
- `file_format` - 文件格式
- `detection_strategy` - 检测策略
- `trigger_update_now` - 立即更新
- `detect` - 识别
- `update_history` - 更新历史
- 等等...

## 注意事项

1. 自动更新功能需要集合的写权限
2. 定时任务在每月1号凌晨2点自动执行
3. 支持的文件格式：CSV、XLSX、XML、API
4. 检测策略包括年份匹配、更新时间比较、详情页检查
