// 鲁港通 - IPC 参数校验：拒绝越界尺寸、非法标签 id 与超长网址
import { z } from 'zod';

const finiteNumber = z.number().refine((value) => Number.isFinite(value), {
  message: '必须是有限数字'
});

export const cssRectSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: finiteNumber.refine((value) => value >= 0, { message: '宽度不能为负' }),
  height: finiteNumber.refine((value) => value >= 0, { message: '高度不能为负' })
});

export const booleanSchema = z.boolean();

export const tabIdSchema = z.number().int().positive();

export const navigateUrlSchema = z.string().trim().min(1).max(2048);

export const createTabSchema = z.object({ url: navigateUrlSchema.optional() }).optional();
