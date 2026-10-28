// 鲁港通 - Excel 手术式补丁：只改目标单元格的工作表 XML，其余部件原样保留
// 走 ExcelJS 整簿读写会丢掉图片、打印设置、计算链与默认字体，副本必须与原件同版式。
import { posix } from 'node:path';
import AdmZip from 'adm-zip';
import { isSafeFormula } from '../formulaSafety';
import {
  MAX_REPLACEMENTS,
  MAX_SCAN_COLUMNS,
  MAX_SCAN_ROWS,
  PLAIN_NUMBER,
  formatCellReference,
  parseCellReference,
  type CellAddress
} from './xlsxRefs';

const CALC_CHAIN_PART = 'xl/calcChain.xml';
const WORKBOOK_PART = 'xl/workbook.xml';
const WORKBOOK_RELS_PART = 'xl/_rels/workbook.xml.rels';
const CONTENT_TYPES_PART = '[Content_Types].xml';
const SHARED_STRINGS_PART = 'xl/sharedStrings.xml';

const ATTRIBUTE_PATTERN = /([\w.-]+(?::[\w.-]+)?)="([^"]*)"/g;

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // 控制字符在 XML 1.0 里非法，写进去 Excel 会判定文件损坏
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const unescapeXml = (text: string): string =>
  text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readAttributes = (tag: string): Map<string, string> => {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
    attributes.set(match[1], unescapeXml(match[2]));
  }
  return attributes;
};

type ElementBounds = {
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
  selfClosing: boolean;
};

type LocatedCell = {
  bounds: ElementBounds;
  attributes: Map<string, string>;
  inner: string;
};

type SheetPart = { name: string; partPath: string };

type MergeRange = { top: number; left: number; bottom: number; right: number };

type CellWrite =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'number'; text: string }
  | { kind: 'formula'; formula: string };

export type XlsxPatchOutcome = {
  applied: number;
  skipped: string[];
  warnings: string[];
};

const resolvePartPath = (target: string): string =>
  target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join('xl', target));

const readSheetParts = (zip: AdmZip): SheetPart[] => {
  const workbookEntry = zip.getEntry(WORKBOOK_PART);
  const relsEntry = zip.getEntry(WORKBOOK_RELS_PART);
  if (!workbookEntry || !relsEntry) return [];

  const targets = new Map<string, string>();
  for (const match of relsEntry.getData().toString('utf8').matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const attributes = readAttributes(match[1]);
    const id = attributes.get('Id');
    const target = attributes.get('Target');
    if (!id || !target) continue;
    if (!attributes.get('Type')?.endsWith('/worksheet')) continue;
    targets.set(id, target);
  }

  const sheets: SheetPart[] = [];
  for (const match of workbookEntry.getData().toString('utf8').matchAll(/<(?:\w+:)?sheet\b([^>]*?)\/?>/g)) {
    const attributes = readAttributes(match[1]);
    const name = attributes.get('name');
    if (!name) continue;
    let relId: string | undefined;
    for (const [key, value] of attributes) {
      if (key === 'id' || key.endsWith(':id')) {
        relId = value;
        break;
      }
    }
    const target = relId ? targets.get(relId) : undefined;
    if (!target) continue;
    sheets.push({ name, partPath: resolvePartPath(target) });
  }
  return sheets;
};

const locateRow = (xml: string, rowNumber: number): ElementBounds | undefined => {
  for (const match of xml.matchAll(/<row\b([^>]*?)(\/?)>/g)) {
    if (readAttributes(match[1]).get('r') !== String(rowNumber)) continue;
    const start = match.index ?? 0;
    const tagEnd = start + match[0].length;
    if (match[2] === '/') {
      return { start, end: tagEnd, innerStart: tagEnd, innerEnd: tagEnd, selfClosing: true };
    }
    const close = xml.indexOf('</row>', tagEnd);
    if (close < 0) return undefined;
    return {
      start,
      end: close + '</row>'.length,
      innerStart: tagEnd,
      innerEnd: close,
      selfClosing: false
    };
  }
  return undefined;
};

