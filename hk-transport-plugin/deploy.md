# 香港智能交通助手 - 部署指南

## 打包

```bash
# 方式 1: 使用 Bun（生产环境推荐）
bun run build:pkg

# 方式 2: 使用 Node.js + esbuild（开发环境备用）
npm run build:pkg:node
# 或
node build.mjs
```

打包成功后，输出文件在 `dist/hk-transport-assistant.pkg`。

## 上传到 FastGPT

1. 使用 root 用户登录 FastGPT（https://www.airscend.com）
2. 进入「配置页面」→「系统插件」→「导入/更新」
3. 上传 `dist/hk-transport-assistant.pkg` 文件
4. 等待插件热加载完成（通常几秒钟）
5. 在插件列表中确认「香港智能交通助手」已出现

## 验证

上传后在 FastGPT 工作流中：
1. 添加「工具调用」节点
2. 选择「香港智能交通助手」
3. 输入测试问题：`从落马洲口岸到香港立法会怎么走`
4. 确认返回路线方案、ETA、付款信息等数据

## 文件说明

| 文件 | 说明 |
|------|------|
| `dist/hk-transport-assistant.pkg` | 插件包（上传此文件） |
| `dist/index.js` | 打包后的 JS bundle |
| `dist/hk-transport-assistant.config.json` | 插件配置（调试用） |
