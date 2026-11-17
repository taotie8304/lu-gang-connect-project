// 鲁港通 - PPTX 页序解析：优先 presentation.xml 的 sldIdLst，缺失时回退幻灯片文件名顺序
import type JSZip from 'jszip';

export const PPTX_SLIDE_PART_PATTERN = /^ppt\/slides\/slide(\d+)\.xml$/;
export const PPTX_PRESENTATION_PART = 'ppt/presentation.xml';
export const PPTX_PRESENTATION_RELS_PART = 'ppt/_rels/presentation.xml.rels';

export type PptxSlideEntry = { partPath: string; rId?: string };

export const pptxSlidePartNumber = (partPath: string): number =>
  Number(PPTX_SLIDE_PART_PATTERN.exec(partPath)?.[1] ?? 0);

/** 鲁港通 - 关系里的相对 Target 解析成包内部件路径（如 slides/slide1.xml → ppt/slides/slide1.xml） */
export const resolvePptxRelTarget = (baseDir: string, target: string): string => {
  if (target.startsWith('/')) return target.slice(1);
  const stack: string[] = [];
  for (const segment of `${baseDir}/${target}`.split('/')) {
    if (segment === '..') stack.pop();
    else if (segment && segment !== '.') stack.push(segment);
  }
  return stack.join('/');
};

export type PptxRelationship = { id: string; type: string; target: string };

export const parsePptxRelationships = (xml: string): PptxRelationship[] => {
  const items: PptxRelationship[] = [];
  for (const match of xml.matchAll(/<Relationship\b[^>]*?\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(match[0])?.[1];
    const type = /\bType="([^"]+)"/.exec(match[0])?.[1] ?? '';
    const target = /\bTarget="([^"]+)"/.exec(match[0])?.[1];
    if (id && target) items.push({ id, type, target });
  }
  return items;
};

export const pptxRelsPartPath = (partPath: string): string => {
  const index = partPath.lastIndexOf('/');
  return `${partPath.slice(0, index)}/_rels/${partPath.slice(index + 1)}.rels`;
};

export type PptxSldIdItem = { xml: string; rId: string };

export type PptxSldIdList = {
  innerStart: number;
  innerEnd: number;
  items: PptxSldIdItem[];
};

export const parsePptxSldIdList = (xml: string): PptxSldIdList | undefined => {
  const open = /<p:sldIdLst\b[^>]*>/.exec(xml);
  if (!open) return undefined;
  const innerStart = (open.index ?? 0) + open[0].length;
  const innerEnd = xml.indexOf('</p:sldIdLst>', innerStart);
  if (innerEnd < 0) return undefined;
  const items: PptxSldIdItem[] = [];
  for (const match of xml.slice(innerStart, innerEnd).matchAll(/<p:sldId\b[^>]*\/>/g)) {
    const rId = /\br:id="([^"]+)"/.exec(match[0])?.[1];
    if (rId) items.push({ xml: match[0], rId });
  }
  return { innerStart, innerEnd, items };
};

export const rewritePptxSldIdList = (
  xml: string,
  list: PptxSldIdList,
  items: Array<{ xml: string }>
): string =>
  xml.slice(0, list.innerStart) + items.map((item) => item.xml).join('') + xml.slice(list.innerEnd);

export const readPptxSlideOrder = async (
  zip: JSZip
): Promise<{
  slides: PptxSlideEntry[];
  presentationXml?: string;
  sldIdList?: PptxSldIdList;
}> => {
  const presentationXml = await zip.file(PPTX_PRESENTATION_PART)?.async('string');
  const relsXml = await zip.file(PPTX_PRESENTATION_RELS_PART)?.async('string');

  const slideRelTargets = new Map<string, string>();
  if (relsXml) {
    for (const rel of parsePptxRelationships(relsXml)) {
      if (!rel.type.endsWith('/slide')) continue;
      slideRelTargets.set(rel.id, resolvePptxRelTarget('ppt', rel.target));
    }
  }

  const sldIdList = presentationXml ? parsePptxSldIdList(presentationXml) : undefined;
  const slides: PptxSlideEntry[] = [];
  const seen = new Set<string>();
  for (const item of sldIdList?.items ?? []) {
    const partPath = slideRelTargets.get(item.rId);
    if (!partPath || seen.has(partPath) || !zip.file(partPath)) continue;
    slides.push({ partPath, rId: item.rId });
    seen.add(partPath);
  }

  const remaining = Object.keys(zip.files)
    .filter((name) => PPTX_SLIDE_PART_PATTERN.test(name) && !zip.files[name].dir)
    .sort((left, right) => pptxSlidePartNumber(left) - pptxSlidePartNumber(right));
  for (const partPath of remaining) {
    if (seen.has(partPath)) continue;
    slides.push({ partPath });
    seen.add(partPath);
  }

  return { slides, presentationXml, sldIdList };
};