const locateSheetData = (xml: string): ElementBounds | undefined => {
  const match = /<sheetData\b([^>]*?)(\/?)>/.exec(xml);
  if (!match) return undefined;
  const start = match.index;
  const tagEnd = start + match[0].length;
  if (match[2] === '/') {
    return { start, end: tagEnd, innerStart: tagEnd, innerEnd: tagEnd, selfClosing: true };
  }
  const close = xml.indexOf('</sheetData>', tagEnd);
  if (close < 0) return undefined;
  return {
    start,
    end: close + '</sheetData>'.length,
    innerStart: tagEnd,
    innerEnd: close,
    selfClosing: false
  };
};

const locateCell = (
  xml: string,
  address: CellAddress,
  row: ElementBounds
): LocatedCell | undefined => {
  if (row.selfClosing) return undefined;
  const content = xml.slice(row.innerStart, row.innerEnd);
  for (const match of content.matchAll(/<c\b([^>]*?)(\/?)>/g)) {
    const attributes = readAttributes(match[1]);
    const parsed = parseCellReference(attributes.get('r') ?? '');
    if (!parsed || parsed.row !== address.row || parsed.col !== address.col) continue;
    const start = row.innerStart + (match.index ?? 0);
    const tagEnd = start + match[0].length;
    if (match[2] === '/') {
      const bounds = { start, end: tagEnd, innerStart: tagEnd, innerEnd: tagEnd, selfClosing: true };
      return { bounds, attributes, inner: '' };
    }
    const close = xml.indexOf('</c>', tagEnd);
    if (close < 0) return undefined;
    const bounds = { start, end: close + 4, innerStart: tagEnd, innerEnd: close, selfClosing: false };
    return { bounds, attributes, inner: xml.slice(tagEnd, close) };
  }
  return undefined;
};

const locateCellAt = (xml: string, address: CellAddress): LocatedCell | undefined => {
  const row = locateRow(xml, address.row);
  return row ? locateCell(xml, address, row) : undefined;
};

const insertCellXml = (content: string, cellXml: string, column: number): string => {
  for (const match of content.matchAll(/<c\b([^>]*?)(\/?)>/g)) {
    const parsed = parseCellReference(readAttributes(match[1]).get('r') ?? '');
    if (!parsed || parsed.col <= column) continue;
    const at = match.index ?? 0;
    return content.slice(0, at) + cellXml + content.slice(at);
  }
  return content + cellXml;
};

const insertRowXml = (xml: string, rowNumber: number, rowXml: string): string => {
  const sheetData = locateSheetData(xml);
  if (!sheetData) return xml;
  if (sheetData.selfClosing) {
    return (
      xml.slice(0, sheetData.start) +
      `<sheetData>${rowXml}</sheetData>` +
      xml.slice(sheetData.end)
    );
  }
  const content = xml.slice(sheetData.innerStart, sheetData.innerEnd);
  for (const match of content.matchAll(/<row\b([^>]*?)>/g)) {
    const parsed = Number(readAttributes(match[1]).get('r'));
    if (!Number.isFinite(parsed) || parsed <= rowNumber) continue;
    const at = sheetData.innerStart + (match.index ?? 0);
    return xml.slice(0, at) + rowXml + xml.slice(at);
  }
  return xml.slice(0, sheetData.innerEnd) + rowXml + xml.slice(sheetData.innerEnd);
};

const buildCellXml = (ref: string, style: string | undefined, write: CellWrite): string => {
  const styleAttribute = style ? ` s="${style}"` : '';
  const head = `<c r="${ref}"${styleAttribute}`;
  if (write.kind === 'empty') return `${head}/>`;
  if (write.kind === 'number') return `${head}><v>${write.text}</v></c>`;
  if (write.kind === 'formula') return `${head}><f>${escapeXml(write.formula)}</f></c>`;
  return `${head} t="inlineStr"><is><t xml:space="preserve">${escapeXml(write.text)}</t></is></c>`;
};

