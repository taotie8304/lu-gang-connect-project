// 鲁港通 - 桌面客户端指令结果回传（阶段一）：同一指令只接受第一次结果，重复回传幂等返回
import type { ApiRequestProps } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import {
  authenticateDesktopDevice,
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
    confirmation: confirmationSchema.optional()
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

  return { accepted };
}

export default NextAPI(handler);
