// 鲁港通 - 首页史莱姆拖拽坐标：归一化定位、边界收拢与本地存储序列化

export type MascotPoint = { x: number; y: number };

const round = (value: number) => Math.round(value * 10000) / 10000;

/**
 * 把指针位置换算为相对 hero 的归一化坐标，并保证史莱姆完整落在区域内。
 * 区域小于史莱姆（含边距）时退回中心点。
 */
export const clampMascotPoint = ({
  pointerX,
  pointerY,
  heroRect,
  mascotSize,
  margin = 16
}: {
  pointerX: number;
  pointerY: number;
  heroRect: { left: number; top: number; width: number; height: number };
  mascotSize: { width: number; height: number };
  margin?: number;
}): MascotPoint => {
  const minX = margin + mascotSize.width / 2;
  const maxX = heroRect.width - minX;
  const minY = margin + mascotSize.height / 2;
  const maxY = heroRect.height - minY;

  if (heroRect.width <= 0 || heroRect.height <= 0 || maxX < minX || maxY < minY) {
    return { x: 0.5, y: 0.5 };
  }

  const px = Math.min(maxX, Math.max(minX, pointerX - heroRect.left));
  const py = Math.min(maxY, Math.max(minY, pointerY - heroRect.top));

  return {
    x: round(px / heroRect.width),
    y: round(py / heroRect.height)
  };
};

export const serializeMascotPoint = (point: MascotPoint): string =>
  `${round(point.x)},${round(point.y)}`;

export const parseMascotPoint = (raw: string | null): MascotPoint | null => {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: round(Math.min(1, Math.max(0, x))),
    y: round(Math.min(1, Math.max(0, y)))
  };
};
