### Property 1: 图片格式支持
*对于任何*有效的图片 URL（JPG、PNG、GIF、WebP 格式），图片渲染组件应该能够正确加载并显示图片
**Validates: Requirements 1.1, 1.3**

### Property 2: 图片加载失败处理
*对于任何*无效或无法访问的图片 URL，图片渲染组件应该显示占位符或错误提示
**Validates: Requirements 1.2**

### Property 3: 思考模式样式隔离
*对于任何*聊天回复，思考模式区域的背景色样式不应该影响最终答案区域的背景色
**Validates: Requirements 3.4**

### Property 4: 思考模式背景色正确性
*对于任何*思考模式内容，渲染后的背景色应该是灰色（#F7F8FA），最终答案的背景色应该是白色或透明
**Validates: Requirements 3.1, 3.2**

### Property 5: 表格 HTML 标签清理
*对于任何*包含 Markdown 表格的文本，渲染后的表格单元格中不应该包含 <br> 标签
**Validates: Requirements 4.2, 4.3**

### Property 6: 表格样式正确性
*对于任何*Markdown 表格，渲染后应该支持文本自动换行（word-wrap）和横向滚动（overflow-x）
**Validates: Requirements 4.5, 4.6**

### Property 7: 引用标记移除
*对于任何*包含引用标记（如 [1], [2]）的文本，普通用户看到的渲染结果中不应该包含这些标记
**Validates: Requirements 5.1, 5.5**

### Property 8: 引用标记移除后文本连贯性
*对于任何*包含引用标记的文本，移除引用标记后文本应该仍然连贯可读（没有多余的空格或标点）
**Validates: Requirements 5.6**

### Property 9: 用户角色引用显示控制
*对于任何*用户，如果是普通用户则不显示引用图标和来源列表，如果是管理员则显示完整引用信息
**Validates: Requirements 5.2, 5.3**

### Property 10: 响应式表格宽度
*对于任何*屏幕宽度，表格应该自动调整宽度以适应屏幕，在移动端提供横向滚动
**Validates: Requirements 6.1**

### Property 11: 响应式思考模式显示
*对于任何*屏幕宽度，思考模式区域应该正确显示，在小屏幕设备上默认折叠
**Validates: Requirements 6.2, 6.3**

## Error Handling

### 1. 图片加载错误

**错误场景**:
- 图片 URL 无效
- 图片服务器不可访问
- 跨域问题（CORS）
- 图片格式不支持

**处理策略**:
- 显示占位符图片（灰色背景 + 图片图标）
- 显示错误提示文本（可选）
- 记录错误日志（用于调试）
- 不阻塞页面渲染

**实现**:
`	ypescript
const [imageError, setImageError] = useState(false);

const handleImageError = () => {
  setImageError(true);
  console.error('Image load failed:', src);
};

if (imageError) {
  return <ImagePlaceholder alt={alt} />;
}
`

### 2. Markdown 渲染错误

**错误场景**:
- Markdown 语法错误
- 表格格式不正确
- 特殊字符导致渲染失败

**处理策略**:
- 使用 try-catch 包裹渲染逻辑
- 降级显示原始文本
- 记录错误日志
- 不影响其他内容的显示

**实现**:
`	ypescript
try {
  return <ReactMarkdown>{source}</ReactMarkdown>;
} catch (error) {
  console.error('Markdown render error:', error);
  return <Box whiteSpace="pre-wrap">{source}</Box>;
}
`

### 3. 引用数据获取错误

**错误场景**:
- 引用 ID 无效
- 引用数据不存在
- 网络请求失败

**处理策略**:
- 不显示引用图标（静默失败）
- 记录错误日志
- 不影响主要内容的显示

**实现**:
`	ypescript
const { data, error } = useRequest2(getQuoteData, { manual: true });

if (error) {
  console.error('Quote data fetch error:', error);
  return null; // 不显示引用
}
`

### 4. 样式冲突错误

**错误场景**:
- 思考模式样式污染最终答案
- 全局样式覆盖组件样式
- 主题切换导致样式错误

**处理策略**:
- 使用 CSS Modules 或 scoped styles
- 使用唯一的 className 前缀
- 使用 CSS-in-JS（styled-components）
- 定期进行样式隔离测试

**实现**:
`	ypescript
// 使用 CSS Modules
import styles from './AIResponseBox.module.scss';

<Box className={styles.thinkingMode}>
  {/* 思考模式内容 */}
</Box>

<Box className={styles.finalAnswer}>
  {/* 最终答案内容 */}
</Box>
`

## Testing Strategy

### 单元测试（Unit Tests）

**测试框架**: Vitest + React Testing Library

