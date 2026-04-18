import { describe, it, expect } from 'vitest';
import { removeCitationMarks, preprocessTableMarkdown } from '@/components/Markdown/utils';

describe('removeCitationMarks', () => {
  // 鲁港通 - 测试移除单个引用标记
  it('should remove single citation mark', () => {
    const input = '这是一段文本[1]。';
    const expected = '这是一段文本。';
    expect(removeCitationMarks(input)).toBe(expected);
  });

  // 鲁港通 - 测试移除多个引用标记
  it('should remove multiple citation marks', () => {
    const input = '这是一段文本[1]，包含引用[2]和更多引用[3]。';
    const expected = '这是一段文本，包含引用和更多引用。';
    expect(removeCitationMarks(input)).toBe(expected);
  });

  // 鲁港通 - 测试处理没有引用标记的文本
  it('should handle text without citation marks', () => {
    const input = '这是一段没有引用的文本。';
    expect(removeCitationMarks(input)).toBe(input);
  });

  // 鲁港通 - 测试移除引用标记后处理多余空格
  it('should remove extra spaces after removing marks', () => {
    const input = '文本 [1] 引用';
    const expected = '文本 引用';
    expect(removeCitationMarks(input)).toBe(expected);
  });

  // 鲁港通 - 测试移除后文本的连贯性（标点符号前的空格）
  it('should ensure text coherence after removal', () => {
    const input = '这是文本[1] 。另一段[2] ，还有[3] ！';
    const expected = '这是文本。另一段，还有！';
    expect(removeCitationMarks(input)).toBe(expected);
  });

  // 鲁港通 - 测试处理空字符串
  it('should handle empty string', () => {
    expect(removeCitationMarks('')).toBe('');
  });

  // 鲁港通 - 测试处理多位数引用标记
  it('should remove multi-digit citation marks', () => {
    const input = '文本[10]和[99]以及[100]。';
    const expected = '文本和以及。';
    expect(removeCitationMarks(input)).toBe(expected);
  });

  // 鲁港通 - 测试处理连续的引用标记
  it('should handle consecutive citation marks', () => {
    const input = '文本[1][2][3]。';
    const expected = '文本。';
    expect(removeCitationMarks(input)).toBe(expected);
  });

  // 鲁港通 - 测试处理引用标记在句首
  it('should handle citation marks at the beginning', () => {
    const input = '[1]这是文本。';
    const expected = '这是文本。';
    expect(removeCitationMarks(input)).toBe(expected);
  });

  // 鲁港通 - 测试处理引用标记在句尾
  it('should handle citation marks at the end', () => {
    const input = '这是文本[1]';
    const expected = '这是文本';
    expect(removeCitationMarks(input)).toBe(expected);
  });

  // 鲁港通 - 测试处理多行文本
  it('should handle multi-line text', () => {
    const input = '第一行[1]\n第二行[2]\n第三行[3]';
    const expected = '第一行\n第二行\n第三行';
    expect(removeCitationMarks(input)).toBe(expected);
  });

  // 鲁港通 - 测试不移除非引用格式的方括号
  it('should not remove non-citation brackets', () => {
    const input = '这是[示例]文本，不是引用[1]。';
    const expected = '这是[示例]文本，不是引用。';
    expect(removeCitationMarks(input)).toBe(expected);
  });
});

