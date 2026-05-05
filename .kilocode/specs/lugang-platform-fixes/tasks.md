# 鲁港通 - 启用完整功能任务清单

## 任务状态说明
- [ ] 待处理
- [x] 已完成
- [!] 需要注意

## 阶段一：后端核心逻辑修改（最高优先级）

### Task 1.1: 修改训练模式判断函数
- [x] 文件: `lugang-ai/packages/service/core/dataset/collection/utils.ts`
- [x] 修改 `getTrainingModeByCollection` 函数
- [x] 移除 imageParse 模式的 isPlus 判断
- [x] 移除 image 模式的 isPlus 判断
- [x] 移除 auto 模式的 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 启用图片解析/图片索引/自动索引`
- [x] 关联: US-1 (AC1, AC2, AC3)

### Task 1.2: 修改搜索控制器
- [x] 文件: `lugang-ai/packages/service/core/dataset/search/controller.ts`
- [x] 移除标签过滤的 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 启用标签过滤功能`
- [x] 关联: US-1 (AC4)

## 阶段二：前端知识库功能修改

### Task 2.1: 修改知识库页面上下文
- [x] 文件: `lugang-ai/projects/app/src/web/core/dataset/context/datasetPageContext.tsx`
- [x] 修改 `loadAllDatasetTags` 函数，移除 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 启用标签加载功能`
- [x] 关联: US-1 (AC4)

### Task 2.2: 修改集合卡片标签显示
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/dataset/detail/CollectionCard/index.tsx`
- [x] 移除标签显示的 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 显示集合标签`
- [x] 关联: US-1 (AC4)

## 阶段三：前端发布功能修改

### Task 3.1: 修改链接发布
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/app/detail/Publish/Link/index.tsx`
- [x] 移除表格列的 isPlus 判断（过期时间、IP限制、角色检查）
- [x] 移除编辑模态框的 isPlus 判断（过期时间、QPM、最大使用点数、Token认证）
- [x] 添加注释: `// 鲁港通 - 启用高级发布配置`
- [x] 关联: US-3 (AC1, AC2, AC3, AC4)

### Task 3.2: 修改企业微信发布
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/app/detail/Publish/Wecom/index.tsx`
- [x] 移除 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 显示高级发布配置`
- [x] 关联: US-3 (AC5)

### Task 3.3: 修改公众号发布
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/app/detail/Publish/OffiAccount/index.tsx`
- [x] 移除 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 显示高级发布配置`
- [x] 关联: US-3 (AC5)

### Task 3.4: 修改钉钉发布
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/app/detail/Publish/DingTalk/index.tsx`
- [x] 移除 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 显示高级发布配置`
- [x] 关联: US-3 (AC5)

### Task 3.5: 修改飞书发布
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/app/detail/Publish/FeiShu/index.tsx`
- [x] 移除 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 显示高级发布配置`
- [x] 关联: US-3 (AC5)

## 阶段四：前端工作流功能修改

### Task 4.1: 修改工作流节点输入渲染
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/app/detail/WorkflowComponents/Flow/nodes/render/RenderInput/index.tsx`
- [x] 修改 `filterProInputs` 逻辑，移除 isPlus 过滤
- [x] 添加注释: `// 鲁港通 - 显示所有节点输入选项`
- [x] 关联: US-6 (AC1)

## 阶段五：前端其他功能修改

### Task 5.1: 修改聊天窗口
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/chat/ChatWindow/HomeChatWindow.tsx`
- [x] 移除 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 启用首页聊天功能`

### Task 5.2: 修改聊天设置
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/chat/ChatSetting/index.tsx`
- [x] 移除 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 检查管理权限`

### Task 5.3: 修改模型配置表格
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/account/model/ModelConfigTable.tsx`
- [x] 移除计费显示的 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 显示模型计费信息`

### Task 5.4: 修改模型仪表盘
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/account/model/ModelDashboard/index.tsx`
- [x] 移除成本显示的 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 显示成本统计图表`

### Task 5.5: 修改添加模型框
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/account/model/AddModelBox.tsx`
- [x] 移除价格设置的 isPlus 判断
- [x] 移除内容审核配置的 isPlus 判断
- [x] 移除评估功能配置的 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 启用价格配置`

### Task 5.6: 修改账户容器
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/account/AccountContainer.tsx`
- [x] 移除账户标签的 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 启用团队和使用记录功能`

