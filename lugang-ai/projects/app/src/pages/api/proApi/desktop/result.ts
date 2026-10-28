// 鲁港通 - 桌面客户端指令结果回传（阶段一）：同一指令只接受第一次结果，重复回传幂等返回
import type { ApiRequestProps } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import {
  authenticateDesktopDevice,
  clearDesktopDeviceBusy,
  saveDesktopCommandResult
} from '@fastgpt/service/support/desktopCommand/store';
import type { SubmitDesktopCommandResultResponse } from '@fastgpt/global/support/desktopCommand/type';

// 鲁港通 - 页面快照边界：与桌面端 snapshot.ts 的截断上限保持一致，防止超大载荷写入 Redis/Mongo
const snapshotElementSchema = z.object({
  ref: z.string().regex(/^e\d{1,4}$/, '元素引用格式不正确'),
  role: z.string().max(40),
  name: z.string().max(200),
  tag: z.string().max(20),
  type: z.string().max(20).optional(),
  placeholder: z.string().max(200).optional(),
  text: z.string().max(200).optional(),
  value: z.string().max(500).optional(),
  autocomplete: z.string().max(60).optional(),
  href: z.string().max(300).optional(),
  checked: z.boolean().optional(),
  disabled: z.boolean().optional(),
  visible: z.boolean().optional(),
  inViewport: z.boolean().optional(),
  rect: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    })
    .optional()
});

const snapshotSchema = z.object({
  url: z.string().max(2048),
  title: z.string().max(200),
  text: z.string().max(20_000),
  scroll: z.object({
    x: z.number(),
    y: z.number(),
    viewportWidth: z.number(),
    viewportHeight: z.number(),
    pageHeight: z.number()
  }),
  elements: z.array(snapshotElementSchema).max(300, '页面元素数量超出上限'),
  textTruncated: z.boolean().optional(),
  elementsTruncated: z.boolean().optional()
});

const fileResultSchema = z.object({
  name: z.string().trim().min(1).max(120),
  format: z.enum(['docx', 'xlsx', 'pdf', 'other']).optional(),
  folder: z.string().max(300).optional()
});

const confirmationSchema = z.object({
  required: z.boolean(),
  decision: z.enum(['allow', 'handoff', 'cancel', 'timeout', 'unavailable']),
  label: z.string().max(200).optional()
});

const tokenSchema = z.string().trim().min(1).max(200);
const warningsSchema = z.array(z.string().max(300)).max(20);
const skippedSchema = z.array(z.string().max(300)).max(200);

// 鲁港通 - 表单/文档摘要边界：桌面端解析时已截断（段落 300 段、字段 200 个、工作表 12 个等），
// 这里保留更宽的上限，只拦截异常载荷，避免把正文整篇或超长字段写进 Redis/Mongo
const formFieldSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().max(200),
  kind: z.enum(['text', 'choice', 'checkbox', 'date', 'table-cell', 'unknown']),
  required: z.boolean().optional(),
  options: z.array(z.string().max(200)).max(100).optional(),
  hint: z.string().max(300).optional()
});

const formSummarySchema = z.object({
  format: z.enum(['docx', 'xlsx', 'pdf']),
  name: z.string().trim().min(1).max(120),
  title: z.string().max(200).optional(),
  fields: z.array(formFieldSchema).max(300, '表单字段数量超出上限'),
  fieldsTruncated: z.boolean().optional(),
  warnings: warningsSchema.optional()
});

const formFillResultSchema = z.object({
  filled: z.number().int().min(0),
  skipped: skippedSchema.optional(),
  warnings: warningsSchema.optional()
});

const documentParagraphSchema = z.object({
  index: z.number().int().min(0),
  text: z.string().max(500),
  style: z.string().max(60).optional()
});

const documentTableSchema = z.object({
  index: z.number().int().min(0),
  rows: z.number().int().min(0),
  cells: z.number().int().min(0),
  header: z.array(z.string().max(120)).max(20)
});

const documentSheetColumnSchema = z.object({
  col: z.string().trim().min(1).max(3),
  header: z.string().max(120),
  mergedTo: z.string().trim().min(1).max(3).optional(),
  formula: z.boolean().optional()
});

const documentSheetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rowCount: z.number().int().min(0),
  columnCount: z.number().int().min(0),
  // 鲁港通 - 这些字段要原样透传，zod 默认会剥离未声明字段
  headerRow: z.number().int().min(0).max(1_000_000).optional(),
  header: z.array(z.string().max(120)).max(50),
  columns: z.array(documentSheetColumnSchema).max(50).optional(),
  sampleRows: z.array(z.array(z.string().max(300)).max(50)).max(20),
  sampleRowNumbers: z.array(z.number().int().min(0).max(1_000_000)).max(20).optional(),
  rowLabels: z
    .array(
      z.object({
        row: z.number().int().min(0).max(1_000_000),
        text: z.string().max(120)
      })
    )
    .max(80)
    .optional(),
  rowLabelsTruncated: z.boolean().optional()
});

const documentSummarySchema = z.object({
  format: z.enum(['docx', 'xlsx']),
  name: z.string().trim().min(1).max(120),
  paragraphs: z.array(documentParagraphSchema).max(500, '段落数量超出上限').optional(),
  tables: z.array(documentTableSchema).max(50).optional(),
  paragraphsTruncated: z.boolean().optional(),
  sheets: z.array(documentSheetSchema).max(50).optional(),
  sheetsTruncated: z.boolean().optional(),
  warnings: warningsSchema.optional()
});

const documentEditResultSchema = z.object({
  applied: z.number().int().min(0),
  skipped: skippedSchema.optional(),
  warnings: warningsSchema.optional()
});

const bodySchema = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, '设备标识格式不正确'),
  commandId: z.uuid('指令标识格式不正确'),
  result: z.object({
    ok: z.boolean(),
    code: z.string().trim().min(1).max(64).optional(),
    message: z.string().trim().max(500).optional(),
    changed: z.boolean().optional(),
    stopped: z.boolean().optional(),
    snapshot: snapshotSchema.optional(),
    file: fileResultSchema.optional(),
    confirmation: confirmationSchema.optional(),
    form: formSummarySchema.optional(),
    formToken: tokenSchema.optional(),
    fill: formFillResultSchema.optional(),
    document: documentSummarySchema.optional(),
    documentToken: tokenSchema.optional(),
    edit: documentEditResultSchema.optional()
  })
});

async function handler(req: ApiRequestProps): Promise<SubmitDesktopCommandResultResponse> {
  if (req.method !== 'POST') {
    throw new Error('请求方法不支持');
  }

  const { body } = parseApiInput({ req, bodySchema });
  await authenticateDesktopDevice({
    deviceId: body.deviceId,
    authorization: req.headers.authorization
  });

  const accepted = await saveDesktopCommandResult({
    commandId: body.commandId,
    result: body.result
  });
  // 结果已回传，客户端马上恢复长轮询，执行中标记不再需要
  await clearDesktopDeviceBusy(body.deviceId);

  return { accepted };
}

export default NextAPI(handler);
