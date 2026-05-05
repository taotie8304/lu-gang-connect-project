# Design Document

## Overview

本文档描述鲁港通 AI 平台聊天显示优化功能的技术设计。该功能旨在解决当前聊天界面中存在的6个主要问题：图片引用显示失败、思考模式内容过于详细、思考模式背景色错误、Markdown 表格渲染问题、引用内容显示控制以及响应式显示优化。

## Architecture

### 系统架构概览

前端聊天界面包含以下核心模块：
- 图片渲染模块 (MdImage)：处理图片加载和显示
- 思考模式渲染模块 (RenderResoningContent)：渲染 AI 推理过程
- 引用显示控制模块 (CiteLink)：根据用户角色控制引用显示
- Markdown 渲染器 (ReactMarkdown)：渲染 Markdown 内容

后端 AI 服务通过 System Prompt 控制思考模式的输出内容。

### 模块职责

1. **图片渲染模块**：负责加载和显示图片，处理跨域问题，提供错误降级
2. **思考模式渲染模块**：渲染推理过程，控制背景色和样式，提供展开/折叠功能
3. **引用显示控制模块**：根据用户角色显示/隐藏引用内容，移除引用标记
4. **Markdown 渲染器**：渲染 Markdown 内容，处理表格等特殊格式
5. **AI 模型配置**：通过 System Prompt 控制思考模式输出

## Components and Interfaces

### 1. 图片渲染组件 (MdImage)

**文件路径**: `lugang-ai/projects/app/src/components/Markdown/img/Image.tsx`

**接口定义**:
```typescript
interface MdImageProps {
  src?: string;
  alt?: string;
  chatAuthData?: {
    appId: string;
    chatId: string;
    chatItemDataId: string;
  } & OutLinkChatAuthProps;
}
```

**修改点**:
- 添加图片代理功能（解决 CORS 问题）
- 添加错误处理和占位符显示
- 优化图片加载性能（懒加载）

### 2. 思考模式渲染组件 (RenderResoningContent)

**文件路径**: `lugang-ai/projects/app/src/components/core/chat/components/AIResponseBox.tsx`

**接口定义**:
```typescript
interface RenderResoningContentProps {
  content: string;
  isChatting: boolean;
  isLastResponseValue: boolean;
}
```

**修改点**:
- 修改背景色样式（使用 scoped styles 确保不污染最终答案）
- 保持现有的展开/折叠功能
- 优化样式隔离（使用 CSS Modules 或 styled-components）

### 3. 引用链接组件 (CiteLink)

**文件路径**: `lugang-ai/projects/app/src/components/Markdown/A.tsx`

**修改点**:
- 对普通用户完全隐藏引用图标（移除当前的条件判断）
- 添加文本处理函数，移除回复文本中的引用标记（如 [1], [2]）
- 保留引用数据在后台（不删除数据，只是不显示）

### 4. Markdown 渲染器

**文件路径**: `lugang-ai/projects/app/src/components/Markdown/index.tsx`

**修改点**:
- 添加表格预处理函数，移除 `<br>` 标签
- 修改表格样式（CSS）：添加 word-wrap、overflow-x: auto
- 确保移动端响应式显示

### 5. 引用标记移除工具函数

**新增文件**: `lugang-ai/projects/app/src/components/Markdown/utils.ts`

**功能**:
```typescript
// 移除文本中的引用标记
function removeCitationMarks(text: string): string {
  // 移除 [1], [2] 等引用标记
  // 确保移除后文本仍然连贯（处理多余的空格和标点）
  return text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}
```

## Data Models

### 1. 系统配置扩展

在现有的系统配置中添加以下字段：

```typescript
interface SystemConfig {
  // ... 现有字段
  
  // 图片代理配置
  imageProxy?: {
    enabled: boolean;
    proxyUrl: string;
  };
  
  // 引用显示配置
  citationDisplay?: {
    enableForNormalUser: boolean;  // 默认 false
    enableForAdmin: boolean;        // 默认 true
  };
}
```

