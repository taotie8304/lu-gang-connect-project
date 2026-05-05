# 需求文档 - 知识库自动更新功能

## 简介

本功能为鲁港通知识库提供自动更新能力，特别针对香港政府开放数据集的定期更新需求。系统将自动检测数据源更新，并在发现新数据时自动下载并导入到知识库。

## 术语表

- **知识库集合 (Collection)**：知识库中的一个数据集合，可以包含文件、网页链接或 API 数据
- **自动更新配置 (AutoUpdateConfig)**：存储在集合中的配置信息，控制自动更新行为
- **数据源 (Data Source)**：提供数据的来源，如香港政府数据网站
- **检测策略 (Detection Strategy)**：判断数据是否更新的方法
- **训练队列 (Training Queue)**：知识库数据处理的队列系统
- **定时任务 (Scheduled Task)**：按固定时间自动执行的任务

## 需求

### 需求 1：自动更新配置管理

**用户故事**：作为知识库管理员，我想要配置知识库的自动更新设置，以便系统能够自动检测和导入新数据。

#### 验收标准

1. WHEN 管理员访问知识库集合配置页面 THEN 系统 SHALL 显示自动更新配置选项
2. WHEN 管理员启用自动更新 THEN 系统 SHALL 保存配置到数据库
3. WHEN 管理员配置数据源 URL THEN 系统 SHALL 验证 URL 格式的有效性
4. WHEN 管理员选择文件格式 THEN 系统 SHALL 支持 CSV、XLSX、XML、API 四种格式
5. WHEN 管理员保存配置 THEN 系统 SHALL 返回成功或失败的反馈

### 需求 2：页面爬取和文件识别

**用户故事**：作为系统，我需要能够爬取数据集页面并识别可下载的文件，以便自动获取最新数据。

#### 验收标准

1. WHEN 系统访问数据集页面 THEN 系统 SHALL 使用 HTTP 请求获取页面内容
2. WHEN 系统解析页面 THEN 系统 SHALL 识别所有 CSV、XLSX、XML 格式的文件链接
3. WHEN 系统提取文件信息 THEN 系统 SHALL 获取文件名、文件 URL、文件大小、更新时间
4. WHEN 页面包含详情页链接 THEN 系统 SHALL 记录详情页 URL 供后续检查
5. WHEN 页面爬取失败 THEN 系统 SHALL 返回错误信息并记录日志

### 需求 3：文件更新检测

**用户故事**：作为系统，我需要能够判断数据文件是否有更新，以避免重复导入相同数据。

#### 验收标准

1. WHEN 系统检测文件更新 THEN 系统 SHALL 首先检查文件名是否包含当前年份
2. WHEN 文件名包含年份模式 THEN 系统 SHALL 支持多种格式（2025/26、2025-2026、2025至2026）
3. WHEN 文件名检测未发现新文件 THEN 系统 SHALL 比对文件更新时间
4. WHEN 更新时间晚于上次导入时间 THEN 系统 SHALL 判定为新文件
5. WHEN 需要详情页检查 THEN 系统 SHALL 访问详情页获取更详细的更新时间
6. WHEN 所有检测都未发现更新 THEN 系统 SHALL 返回"无需更新"状态

### 需求 4：API 数据更新检测

**用户故事**：作为系统，我需要能够检测 API 数据是否有更新，以便及时刷新缓存数据。

#### 验收标准

1. WHEN 系统检查 API 更新 THEN 系统 SHALL 发送 HEAD 请求到 API 端点
2. WHEN API 返回 Last-Modified 头 THEN 系统 SHALL 比对该时间与上次更新时间
3. WHEN Last-Modified 时间更新 THEN 系统 SHALL 判定需要刷新缓存
4. WHEN API 未提供 Last-Modified 头 THEN 系统 SHALL 返回"无法判断"状态
5. WHEN API 请求失败 THEN 系统 SHALL 记录错误并返回失败状态

### 需求 5：文件下载和解析

**用户故事**：作为系统，我需要能够下载并解析不同格式的数据文件，以便导入到知识库。

#### 验收标准

1. WHEN 系统下载 CSV 文件 THEN 系统 SHALL 使用 papaparse 库解析内容
2. WHEN 系统下载 XLSX 文件 THEN 系统 SHALL 使用 node-xlsx 库解析内容
3. WHEN 系统下载 XML 文件 THEN 系统 SHALL 读取原始文本内容
4. WHEN 系统下载 API 数据 THEN 系统 SHALL 将 JSON 响应转换为文本格式
5. WHEN 文件下载失败 THEN 系统 SHALL 返回错误信息并记录到历史
6. WHEN 文件解析失败 THEN 系统 SHALL 返回错误信息并记录到历史

### 需求 6：数据导入到知识库

