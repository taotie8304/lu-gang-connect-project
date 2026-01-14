# 鲁港通 - 启用完整功能设计文档

## 设计概述

本设计文档描述如何安全地移除 FastGPT 中的 `feConfigs?.isPlus` 限制，使鲁港通平台具备完整功能。

## 修改策略

### 策略一：前端 UI 层修改

对于纯 UI 显示控制的代码，直接移除条件判断或将条件改为始终为真。

**修改模式:**
```typescript
// 修改前
{feConfigs?.isPlus && <Component />}

// 修改后 - 鲁港通 - 启用完整功能
{<Component />}
```

```typescript
// 修改前
const data = feConfigs?.isPlus ? fullData : limitedData;

// 修改后 - 鲁港通 - 启用完整功能
const data = fullData;
```

### 策略二：后端业务逻辑修改

对于影响业务逻辑的代码，需要仔细分析后修改。

**关键修改 - getTrainingModeByCollection 函数:**

```typescript
// 修改前
export const getTrainingModeByCollection = ({
  trainingType,
  autoIndexes,
  imageIndex
}: {
  trainingType: DatasetCollectionDataProcessModeEnum;
  autoIndexes?: boolean;
  imageIndex?: boolean;
}) => {
  if (
    trainingType === DatasetCollectionDataProcessModeEnum.imageParse &&
    global.feConfigs?.isPlus  // 限制条件
  ) {
    return TrainingModeEnum.imageParse;
  }
  // ...
};

// 修改后 - 鲁港通 - 启用图片解析/图片索引/自动索引
export const getTrainingModeByCollection = ({
  trainingType,
  autoIndexes,
  imageIndex
}: {
  trainingType: DatasetCollectionDataProcessModeEnum;
  autoIndexes?: boolean;
  imageIndex?: boolean;
}) => {
  if (trainingType === DatasetCollectionDataProcessModeEnum.imageParse) {
    return TrainingModeEnum.imageParse;
  }
  // ...
};
```

## 文件修改清单

### 第一优先级：后端核心逻辑

| 文件 | 修改内容 | 影响 |
|------|----------|------|
| `packages/service/core/dataset/collection/utils.ts` | 移除 getTrainingModeByCollection 中的 isPlus 判断 | 启用自动索引/图片索引/图片解析 |
| `packages/service/core/dataset/search/controller.ts` | 移除标签过滤的 isPlus 判断 | 启用搜索标签过滤 |

### 第二优先级：前端知识库功能

| 文件 | 修改内容 | 影响 |
|------|----------|------|
| `datasetPageContext.tsx` | 移除标签加载的 isPlus 判断 | 启用标签功能 |
| `CollectionCard/index.tsx` | 移除标签显示的 isPlus 判断 | 显示集合标签 |

### 第三优先级：前端发布功能

| 文件 | 修改内容 | 影响 |
|------|----------|------|
| `Publish/Link/index.tsx` | 移除高级配置的 isPlus 判断 | 启用过期时间/QPM/Token认证 |
| `Publish/Wecom/index.tsx` | 移除 isPlus 判断 | 启用企业微信发布 |
| `Publish/OffiAccount/index.tsx` | 移除 isPlus 判断 | 启用公众号发布 |
| `Publish/DingTalk/index.tsx` | 移除 isPlus 判断 | 启用钉钉发布 |
| `Publish/FeiShu/index.tsx` | 移除 isPlus 判断 | 启用飞书发布 |

### 第四优先级：前端工作流功能

| 文件 | 修改内容 | 影响 |
|------|----------|------|
| `RenderInput/index.tsx` | 移除 Pro 输入过滤 | 显示所有节点输入选项 |

### 第五优先级：前端其他功能

| 文件 | 修改内容 | 影响 |
|------|----------|------|
| `TeamPlanStatusCard.tsx` | 移除运营广告判断 | 显示/隐藏广告 |
| `Container.tsx` | 移除模板列表判断 | 显示完整模板 |
| `LoginForm.tsx` | 移除社区版判断 | 调整登录逻辑 |
| `HomeChatWindow.tsx` | 移除聊天窗口判断 | 启用完整聊天功能 |
| `ChatSetting/index.tsx` | 移除聊天设置判断 | 启用完整设置 |
| `ModelConfigTable.tsx` | 移除计费显示判断 | 显示模型计费 |
| `ModelDashboard/*.tsx` | 移除成本显示判断 | 显示成本统计 |
| `AddModelBox.tsx` | 移除价格设置判断 | 启用价格配置 |
| `AccountContainer.tsx` | 移除账户标签判断 | 显示完整账户页 |
| `ProTip/*.tsx` | 移除 Pro 提示 | 隐藏升级提示 |

## 注释规范

所有修改必须添加注释，格式为：
```typescript
// 鲁港通 - [功能描述]
```

**示例:**
```typescript
// 鲁港通 - 启用自动索引功能
// 鲁港通 - 启用图片索引功能
// 鲁港通 - 启用标签管理
// 鲁港通 - 启用高级发布配置
// 鲁港通 - 显示完整日志统计
```

## 依赖关系

```
后端 getTrainingModeByCollection
    ↓
前端 CollectionChunkForm (自动索引/图片索引选项)
    ↓
数据处理流程 (实际执行索引)
```

**重要:** 如果只修改前端而不修改后端，用户虽然能看到并选择自动索引/图片索引选项，但实际处理时会降级为普通 chunk 模式。

## 回滚方案

1. 已创建备份分支: `backup-before-isplus-removal-20260114`
2. 回滚命令:
   ```bash
   git checkout backup-before-isplus-removal-20260114
   # 或者
   git revert <commit-hash>
   ```

## 部署注意事项

1. 修改后需要重新构建前端和后端镜像
2. 部署顺序: 先部署后端，再部署前端
3. 部署后需要清除浏览器缓存测试