### 2. AI 模型配置

在工作流的 AI 对话节点中添加思考模式的 System Prompt：

```
当启用深度思考模式时，请遵循以下规则：
1. 在思考阶段，只输出推理逻辑框架和答案大纲
2. 使用简洁的要点形式（如：步骤1、步骤2、关键点等）
3. 不要在思考阶段输出完整的答案内容
4. 思考内容应该简洁明了，帮助用户理解你的推理方向
5. 在最终答案阶段，再提供完整详细的内容
```

## Correctness Properties

*属性基础测试（Property-Based Testing）是一种强大的软件正确性验证工具。每个属性都是一个应该对所有有效输入成立的形式化陈述。*

Property 1: 图片加载支持多种格式
For any 有效的图片 URL（JPG、PNG、GIF、WebP 格式），图片渲染组件应该能够正确加载并显示图片

Validates: Requirements 1.1, 1.3

Property 2: 图片加载失败显示占位符
For any 无效或加载失败的图片 URL，图片渲染组件应该显示占位符或错误提示，而不是空白或崩溃

Validates: Requirements 1.2

Property 3: 思考模式和最终答案样式隔离
For any 聊天回复内容，思考模式区域的背景色样式不应该影响最终答案区域的背景色样式

Validates: Requirements 3.4

Property 4: 思考模式使用灰色背景
For any 思考模式内容，渲染后的组件应该使用灰色背景（#F7F8FA 或类似颜色）

Validates: Requirements 3.1

Property 5: 最终答案使用透明背景
For any 最终答案内容，渲染后的组件应该使用与页面背景一致的颜色（白色或透明）

Validates: Requirements 3.2

Property 6: 思考模式和最终答案之间有间距
For any 包含思考模式和最终答案的聊天回复，两者之间应该有明显的间距或分隔线

Validates: Requirements 3.3

Property 7: 主题切换时背景色自动调整
For any 主题切换操作（浅色/深色），思考模式和最终答案的背景色应该自动调整以保持对比度

Validates: Requirements 3.5

Property 8: 表格正确渲染
For any 有效的 Markdown 表格语法，Markdown 渲染器应该正确渲染表格结构（包含表头、表格行、单元格）

Validates: Requirements 4.1

Property 9: 表格单元格使用 CSS 控制换行
For any Markdown 表格，渲染后的 HTML 应该使用 CSS（如 white-space、word-wrap）控制换行，而不应该包含 <br> 标签

Validates: Requirements 4.2, 4.3

Property 10: 表格单元格内容正确对齐
For any Markdown 表格，渲染后的表格单元格内容应该正确对齐（左对齐、居中或右对齐）

Validates: Requirements 4.4

Property 11: 表格支持文本自动换行
For any 包含长文本的表格单元格，文本应该能够自动换行而不是溢出单元格

Validates: Requirements 4.5

Property 12: 宽表格提供横向滚动
For any 宽度超过容器的表格，应该提供横向滚动功能而不是被截断

Validates: Requirements 4.6

Property 13: 普通用户不显示引用标记
For any 包含引用标记（如 [1], [2]）的 AI 回复，当用户为普通用户时，渲染后的内容不应该显示这些引用标记

Validates: Requirements 5.1, 5.5

Property 14: 普通用户不显示引用来源列表
For any 包含引用来源的 AI 回复，当用户为普通用户时，不应该显示引用来源列表或引用图标

Validates: Requirements 5.2

Property 15: 管理员可显示引用内容
For any 包含引用的 AI 回复，当用户为管理员时，应该能够看到引用图标和引用来源信息

Validates: Requirements 5.3

Property 16: 引用数据保留在后台
For any 包含引用的 AI 回复，即使不显示引用内容，引用数据仍然应该存在于数据结构中

Validates: Requirements 5.4

Property 17: 移除引用标记后文本连贯
For any 包含引用标记的文本，移除引用标记后，文本应该仍然连贯可读（没有多余的空格或标点）

