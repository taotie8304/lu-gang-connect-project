---
inclusion: fileMatch: ["hk-transport-plugin/**"]
---
# 香港交通插件规范

## 关键约束
- toolId：`hk_transport_assistant`（下划线，禁用连字符）
- 包大小上限：1 MB（当前 629.4 KB）
- 打包：esbuild，禁用 tree-shaking 和 minifyIdentifiers
- 入口：`cb` 绑定 IIFE 导出的 `tool`

## 地理编码优先级
1. LOCATION_COORDS 硬编码坐标（最快）
2. LOCATION_ALIASES 别名映射
3. stop-db 9461 站点全文匹配
4. expandNames 后缀扩展重试（站/巴士总站/巴士站/总站）
5. Nominatim 联网回退（组织名，1.1s 速率限制）

## 实时 ETA
- 支持 KMB/CTB/LWB/NLB/MTR；失败降级 5 分钟静态估算
- 路线按总时长排序，第一条标记 `recommended: true`

## 防重复调用
- 空结果返回措辞：阻止 LLM 重试（"暂未查询到...建议改用其他方式"）
- toolDescription 末尾加反重试说明

## 构建
```bash
cd hk-transport-plugin && pnpm build
# 输出：dist/hk_transport_assistant.pkg
```
