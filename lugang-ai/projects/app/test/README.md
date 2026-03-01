# 鲁港通项目测试目录

## 📁 目录结构

```
test/
├── REPORTS.md          # 📊 所有项目报告汇总（重要）
├── README.md           # 📖 本文件
├── tsconfig.json       # TypeScript 配置
├── api/                # API 测试
├── components/         # 组件测试
├── hooks/              # Hooks 测试
├── integration/        # 集成测试
├── pages/              # 页面测试
├── service/            # 服务测试
├── support/            # 支持功能测试
├── system/             # 系统功能测试
└── web/                # Web 功能测试
```

## 📊 项目报告

所有重要的项目报告、验证记录和审查文档都已汇总到 **`REPORTS.md`** 文件中，包括：

1. **FastGPT 商业版集成项目**
   - 项目概述和完成任务
   - 核心改进和测试结果
   - 需求满足情况

2. **版本对比分析**
   - FastGPT 4.14.7.2 vs 当前版本对比
   - 依赖版本变化
   - 升级建议

3. **部署前审查**
   - 代码质量审查
   - 依赖安全审查
   - 部署兼容性审查
   - 关键问题解答

4. **安全依赖升级**
   - 升级内容和安全漏洞详情
   - 升级验证和兼容性评估
   - 风险评估

5. **部署流程**
   - 推荐部署步骤
   - 验证方法

## 🚫 忽略的文件

以下类型的文件已在 `.gitignore` 中配置为不提交到 Git：

- `*-report.md` - 临时测试报告
- `task*.md` - 任务总结文件

这些文件仅用于本地开发参考，所有重要内容都已整合到 `REPORTS.md` 中。

## 🧪 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm vitest run test/path/to/test.ts

# 运行测试并生成覆盖率报告
pnpm vitest run --coverage
```

## 📝 测试规范

- 使用 Vitest 作为测试框架
- 使用 fast-check 进行属性测试
- 测试文件命名：`*.test.ts`
- 测试覆盖率目标：80%+

## 📚 相关文档

- [REPORTS.md](./REPORTS.md) - 项目报告汇总
- [部署指南](../../../DEPLOYMENT-GUIDE.md)
- [README](../../../README.md)

---

**维护**: Kiro AI Assistant  
**更新日期**: 2026-03-01
