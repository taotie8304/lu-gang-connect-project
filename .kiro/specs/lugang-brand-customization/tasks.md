# Implementation Plan: 鲁港通品牌定制化

## Overview

本任务列表将 Lobe Chat 从版本 1.82.8 升级到 1.143.2，并完成鲁港通品牌定制化。任务按照依赖关系排序，确保增量开发和持续验证。

## Tasks

- [x] 1. 版本升级准备
  - [x] 1.1 备份当前 lugang-chat-custom 目录
    - 创建完整备份以便回滚
    - _Requirements: 11.1_
  - [x] 1.2 将 lobe-chat-1.143.2 复制为新的工作目录 lugang-chat-v2
    - 保留原始新版本作为参考
    - _Requirements: 11.1_
  - [x] 1.3 更新 package.json 项目信息
    - 修改 name 为 "@lugang/chat"
    - 修改 description 为鲁港通描述
    - 修改 author 为鲁港通团队
    - 修改 homepage 和 repository 信息
    - _Requirements: 3.5, 12.1_

- [x] 2. 品牌配置模块定制
  - [x] 2.1 修改 packages/const/src/branding.ts
    - 设置 BRANDING_NAME = '鲁港通AI'
    - 设置 LOBE_CHAT_CLOUD = '鲁港通云服务'
    - 设置 ORG_NAME = '鲁港通'
    - 设置 BRANDING_LOGO_URL
    - 添加 COPYRIGHT 信息
    - 清空 SOCIAL_URL 中的所有外部链接
    - 更新 BRANDING_EMAIL 为鲁港通邮箱
    - _Requirements: 3.1, 3.4, 9.4, 10.3_
  - [x] 2.2 更新 src/const/url.ts
    - 移除所有 lobehub.com 相关 URL
    - 更新 OFFICIAL_SITE 为鲁港通官网
    - 更新 BLOG、PRIVACY_URL、TERMS_URL
    - _Requirements: 3.1, 9.3, 10.3_

- [x] 3. 禁用远程资源拉取
  - [x] 3.1 修改 src/envs/app.ts
    - 将 ASSISTANT_INDEX_URL 默认值设为空字符串
    - 将 PLUGINS_INDEX_URL 默认值设为空字符串
    - _Requirements: 7.1, 7.4, 7.5_
  - [x] 3.2 更新环境变量配置文件
    - 在 .env.example 中添加禁用远程资源的配置说明
    - _Requirements: 7.3_

- [x] 4. Checkpoint - 基础配置验证
  - 确保项目可以正常构建
  - 验证品牌名称显示正确
  - 确认无远程资源请求

- [x] 5. 模型提供商配置
  - [x] 5.1 禁用境外模型提供商
    - 修改 src/config/modelProviders/index.ts
    - 移除或禁用 OpenAI、Azure、Anthropic、Google 等提供商的导出
    - 保留 DeepSeek 和 Qwen 提供商
    - _Requirements: 1.6, 2.1, 2.3_
  - [x] 5.2 配置默认模型
    - 更新 DEFAULT_AGENT_CONFIG 默认值为 "model=qwen-max"
    - _Requirements: 1.4_
  - [x] 5.3 移除 LobeHub 云服务提供商
    - 删除或禁用 src/config/modelProviders/lobehub.ts
    - _Requirements: 2.3, 9.3_

- [x] 6. 关于页面定制
  - [x] 6.1 修改 src/app/[variants]/(main)/settings/about/index.tsx
    - 移除 GitHub、Discord、Twitter、Medium 等外部链接
    - 更新联系方式为鲁港通信息
    - _Requirements: 3.1, 9.1, 9.4, 10.1, 10.2_
  - [x] 6.2 更新版本显示组件
    - 修改 about/features/Version.tsx
    - 显示鲁港通版本信息
    - _Requirements: 3.4_

- [x] 7. 界面元素清理
  - [x] 7.1 移除页面左下角外部链接
    - 查找并修改 SideBar 或 Footer 组件
    - 移除 GitHub、Discord 等链接图标
    - _Requirements: 5.1, 5.2, 9.1, 10.1_
  - [x] 7.2 隐藏扩展插件市场入口
    - 修改发现页面或设置页面
    - 隐藏指向 Lobe 插件市场的入口
    - _Requirements: 5.2, 5.4_
  - [x] 7.3 移除设置页面中的 OpenAI 相关选项
    - 修改语音服务设置
    - 移除 OpenAI Audio 选项
    - _Requirements: 2.1, 8.1, 8.2_

