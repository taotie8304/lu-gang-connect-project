# Design Document: 鲁港通品牌化

## Overview

本设计文档描述了将 FastGPT 开源项目品牌化为"鲁港通跨境AI智能平台"的技术方案。主要包括品牌名称替换、视觉资产更新、外部链接清理、功能模块调整等方面。

## Architecture

品牌化修改涉及以下层次：

```
┌─────────────────────────────────────────────────────────┐
│                    前端展示层                            │
│  ├── 页面标题 (systemTitle)                             │
│  ├── Logo/Favicon (public/imgs)                         │
│  ├── 国际化文本 (packages/web/i18n)                     │
│  └── 菜单配置 (侧边栏、导航)                            │
├─────────────────────────────────────────────────────────┤
│                    配置层                                │
│  ├── config.json (feConfigs)                            │
│  ├── 环境变量 (.env)                                    │
│  └── 构建配置 (package.json, Dockerfile)                │
├─────────────────────────────────────────────────────────┤
│                    代码层                                │
│  ├── 硬编码文本                                         │
│  ├── 外部链接                                           │
│  └── 注释/文档                                          │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 配置文件修改

**文件**: `projects/app/data/config.json`

```json
{
  "feConfigs": {
    "systemTitle": "鲁港通跨境AI智能平台",
    "show_git": false,
    "show_appStore": false,
    "show_promotion": false,
    "docUrl": "",
    "concatMd": "技术支持：鲁港通科技"
  }
}
```

### 2. 国际化文件修改

**目录**: `packages/web/i18n/`

需要修改的文件：
- `zh-CN/common.json` - 中文通用文本
- `zh-CN/chat.json` - 中文聊天相关
- `zh-CN/app.json` - 中文应用相关
- `en/common.json` - 英文通用文本
- `en/chat.json` - 英文聊天相关
- `en/app.json` - 英文应用相关
- `zh-Hant/` - 繁体中文相关

### 3. 视觉资产替换

**目录**: `projects/app/public/`

| 文件 | 用途 | 替换为 |
|------|------|--------|
| `favicon.ico` | 浏览器标签图标 | 鲁港通图标 |
| `imgs/logo.svg` | 主 Logo | 鲁港通 Logo |
| `imgs/chat/` | 聊天相关图片 | 鲁港通品牌图片 |

### 4. 菜单配置修改

隐藏以下菜单项：
- 插件市场入口
- 模板市场入口
- GitHub 链接
- 官方文档链接

## Data Models

本次修改不涉及数据模型变更，仅涉及前端展示和配置。

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 品牌名称完整替换

*For any* 代码文件或配置文件，搜索 "FastGPT" 字符串后，应该只在以下情况下存在：
1. 包名引用（如 `@fastgpt/global`）
2. 技术性注释（不影响用户界面）

**Validates: Requirements 1.2, 7.1, 7.2**

### Property 2: 外部链接完整清理

*For any* 代码文件，搜索以下域名后应返回空结果：
- `doc.fastgpt.io`
- `github.com/labring/FastGPT`
- `fastgpt.in`
- `fastgpt.io`

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: 配置一致性

*For any* 配置文件中的 `systemTitle` 字段，其值应为 "鲁港通跨境AI智能平台" 或包含 "鲁港通"。

**Validates: Requirements 1.1**

## Error Handling

- 如果国际化文件格式错误，构建时会报错
- 如果图片资源缺失，页面会显示空白或默认图标
- 配置文件语法错误会导致应用启动失败

## Testing Strategy

### 单元测试
- 验证配置文件格式正确
- 验证国际化文件 JSON 格式正确

### 集成测试
- 验证页面标题显示正确
- 验证 Logo 图片加载正确
- 验证菜单项显示/隐藏正确

### 手动验证
- 浏览所有主要页面，确认无 FastGPT 品牌残留
- 切换语言，确认品牌名称一致
- 检查浏览器控制台无 404 错误

## Implementation Notes

### 修改优先级

1. **高优先级**：配置文件（立即生效）
2. **中优先级**：国际化文件（影响用户界面）
3. **低优先级**：代码注释和文档（不影响功能）

### 注意事项

1. 包名 `@fastgpt/*` 不能修改，这是代码依赖路径
2. 数据库中可能存储了旧的品牌名称，需要数据迁移
3. 已部署的镜像需要重新构建才能生效
