// 鲁港通 - PPT 编辑：只改幻灯片里的文字节点，可指定页或全片，跨 run 命中保留首个 run 样式
import type JSZip from 'jszip';
import type { DocumentEditOperation } from '../../llm/agentLoop/domain/systemTool/document/schema';
import { hasZipMagic, loadDocumentArchive } from '../limits';
import { DocumentEditError, type DocumentEditResult } from '../types';

const PRESENTATION_PART = 'ppt/presentation.xml';
const SLIDE_PART_PATTERN = /^ppt\/slides\/slide(\d+)\.xml$/;
const MAX_MATCHES_PER_OP = 200;

export const PPTX_UNREADABLE_MESSAGE =
  '无法读取这个 PowerPoint 文件，可能已损坏；请确认文件能正常打开后再试。';
const PPTX_EDIT_FAILED_MESSAGE =
  '修改文件没有生成成功，请重试一次；如果仍然失败，请手动修改原文件。';

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const unescapeXml = (text: string): string =>
  text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

type TextItem = {
  start: number;
  end: number;
  text: string;
  openStart: number;
  openEnd: number;
  innerStart: number;
  innerEnd: number;
  attributes: string;
};

type ParagraphBounds = { start: number; end: number };

const collectTextItems = (paragraph: string): { text: string; items: TextItem[] } => {
  const items: TextItem[] = [];
  let text = '';
  for (const match of paragraph.matchAll(/<a:t\b([^>]*?)(\/?)>([\s\S]*?)<\/a:t>/g)) {
    const value = unescapeXml(match[3]);
    const openStart = match.index ?? 0;
    const openEnd = openStart + match[0].indexOf('>') + 1;
    items.push({
      start: text.length,
      end: text.length + value.length,
      text: value,
      openStart,
      openEnd,
      innerStart: openEnd,
      innerEnd: openEnd + match[3].length,
      attributes: match[1]
    });
    text += value;
  }
  return { text, items };
};

// 鲁港通 - 匹配文本插入到命中开始的那个 run，其余 run 只删掉命中部分，样式与结构保持原样
const buildItemText = (
  item: TextItem,
  matches: Array<{ start: number; end: number }>,
  replacement: string
): string => {
  let result = '';
  let position = item.start;
  for (const match of matches) {
    if (match.end <= item.start || match.start >= item.end) continue;
    const from = Math.max(match.start, position);
    if (from > position) result += item.text.slice(position - item.start, from - item.start);
    if (match.start >= item.start) result += replacement;
    position = Math.min(match.end, item.end);
  }
  result += item.text.slice(position - item.start);
  return result;
};

const buildTextElement = (item: TextItem, text: string): string => {
  const attributes = /xml:space=/.test(item.attributes)
    ? item.attributes
    : ` xml:space="preserve"${item.attributes}`;
  return `<a:t${attributes}>${escapeXml(text)}</a:t>`;
};

const replaceInParagraph = (
  paragraph: string,
  find: string,
  replace: string,
  limit: number
): { xml: string; count: number; capped: boolean } => {
  if (limit <= 0) return { xml: paragraph, count: 0, capped: true };
  const { text, items } = collectTextItems(paragraph);
  const matches: Array<{ start: number; end: number }> = [];
  let from = 0;
  while (matches.length < limit) {
    const index = text.indexOf(find, from);
    if (index < 0) break;
    matches.push({ start: index, end: index + find.length });
    from = index + find.length;
  }
  if (matches.length === 0) return { xml: paragraph, count: 0, capped: false };
  const capped = matches.length >= limit && text.indexOf(find, from) >= 0;

  let next = paragraph;
  for (const item of [...items].reverse()) {
    const value = buildItemText(item, matches, replace);
    if (value === item.text) continue;
    next =
      next.slice(0, item.openStart) +
      buildTextElement(item, value) +
      next.slice(item.innerEnd + '</a:t>'.length);
  }
  return { xml: next, count: matches.length, capped };
};

const collectParagraphs = (xml: string): ParagraphBounds[] => {
  const paragraphs: ParagraphBounds[] = [];
  for (const match of xml.matchAll(/<a:p\b([^>]*?)(\/?)>/g)) {
    const start = match.index ?? 0;
    const tagEnd = start + match[0].length;
    if (match[2] === '/') {
      paragraphs.push({ start, end: tagEnd });
      continue;
    }
    const close = xml.indexOf('</a:p>', tagEnd);
    if (close < 0) continue;
    paragraphs.push({ start, end: close + '</a:p>'.length });
  }
  return paragraphs;
};

const replaceInSlide = (
  xml: string,
  find: string,
  replace: string,
  limit: number
): { xml: string; count: number; capped: boolean } => {
  let next = xml;
  let count = 0;
  let capped = false;
  const paragraphs = collectParagraphs(xml);
  for (const bounds of [...paragraphs].reverse()) {
    if (count >= limit) {
      capped = true;
      break;
    }
    const paragraph = xml.slice(bounds.start, bounds.end);
    const result = replaceInParagraph(paragraph, find, replace, limit - count);
    count += result.count;
    capped = capped || result.capped;
    if (result.count > 0) {
      next = next.slice(0, bounds.start) + result.xml + next.slice(bounds.end);
    }
  }
  return { xml: next, count, capped };
};

type SlidePart = { name: string; number: number };

