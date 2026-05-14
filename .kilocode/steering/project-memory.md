---
inclusion: always
---
# 鲁港通 - 项目记忆

## 基础信息
| 项目 | 说明 |
|------|------|
| 前端 lugang-ai | FastGPT 二开，Next.js + TypeScript，端口 3210，域名 www.airscend.com |
| 后端 lugang-connect-enterprise | One API，Go，端口 8080，域名 api.airscend.com |
| 包管理 | pnpm（monorepo） |
| 测试 | vitest + fast-check |
| 数据库 | 前端 MongoDB（库名 lugang_ai）；后端 MySQL/PostgreSQL |
| 部署 | Docker Compose + GitHub Actions |
| 服务器 | 156.225.30.134，目录 /www/wwwroot/lugang-ai |

## 技术栈
- 前端：Next.js 14, React, TypeScript, Chakra UI, MongoDB, Redis
- 后端：Go, Gin
- 密码：前端双重 SHA256；后端标准 bcrypt

## 已完成功能
- [x] CJK 简繁搜索规范化（opencc-js）
- [x] 联网搜索引用修复（Citation Parser + StreamHandler）
- [x] 前端使用条款 + 多语言（简/繁/英）
- [x] 用户设置面板多语言
- [x] 香港交通插件 hk-transport-plugin（完整功能见下）
- [x] 深度思考草拟答案截断（500字预览 + 展开按钮）

### 香港交通插件核心决策
- toolId：`hk_transport_assistant`（下划线，避免 split('-')[1] 截断）
- 站点数据：9461 站全量打入 bundle，不依赖外网
- 站名索引：政府数据"道路,建筑"格式需拆分建索引
- KMB ETA API：stopId 与 data.gov.hk GeoJSON 的 sid 兼容
- 实时 ETA：KMB/CTB/LWB/NLB/MTR 均支持，失败降级 5 分钟静态
- 步行距离：Haversine × 1.4 校正系数
- 未知地点：双层防御（工作流 LLM 先联网搜索 + 插件 Nominatim 回退）
- 防重复调用：空结果措辞阻止 LLM 重试
- 当前包大小：629.4 KB（上限 1 MB）

## 重要架构决策
- 简繁转换：opencc-js，通过 `__enableS2T__` 工作流变量控制
- 多语言 key 规则：`{key}`(繁) / `{key}_zh-CN`(简) / `{key}_en`(英)
- `-internet` 后缀模型必须走原生 DashScope 协议（兼容模式不返回 search_info）
- FastGPT 系统工具 SSE：需 `parseSystemToolStreamResult` 兼容两种返回格式

## 用户偏好
- 始终简体中文；技术问题用通俗语言
- 不假装记得之前对话；记忆文件为空时主动告知