Validates: Requirements 5.6

Property 18: 移动端表格宽度自动调整
For any 表格内容，在移动端（屏幕宽度 < 768px）应该自动调整宽度以适应屏幕

Validates: Requirements 6.1

Property 19: 移动端思考模式显示优化
For any 思考模式内容，在移动端应该正确显示并自动调整布局

Validates: Requirements 6.2

Property 20: 小屏幕优先显示最终答案
For any 包含思考模式的回复，在小屏幕设备上（屏幕宽度 < 768px），思考模式应该默认折叠，优先显示最终答案

Validates: Requirements 6.3

Property 21: 移动端文本可读性
For any 文本内容，在移动端的字体大小应该适中（至少 14px），确保可读性

Validates: Requirements 6.4

Error Handling
1. 图片加载错误处理
错误场景:

图片 URL 无效
图片加载超时
跨域问题（CORS）
图片格式不支持
处理策略:

// 图片加载错误处理
const handleImageError = (error: Error) => {
  console.error('Image load failed:', error);
  
  // 显示占位符
  setImageState({
    loading: false,
    error: true,
    placeholder: '/images/image-placeholder.svg'
  });
  
  // 可选：尝试通过代理重新加载
  if (imageProxyConfig.enabled && !isProxyAttempted) {
    const proxyUrl = `${imageProxyConfig.proxyUrl}?url=${encodeURIComponent(src)}`;
    retryLoadImage(proxyUrl);
  }
};
2. Markdown 渲染错误处理
错误场景:

Markdown 语法错误
表格格式不正确
特殊字符导致渲染失败
处理策略:

// Markdown 渲染错误处理
try {
  const renderedContent = renderMarkdown(source);
  return renderedContent;
} catch (error) {
  console.error('Markdown render failed:', error);
  
  // 降级为纯文本显示
  return <Box whiteSpace="pre-wrap">{source}</Box>;
}
3. 引用数据获取错误处理
错误场景:

引用 ID 无效
引用数据不存在
网络请求失败
处理策略:

// 引用数据获取错误处理
const { data, error } = useRequest2(
  (id: string) => getQuoteData({ id, ...chatAuthData }),
  {
    manual: true,
    onError: (error) => {
      console.error('Failed to load citation data:', error);
      // 静默失败，不显示引用内容
      onClose();
    }
  }
);
4. 样式冲突处理
错误场景:

思考模式样式污染最终答案
全局样式覆盖组件样式
主题切换导致样式错误
处理策略:

使用 CSS Modules 或 styled-components 确保样式隔离
使用 BEM 命名规范避免样式冲突
为思考模式和最终答案使用不同的 CSS 类名
使用 !important 谨慎处理必须覆盖的样式
5. 响应式布局错误处理
错误场景:

表格在移动端溢出
文本在小屏幕上不可读
布局在特定屏幕尺寸下错乱
处理策略:

使用媒体查询（@media）处理不同屏幕尺寸
使用 overflow-x: auto 处理宽表格
使用相对单位（rem、em）而非固定像素
测试常见设备尺寸（iPhone、iPad、Android）
Testing Strategy
单元测试（Unit Tests）
使用 Vitest 进行单元测试，重点测试以下功能：

1. 引用标记移除函数测试

describe('removeCitationMarks', () => {
  it('should remove citation marks [1], [2]', () => {
    const input = '这是一段文本[1]，包含引用[2]。';
    const expected = '这是一段文本，包含引用。';
    expect(removeCitationMarks(input)).toBe(expected);
  });
  
  it('should handle text without citation marks', () => {
    const input = '这是一段没有引用的文本。';
    expect(removeCitationMarks(input)).toBe(input);
  });
  
  it('should remove extra spaces after removing marks', () => {
    const input = '文本 [1] 引用';
    const expected = '文本 引用';
    expect(removeCitationMarks(input)).toBe(expected);
  });
});
2. 表格预处理函数测试

