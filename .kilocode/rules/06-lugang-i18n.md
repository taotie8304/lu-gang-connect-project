---
inclusion: fileMatch: ["*i18n*", "*locale*", "*/lang/*"]
---
# 国际化规范

## 支持语言：简体中文 / 繁体中文 / 英文

## Key 命名规则
- 繁体（默认）：`{base_key}`
- 简体：`{base_key}_zh-CN`
- 英文：`{base_key}_en`

## 规则
- 所有用户可见文字必须走 i18n key，禁止硬编码中文/英文字符串
- 繁简转换使用 opencc-js（hk→cn），准确率 >99%
- 简体版可通过 `convert_to_simplified.js` 自动生成
- 根据 Cookie `NEXT_LOCALE` 自动选择语言版本
