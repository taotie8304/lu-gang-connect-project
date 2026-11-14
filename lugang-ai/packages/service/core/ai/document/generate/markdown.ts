// 鲁港通 - Markdown 生成器：把结构化块序列化为 GFM 文本
import type { GeneratedBlock } from '../../llm/agentLoop/domain/systemTool/generatedSchema';
import {
  assertGenerateInputWithinLimits,
  DocumentGenerationError,
  type DocumentGenerateInput
} from '../types';

const serializeBlock = (block: GeneratedBlock): string => {
  if (block.type === 'heading') {
    const level = Math.min(3, Math.max(1, block.level ?? 1));
    return `${'#'.repeat(level)} ${block.text}`;
  }
  if (block.type === 'paragraph') return block.text;
  if (block.type === 'list') {
    return block.items
      .map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`))
      .join('\n');
  }
  if (block.type === 'table') {
    const rows = block.rows ?? [];
    if (!block.header?.length) {
      return rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
    }
    return [
      `| ${block.header.join(' | ')} |`,
      `| ${block.header.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`)
    ].join('\n');
  }
  if (block.type === 'divider') return '---';
  return '<!-- pagebreak -->';
};

export const serializeMarkdownBlocks = (blocks: GeneratedBlock[]): string =>
  blocks.map(serializeBlock).join('\n\n');

/**
 * 鲁港通 - 生成 Markdown 文本 Buffer；有 blocks 时按块序列化，否则原样输出 content。
 */
export const generateMarkdown = (input: DocumentGenerateInput): Buffer => {
  assertGenerateInputWithinLimits(input);

  const parts: string[] = [];
  const title = input.title?.trim();
  if (title) parts.push(`# ${title}`);

  const body = input.blocks?.length
    ? serializeMarkdownBlocks(input.blocks)
    : input.content?.trim();
  if (body) parts.push(body);

  if (parts.length === 0) {
    throw new DocumentGenerationError('需要提供文档内容后再生成');
  }

  return Buffer.from(`${parts.join('\n\n')}\n`, 'utf8');
};