const applyCellWrite = (
  xml: string,
  address: CellAddress,
  write: CellWrite,
  existing?: LocatedCell
): string => {
  const ref = formatCellReference(address);
  if (existing) {
    return (
      xml.slice(0, existing.bounds.start) +
      buildCellXml(ref, existing.attributes.get('s'), write) +
      xml.slice(existing.bounds.end)
    );
  }

  const row = locateRow(xml, address.row);
  if (!row) {
    return insertRowXml(
      xml,
      address.row,
      `<row r="${address.row}">${buildCellXml(ref, undefined, write)}</row>`
    );
  }
  const cellXml = buildCellXml(ref, undefined, write);
  if (row.selfClosing) {
    const openTag = xml.slice(row.start, row.innerStart).replace(/\/>$/, '>');
    return xml.slice(0, row.start) + `${openTag}${cellXml}</row>` + xml.slice(row.end);
  }
  const content = xml.slice(row.innerStart, row.innerEnd);
  return (
    xml.slice(0, row.innerStart) + insertCellXml(content, cellXml, address.col) + xml.slice(row.innerEnd)
  );
};

const extendDimension = (xml: string, address: CellAddress): string => {
  const match = /<dimension\b([^>]*?)(\/?)>/.exec(xml);
  if (!match || match.index === undefined) return xml;
  const ref = readAttributes(match[1]).get('ref');
  if (!ref) return xml;
  const [startRef, endRef = startRef] = ref.split(':');
  const start = parseCellReference(startRef);
  const end = parseCellReference(endRef);
  if (!start || !end) return xml;
  const nextEnd = { row: Math.max(end.row, address.row), col: Math.max(end.col, address.col) };
  if (nextEnd.row === end.row && nextEnd.col === end.col) return xml;
  const nextRef = `${formatCellReference(start)}:${formatCellReference(nextEnd)}`;
  const attributes = match[1].replace(/ref="[^"]*"/, `ref="${nextRef}"`);
  return (
    xml.slice(0, match.index) +
    `<dimension${attributes}${match[2]}>` +
    xml.slice(match.index + match[0].length)
  );
};

const readMergeRanges = (xml: string): MergeRange[] => {
  const section = /<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/.exec(xml);
  if (!section) return [];
  const ranges: MergeRange[] = [];
  for (const match of section[1].matchAll(/<mergeCell\b([^>]*?)\/?>/g)) {
    const ref = readAttributes(match[1]).get('ref');
    if (!ref) continue;
    const [startRef, endRef = startRef] = ref.split(':');
    const start = parseCellReference(startRef);
    const end = parseCellReference(endRef);
    if (!start || !end) continue;
    ranges.push({ top: start.row, left: start.col, bottom: end.row, right: end.col });
  }
  return ranges;
};

const mergeMasterOf = (ranges: MergeRange[], address: CellAddress): CellAddress | undefined => {
  for (const range of ranges) {
    if (address.row < range.top || address.row > range.bottom) continue;
    if (address.col < range.left || address.col > range.right) continue;
    if (address.row === range.top && address.col === range.left) return undefined;
    return { row: range.top, col: range.left };
  }
  return undefined;
};