// 鲁港通 - 表格预处理函数测试 (Requirements 4.2, 4.3)
describe('preprocessTableMarkdown', () => {
  // 鲁港通 - 测试移除表格中的 <br> 标签
  it('should remove <br> tags from table cells', () => {
    const input = `| 列1 | 列2 |
|-----|-----|
| 值1 | 值2<br>换行 |`;
    const output = preprocessTableMarkdown(input);
    expect(output).not.toContain('<br>');
    expect(output).toContain('值2 换行');
  });

  // 鲁港通 - 测试移除表格中的 <br/> 标签
  it('should remove <br/> tags from table cells', () => {
    const input = `| 列1 | 列2 |
|-----|-----|
| 值1 | 值2<br/>换行 |`;
    const output = preprocessTableMarkdown(input);
    expect(output).not.toContain('<br/>');
    expect(output).toContain('值2 换行');
  });

  // 鲁港通 - 测试移除表格中的 <br /> 标签（带空格）
  it('should remove <br /> tags with space from table cells', () => {
    const input = `| 列1 | 列2 |
|-----|-----|
| 值1 | 值2<br />换行 |`;
    const output = preprocessTableMarkdown(input);
    expect(output).not.toContain('<br />');
    expect(output).toContain('值2 换行');
  });

  // 鲁港通 - 测试移除多个 <br> 标签
  it('should remove multiple <br> tags from table cells', () => {
    const input = `| 列1 | 列2 |
|-----|-----|
| 值1<br>值2 | 值3<br>值4<br>值5 |`;
    const output = preprocessTableMarkdown(input);
    expect(output).not.toContain('<br>');
    expect(output).toContain('值1 值2');
    expect(output).toContain('值3 值4 值5');
  });

  // 鲁港通 - 测试处理没有表格的文本
  it('should handle text without tables', () => {
    const input = '这是普通文本<br>换行';
    const output = preprocessTableMarkdown(input);
    // 非表格内容不应该被处理
    expect(output).toBe(input);
  });

  // 鲁港通 - 测试处理空字符串
  it('should handle empty string', () => {
    expect(preprocessTableMarkdown('')).toBe('');
  });

  // 鲁港通 - 测试处理复杂表格
  it('should handle complex table with multiple rows', () => {
    const input = `| 姓名 | 地址 | 备注 |
|------|------|------|
| 张三 | 北京<br>朝阳区 | 无 |
| 李四 | 上海<br>浦东新区 | 重要<br>客户 |
| 王五 | 广州 | 无 |`;
    const output = preprocessTableMarkdown(input);
    expect(output).not.toContain('<br>');
    expect(output).toContain('北京 朝阳区');
    expect(output).toContain('上海 浦东新区');
    expect(output).toContain('重要 客户');
  });

  // 鲁港通 - 测试处理表格和非表格混合内容
  it('should only process table content', () => {
    const input = `这是普通文本<br>换行

| 列1 | 列2 |
|-----|-----|
| 值1<br>换行 | 值2 |

这是另一段文本<br>换行`;
    const output = preprocessTableMarkdown(input);
    // 表格中的 <br> 应该被移除
    expect(output).toContain('值1 换行');
    // 非表格中的 <br> 应该保留
    expect(output).toContain('这是普通文本<br>换行');
    expect(output).toContain('这是另一段文本<br>换行');
  });

  // 鲁港通 - 测试处理表格标题行
  it('should handle table header with <br> tags', () => {
    const input = `| 列1<br>标题 | 列2 |
|-----|-----|
| 值1 | 值2 |`;
    const output = preprocessTableMarkdown(input);
    expect(output).not.toContain('<br>');
    expect(output).toContain('列1 标题');
  });

  // 鲁港通 - 测试处理大小写混合的 <BR> 标签
  it('should handle case-insensitive <BR> tags', () => {
    const input = `| 列1 | 列2 |
|-----|-----|
| 值1<BR>换行 | 值2<Br>换行 |`;
    const output = preprocessTableMarkdown(input);
    expect(output).not.toMatch(/<br>/i);
    expect(output).toContain('值1 换行');
    expect(output).toContain('值2 换行');
  });

  // 鲁港通 - 测试清理多余空格
  it('should clean up extra spaces after removing <br> tags', () => {
    const input = `| 列1 | 列2 |
|-----|-----|
| 值1<br>  <br>值2 | 值3 |`;
    const output = preprocessTableMarkdown(input);
    expect(output).not.toContain('<br>');
    // 多个空格应该被合并为单个空格
    expect(output).not.toContain('  ');
    expect(output).toContain('值1 值2');
  });
});