describe('preprocessTableMarkdown', () => {
  it('should remove <br> tags from table cells', () => {
    const input = '| 列1 | 列2<br>换行 |\n|-----|-----|\n| 值1 | 值2 |';
    const output = preprocessTableMarkdown(input);
    expect(output).not.toContain('<br>');
  });
});
3. 组件渲染测试

describe('RenderResoningContent', () => {
  it('should render with gray background', () => {
    const { container } = render(
      <RenderResoningContent 
        content="思考内容" 
        isChatting={false} 
        isLastResponseValue={false} 
      />
    );
    
    const accordionPanel = container.querySelector('.chakra-accordion__panel');
    const styles = window.getComputedStyle(accordionPanel);
    expect(styles.backgroundColor).toBe('rgb(247, 248, 250)'); // #F7F8FA
  });
});
属性测试（Property-Based Tests）
使用 fast-check 进行属性测试，每个测试至少运行 100 次迭代：

1. 引用标记移除属性测试

import fc from 'fast-check';

describe('Property: Citation mark removal', () => {
  it('should always produce text without citation marks', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.integer({ min: 1, max: 99 })),
        (text, citations) => {
          // 生成包含引用标记的文本
          let textWithCitations = text;
          citations.forEach(num => {
            textWithCitations += `[${num}]`;
          });
          
          // 移除引用标记
          const result = removeCitationMarks(textWithCitations);
          
          // 验证结果不包含引用标记
          expect(result).not.toMatch(/\[\d+\]/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
2. 样式隔离属性测试

describe('Property: Style isolation', () => {
  it('thinking mode styles should not affect answer styles', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.string({ minLength: 10 }),
        (thinkingContent, answerContent) => {
          const { container } = render(
            <>
              <RenderResoningContent content={thinkingContent} />
              <Markdown source={answerContent} />
            </>
          );
          
          const thinkingBg = getBackgroundColor(container, '.thinking-mode');
          const answerBg = getBackgroundColor(container, '.answer-content');
          
          // 验证背景色不同
          expect(thinkingBg).not.toBe(answerBg);
        }
      ),
      { numRuns: 100 }
    );
  });
});
集成测试（Integration Tests）
测试多个组件协同工作的场景：

1. 完整聊天回复渲染测试

describe('Integration: Full chat response rendering', () => {
  it('should render thinking mode and answer with correct styles', async () => {
    const mockResponse = {
      reasoning: '步骤1：分析问题\n步骤2：查找资料',
      answer: '这是最终答案[1]。',
      citations: [{ id: '123', source: '来源1' }]
    };
    
    const { container } = render(
      <ChatResponse response={mockResponse} userRole="normal" />
    );
    
    // 验证思考模式显示
    expect(container.querySelector('.thinking-mode')).toBeInTheDocument();
    
    // 验证最终答案显示
    expect(container.querySelector('.answer-content')).toBeInTheDocument();
    
    // 验证普通用户不显示引用
    expect(container.querySelector('.citation-mark')).not.toBeInTheDocument();
  });
});
视觉回归测试（Visual Regression Tests）
使用 Playwright 或 Cypress 进行视觉回归测试：

1. 思考模式样式测试

截图对比思考模式的背景色
验证思考模式和最终答案的间距
测试不同主题下的显示效果
2. 表格渲染测试

截图对比表格的渲染效果
验证表格在移动端的显示
测试宽表格的横向滚动
测试覆盖率目标
单元测试覆盖率：> 80%
属性测试：每个核心属性至少 100 次迭代
集成测试：覆盖主要用户场景
视觉回归测试：覆盖关键 UI 组件
测试执行
# 运行所有测试
pnpm vitest run --config vitest.simple.config.mts

# 运行属性测试（带警告）
pnpm vitest run --config vitest.simple.config.mts --grep "Property"

# 运行特定测试文件
pnpm vitest run src/components/Markdown/utils.test.ts