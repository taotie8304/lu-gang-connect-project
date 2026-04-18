# 部署检查清单

## 1. 依赖包检查

### ✅ 已安装的依赖包

在 `packages/service/package.json` 中：

```json
{
  "dependencies": {
    "cheerio": "1.0.0-rc.12",      // ✅ 页面爬取
    "node-cron": "^3.0.3",          // ✅ 定时任务
    "papaparse": "5.4.1",           // ✅ CSV 解析
    "node-xlsx": "^0.24.0",         // ✅ XLSX 解析
    "axios": "^1.12.1"              // ✅ HTTP 请求
  }
}
```

### 验证命令

```bash
cd lugang-ai
pnpm list cheerio node-cron papaparse node-xlsx axios
```

预期输出应显示所有包都已安装。

## 2. 数据库迁移检查

### ✅ Schema 已更新

在 `packages/service/core/dataset/collection/schema.ts` 中已添加：

```typescript
autoUpdateConfig: {
  enabled: Boolean,
  source: String,
  datasetUrl: String,
  fileFormat: String,
  api: { ... },
  detection: { ... },
  history: [ ... ],
  lastCheckTime: Date,
  lastUpdateTime: Date,
  notification: { ... }
}
```

### ⚠️ 需要创建的索引

为了优化查询性能，需要在 MongoDB 中创建索引：

```bash
# 连接到 MongoDB
docker exec -it lugang-ai-mongo mongosh lugang_ai

# 或者使用 mongo 命令（旧版本）
docker exec -it lugang-ai-mongo mongo lugang_ai
```

然后执行以下命令：

```javascript
// 创建自动更新索引
db.dataset_collections.createIndex(
  { "autoUpdateConfig.enabled": 1 },
  { name: "idx_auto_update_enabled", background: true, sparse: true }
);

db.dataset_collections.createIndex(
  { "autoUpdateConfig.enabled": 1, "autoUpdateConfig.lastCheckTime": -1 },
  { name: "idx_auto_update_check_time", background: true, sparse: true }
);

db.dataset_collections.createIndex(
  { "autoUpdateConfig.enabled": 1, "autoUpdateConfig.lastUpdateTime": -1 },
  { name: "idx_auto_update_update_time", background: true, sparse: true }
);

db.dataset_collections.createIndex(
  { teamId: 1, "autoUpdateConfig.enabled": 1 },
  { name: "idx_team_auto_update", background: true }
);

// 验证索引创建成功
db.dataset_collections.getIndexes();
```

### 数据库迁移脚本

如果需要为现有集合添加默认配置，可以运行：

```javascript
// 为所有集合添加 autoUpdateConfig 字段（如果不存在）
db.dataset_collections.updateMany(
  { autoUpdateConfig: { $exists: false } },
  { $set: { autoUpdateConfig: null } }
);
```

## 3. 环境变量配置

### ✅ 无需额外环境变量

自动更新功能使用现有的环境变量：

- `MONGODB_URI`: MongoDB 连接字符串（已配置）
- `REDIS_URL`: Redis 连接字符串（已配置）

### 可选配置

如果需要自定义定时任务时间，可以添加环境变量：

```bash
# .env.local
AUTO_UPDATE_CRON="0 2 1 * *"  # 默认：每月1号凌晨2点
```

但当前版本是硬编码的，不需要配置。

## 4. 文件结构检查

### ✅ 核心模块文件

```
lugang-ai/packages/service/core/dataset/autoUpdate/
├── scraper.ts              ✅ 页面爬取模块
├── detector.ts             ✅ 更新检测模块
├── downloader.ts           ✅ 文件下载模块
├── scheduler.ts            ✅ 定时任务模块
├── index.ts                ✅ 模块导出
├── README.md               ✅ 功能说明文档
├── DATABASE_OPTIMIZATION.md ✅ 数据库优化指南
├── CODE_REVIEW.md          ✅ 代码审查报告
└── DEPLOYMENT_CHECKLIST.md ✅ 部署检查清单（本文件）
```

### ✅ API 路由文件

```
lugang-ai/projects/app/src/pages/api/core/dataset/collection/autoUpdate/
├── config.ts               ✅ 配置自动更新
├── trigger.ts              ✅ 手动触发更新
├── detect.ts               ✅ 识别数据集
└── history.ts              ✅ 获取更新历史
```

