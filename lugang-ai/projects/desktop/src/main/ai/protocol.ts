// 鲁港通 - AI 指令协议：桌面端只接受受控动作，拒绝提交/支付类动作
import { z } from 'zod';

const refSchema = z.string().trim().min(1).max(32);
const targetSchema = z.string().trim().min(1).max(200);

const locateSchema = {
  ref: refSchema.optional(),
  target: targetSchema.optional()
};

const requiresLocator = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).refine(
    (value) => {
      const locator = value as { ref?: string; target?: string };
      return Boolean(locator.ref || locator.target);
    },
    { message: '需要提供元素引用或元素描述' }
  );

const readCommand = z.object({
  action: z.literal('read'),
  fullText: z.boolean().optional()
});

const navigateCommand = z.object({
  action: z.literal('navigate'),
  url: z.string().trim().min(1).max(2048)
});

const clickCommand = requiresLocator({
  action: z.literal('click'),
  ...locateSchema,
  expect: z.string().trim().max(200).optional()
});

const typeCommand = requiresLocator({
  action: z.literal('type'),
  ...locateSchema,
  text: z.string().max(2000),
  expect: z.string().trim().max(200).optional()
});

const selectCommand = requiresLocator({
  action: z.literal('select'),
  ...locateSchema,
  option: z.string().trim().min(1).max(200)
});

const scrollCommand = z.object({
  action: z.literal('scroll'),
  direction: z.enum(['up', 'down', 'top', 'bottom']),
  amount: z.number().int().min(1).max(5000).optional()
});

const stopCommand = z.object({
  action: z.literal('stop')
});

export const aiCommandSchema = z.discriminatedUnion('action', [
  readCommand,
  navigateCommand,
  clickCommand,
  typeCommand,
  selectCommand,
  scrollCommand,
  stopCommand
]);

export type AiCommand = z.infer<typeof aiCommandSchema>;

export const parseAiCommand = (input: unknown): AiCommand | null => {
  const result = aiCommandSchema.safeParse(input);
  return result.success ? result.data : null;
};