const readSlideParts = (zip: JSZip): SlidePart[] => {
  const slides: SlidePart[] = [];
  for (const name of Object.keys(zip.files)) {
    const match = SLIDE_PART_PATTERN.exec(name);
    if (!match) continue;
    slides.push({ name, number: Number(match[1]) });
  }
  return slides.sort((left, right) => left.number - right.number);
};

/** 鲁港通 - PPT 补丁器：只重写改动过的幻灯片 XML，其余部件原样保留 */
export class PptxPatchDeck {
  private readonly editedParts = new Map<string, string>();
  private readonly skippedNotes: string[] = [];
  private readonly warningNotes = new Set<string>();
  private appliedCount = 0;

  private constructor(
    private readonly zip: JSZip,
    private readonly slides: SlidePart[]
  ) {}

  static async load(buffer: Buffer): Promise<PptxPatchDeck> {
    const zip = await loadDocumentArchive(buffer);
    if (!zip.file(PRESENTATION_PART)) throw new DocumentEditError(PPTX_UNREADABLE_MESSAGE);
    const slides = readSlideParts(zip);
    if (slides.length === 0) throw new DocumentEditError(PPTX_UNREADABLE_MESSAGE);
    return new PptxPatchDeck(zip, slides);
  }

  get outcome(): { applied: number; skipped: string[]; warnings: string[] } {
    return {
      applied: this.appliedCount,
      skipped: [...this.skippedNotes],
      warnings: [...this.warningNotes]
    };
  }

  noteSkipped(note: string): void {
    this.skippedNotes.push(note);
  }

  private async readPart(partPath: string): Promise<string | undefined> {
    const edited = this.editedParts.get(partPath);
    if (edited !== undefined) return edited;
    const entry = this.zip.file(partPath);
    return entry ? entry.async('string') : undefined;
  }

  async replaceText({
    find,
    replace,
    slide
  }: {
    find: string;
    replace: string;
    slide?: number;
  }): Promise<void> {
    let targets = this.slides;
    if (slide !== undefined) {
      const target = this.slides[slide - 1];
      if (!target) {
        return this.noteSkipped(`第 ${slide} 张幻灯片在文件里不存在，已跳过`);
      }
      targets = [target];
    }

    let matched = 0;
    let capped = false;
    for (const target of targets) {
      if (matched >= MAX_MATCHES_PER_OP) {
        capped = true;
        break;
      }
      const xml = await this.readPart(target.name);
      if (xml === undefined) continue;
      const result = replaceInSlide(xml, find, replace, MAX_MATCHES_PER_OP - matched);
      matched += result.count;
      capped = capped || result.capped;
      if (result.count > 0) this.editedParts.set(target.name, result.xml);
    }

    if (matched === 0) {
      this.noteSkipped(`没有找到「${find}」，已跳过`);
      return;
    }
    if (capped) {
      this.warningNotes.add(`替换内容出现次数较多，本次只处理了前 ${MAX_MATCHES_PER_OP} 处。`);
    }
    this.appliedCount += matched;
  }

  async toBuffer(): Promise<Buffer> {
    for (const [partPath, xml] of this.editedParts) {
      this.zip.file(partPath, xml);
    }
    return this.zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}

const applyOperation = async (
  deck: PptxPatchDeck,
  operation: DocumentEditOperation
): Promise<void> => {
  if (operation.op === 'replace_text') {
    if (operation.paragraph !== undefined) {
      return deck.noteSkipped('「按段落替换」只适用于 Word，已跳过');
    }
    if (operation.sheet !== undefined) {
      return deck.noteSkipped('「按工作表替换」只适用于 Excel，已跳过');
    }
    return deck.replaceText({
      find: operation.find,
      replace: operation.replace,
      slide: operation.slide
    });
  }
  if (operation.op === 'set_cell' || operation.op === 'append_row') {
    return deck.noteSkipped('单元格与追加行操作只适用于 Excel，已跳过');
  }
  if (operation.op === 'set_paragraph' || operation.op === 'set_table_cell') {
    return deck.noteSkipped('段落与表格单元格操作只适用于 Word，已跳过');
  }
  if (operation.op === 'insert_paragraph' || operation.op === 'append_paragraph') {
    return deck.noteSkipped('段落操作只适用于 Word，已跳过');
  }
  return deck.noteSkipped('填写表单与叠加文字只适用于 PDF，已跳过');
};

/** 鲁港通 - 编辑 PowerPoint：只做文字替换，未命中不产出新文件 */
export const editPptx = async ({
  buffer,
  operations
}: {
  buffer: Buffer;
  operations: DocumentEditOperation[];
}): Promise<DocumentEditResult> => {
  if (!hasZipMagic(buffer)) throw new DocumentEditError(PPTX_UNREADABLE_MESSAGE);

  const deck = await PptxPatchDeck.load(buffer);
  for (const operation of operations) await applyOperation(deck, operation);

  const outcome = deck.outcome;
  if (outcome.applied === 0) {
    const detail = outcome.skipped.slice(0, 3).join('；');
    throw new DocumentEditError(
      `没有找到与要求匹配的内容，未生成新文件。${detail ? `${detail}。` : ''}请核对页码或文字后重试。`
    );
  }

  let output: Buffer;
  try {
    output = await deck.toBuffer();
  } catch {
    throw new DocumentEditError(PPTX_EDIT_FAILED_MESSAGE);
  }

  return {
    buffer: output,
    applied: outcome.applied,
    skipped: outcome.skipped,
    warnings: outcome.warnings
  };
};
