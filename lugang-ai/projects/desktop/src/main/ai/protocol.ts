// 鲁港通 - AI 指令协议：桌面端只接受受控动作，上传与生成文件不允许携带本机路径
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

const generateFileCommand = z
  .object({
    action: z.literal('generate_file'),
    format: z.enum(['docx', 'xlsx', 'pdf']),
    fileName: z.string().trim().min(1).max(80),
    title: z.string().trim().max(200).optional(),
    content: z.string().max(20000).optional(),
    rows: z
      .array(z.array(z.string().max(500)).max(12))
      .max(1000)
      .optional()
  })
  .refine(
    (value) => Boolean(value.content?.trim() || value.title?.trim() || value.rows?.length),
    { message: '需要提供文件内容' }
  );

const uploadCommand = requiresLocator({
  action: z.literal('upload'),
  ...locateSchema
});

// 鲁港通 - 打开表单只让用户在原生文件框里选文件，协议层不接受任何本机路径
const openFormCommand = z.object({
  action: z.literal('open_form'),
  hint: z.string().trim().max(100).optional()
});

const fillFormFieldSchema = z.object({
  field: z.string().trim().min(1).max(200),
  value: z.string().max(2000)
});

// 鲁港通 - 回填只看服务端下发的字段清单，token 对应本机已打开的表单
const fillFormCommand = z.object({
  action: z.literal('fill_form'),
  token: z.string().trim().min(1).max(64),
  fields: z.array(fillFormFieldSchema).min(1).max(200)
});

export const aiCommandSchema = z.discriminatedUnion('action', [
  readCommand,
  navigateCommand,
  clickCommand,
  typeCommand,
  selectCommand,
  scrollCommand,
  uploadCommand,
  generateFileCommand,
  openFormCommand,
  fillFormCommand,
  stopCommand
]);

export type AiCommand = z.infer<typeof aiCommandSchema>;

export const parseAiCommand = (input: unknown): AiCommand | null => {
  const result = aiCommandSchema.safeParse(input);
  return result.success ? result.data : null;
};
