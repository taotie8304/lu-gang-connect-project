---
inclusion: always
---

# 鲁港通项目命名规范

## 品牌名称

- **中文品牌名**: 鲁港通
- **英文品牌名**: Lugang Connect
- **繁体中文品牌名**: 魯港通
- **完整名称**: 鲁港通跨境AI智能平台

## 服务命名

### 鲁港通前端
- **全称**: 鲁港通跨境AI智能服务助手
- **简称**: 鲁港通前端
- **技术基础**: 基于 FastGPT 二开
- **域名**: www.airscend.com
- **端口**: 3210
- **Docker 容器名**: lugang-ai-app
- **Docker 镜像名**: lugang-ai

### 鲁港通后端
- **全称**: 鲁港通跨境AI智能服务后端
- **简称**: 鲁港通后端
- **技术基础**: 基于 One API
- **域名**: api.airscend.com
- **端口**: 8080
- **Docker 容器名**: lugang-oneapi
- **Docker 镜像名**: lugang-oneapi

## 代码注释规范

在代码注释中使用以下命名：

```typescript
// ✅ 正确示例
/**
 * 鲁港通 - 用户同步服务
 * 用于与鲁港通后端进行用户同步
 */

// ❌ 避免使用
/**
 * One API 集成服务
 * FastGPT 用户同步
 */
```

## 环境变量命名

虽然环境变量名保持原有格式（如 `ONE_API_URL`），但注释应使用鲁港通命名：

```bash
# 鲁港通后端配置
ONE_API_URL=https://api.airscend.com
ONE_API_TOKEN=sk-xxx
```

## 日志输出

日志中使用中文命名：

```typescript
addLog.info('鲁港通后端用户创建成功', { username });
addLog.warn('鲁港通后端请求失败', { url, status });
```

## 包名说明

- `@fastgpt/*` 是代码依赖路径，**不能修改**
- 这些是技术依赖，不是品牌名称
