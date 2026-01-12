# Implementation Plan: 鲁港通品牌化

## Overview

本实施计划将 FastGPT 项目品牌化为"鲁港通跨境AI智能平台"，按照配置优先、国际化次之、代码最后的顺序进行修改。

## Tasks

- [x] 1. 配置文件品牌化
  - [x] 1.1 更新 config.json 中的 systemTitle 和相关配置
    - 修改 `projects/app/data/config.json`
    - 设置 `systemTitle` 为 "鲁港通跨境AI智能平台"
    - 确保 `show_git`, `show_appStore`, `show_promotion` 为 false
    - 清空或更新 `docUrl`
    - _Requirements: 1.1, 3.4_
  
  - [x] 1.2 更新 package.json 项目名称
    - 修改根目录和子项目的 `package.json`
    - 更新 `name` 字段为 `lugang-ai-*`
    - _Requirements: 1.2_

- [x] 2. 国际化文件品牌化
  - [x] 2.1 修改中文国际化文件 (zh-CN)
    - 修改 `packages/web/i18n/zh-CN/common.json`
    - 修改 `packages/web/i18n/zh-CN/chat.json`
    - 修改 `packages/web/i18n/zh-CN/app.json`
    - 修改 `packages/web/i18n/zh-CN/account_model.json`
    - 将所有 "FastGPT" 替换为 "鲁港通"
    - 删除或替换所有外部链接
    - _Requirements: 7.1, 3.1, 3.2, 3.3_
  
  - [x] 2.2 修改英文国际化文件 (en)
    - 修改 `packages/web/i18n/en/common.json`
    - 修改 `packages/web/i18n/en/chat.json`
    - 修改 `packages/web/i18n/en/app.json`
    - 修改 `packages/web/i18n/en/account_model.json`
    - 将所有 "FastGPT" 替换为 "Lugang Connect"
    - _Requirements: 7.2_
  
  - [x] 2.3 修改繁体中文国际化文件 (zh-Hant)
    - 修改 `packages/web/i18n/zh-Hant/common.json`
    - 修改 `packages/web/i18n/zh-Hant/chat.json`
    - 修改 `packages/web/i18n/zh-Hant/app.json`
    - 修改 `packages/web/i18n/zh-Hant/account_model.json`
    - 将所有 "FastGPT" 替换为 "魯港通"
    - _Requirements: 7.1, 7.3_

- [x] 3. 视觉资产替换
  - [x] 3.1 替换 favicon
    - 使用 `lugang_icon.png` 生成新的 `favicon.ico`
    - 替换 `projects/app/public/favicon.ico`
    - _Requirements: 2.2_
  
  - [x] 3.2 替换 Logo 图片
    - 使用 `lugang_connect_logo.png` 替换相关 Logo
    - 更新 `projects/app/public/imgs/` 下的 Logo 文件
    - _Requirements: 2.1, 2.3, 2.4_
  
  - [x] 3.3 更新聊天界面图片
    - 创建 `lugang_chat_diagram.png` 替换 FastGPT 聊天示意图
    - 更新 `projects/app/public/imgs/chat/` 目录
    - _Requirements: 2.1_

- [x] 4. 功能模块调整
  - [x] 4.1 隐藏插件市场入口
    - 修改侧边栏菜单配置
    - 通过配置或代码隐藏插件市场菜单项
    - 保留代码以便未来启用
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 4.2 隐藏模板市场入口
    - 修改侧边栏菜单配置
    - 通过配置或代码隐藏模板市场菜单项
    - 保留代码以便未来启用
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. 外部链接清理
  - [x] 5.1 清理代码中的 FastGPT 官方链接
    - 搜索并删除/替换 `doc.fastgpt.io` 链接
    - 搜索并删除/替换 `github.com/labring/FastGPT` 链接
    - 搜索并删除/替换 `fastgpt.in` 链接
    - 搜索并删除/替换 `fastgpt.io` 链接
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [-] 5.2 清理文档目录中的 FastGPT 引用（跳过 - 开发文档仅管理员可见）
    - `document/` 目录是技术开发文档，不影响用户界面
    - 保留原样，仅管理员有权限查看
    - _Requirements: 3.4_

- [x] 6. Checkpoint - 验证品牌化完成
  - ✅ 运行搜索验证无 FastGPT 品牌残留（用户界面相关）
  - ✅ 验证配置文件格式正确
  - ✅ 代码诊断无错误
  - ✅ `@fastgpt/*` 包依赖路径保持不变（代码内部依赖）
  - ✅ i18n key 名称保持不变（不影响用户界面显示）

- [-] 7. 工具功能说明（无需单独文档）
  - **MCP 工具**: Model Context Protocol，让 AI 调用外部工具（搜索、数据库等）
  - **HTTP 工具**: 工作流中的 HTTP 请求节点，用于调用外部 API
  - **工作流工具**: 可视化编排 AI 对话流程，设置条件分支、循环等
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. 构建和部署配置更新
  - [x] 8.1 更新 Docker 相关配置
    - ✅ `docker-compose.yml` 已使用 lugang-ai 品牌
    - ✅ `docker-compose.prod.yml` 已使用 lugang-ai 品牌
    - _Requirements: 1.2_
  
  - [-] 8.2 更新 GitHub Actions 配置（目录为空，无需修改）
    - `.github/workflows/` 目录为空
    - _Requirements: 1.2_

- [x] 9. Final Checkpoint - 完整性验证
  - ✅ 品牌化验证完成
  - ✅ 所有用户界面相关的 FastGPT 引用已替换为鲁港通
  - ✅ 配置文件已更新
  - ✅ Docker 配置已品牌化
  - ✅ 代码无冲突，诊断无错误

## Notes

- 包名 `@fastgpt/*` 是代码依赖路径，不能修改
- `document/` 目录是开发文档，仅管理员可见，保留原样
- 修改完成后需要重新构建 Docker 镜像
- 建议在测试环境验证后再部署到生产环境

## 品牌化完成 ✅

下一步：创建新的 Spec 实现"港话通风格"的简洁用户界面
