---
description: 后端 Go / One API 二开专项规范
globs:
  - "lugang-connect-enterprise/**/*.go"
  - "lugang-connect-enterprise/**/*.sql"
alwaysApply: false
---

# 后端架构约束（One API 二开）

## 架构红线
- 严禁修改 One API 核心验签逻辑（`middleware/auth.go` 等），任何新功能必须在现有鉴权体系外层叠加。
- 新增模型渠道时，必须遵循 `model/channel.go` 中已有的结构定义，不得新增不兼容字段。
- 所有数据库操作必须通过 GORM 进行，禁止裸写 SQL（工具脚本除外）。
- 数据库表结构变更必须通过迁移文件（Migration），禁止直接 `ALTER TABLE`。

## API 开发规范
- 所有对外接口必须遵循 RESTful 标准，返回统一格式：
  ```go
  // 鲁港通 - 标准响应结构
  type Response struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data"`
  }
  ```
- 接口必须区分 `code: 0`（成功）和非 0（失败），禁止用 HTTP 状态码传递业务错误。
- 调用外部 API（香港政府 API、山东政府 API 等）时：
  - 必须设置超时（默认 8 秒）：`client.Timeout = 8 * time.Second`
  - 必须加入重试机制（最多 3 次，间隔指数退避）
  - 必须对返回数据进行类型断言，防止格式突变导致 panic

## 联网搜索模型特殊规则
- 带 `-internet` 后缀的模型（如 `qwen-plus-internet`）必须走**原生 DashScope 协议**，不能用 OpenAI 兼容模式。
  - 原因：兼容模式 SSE 流不返回 `search_info` 字段，导致前端引用丢失。
- 非联网的 Qwen3.5 / QwQ / Qwen3 系列继续走兼容模式，以支持 `reasoning_content`。

## 密码与安全
- 后端密码统一使用 `bcrypt.GenerateFromPassword`（标准 bcrypt），禁止使用 SHA256 或 MD5。
- 环境变量中的密钥（`MYSQL_PASSWORD`、`REDIS_PASSWORD` 等）禁止硬编码进代码，只能通过 `.env` 或 Docker 环境变量注入。

## 日志规范
- 关键节点（模型调用、用户注册、渠道切换、外部 API 调用）必须打印结构化日志。
- 日志格式：`[鲁港通] [模块名] 操作说明 | 参数: xxx | 结果: xxx`
- 错误日志必须包含完整堆栈信息（`%+v` 格式）。
