---
description: 鲁港通多语言与简繁转换规则
globs:
  - "packages/web/i18n/**"
  - "**/SystemContentModal/**"
  - "**/system/content/**"
alwaysApply: false
---

# 多语言与简繁架构

- 系统内容 key 命名规则：
  - 繁体：`{base_key}`
  - 简体：`{base_key}_zh-CN`
  - 英文：`{base_key}_en`
- 新增或修改系统内容（使用条款、隐私政策、个人资料收集声明等）时，应同时考虑三种语言版本。
- 简繁转换通过 opencc-js（hk→cn）实现，简体版本可以通过已有脚本自动生成，不能手工硬改结构。

# 修改约束

- 不得擅自修改 key 命名规则，否则会导致多语言内容无法正确加载。
- 如需新增一条中文文案，应说明三种语言的处理方式（是先添加繁体，再用脚本转简体，还是只添加英文等）。