---
description: 鲁港通项目命名规范与注释约定
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.go"
alwaysApply: false
---

# 品牌与服务命名

- 中文品牌名：鲁港通。
- 英文品牌名：Lugang Connect。
- 繁体品牌名：魯港通。
- 项目完整名称：鲁港通跨境AI智能平台。

## 服务命名约定（摘要）

- 前端服务：
  - 全称：鲁港通跨境AI智能服务助手。
  - 简称：鲁港通前端。
  - 域名：`www.airscend.com`。
  - 端口：3210。
  - Docker 容器名：`lugang-ai-app`，镜像名：`lugang-ai`。
- 后端服务：
  - 全称：鲁港通跨境AI智能服务后端。
  - 简称：鲁港通后端。
  - 域名：`api.airscend.com`。
  - 端口：8080。
  - Docker 容器名：`lugang-enterprise`，镜像名：`lugang-enterprise`。

# 代码注释与日志

- 代码注释统一使用前缀：`// 鲁港通 - xxx`。
- 不得在注释或日志中使用“FastGPT”、“One API”等作为对外品牌名称。
- 日志输出示例：
  - `addLog.info('鲁港通后端用户创建成功', { username });`
  - `addLog.warn('鲁港通后端请求失败', { url, status });`

# 依赖包命名说明

- `@fastgpt/*` 是技术依赖路径，不能修改，这不是品牌命名。
- 涉及这些包名时，只能在代码层面使用，不得用作对用户的产品名称。