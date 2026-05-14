---
inclusion: fileMatch: ["lugang-ai/**", "*.tsx", "*.ts", "*.jsx"]
---
# 前端规范（Next.js / FastGPT 二开）

## React
- 函数组件 + Hooks；组件拆分 < 200 行
- 列表必须加唯一 `key`；副作用在 `useEffect` 中

## 样式
- 使用 Chakra UI 组件；自定义样式用 CSS Modules
- 禁止内联样式（除动态计算值）

## 性能
- 路由级懒加载（`dynamic()`）
- 图片用 `next/image`；API 数据用 SWR 缓存

## FastGPT 特殊约束
- 不修改 `@fastgpt/*` 导入路径
- 数据库连接到 `lugang_ai`（非 `fastgpt`）
- 密码：双重 SHA256 哈希（前端专用）