### ✅ 系统集成文件

```
lugang-ai/projects/app/src/instrumentation.ts  ✅ 应用启动初始化
```

## 5. 系统集成检查

### ✅ 启动初始化

在 `projects/app/src/instrumentation.ts` 中已添加：

```typescript
import { initAutoUpdate } from '@fastgpt/service/core/dataset/autoUpdate';

export async function register() {
  // ... 其他初始化代码
  
  // 鲁港通 - 启动自动更新定时任务
  initAutoUpdate();
}
```

### 验证方法

启动应用后，检查日志中是否有：

```
鲁港通 - 自动更新定时任务已启动 (每月1号凌晨2点)
```

## 6. 权限配置检查

### ✅ API 权限验证

所有 API 路由都已实现权限验证：

- `config.ts`: 需要集合写权限
- `trigger.ts`: 需要集合写权限
- `detect.ts`: 需要集合读权限
- `history.ts`: 需要集合读权限

### 验证方法

测试未授权访问应返回 403 错误。

## 7. 前端界面检查

### ✅ 前端组件

```
lugang-ai/projects/app/src/components/core/dataset/AutoUpdateConfig/
├── index.tsx               ✅ 配置面板主组件
├── ConfigForm.tsx          ✅ 配置表单
├── DetectButton.tsx        ✅ 识别按钮
├── HistoryList.tsx         ✅ 历史记录列表
└── TriggerButton.tsx       ✅ 手动触发按钮
```

### 验证方法

1. 访问知识库集合详情页
2. 查看是否有"自动更新"标签页
3. 测试配置保存功能
4. 测试识别功能
5. 测试手动触发功能
6. 查看更新历史

## 8. 测试验证

### 单元测试

```bash
cd lugang-ai
pnpm test test-auto-update.js
```

### 集成测试

1. **配置测试**
   ```bash
   curl -X POST http://localhost:3210/api/core/dataset/collection/autoUpdate/config \
     -H "Content-Type: application/json" \
     -H "Cookie: token=YOUR_TOKEN" \
     -d '{
       "collectionId": "YOUR_COLLECTION_ID",
       "enabled": true,
       "datasetUrl": "https://data.gov.hk/...",
       "fileFormat": "csv"
     }'
   ```

2. **识别测试**
   ```bash
   curl -X POST http://localhost:3210/api/core/dataset/collection/autoUpdate/detect \
     -H "Content-Type: application/json" \
     -H "Cookie: token=YOUR_TOKEN" \
     -d '{
       "collectionId": "YOUR_COLLECTION_ID",
       "datasetUrl": "https://data.gov.hk/..."
     }'
   ```

3. **触发测试**
   ```bash
   curl -X POST http://localhost:3210/api/core/dataset/collection/autoUpdate/trigger \
     -H "Content-Type: application/json" \
     -H "Cookie: token=YOUR_TOKEN" \
     -d '{
       "collectionId": "YOUR_COLLECTION_ID"
     }'
   ```

4. **历史查询测试**
   ```bash
   curl "http://localhost:3210/api/core/dataset/collection/autoUpdate/history?collectionId=YOUR_COLLECTION_ID" \
     -H "Cookie: token=YOUR_TOKEN"
   ```

## 9. 性能监控

### 监控指标

1. **定时任务执行时间**
   - 查看日志中的执行时间
   - 预期：< 5 分钟（取决于集合数量）

2. **页面爬取速度**
   - 预期：< 5 秒/页面

3. **文件下载速度**
   - 预期：取决于文件大小和网络速度
   - 超时设置：5 分钟

4. **数据库查询性能**
   - 使用 `explain()` 分析查询
   - 预期：使用索引，< 100ms

### 监控命令

```javascript
// MongoDB 慢查询监控
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(10);
```

## 10. 日志检查

### 日志位置

- **应用日志**: Docker 容器日志
  ```bash
  docker logs -f lugang-ai
  ```

- **MongoDB 日志**: MongoDB 容器日志
  ```bash
  docker logs -f lugang-ai-mongo
  ```

### 关键日志

启动时应看到：
```
鲁港通 - 自动更新定时任务已启动 (每月1号凌晨2点)
```

