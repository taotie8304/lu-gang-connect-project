// 鲁港通 - PPT 编辑：改文字、换图片、删页与调序；只动相关部件，其余原样保留
import type JSZip from 'jszip';
import type { DocumentEditOperation } from '../../llm/agentLoop/domain/systemTool/document/schema';
import { hasZipMagic, loadDocumentArchive } from '../limits';
import {
  PPTX_PRESENTATION_PART,
  PPTX_PRESENTATION_RELS_PART,
  parsePptxRelationships,
  parsePptxSldIdList,
  pptxRelsPartPath,
  readPptxSlideOrder,
  resolvePptxRelTarget,
  rewritePptxSldIdList,
  type PptxSlideEntry
} from '../pptxOrder';
import { DocumentEditError, type DocumentEditResult } from '../types';

const CONTENT_TYPES_PART = '[Content_Types].xml';
const MEDIA_PART_PATTERN = /^ppt\/media\/([^/]+)$/;
const MAX_MATCHES_PER_OP = 200;

export const PPTX_UNREADABLE_MESSAGE =
  '无法读取这个 PowerPoint 文件，可能已损坏；请确认文件能正常打开后再试。';
const PPTX_EDIT_FAILED_MESSAGE =
  '修改文件没有生成成功，请重试一次；如果仍然失败，请手动修改原文件。';
const PPTX_NO_ORDER_MESSAGE =
  '这个演示文稿缺少页序信息，无法删除页或调整页序；请先用 PowerPoint 打开并另存一次再试。';
const PPTX_IMAGE_CHANNEL_MESSAGE =
  '替换图片需要从本次对话上传的文件里读取新图片，请先在对话中上传图片后再试。';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const normalizeImageExtension = (value: string): string => {
  const lower = value.toLowerCase().replace(/^\./, '');
  return lower === 'jpeg' ? 'jpg' : lower;
};

export type PptxEditImageLoader = (
  sourceUrl: string
) => Promise<{ buffer: Buffer; extension: string }>;

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

const removePptxRelationship = (xml: string, rId: string): string =>
  xml.replace(
    new RegExp(`\\s*<Relationship\\b[^>]*\\bId="${escapeRegExp(rId)}"[^>]*?/?>`, 'g'),
    ''
  );

/** 鲁港通 - PPT 补丁器：文字与图片直接改写部件，删页与调序在收尾时统一改页序 */
export class PptxPatchDeck {
  private readonly editedParts = new Map<string, string | Buffer>();
  private readonly deletedParts = new Set<string>();
  private readonly skippedNotes: string[] = [];
  private readonly warningNotes = new Set<string>();
  private readonly pendingDeletes: string[] = [];
  private readonly pendingMoves: Array<{ from: PptxSlideEntry; to: PptxSlideEntry }> = [];
  private appliedCount = 0;
  private structureCommitted = false;

  private constructor(
    private readonly zip: JSZip,
    private readonly slides: PptxSlideEntry[],
    private readonly structuralSupported: boolean,
    private readonly loadImage?: PptxEditImageLoader
  ) {}

