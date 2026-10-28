// 鲁港通 - PDF 黄底叠加纯计算：按页筛出条目，把 0~1 归一化矩形换算成百分比定位
import type {
  DesktopDocumentChangeStatus,
  DesktopDocumentSnapshot,
  DesktopPdfOverlayItem
} from './desktopBridge';

export type PdfOverlayTone = 'pending' | 'applied';

export type PdfOverlayBox = {
  key: string;
  index: number;
  kind: 'label' | 'value';
  tone: PdfOverlayTone;
  label: string;
  value: string;
  style: { left: string; top: string; width: string; height: string };
};

const clampFraction = (value: number): number =>
  !Number.isFinite(value) ? 0 : Math.min(Math.max(value, 0), 1);

const percent = (value: number): string => `${(value * 100).toFixed(3)}%`;

const boxStyle = (rect: { x: number; y: number; width: number; height: number }) => {
  const left = clampFraction(rect.x);
  const top = clampFraction(rect.y);
  const right = Math.min(left + clampFraction(rect.width), 1);
  const bottom = Math.min(top + clampFraction(rect.height), 1);
  return {
    left: percent(left),
    top: percent(top),
    width: percent(Math.max(right - left, 0.004)),
    height: percent(Math.max(bottom - top, 0.004))
  };
};

export const pdfOverlayTone = (
  status: DesktopDocumentChangeStatus
): PdfOverlayTone | undefined =>
  status === 'applied' ? 'applied' : status === 'pending' ? 'pending' : undefined;

/** 鲁港通 - 跳过与找不到标签的条目不画标记，避免用户误以为会写进副本 */
export const pdfOverlayBoxes = (
  items: DesktopPdfOverlayItem[] | undefined,
  page: number
): PdfOverlayBox[] => {
  const boxes: PdfOverlayBox[] = [];
  for (const item of items ?? []) {
    if (item.page !== page) continue;
    const tone = pdfOverlayTone(item.status);
    if (!tone) continue;
    if (item.labelRect) {
      boxes.push({
        key: `${item.index}-label`,
        index: item.index,
        kind: 'label',
        tone,
        label: item.label,
        value: item.value,
        style: boxStyle(item.labelRect)
      });
    }
    if (item.valueRect) {
      boxes.push({
        key: `${item.index}-value`,
        index: item.index,
        kind: 'value',
        tone,
        label: item.label,
        value: item.value,
        style: boxStyle(item.valueRect)
      });
    }
  }
  return boxes;
};

/** 鲁港通 - 当前待确认的条目，用于在页面上加粗描边 */
export const findActivePdfChangeIndex = (
  snapshot: DesktopDocumentSnapshot
): number | undefined => snapshot.changes.find((change) => change.status === 'pending')?.index;
