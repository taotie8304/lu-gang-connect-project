---
inclusion: fileMatch: ["lugang-connect-enterprise/**", "*.go"]
---
# 后端规范（Go / One API）

## API 设计
- RESTful；版本前缀 `/api/v1/`
- 统一响应格式：`{ success, data, message }`
- HTTP 状态码语义化

## 数据库
- MySQL/PostgreSQL 用 GORM
- 修改表结构必须写迁移脚本
- 查询加索引，大表加分页

## 性能
- 数据库连接池；Redis 缓存热点数据
- 大量数据用流式处理，避免一次性加载

## 密码
- 标准 bcrypt 哈希（不用 SHA256）