执行时应看到：
```
鲁港通 - 开始执行自动更新任务
鲁港通 - 找到 X 个需要检查更新的集合
鲁港通 - 检查集合更新: XXX
鲁港通 - XXX: 更新成功
鲁港通 - 自动更新任务执行完成
```

## 11. 回滚计划

### 如果部署失败

1. **停止定时任务**
   ```typescript
   import { stopAutoUpdateScheduler } from '@fastgpt/service/core/dataset/autoUpdate';
   stopAutoUpdateScheduler();
   ```

2. **删除索引**
   ```javascript
   db.dataset_collections.dropIndex("idx_auto_update_enabled");
   db.dataset_collections.dropIndex("idx_auto_update_check_time");
   db.dataset_collections.dropIndex("idx_auto_update_update_time");
   db.dataset_collections.dropIndex("idx_team_auto_update");
   ```

3. **回滚代码**
   ```bash
   git revert <commit-hash>
   pnpm install
   pnpm build
   ```

## 12. 部署步骤

### 开发环境

```bash
# 1. 安装依赖
cd lugang-ai
pnpm install

# 2. 构建项目
pnpm build

# 3. 创建数据库索引（见第2节）

# 4. 启动开发服务器
pnpm dev

# 5. 验证功能（见第8节）
```

### 生产环境

```bash
# 1. 构建 Docker 镜像
cd lugang-ai
docker build -t lugang-ai:latest .

# 2. 停止旧容器
docker-compose down

# 3. 启动新容器
docker-compose up -d

# 4. 创建数据库索引（见第2节）

# 5. 检查日志
docker logs -f lugang-ai

# 6. 验证功能（见第8节）
```

## 13. 部署后验证

### ✅ 验证清单

- [ ] 应用启动成功
- [ ] 定时任务启动日志出现
- [ ] 数据库索引创建成功
- [ ] API 路由可访问
- [ ] 前端界面显示正常
- [ ] 配置保存功能正常
- [ ] 识别功能正常
- [ ] 手动触发功能正常
- [ ] 历史查询功能正常
- [ ] 权限验证正常

### 验证脚本

```bash
#!/bin/bash

echo "=== 鲁港通自动更新功能部署验证 ==="

# 1. 检查应用是否运行
echo "1. 检查应用状态..."
docker ps | grep lugang-ai

# 2. 检查日志
echo "2. 检查启动日志..."
docker logs lugang-ai 2>&1 | grep "自动更新定时任务已启动"

# 3. 检查数据库索引
echo "3. 检查数据库索引..."
docker exec lugang-ai-mongo mongosh lugang_ai --eval "db.dataset_collections.getIndexes()" | grep "idx_auto_update"

# 4. 测试 API（需要替换 TOKEN 和 COLLECTION_ID）
echo "4. 测试 API..."
# curl 测试命令...

echo "=== 验证完成 ==="
```

## 14. 常见问题

### Q1: 定时任务没有启动？

**检查**:
- 查看应用日志是否有启动日志
- 检查 `instrumentation.ts` 是否调用了 `initAutoUpdate()`

**解决**:
```typescript
// 在 instrumentation.ts 中确保调用
import { initAutoUpdate } from '@fastgpt/service/core/dataset/autoUpdate';
initAutoUpdate();
```

### Q2: 页面爬取失败？

**检查**:
- 网络连接是否正常
- URL 是否可访问
- 是否被防火墙拦截

**解决**:
- 检查 Docker 网络配置
- 添加代理配置（如需要）

### Q3: 文件下载超时？

**检查**:
- 文件大小是否超过 100MB
- 网络速度是否过慢

**解决**:
- 增加超时时间（在 downloader.ts 中）
- 增加文件大小限制

### Q4: 数据库查询慢？

**检查**:
- 索引是否创建成功
- 集合数量是否过多

**解决**:
- 创建缺失的索引
- 使用并发控制限制同时处理的集合数量

## 15. 联系支持

如果遇到问题，请：

1. 查看日志文件
2. 检查本清单中的所有项目
3. 查看 `CODE_REVIEW.md` 中的已知问题
4. 查看 `DATABASE_OPTIMIZATION.md` 中的性能优化建议

---

**部署完成后，请在此签名确认：**

- 部署人员: _______________
- 部署日期: _______________
- 验证人员: _______________
- 验证日期: _______________
