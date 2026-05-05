# 鲁港通 - 启用完整功能规范

## 概述

鲁港通跨境AI智能平台基于 FastGPT 二次开发，需要启用所有被 `feConfigs?.isPlus` 条件限制的功能，使平台具备完整的企业级能力。

## 用户故事

### US-1: 知识库完整功能
**作为** 鲁港通平台用户  
**我希望** 能够使用知识库的所有高级功能  
**以便** 更高效地管理和检索企业知识

**验收标准:**
- [ ] AC1: 能够使用自动索引功能（Auto Index）
- [ ] AC2: 能够使用图片索引功能（Image Index）
- [ ] AC3: 能够使用图片解析功能（Image Parse）
- [ ] AC4: 能够使用标签管理功能
- [ ] AC5: 能够使用定时同步功能
- [ ] AC6: 能够创建 Web 站点同步知识库

### US-2: 应用日志完整功能
**作为** 鲁港通平台管理员  
**我希望** 能够查看完整的应用日志和统计信息  
**以便** 监控和分析应用使用情况

**验收标准:**
- [ ] AC1: 能够查看日志图表统计
- [ ] AC2: 能够按成员筛选日志
- [ ] AC3: 能够切换日志视图模式

### US-3: 发布渠道完整功能
**作为** 鲁港通平台用户  
**我希望** 能够使用所有发布渠道的高级配置  
**以便** 灵活控制应用的对外发布

**验收标准:**
- [ ] AC1: 链接发布支持过期时间设置
- [ ] AC2: 链接发布支持 QPM 限制
- [ ] AC3: 链接发布支持最大使用点数限制
- [ ] AC4: 链接发布支持 Token 认证
- [ ] AC5: 企业微信/钉钉/飞书/公众号发布功能可用

### US-4: API Key 完整功能
**作为** 鲁港通平台开发者  
**我希望** 能够管理 API Key 的完整配置  
**以便** 精细控制 API 访问权限

**验收标准:**
- [ ] AC1: 能够设置 API Key 过期时间
- [ ] AC2: 能够设置 API Key 使用点数限制

### US-5: 协作功能
**作为** 鲁港通平台团队成员  
**我希望** 能够使用协作者管理功能  
**以便** 与团队成员共享资源

**验收标准:**
- [ ] AC1: 文件夹卡片显示协作者信息
- [ ] AC2: 能够管理资源的协作者权限

### US-6: 工作流完整功能
**作为** 鲁港通平台用户  
**我希望** 能够使用工作流的所有节点输入类型  
**以便** 构建更复杂的自动化流程

**验收标准:**
- [ ] AC1: 工作流节点显示所有 Pro 级别输入选项

## 技术约束

### 前端修改原则
1. 移除 UI 层面的 `feConfigs?.isPlus` 条件判断
2. 保持代码结构不变，仅修改条件逻辑
3. 注释格式统一为 `// 鲁港通 - xxx`

### 后端修改原则
1. 后端服务中的 isPlus 限制涉及核心业务逻辑，需谨慎处理
2. 关键文件 `packages/service/core/dataset/collection/utils.ts` 中的 `getTrainingModeByCollection` 函数必须修改，否则自动索引/图片索引功能不会真正生效
3. 修改前必须创建备份分支

### 已创建备份
- 备份分支: `backup-before-isplus-removal-20260114`

## 影响范围

### 已完成修改的文件（12个）
1. `components/support/apikey/Table.tsx` - API Key 管理
2. `components/Layout/index.tsx` - 布局组件
3. `components/common/folder/SlideCard.tsx` - 文件夹卡片
4. `components/support/permission/MemberManager/context.tsx` - 协作者功能
5. `pageComponents/app/detail/Logs/LogChart.tsx` - 日志图表
6. `pageComponents/app/detail/Logs/LogTable.tsx` - 日志表格
7. `pageComponents/app/detail/Logs/index.tsx` - 日志页面
8. `pageComponents/dataset/detail/Form/CollectionChunkForm.tsx` - 自动索引/图片索引
9. `pageComponents/dataset/detail/Info/index.tsx` - 定时同步
10. `pageComponents/dataset/detail/DataCard.tsx` - 标签功能
11. `pageComponents/dataset/detail/CollectionCard/Header.tsx` - 图片集合/标签/同步
12. `pages/dataset/list/index.tsx` - Web 站点同步

### 待处理的前端文件
- `datasetPageContext.tsx` - 标签加载功能
- `TeamPlanStatusCard.tsx` - 运营广告
- `Container.tsx` - 模板列表
- `CollectionCard/index.tsx` - 集合卡片标签显示
- `LoginForm.tsx` - 社区版判断
- `HomeChatWindow.tsx` - 聊天窗口功能
- `ChatSetting/index.tsx` - 聊天设置
- `ModelConfigTable.tsx` - 模型计费显示
- `ModelDashboard/DataTableComponent.tsx` - 模型仪表盘成本显示
- `ModelDashboard/index.tsx` - 成本图表
- `RenderInput/index.tsx` - 工作流节点 Pro 输入过滤
- `AddModelBox.tsx` - 添加模型价格设置
- `Publish/Wecom/index.tsx` - 企业微信发布
- `Publish/OffiAccount/index.tsx` - 公众号发布
- `Publish/Link/index.tsx` - 链接发布
- `Publish/DingTalk/index.tsx` - 钉钉发布
- `Publish/FeiShu/index.tsx` - 飞书发布
- `AccountContainer.tsx` - 账户页面标签
- `ProTip/ProModal.tsx` - Pro 提示模态框
- `ProTip/ProText.tsx` - Pro 提示文本

### 待处理的后端文件（关键）
- `packages/service/core/dataset/collection/utils.ts` - **训练模式判断（最关键）**
- `packages/service/core/dataset/search/controller.ts` - 搜索控制器标签过滤
- `packages/service/common/system/constants.ts` - isProVersion 函数
- `packages/service/common/middle/tracks/utils.ts` - 追踪功能

## 风险评估

### 高风险
- 后端 `getTrainingModeByCollection` 函数修改会影响数据处理流程
- 需要充分测试自动索引、图片索引、图片解析功能

### 中风险
- 发布渠道的高级配置可能依赖后端验证
- 需要验证前后端配置一致性

### 低风险
- 纯 UI 显示类的修改（如隐藏 ProTag、显示更多选项）

## 测试计划

### 功能测试
1. 创建知识库并测试自动索引功能
2. 上传图片测试图片索引功能
3. 创建 Web 站点同步知识库
4. 测试标签管理功能
5. 测试定时同步功能
6. 测试各发布渠道的高级配置

### 回归测试
1. 确保基础功能不受影响
2. 确保已有数据正常显示
3. 确保权限控制正常工作