### Task 5.7: 移除 Pro 提示组件
- [x] 文件: `lugang-ai/projects/app/src/components/ProTip/ProModal.tsx`
- [x] 文件: `lugang-ai/projects/app/src/components/ProTip/ProText.tsx`
- [x] 修改或隐藏 Pro 升级提示
- [x] 添加注释: `// 鲁港通 - 隐藏升级提示`

### Task 5.8: 修改模板容器
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/dashboard/Container.tsx`
- [x] 移除模板列表的 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 启用应用评估功能`

### Task 5.9: 修改团队计划状态卡片
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/dashboard/TeamPlanStatusCard.tsx`
- [x] 移除运营广告的 isPlus 判断
- [x] 添加注释: `// 鲁港通 - 启用运营广告加载`

### Task 5.10: 修改登录表单
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/login/LoginForm/LoginForm.tsx`
- [x] 移除社区版判断 (isCommunityVersion)
- [x] 统一使用完整登录提示
- [x] 添加注释: `// 鲁港通 - 移除社区版判断，统一使用完整登录提示`

## 阶段六：已完成的修改（参考）

以下文件已在之前的工作中完成修改：

- [x] `components/support/apikey/Table.tsx` - API Key 管理
- [x] `components/Layout/index.tsx` - 布局组件
- [x] `components/common/folder/SlideCard.tsx` - 文件夹卡片
- [x] `components/support/permission/MemberManager/context.tsx` - 协作者功能
- [x] `pageComponents/app/detail/Logs/LogChart.tsx` - 日志图表
- [x] `pageComponents/app/detail/Logs/LogTable.tsx` - 日志表格
- [x] `pageComponents/app/detail/Logs/index.tsx` - 日志页面
- [x] `pageComponents/dataset/detail/Form/CollectionChunkForm.tsx` - 自动索引/图片索引
- [x] `pageComponents/dataset/detail/Info/index.tsx` - 定时同步
- [x] `pageComponents/dataset/detail/DataCard.tsx` - 标签功能
- [x] `pageComponents/dataset/detail/CollectionCard/Header.tsx` - 图片集合/标签/同步
- [x] `pages/dataset/list/index.tsx` - Web 站点同步

### 本次会话新增修改的文件：

- [x] `components/ProTip/Tag.tsx` - 隐藏 Pro 标签
- [x] `pageComponents/account/model/ModelDashboard/DataTableComponent.tsx` - 显示积分消耗数据
- [x] `pageComponents/chat/slider/index.tsx` - 启用完整导航功能
- [x] `pageComponents/chat/slider/ChatSliderFooter.tsx` - 启用管理员设置功能
- [x] `pageComponents/app/detail/Publish/index.tsx` - 启用所有发布渠道
- [x] `web/core/chat/context/chatSettingContext.tsx` - 启用聊天设置功能
- [x] `web/core/app/api/template.ts` - 启用模板标签列表功能
- [x] `web/common/middle/tracks/utils.ts` - 启用数据追踪功能
- [x] `pages/api/common/tracks/push.ts` - 启用数据追踪API
- [x] `service/support/permission/auth/outLink.ts` - 启用外链认证功能
- [x] `service/common/frequencyLimit/api.ts` - 启用频率限制功能
- [x] `service/core/dataset/queues/datasetParse.ts` - 启用LLM段落处理功能
- [x] `packages/service/common/middle/tracks/utils.ts` - 启用数据追踪功能
- [x] `packages/service/common/system/constants.ts` - 启用完整功能（isProVersion返回true）

## 阶段七：测试验证

### Task 7.1: 功能测试
- [ ] 测试自动索引功能
- [ ] 测试图片索引功能
- [ ] 测试图片解析功能
- [ ] 测试标签管理功能
- [ ] 测试定时同步功能
- [ ] 测试 Web 站点同步
- [ ] 测试各发布渠道高级配置
- [ ] 测试工作流 Pro 节点输入

### Task 7.2: 回归测试
- [ ] 验证基础功能正常
- [ ] 验证已有数据正常显示
- [ ] 验证权限控制正常

## 阶段八：部署

### Task 8.1: 构建部署
- [ ] 提交代码到 GitHub
- [ ] 构建前端镜像
- [ ] 构建后端镜像（如有后端修改）
- [ ] 部署到服务器
- [ ] 清除缓存测试

## 注意事项

1. **修改顺序**: 建议先完成后端修改（阶段一），再进行前端修改
2. **测试环境**: 建议先在测试环境验证，再部署到生产环境
3. **回滚准备**: 确保备份分支可用，随时可以回滚
4. **注释规范**: 所有修改必须添加 `// 鲁港通 - xxx` 格式的注释
