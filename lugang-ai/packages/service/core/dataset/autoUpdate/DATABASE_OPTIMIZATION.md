# 数据库优化指南

## MongoDB 索引优化

为了提高自动更新功能的查询性能，建议在 MongoDB 中创建以下索引：

### 1. DatasetCollection 集合索引

```javascript
// 鲁港通 - 自动更新功能索引优化

// 索引 1: 查询启用自动更新的集合
db.dataset_collections.createIndex(
  { "autoUpdateConfig.enabled": 1 },
  { 
    name: "idx_auto_update_enabled",
    background: true,
    sparse: true  // 只索引有 autoUpdateConfig 的文档
  }
);

// 索引 2: 查询最后检查时间（用于监控和调试）
db.dataset_collections.createIndex(
  { 
    "autoUpdateConfig.enabled": 1,
    "autoUpdateConfig.lastCheckTime": -1 
  },
  { 
    name: "idx_auto_update_check_time",
    background: true,
    sparse: true
  }
);

// 索引 3: 查询最后更新时间（用于监控和调试）
db.dataset_collections.createIndex(
  { 
    "autoUpdateConfig.enabled": 1,
    "autoUpdateConfig.lastUpdateTime": -1 
  },
  { 
    name: "idx_auto_update_update_time",
    background: true,
    sparse: true
  }
);

// 索引 4: 复合索引用于团队查询
db.dataset_collections.createIndex(
  { 
    teamId: 1,
    "autoUpdateConfig.enabled": 1 
  },
  { 
    name: "idx_team_auto_update",
    background: true
  }
);
```

### 2. 索引创建脚本

在 MongoDB shell 中执行以下命令：

```bash
# 连接到 MongoDB
mongo lugang_ai

# 执行索引创建
use lugang_ai

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
```

### 3. 验证索引

```javascript
// 查看所有索引
db.dataset_collections.getIndexes();

// 查看索引使用情况
db.dataset_collections.explain("executionStats").find({
  "autoUpdateConfig.enabled": true
});
```

## 查询优化建议

### 1. 使用 lean() 减少内存占用

```typescript
// ❌ 不推荐：返回完整的 Mongoose 文档
const collections = await MongoDatasetCollection.find({
  'autoUpdateConfig.enabled': true
});

// ✅ 推荐：使用 lean() 返回纯 JavaScript 对象
const collections = await MongoDatasetCollection.find({
  'autoUpdateConfig.enabled': true
}).lean();
```

### 2. 只查询必要的字段

```typescript
// ❌ 不推荐：查询所有字段
const collections = await MongoDatasetCollection.find({
  'autoUpdateConfig.enabled': true
});

// ✅ 推荐：只查询需要的字段
const collections = await MongoDatasetCollection.find(
  { 'autoUpdateConfig.enabled': true },
  { _id: 1, name: 1, autoUpdateConfig: 1 }
).lean();
```

### 3. 使用 updateOne 代替 findByIdAndUpdate

```typescript
// ❌ 不推荐：findByIdAndUpdate 会先查询再更新
await MongoDatasetCollection.findByIdAndUpdate(collectionId, {
  'autoUpdateConfig.lastCheckTime': new Date()
});

// ✅ 推荐：updateOne 直接更新，性能更好
await MongoDatasetCollection.updateOne(
  { _id: collectionId },
  { $set: { 'autoUpdateConfig.lastCheckTime': new Date() } }
);
```

### 4. 批量操作使用 bulkWrite

```typescript
// ❌ 不推荐：循环中多次更新
for (const collection of collections) {
  await MongoDatasetCollection.updateOne(
    { _id: collection._id },
    { $set: { 'autoUpdateConfig.lastCheckTime': new Date() } }
  );
}

// ✅ 推荐：使用 bulkWrite 批量更新
const operations = collections.map(collection => ({
  updateOne: {
    filter: { _id: collection._id },
    update: { $set: { 'autoUpdateConfig.lastCheckTime': new Date() } }
  }
}));

await MongoDatasetCollection.bulkWrite(operations);
```

## 性能监控

### 1. 查询性能分析

```javascript
// 分析查询性能
db.dataset_collections.explain("executionStats").find({
  "autoUpdateConfig.enabled": true
});

// 查看慢查询日志
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(10);
```

### 2. 索引使用统计

```javascript
// 查看索引统计
db.dataset_collections.aggregate([
  { $indexStats: {} }
]);
```

## 预期性能提升

实施以上优化后，预期性能提升：

- **查询速度**: 提升 80-90%（通过索引）
- **内存占用**: 减少 50-60%（通过 lean() 和字段选择）
- **并发处理**: 提升 3 倍（通过并发控制）
- **网络请求**: 减少 30-40%（通过连接复用）

## 注意事项

1. **索引创建**: 使用 `background: true` 避免阻塞数据库
2. **稀疏索引**: 使用 `sparse: true` 只索引有值的文档
3. **索引维护**: 定期检查索引使用情况，删除未使用的索引
4. **监控告警**: 设置慢查询告警（> 100ms）