const readMaxRow = (xml: string): number => {
  let max = 0;
  for (const match of xml.matchAll(/<row\b([^>]*?)>/g)) {
    const parsed = Number(readAttributes(match[1]).get('r'));
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return max;
};

const readRowStyles = (xml: string, row: ElementBounds): Map<number, string> => {
  const styles = new Map<number, string>();
  if (row.selfClosing) return styles;
  const content = xml.slice(row.innerStart, row.innerEnd);
  for (const match of content.matchAll(/<c\b([^>]*?)(\/?)>/g)) {
    const attributes = readAttributes(match[1]);
    const parsed = parseCellReference(attributes.get('r') ?? '');
    const style = attributes.get('s');
    if (!parsed || !style) continue;
    styles.set(parsed.col, style);
  }
  return styles;
};

const readDimensionEnd = (xml: string): CellAddress | undefined => {
  const match = /<dimension\b([^>]*?)\/?>/.exec(xml);
  const ref = match ? readAttributes(match[1]).get('ref') : undefined;
  if (!ref) return undefined;
  const [, endRef = ref] = ref.split(':');
  return parseCellReference(endRef);
};

const readTextRuns = (xml: string): string => {
  let text = '';
  for (const match of xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
    text += unescapeXml(match[1]);
  }
  return text;
};

const readSharedStrings = (zip: AdmZip): string[] => {
  const entry = zip.getEntry(SHARED_STRINGS_PART);
  if (!entry) return [];
  const xml = entry.getData().toString('utf8');
  const strings: string[] = [];
  let from = 0;
  for (;;) {
    const open = xml.indexOf('<si', from);
    if (open < 0) break;
    const next = xml[open + 3];
    if (next !== '>' && next !== '/' && !/\s/.test(next)) {
      from = open + 3;
      continue;
    }
    const tagEnd = xml.indexOf('>', open);
    if (tagEnd < 0) break;
    if (xml[tagEnd - 1] === '/') {
      strings.push('');
      from = tagEnd + 1;
      continue;
    }
    const close = xml.indexOf('</si>', tagEnd);
    if (close < 0) break;
    strings.push(readTextRuns(xml.slice(tagEnd + 1, close)));
    from = close + '</si>'.length;
  }
  return strings;
};

const readCachedValue = (inner: string): string => {
  const match = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
  return match ? unescapeXml(match[1]) : '';
};

const readCellText = (inner: string, type: string, sharedStrings: string[]): string => {
  if (type === 'inlineStr') {
    const inline = /<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/.exec(inner);
    return inline ? readTextRuns(inline[1]) : '';
  }
  if (type === 's') {
    const index = Number(readCachedValue(inner));
    return Number.isInteger(index) ? (sharedStrings[index] ?? '') : '';
  }
  if (type === 'str') return readCachedValue(inner);
  return '';
};

const hasFormula = (inner: string): boolean => /<(?:\w+:)?f\b/.test(inner);

const hasSharedFormula = (inner: string): boolean => /<(?:\w+:)?f\b[^>]*\bt="shared"/.test(inner);

const countOccurrences = (text: string, find: string): number => {
  let count = 0;
  let from = 0;
  for (;;) {
    const index = text.indexOf(find, from);
    if (index < 0) return count;
    count += 1;
    from = index + find.length;
  }
};

const setFullCalcOnLoad = (xml: string): string => {
  const existing = /<(?:\w+:)?calcPr\b([^>]*?)(\/?)>/.exec(xml);
  if (existing && existing.index !== undefined) {
    const attributes = existing[1].replace(/\sfullCalcOnLoad="[^"]*"/g, '');
    return (
      xml.slice(0, existing.index) +
      `<calcPr${attributes} fullCalcOnLoad="1"${existing[2]}>` +
      xml.slice(existing.index + existing[0].length)
    );
  }
  const anchor =
    /<(?:\w+:)?(?:oleSize|customWorkbookViews|pivotCaches|smartTagPr|smartTagTypes|webPublishing|fileRecoveryPr|webPublishObjects|extLst)\b/.exec(
      xml
    );
  if (anchor?.index !== undefined) {
    return xml.slice(0, anchor.index) + '<calcPr fullCalcOnLoad="1"/>' + xml.slice(anchor.index);
  }
  return xml.replace(/<\/(?:\w+:)?workbook>/, (match) => `<calcPr fullCalcOnLoad="1"/>${match}`);
};

/**
 * 单元格级补丁器：只替换目标单元格的 XML 片段，工作表其余内容与压缩包里其他部件保持原样。
 * 写入后统一要求 Excel 打开时重算，并删除会被改动写坏的计算链。
 */
export class XlsxPatchWorkbook {
  private readonly zip: AdmZip;
  private readonly sheets: SheetPart[];
  private readonly editedParts = new Map<string, string>();
  private readonly skippedNotes: string[] = [];
  private readonly warningNotes = new Set<string>();
  private sharedStrings: string[] | undefined;
  private appliedCount = 0;

  constructor(buffer: Buffer) {
    this.zip = new AdmZip(buffer);
    if (!this.zip.getEntry(WORKBOOK_PART)) {
      throw new Error('missing workbook part');
    }
    this.sheets = readSheetParts(this.zip);
  }

  get outcome(): XlsxPatchOutcome {
    return {
      applied: this.appliedCount,
      skipped: [...this.skippedNotes],
      warnings: [...this.warningNotes]
    };
  }

  noteSkipped(note: string): void {
    this.skippedNotes.push(note);
  }

  private skip(note: string): void {
    this.noteSkipped(note);
  }

  private readPart(partPath: string): string | undefined {
    const edited = this.editedParts.get(partPath);
    if (edited !== undefined) return edited;
    const entry = this.zip.getEntry(partPath);
    return entry ? entry.getData().toString('utf8') : undefined;
  }

  private writePart(partPath: string, xml: string): void {
    this.editedParts.set(partPath, xml);
  }

  private findSheet(name: string): SheetPart | undefined {
    const exact = this.sheets.find((sheet) => sheet.name === name);
    if (exact) return exact;
    const lower = name.trim().toLowerCase();
    return this.sheets.find((sheet) => sheet.name.trim().toLowerCase() === lower);
  }

  private getSharedStrings(): string[] {
    if (!this.sharedStrings) this.sharedStrings = readSharedStrings(this.zip);
    return this.sharedStrings;
  }

  private toCellWrite(value: string): CellWrite {
    if (value === '') return { kind: 'empty' };
    if (value.length > 1 && value.startsWith('=')) {
      const formula = value.slice(1);
      if (isSafeFormula(formula)) return { kind: 'formula', formula };
      this.warningNotes.add('部分以等号开头的内容因公式安全限制按文本写入。');
      return { kind: 'text', text: value };
    }
    if (PLAIN_NUMBER.test(value)) return { kind: 'number', text: value };
    return { kind: 'text', text: value };
  }

  setCell({ sheet, cell, value }: { sheet: string; cell: string; value: string }): void {
    const part = this.findSheet(sheet);
    if (!part) return this.skip(`工作表「${sheet}」不存在，已跳过`);
    const xml = this.readPart(part.partPath);
    if (xml === undefined) return this.skip(`工作表「${sheet}」无法读取，已跳过`);
    const address = parseCellReference(cell);
    if (!address) return this.skip(`单元格「${cell}」格式不正确，已跳过`);

    const target = mergeMasterOf(readMergeRanges(xml), address) ?? address;
    const existing = locateCellAt(xml, target);
    const write = this.toCellWrite(value);
    const ref = formatCellReference(target);

    if (existing && hasFormula(existing.inner)) {
      if (write.kind !== 'formula') {
        return this.skip(
          `单元格「${ref}」是公式单元格，已跳过；请改写它引用的输入格，公式会自动重算`
        );
      }
      if (hasSharedFormula(existing.inner)) {
        return this.skip(`单元格「${ref}」属于共享公式区域，已跳过，避免破坏整列公式`);
      }
    }

    const next = extendDimension(applyCellWrite(xml, target, write, existing), target);
    this.writePart(part.partPath, next);
    this.appliedCount += 1;
  }

  appendRow({ sheet, values }: { sheet: string; values: string[] }): void {
    const part = this.findSheet(sheet);
    if (!part) return this.skip(`工作表「${sheet}」不存在，已跳过`);
    const xml = this.readPart(part.partPath);
    if (xml === undefined) return this.skip(`工作表「${sheet}」无法读取，已跳过`);

    const rowNumber = readMaxRow(xml) + 1;
    const previous = locateRow(xml, rowNumber - 1);
    const styles = previous ? readRowStyles(xml, previous) : new Map<number, string>();

    const cells: string[] = [];
    values.forEach((value, index) => {
      if (value === '') return;
      const address = { row: rowNumber, col: index + 1 };
      cells.push(
        buildCellXml(formatCellReference(address), styles.get(address.col), this.toCellWrite(value))
      );
    });

    const rowXml =
      cells.length > 0 ? `<row r="${rowNumber}">${cells.join('')}</row>` : `<row r="${rowNumber}"/>`;
    const next = extendDimension(insertRowXml(xml, rowNumber, rowXml), {
      row: rowNumber,
      col: Math.max(1, values.length)
    });
    this.writePart(part.partPath, next);
    this.appliedCount += values.length;
  }

  replaceText({ sheet, find, replace }: { sheet?: string; find: string; replace: string }): void {
    const targets = sheet ? [this.findSheet(sheet)] : this.sheets;
    if (sheet && !targets[0]) return this.skip(`工作表「${sheet}」不存在，已跳过`);

    let matched = 0;
    for (const part of targets) {
      if (!part || matched >= MAX_REPLACEMENTS) break;
      const xml = this.readPart(part.partPath);
      if (xml === undefined) continue;
      const result = this.replaceInSheet(xml, part.name, find, replace, MAX_REPLACEMENTS - matched);
      matched += result.matched;
      if (result.matched > 0) this.writePart(part.partPath, result.xml);
    }

    if (matched === 0) {
      this.skip(`没有找到「${find}」，已跳过`);
      return;
    }
    if (matched >= MAX_REPLACEMENTS) {
      this.warningNotes.add(`替换次数较多，本次只处理了前 ${MAX_REPLACEMENTS} 处。`);
    }
    this.appliedCount += matched;
  }

  private replaceInSheet(
    xml: string,
    sheetName: string,
    find: string,
    replace: string,
    limit: number
  ): { xml: string; matched: number } {
    const sharedStrings = this.getSharedStrings();
    const merges = readMergeRanges(xml);
    const dimension = readDimensionEnd(xml);
    if (dimension && (dimension.row > MAX_SCAN_ROWS || dimension.col > MAX_SCAN_COLUMNS)) {
      this.warningNotes.add(
        `工作表「${sheetName}」较大，本次只扫描前 ${MAX_SCAN_ROWS} 行、${MAX_SCAN_COLUMNS} 列用于替换。`
      );
    }

    const edits: Array<{ start: number; end: number; xml: string }> = [];
    let matched = 0;
    for (const match of xml.matchAll(/<c\b([^>]*?)(\/?)>/g)) {
      const attributes = readAttributes(match[1]);
      const address = parseCellReference(attributes.get('r') ?? '');
      if (!address) continue;
      if (address.row > MAX_SCAN_ROWS || address.col > MAX_SCAN_COLUMNS) continue;
      if (match[2] === '/') continue;
      const start = match.index ?? 0;
      const tagEnd = start + match[0].length;
      const close = xml.indexOf('</c>', tagEnd);
      if (close < 0) continue;
      const inner = xml.slice(tagEnd, close);
      if (hasFormula(inner)) continue;
      if (mergeMasterOf(merges, address)) continue;
      const text = readCellText(inner, attributes.get('t') ?? '', sharedStrings);
      if (!text.includes(find)) continue;
      const occurrences = countOccurrences(text, find);
      if (occurrences === 0) continue;
      edits.push({
        start,
        end: close + 4,
        xml: buildCellXml(formatCellReference(address), attributes.get('s'), {
          kind: 'text',
          text: text.split(find).join(replace)
        })
      });
      matched += occurrences;
      if (matched >= limit) break;
    }

    let next = xml;
    for (const edit of edits.reverse()) {
      next = next.slice(0, edit.start) + edit.xml + next.slice(edit.end);
    }
    return { xml: next, matched };
  }

  toBuffer(): Buffer {
    for (const [partPath, xml] of this.editedParts) {
      this.zip.updateFile(partPath, Buffer.from(xml, 'utf8'));
    }

    const workbookEntry = this.zip.getEntry(WORKBOOK_PART);
    if (workbookEntry) {
      const xml = workbookEntry.getData().toString('utf8');
      this.zip.updateFile(WORKBOOK_PART, Buffer.from(setFullCalcOnLoad(xml), 'utf8'));
    }

    if (this.zip.getEntry(CALC_CHAIN_PART)) {
      this.zip.deleteFile(CALC_CHAIN_PART);
      this.stripContentType(CALC_CHAIN_PART);
      this.stripRelationship(CALC_CHAIN_PART);
    }

    return this.zip.toBuffer();
  }

  private stripContentType(partPath: string): void {
    const entry = this.zip.getEntry(CONTENT_TYPES_PART);
    if (!entry) return;
    const xml = entry.getData().toString('utf8');
    const pattern = new RegExp(
      `<Override\\b[^>]*PartName="/${escapeRegExp(partPath)}"[^>]*\\/>`,
      'g'
    );
    const next = xml.replace(pattern, '');
    if (next !== xml) this.zip.updateFile(CONTENT_TYPES_PART, Buffer.from(next, 'utf8'));
  }

  private stripRelationship(partPath: string): void {
    const entry = this.zip.getEntry(WORKBOOK_RELS_PART);
    if (!entry) return;
    const xml = entry.getData().toString('utf8');
    const baseName = partPath.split('/').pop() ?? partPath;
    const pattern = new RegExp(
      `<Relationship\\b[^>]*Target="[^"]*${escapeRegExp(baseName)}"[^>]*\\/>`,
      'g'
    );
    const next = xml.replace(pattern, '');
    if (next !== xml) this.zip.updateFile(WORKBOOK_RELS_PART, Buffer.from(next, 'utf8'));
  }
}