**用户故事**：作为系统，我需要能够将下载的数据导入到知识库，以便用户可以使用最新数据。

#### 验收标准

1. WHEN 系统准备导入数据 THEN 系统 SHALL 获取数据集的模型配置（vectorModel、agentModel）
2. WHEN 系统导入数据 THEN 系统 SHALL 使用现有的训练队列功能（pushDataListToTrainingQueue）
3. WHEN 数据导入成功 THEN 系统 SHALL 更新集合的 lastUpdateTime 字段
4. WHEN 数据导入成功 THEN 系统 SHALL 记录成功历史（时间、文件名、文件大小）
5. WHEN 数据导入失败 THEN 系统 SHALL 记录失败历史（时间、错误信息）

### 需求 7：定时任务调度

**用户故事**：作为系统，我需要能够按固定时间自动执行更新检查，以确保数据及时更新。

#### 验收标准

1. WHEN 应用启动 THEN 系统 SHALL 自动启动定时任务调度器
2. WHEN 定时任务触发 THEN 系统 SHALL 在每月1号凌晨2点执行
3. WHEN 定时任务执行 THEN 系统 SHALL 查找所有启用自动更新的集合
4. WHEN 处理每个集合 THEN 系统 SHALL 更新 lastCheckTime 字段
5. WHEN 所有集合处理完成 THEN 系统 SHALL 记录任务完成日志

### 需求 8：手动触发更新

**用户故事**：作为知识库管理员，我想要能够手动触发更新检查，以便在需要时立即获取最新数据。

#### 验收标准

1. WHEN 管理员点击"手动更新"按钮 THEN 系统 SHALL 立即执行更新检查
2. WHEN 手动更新触发 THEN 系统 SHALL 验证用户权限（需要写权限）
3. WHEN 手动更新执行 THEN 系统 SHALL 返回实时进度反馈
4. WHEN 手动更新完成 THEN 系统 SHALL 显示更新结果（成功/失败）
5. WHEN 手动更新失败 THEN 系统 SHALL 显示详细错误信息

### 需求 9：数据集识别 API

**用户故事**：作为知识库管理员，我想要系统能够自动识别数据集页面中的文件，以便快速配置自动更新。

#### 验收标准

1. WHEN 管理员输入数据集 URL THEN 系统 SHALL 提供"识别"按钮
2. WHEN 管理员点击"识别"按钮 THEN 系统 SHALL 爬取页面并识别所有数据文件
3. WHEN 识别完成 THEN 系统 SHALL 返回文件列表（文件名、格式、URL）
4. WHEN 识别到多个文件 THEN 系统 SHALL 按格式分组显示
5. WHEN 识别失败 THEN 系统 SHALL 显示友好的错误提示

### 需求 10：更新历史查询

**用户故事**：作为知识库管理员，我想要查看自动更新的历史记录，以便了解更新情况和排查问题。

#### 验收标准

1. WHEN 管理员访问集合详情页 THEN 系统 SHALL 显示更新历史列表
2. WHEN 显示历史记录 THEN 系统 SHALL 包含时间、状态、消息、文件信息
3. WHEN 历史记录为空 THEN 系统 SHALL 显示"暂无更新历史"提示
4. WHEN 历史记录过多 THEN 系统 SHALL 支持分页显示
5. WHEN 查询历史失败 THEN 系统 SHALL 显示错误信息

### 需求 11：错误处理和日志

**用户故事**：作为系统管理员，我需要系统能够妥善处理错误并记录日志，以便排查问题。

#### 验收标准

1. WHEN 任何操作失败 THEN 系统 SHALL 记录详细的错误日志
2. WHEN 页面爬取失败 THEN 系统 SHALL 记录 URL 和错误原因
3. WHEN 文件下载失败 THEN 系统 SHALL 记录文件 URL 和错误原因
4. WHEN 数据导入失败 THEN 系统 SHALL 记录集合 ID 和错误原因
5. WHEN 定时任务执行 THEN 系统 SHALL 记录开始和结束时间
6. WHEN 错误发生 THEN 系统 SHALL 不影响其他集合的处理

### 需求 12：权限控制

**用户故事**：作为系统，我需要确保只有授权用户才能配置和触发自动更新，以保护数据安全。

#### 验收标准

1. WHEN 用户配置自动更新 THEN 系统 SHALL 验证用户具有集合的写权限
2. WHEN 用户触发手动更新 THEN 系统 SHALL 验证用户具有集合的写权限
3. WHEN 用户查看更新历史 THEN 系统 SHALL 验证用户具有集合的读权限
4. WHEN 用户识别数据集 THEN 系统 SHALL 验证用户具有集合的读权限
5. WHEN 权限验证失败 THEN 系统 SHALL 返回 403 错误