- [x] 8. Checkpoint - 界面验证
  - 确保所有页面无 Lobe/OpenAI 品牌显示
  - 验证模型选择器只显示指定模型
  - 确认外部链接已移除

- [x] 9. 发现页面重构
  - [x] 9.1 创建新闻资讯数据模型
    - 在 src/types/ 下创建 news.ts
    - 定义 NewsArticle 和 NewsCategory 类型
    - _Requirements: 4.1, 4.3_
  - [x] 9.2 创建 RSS 解析服务
    - 在 src/services/ 下创建 news.ts
    - 实现香港政府新闻 RSS 解析
    - _Requirements: 4.1, 4.4_
  - [x] 9.3 重构发现页面组件
    - 修改 src/app/[variants]/(main)/discover/
    - 替换助手市场为新闻资讯列表
    - 添加分类筛选功能
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 10. 静态资源更新
  - [x] 10.1 替换 favicon 和 Logo
    - 更新 public/favicon.ico
    - 更新 public/apple-touch-icon.png
    - 添加鲁港通 Logo 图片
    - _Requirements: 3.4, 10.5_
  - [x] 10.2 更新 manifest.webmanifest
    - 修改应用名称为鲁港通AI
    - 更新图标引用
    - _Requirements: 3.4_

- [x] 11. 本地化文件更新
  - [x] 11.1 更新 locales/zh-CN/ 翻译文件
    - 将所有 "LobeChat" 替换为 "鲁港通AI"
    - 将所有 "Lobe" 替换为 "鲁港通"
    - _Requirements: 2.5, 12.3_
  - [x] 11.2 更新 locales/en-US/ 翻译文件
    - 保持英文界面的品牌一致性
    - _Requirements: 2.5_

- [x] 12. Checkpoint - 功能验证
  - 测试聊天功能是否正常
  - 测试发现页面新闻加载
  - 验证所有品牌元素已更新

- [x] 13. 代码级品牌清理
  - [x] 13.1 批量搜索替换 "LobeChat"
    - 使用脚本或 IDE 批量替换
    - 替换为 "鲁港通AI"
    - _Requirements: 2.5, 12.1_
  - [x] 13.2 批量搜索替换 "lobehub"
    - 移除或替换代码中的 lobehub 引用
    - 注意保留必要的包依赖引用
    - _Requirements: 2.4, 12.2_
  - [x] 13.3 清理注释中的品牌引用
    - 更新代码注释中的品牌信息
    - _Requirements: 12.3_
  - [x] 13.4 验证品牌清理完整性
    - 运行 grep 搜索验证
    - 确保无遗漏的第三方品牌引用
    - **Property 1: 代码品牌清理验证**
    - **Validates: Requirements 2.4, 2.5, 12.1-12.5**

- [x] 14. Docker 配置更新
  - [x] 14.1 更新 Dockerfile
    - 确保构建配置正确
    - _Requirements: 11.5_
  - [x] 14.2 更新 docker-compose.yml
    - 更新镜像名称为 lugang-chat
    - 配置正确的环境变量
    - _Requirements: 11.5_
  - [x] 14.3 更新 lugang-connect-enterprise/chatgpt-web/docker-compose.yml
    - 更新镜像引用
    - 确保环境变量配置正确
    - _Requirements: 11.5_

- [x] 15. Final Checkpoint - 完整性验证 ✅ 已完成
  - [x] 构建 Docker 镜像 - lugang-chat:v2 (724MB/140MB)
  - [x] 运行完整功能测试 - 容器启动成功，Next.js 服务正常运行
  - [x] 验证所有需求已满足
  - [x] 修复的问题：
    - ESLint: NewsCard.tsx, useNav.tsx, Version.tsx, news.ts
    - TypeScript: agent.ts (voice config), dalle/Render/index.tsx
    - 空 URL 处理: AssistantStore, PluginStore (防止无效 URL 构建)
    - 测试文件: app.test.ts (更新期望值)

## Notes

- 每个 Checkpoint 都是验证点，确保前面的任务正确完成
- 如果遇到问题，优先保证核心功能（聊天、模型调用）正常工作
- 品牌清理是关键任务，必须确保无遗漏
- 所有任务都是必需的，确保完整的品牌定制化
