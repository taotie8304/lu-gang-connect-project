# Requirements Document

## Introduction

鲁港通跨境AI智能平台的工作流 HTTP 工具和知识库搜索在处理中文查询时，存在简繁体不匹配的问题。平台服务的用户群体横跨大陆（简体中文）和香港（繁体中文），但外部 API 数据源（如香港学校数据库）和知识库内容多为繁体中文。当用户输入简体中文进行搜索时，由于缺乏简繁转换，导致搜索失败（400 错误）或返回不相关结果。

典型场景：用户搜索"培侨中学"（简体），API 无法匹配繁体数据"培僑中學"，返回错误或不相关结果。改用繁体"培僑中學"搜索则能正确返回。

## Glossary

- **CJK_Normalizer**: 中日韩文字规范化模块，负责在搜索前将简体中文转换为繁体中文
- **HTTP_Tool**: 工作流中的 HTTP 请求节点，用于调用外部 API
- **HTTP_Tool_Runner**: HTTP 工具集运行器（`runHTTPTool`），用于执行 HTTP 工具集中定义的 API 调用
- **Knowledge_Search**: 知识库搜索模块，用于在向量数据库中检索相关内容
- **S2T_Conversion**: 简体到繁体的中文转换（Simplified to Traditional）
- **Workflow_Variable**: 工作流变量，在节点间传递的动态数据

## Requirements

### Requirement 1: HTTP 工具搜索参数简繁转换

**User Story:** As a 大陆用户, I want 用简体中文搜索香港学校等繁体数据, so that 不需要手动切换繁体输入法也能获得正确结果。

#### Acceptance Criteria

1. WHEN HTTP_Tool 或 HTTP_Tool_Runner 发送请求且请求参数包含简体中文, THE CJK_Normalizer SHALL 将参数值中的简体中文转换为繁体中文后再发送
2. WHEN 请求参数仅包含繁体中文或非中文字符, THE CJK_Normalizer SHALL 保持参数值不变
3. THE CJK_Normalizer SHALL 同时转换 URL query 参数和 JSON body 中的中文字符串值
4. THE CJK_Normalizer SHALL 支持通过工作流变量 `__enableS2T__` 控制是否启用简繁转换（默认关闭）
5. WHEN `__enableS2T__` 为 false 或未设置, THE HTTP_Tool SHALL 不执行任何简繁转换

### Requirement 2: 简繁转换准确性

**User Story:** As a 系统开发者, I want 简繁转换结果准确, so that 转换后的查询能正确匹配繁体数据源。

#### Acceptance Criteria

1. THE CJK_Normalizer SHALL 正确转换常见简繁差异字符（如 学→學、国→國、门→門、车→車）
2. THE CJK_Normalizer SHALL 处理一对多映射场景（如 "发" 在不同语境下对应 "發" 或 "髮"），采用最常见的映射
3. THE CJK_Normalizer SHALL 保留非中文字符（英文、数字、标点）不变
4. FOR ALL 有效的简体中文字符串, 转换为繁体后再转换回简体 SHALL 产生与原始输入等价的结果（round-trip 属性）

### Requirement 3: 知识库搜索简繁兼容

**User Story:** As a 普通用户, I want 用简体中文搜索繁体知识库内容, so that 语言差异不影响搜索结果质量。

#### Acceptance Criteria

1. WHEN 用户输入简体中文查询且知识库内容为繁体, THE Knowledge_Search SHALL 在搜索前将查询转换为繁体
2. WHEN 用户输入繁体中文查询且知识库内容为简体, THE Knowledge_Search SHALL 在搜索前将查询转换为简体
3. THE Knowledge_Search SHALL 通过系统配置 `feConfigs.enableCjkNormalization` 控制是否启用简繁兼容搜索（默认关闭）
4. WHEN 简繁兼容搜索启用, THE Knowledge_Search SHALL 对查询同时生成简体和繁体版本进行搜索，取最高相关性结果

### Requirement 4: 转换性能

**User Story:** As a 系统运维人员, I want 简繁转换不影响系统响应速度, so that 用户体验不受影响。

#### Acceptance Criteria

1. THE CJK_Normalizer SHALL 在 10ms 内完成单次转换（对于 1000 字符以内的输入）
2. THE CJK_Normalizer SHALL 使用纯映射表实现，不依赖外部服务调用
3. THE CJK_Normalizer SHALL 在应用启动时加载映射表到内存，运行时无 I/O 操作