  static async load(
    buffer: Buffer,
    loadImage?: PptxEditImageLoader
  ): Promise<PptxPatchDeck> {
    const zip = await loadDocumentArchive(buffer);
    if (!zip.file(PPTX_PRESENTATION_PART)) throw new DocumentEditError(PPTX_UNREADABLE_MESSAGE);
    const order = await readPptxSlideOrder(zip);
    if (order.slides.length === 0) throw new DocumentEditError(PPTX_UNREADABLE_MESSAGE);
    return new PptxPatchDeck(zip, order.slides, Boolean(order.sldIdList), loadImage);
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

  private async readTextPart(partPath: string): Promise<string | undefined> {
    if (this.deletedParts.has(partPath)) return undefined;
    const edited = this.editedParts.get(partPath);
    if (typeof edited === 'string') return edited;
    const entry = this.zip.file(partPath);
    return entry ? entry.async('string') : undefined;
  }

  private setTextPart(partPath: string, xml: string): void {
    this.editedParts.set(partPath, xml);
  }

  private mediaPartPath(image: string): string | undefined {
    const target = image.trim().toLowerCase();
    for (const name of Object.keys(this.zip.files)) {
      if (this.deletedParts.has(name)) continue;
      const base = MEDIA_PART_PATTERN.exec(name)?.[1];
      if (base && base.toLowerCase() === target) return name;
    }
    return undefined;
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
      const xml = await this.readTextPart(target.partPath);
      if (xml === undefined) continue;
      const result = replaceInSlide(xml, find, replace, MAX_MATCHES_PER_OP - matched);
      matched += result.count;
      capped = capped || result.capped;
      if (result.count > 0) this.setTextPart(target.partPath, result.xml);
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

  async replaceImage({
    image,
    sourceUrl
  }: {
    image: string;
    sourceUrl: string;
  }): Promise<void> {
    const partPath = this.mediaPartPath(image);
    if (!partPath) {
      return this.noteSkipped(`图片清单里没有「${image}」，请用 read 返回的图片清单核对后重试`);
    }
    if (!this.loadImage) throw new DocumentEditError(PPTX_IMAGE_CHANNEL_MESSAGE);

    let loaded: { buffer: Buffer; extension: string };
    try {
      loaded = await this.loadImage(sourceUrl);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '';
      this.noteSkipped(
        `读取新图片失败${message ? `：${message}` : '，请确认图片在本次对话的文件清单里'}，已跳过`
      );
      return;
    }

    const extension = partPath.slice(partPath.lastIndexOf('.') + 1);
    const current = normalizeImageExtension(extension);
    const next = normalizeImageExtension(loaded.extension);
    if (current !== next) {
      return this.noteSkipped(
        `新图片格式（${next}）与原图（${current}）不一致，请换一张同格式的图片`
      );
    }

    this.editedParts.set(partPath, loaded.buffer);
    this.appliedCount += 1;
  }

  deleteSlide(slide: number): void {
    const entry = this.slides[slide - 1];
    if (!entry) {
      return this.noteSkipped(`第 ${slide} 张幻灯片在文件里不存在，已跳过`);
    }
    if (!this.structuralSupported || !entry.rId) {
      return this.noteSkipped(PPTX_NO_ORDER_MESSAGE);
    }
    if (this.pendingDeletes.includes(entry.partPath)) {
      return this.noteSkipped(`第 ${slide} 页已安排删除，无需重复`);
    }
    this.pendingDeletes.push(entry.partPath);
  }

  moveSlide(from: number, to: number): void {
    const fromEntry = this.slides[from - 1];
    const toEntry = this.slides[to - 1];
    if (!fromEntry || !toEntry) {
      return this.noteSkipped(`第 ${fromEntry ? to : from} 张幻灯片在文件里不存在，已跳过`);
    }
    if (fromEntry.partPath === toEntry.partPath) {
      return this.noteSkipped(`第 ${from} 页已经在该位置，无需调整`);
    }
    if (!this.structuralSupported || !fromEntry.rId || !toEntry.rId) {
      return this.noteSkipped(PPTX_NO_ORDER_MESSAGE);
    }
    this.pendingMoves.push({ from: fromEntry, to: toEntry });
  }

  private async removeContentTypeOverride(partPath: string): Promise<void> {
    const xml = await this.readTextPart(CONTENT_TYPES_PART);
    if (!xml) return;
    const pattern = new RegExp(
      `<Override\\b[^>]*\\bPartName="/?${escapeRegExp(partPath)}"[^>]*?/?>`,
      'g'
    );
    const next = xml.replace(pattern, '');
    if (next !== xml) this.setTextPart(CONTENT_TYPES_PART, next);
  }

  private async removeSlideParts(partPath: string): Promise<void> {
    const relsPath = pptxRelsPartPath(partPath);
    const slideRels = await this.readTextPart(relsPath);
    if (slideRels) {
      for (const rel of parsePptxRelationships(slideRels)) {
        if (!rel.type.endsWith('/notesSlide')) continue;
        const notesPath = resolvePptxRelTarget('ppt/slides', rel.target);
        this.zip.remove(notesPath);
        this.zip.remove(pptxRelsPartPath(notesPath));
        this.deletedParts.add(notesPath);
        await this.removeContentTypeOverride(notesPath);
      }
    }
    this.zip.remove(partPath);
    this.zip.remove(relsPath);
    this.deletedParts.add(partPath);
    this.deletedParts.add(relsPath);
    await this.removeContentTypeOverride(partPath);
  }

  /** 鲁港通 - 收尾：校验至少保留一页后统一删页与调序，避免页码在操作间漂移 */
  async commitStructure(): Promise<void> {
    if (this.structureCommitted) return;
    this.structureCommitted = true;
    if (this.pendingDeletes.length === 0 && this.pendingMoves.length === 0) return;

    const deleted = new Set(this.pendingDeletes);
    if (this.slides.every((entry) => deleted.has(entry.partPath))) {
      this.skippedNotes.push('不能删除全部幻灯片，至少要保留 1 页，已跳过');
      return;
    }

    const moves = this.pendingMoves.filter((move) => {
      if (deleted.has(move.from.partPath) || deleted.has(move.to.partPath)) {
        this.skippedNotes.push(
          `第 ${this.slides.indexOf(move.from) + 1} 页已被删除，页序调整已跳过`
        );
        return false;
      }
      return true;
    });

    const presentationXml = await this.readTextPart(PPTX_PRESENTATION_PART);
    const relsXml = await this.readTextPart(PPTX_PRESENTATION_RELS_PART);
    const list = presentationXml ? parsePptxSldIdList(presentationXml) : undefined;
    if (!presentationXml || !relsXml || !list) {
      this.skippedNotes.push(PPTX_NO_ORDER_MESSAGE);
      return;
    }

    let items = [...list.items];
    let nextRels = relsXml;
    for (const partPath of this.pendingDeletes) {
      const entry = this.slides.find((slide) => slide.partPath === partPath);
      if (!entry?.rId) continue;
      await this.removeSlideParts(partPath);
      nextRels = removePptxRelationship(nextRels, entry.rId);
      items = items.filter((item) => item.rId !== entry.rId);
    }

    for (const move of moves) {
      const fromIndex = items.findIndex((item) => item.rId === move.from.rId);
      const toIndex = items.findIndex((item) => item.rId === move.to.rId);
      if (fromIndex < 0 || toIndex < 0) continue;
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
    }

    this.setTextPart(
      PPTX_PRESENTATION_PART,
      rewritePptxSldIdList(presentationXml, list, items)
    );
    this.setTextPart(PPTX_PRESENTATION_RELS_PART, nextRels);
    this.appliedCount += this.pendingDeletes.length + moves.length;
  }

  async toBuffer(): Promise<Buffer> {
    for (const [partPath, content] of this.editedParts) {
      if (this.deletedParts.has(partPath)) continue;
      this.zip.file(partPath, content);
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
  if (operation.op === 'replace_image') {
    return deck.replaceImage({ image: operation.image, sourceUrl: operation.sourceUrl });
  }
  if (operation.op === 'delete_slide') {
    return deck.deleteSlide(operation.slide);
  }
  if (operation.op === 'move_slide') {
    return deck.moveSlide(operation.from, operation.to);
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

/** 鲁港通 - 编辑 PowerPoint：文字、图片、删页与调序，未命中不产出新文件 */
export const editPptx = async ({
  buffer,
  operations,
  loadImage
}: {
  buffer: Buffer;
  operations: DocumentEditOperation[];
  loadImage?: PptxEditImageLoader;
}): Promise<DocumentEditResult> => {
  if (!hasZipMagic(buffer)) throw new DocumentEditError(PPTX_UNREADABLE_MESSAGE);

  const deck = await PptxPatchDeck.load(buffer, loadImage);
  for (const operation of operations) await applyOperation(deck, operation);
  await deck.commitStructure();

  const outcome = deck.outcome;
  if (outcome.applied === 0) {
    const detail = outcome.skipped.slice(0, 3).join('；');
    throw new DocumentEditError(
      `没有找到与要求匹配的内容，未生成新文件。${detail ? `${detail}。` : ''}请核对页码、图片名或文字后重试。`
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