**测试范围**:
1. **图片渲染组件**
   - 测试正常图片加载
   - 测试图片加载失败显示占位符
   - 测试不同图片格式支持

2. **引用标记移除函数**
   - 测试移除单个引用标记
   - 测试移除多个引用标记
   - 测试移除后文本连贯性
   - 测试边界情况（空字符串、无引用标记等）

3. **样式隔离**
   - 测试思考模式背景色
   - 测试最终答案背景色
   - 测试样式不互相污染

**示例测试**:
`	ypescript
describe('removeCitationMarks', () => {
  it('should remove single citation mark', () => {
    const input = '这是一段文本[1]。';
    const output = removeCitationMarks(input);
    expect(output).toBe('这是一段文本。');
  });

  it('should remove multiple citation marks', () => {
    const input = '这是[1]一段[2]文本[3]。';
    const output = removeCitationMarks(input);
    expect(output).toBe('这是一段文本。');
  });

  it('should maintain text coherence after removal', () => {
    const input = '文本 [1] 内容';
    const output = removeCitationMarks(input);
    expect(output).not.toContain('  '); // 不应该有多余空格
  });
});
`

### 属性测试（Property-Based Tests）

**测试框架**: fast-check

**测试配置**: 每个属性测试最少 100 次迭代

**测试范围**:
1. **图片格式支持属性**（Property 1）
2. **图片加载失败处理属性**（Property 2）
3. **样式隔离属性**（Property 3）
4. **表格 HTML 清理属性**（Property 5）
5. **引用标记移除属性**（Property 7, 8）
6. **用户角色控制属性**（Property 9）

**示例属性测试**:
`	ypescript
import fc from 'fast-check';

describe('Property: Citation mark removal', () => {
  it('should remove all citation marks from any text', () => {
    // Feature: chat-display-optimization, Property 7: 引用标记移除
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.integer({ min: 1, max: 99 })),
        (text, citations) => {
          // 生成包含引用标记的文本
          let textWithCitations = text;
          citations.forEach(num => {
            textWithCitations += [];
          });

          // 移除引用标记
          const result = removeCitationMarks(textWithCitations);

          // 验证：结果中不应该包含任何引用标记
          expect(result).not.toMatch(/\[\d+\]/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
`

### 集成测试（Integration Tests）

**测试范围**:
1. **完整聊天流程**
   - 测试从 AI 回复到渲染的完整流程
   - 测试思考模式 + 最终答案的组合显示
   - 测试引用内容的显示/隐藏

2. **用户角色切换**
   - 测试普通用户看不到引用
   - 测试管理员可以看到引用
   - 测试角色切换后显示正确

3. **响应式布局**
   - 测试不同屏幕尺寸下的显示
   - 测试移动端和桌面端的差异

### 视觉回归测试（Visual Regression Tests）

**工具**: Playwright + Percy/Chromatic

**测试范围**:
1. 思考模式背景色
2. 最终答案背景色
3. 表格渲染样式
4. 移动端响应式布局

### 手动测试清单

**测试项目**:
- [ ] 图片正常加载显示
- [ ] 图片加载失败显示占位符
- [ ] 思考模式背景色为灰色
- [ ] 最终答案背景色为白色/透明
- [ ] 表格中没有 <br> 标签
- [ ] 表格支持自动换行
- [ ] 表格支持横向滚动
- [ ] 普通用户看不到引用标记
- [ ] 普通用户看不到引用图标
- [ ] 管理员可以看到引用内容
- [ ] 移动端布局正常
- [ ] 主题切换后样式正常

## Implementation Notes

### 1. 图片代理实现

如果需要解决 CORS 问题，可以考虑以下方案：
- 使用 Next.js API Route 作为图片代理
- 使用第三方图片代理服务（如 images.weserv.nl）
- 配置服务器端 CORS 头

### 2. 样式隔离最佳实践

- 使用 CSS Modules（推荐）
- 为每个组件使用唯一的 className 前缀
- 避免使用全局样式
- 使用 Chakra UI 的 sx prop 进行局部样式覆盖

### 3. 引用标记移除时机

引用标记应该在渲染阶段移除，而不是在数据层移除：
- 保留原始数据（包含引用标记）
- 在 Markdown 组件中进行文本预处理
- 根据用户角色决定是否移除

### 4. AI 模型配置更新

需要在以下位置更新 System Prompt：
- 工作流编辑器中的 AI 对话节点
- 默认应用的配置
- 可能需要创建新的应用版本

### 5. 性能优化

- 图片懒加载（使用 Intersection Observer）
- Markdown 渲染缓存（使用 useMemo）
- 引用数据缓存（避免重复请求）
- 虚拟滚动（如果聊天历史很长）
