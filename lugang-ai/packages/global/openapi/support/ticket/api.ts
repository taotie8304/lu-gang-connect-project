import z from 'zod';
import { ObjectIdSchema } from '../../../common/type/mongo';
import {
  TicketContentMaxLength,
  TicketContentMinLength,
  TicketRoleEnum,
  TicketStatusEnum,
  TicketTitleMaxLength,
  TicketTitleMinLength,
  TicketTypeEnum
} from '../../../support/ticket/constants';

/* ============================================================================
 * API: 工单系统（用户反馈闭环）
 * Route: /api/proApi/support/ticket/*
 * Method: GET/POST
 * Description: 用户提交/跟踪/回复工单；管理员在管理台统一处理。
 * ============================================================================ */

export const TicketUserSnapshotSchema = z.object({
  name: z.string().meta({ example: 'jinhui', description: '提交人昵称（创建时快照）' }),
  email: z.string().optional().meta({ example: 'user@example.com', description: '提交人邮箱快照' })
});
export type TicketUserSnapshotType = z.infer<typeof TicketUserSnapshotSchema>;

export const TicketItemSchema = z.object({
  _id: ObjectIdSchema.meta({ example: '68ee0bd23d17260b7829b138', description: '工单 ID' }),
  ticketNo: z.string().meta({ example: 'T20261007-001', description: '工单编号（用户与客服对单用）' }),
  type: z.enum(TicketTypeEnum).meta({ example: TicketTypeEnum.problem, description: '工单类型' }),
  title: z.string().meta({ example: '登录后没有反应', description: '标题' }),
  status: z.enum(TicketStatusEnum).meta({ example: TicketStatusEnum.pending, description: '状态' }),
  userSnapshot: TicketUserSnapshotSchema,
  lastReplyAt: z.date().optional().meta({ description: '最近回复时间' }),
  lastReplyRole: z.enum(TicketRoleEnum).optional().meta({ description: '最近回复方角色' }),
  lastReplyName: z.string().optional().meta({ description: '最近回复人昵称' }),
  userUnread: z.number().int().nonnegative().meta({ example: 0, description: '用户侧未读回复数' }),
  adminUnread: z.number().int().nonnegative().meta({ example: 1, description: '管理侧未读数' }),
  lastActiveTime: z.date().meta({ description: '最近活动时间（回复/状态变更）' }),
  createTime: z.date().meta({ description: '创建时间' })
});
export type TicketItemSchemaType = z.infer<typeof TicketItemSchema>;

export const TicketMessageSchema = z.object({
  _id: ObjectIdSchema.meta({ example: '68ee0bd23d17260b7829b139', description: '消息 ID' }),
  role: z.enum(TicketRoleEnum).meta({ example: TicketRoleEnum.user, description: '发送方角色' }),
  name: z.string().meta({ example: 'jinhui', description: '发送人昵称' }),
  content: z.string().meta({ example: '您好，登录后点击对话没有反应', description: '正文' }),
  createTime: z.date().meta({ description: '发送时间' })
});
export type TicketMessageSchemaType = z.infer<typeof TicketMessageSchema>;

// ---------- 创建工单 ----------
export const TicketCreatePropsSchema = z.object({
  type: z.enum(TicketTypeEnum).meta({ example: TicketTypeEnum.problem, description: '工单类型' }),
  title: z
    .string()
    .min(TicketTitleMinLength)
    .max(TicketTitleMaxLength)
    .meta({ example: '登录后没有反应', description: '标题（2-80 字）' }),
  content: z
    .string()
    .min(TicketContentMinLength)
    .max(TicketContentMaxLength)
    .meta({ example: '您好，登录后点击对话没有反应，请帮忙看看', description: '详细描述（5-3000 字）' })
});
export type TicketCreatePropsType = z.infer<typeof TicketCreatePropsSchema>;

export const TicketCreateResponseSchema = z.object({
  ticketId: ObjectIdSchema.meta({ description: '新工单 ID' }),
  ticketNo: z.string().meta({ example: 'T20261007-001', description: '工单编号' })
});
export type TicketCreateResponseType = z.infer<typeof TicketCreateResponseSchema>;

// ---------- 工单列表 ----------
export const TicketListPropsSchema = z.object({
  status: z.enum(TicketStatusEnum).optional().meta({ description: '按状态筛选，不传为全部' }),
  type: z.enum(TicketTypeEnum).optional().meta({ description: '按类型筛选（管理侧）' }),
  search: z.string().optional().meta({ example: 'T20261007', description: '关键词（单号/标题/用户邮箱，管理侧）' }),
  page: z.coerce.number().int().min(1).default(1).meta({ description: '页码' }),
  pageSize: z.coerce.number().int().min(1).max(50).default(20).meta({ description: '每页条数' })
});
export type TicketListPropsType = z.infer<typeof TicketListPropsSchema>;

export const TicketListStatsSchema = z.object({
  pending: z.number().int().meta({ example: 2, description: '待处理数' }),
  processing: z.number().int().meta({ example: 1, description: '处理中数' }),
  todayNew: z.number().int().meta({ example: 3, description: '今日新增数' }),
  unreadReplies: z.number().int().meta({ example: 2, description: '用户未读回复总数（管理侧）' })
});
export type TicketListStatsType = z.infer<typeof TicketListStatsSchema>;

export const TicketListResponseSchema = z.object({
  list: z.array(TicketItemSchema).meta({ description: '工单列表' }),
  total: z.number().int().meta({ description: '总条数' }),
  stats: TicketListStatsSchema.optional().meta({ description: '管理侧统计（仅管理员返回）' })
});
export type TicketListResponseType = z.infer<typeof TicketListResponseSchema>;

// ---------- 工单详情 ----------
export const TicketDetailQuerySchema = z.object({
  ticketId: ObjectIdSchema.meta({ description: '工单 ID' })
});
export type TicketDetailQueryType = z.infer<typeof TicketDetailQuerySchema>;

export const TicketDetailResponseSchema = z.object({
  ticket: TicketItemSchema,
  messages: z.array(TicketMessageSchema).meta({ description: '消息流（时间正序）' })
});
export type TicketDetailResponseType = z.infer<typeof TicketDetailResponseSchema>;

// ---------- 回复工单 ----------
export const TicketReplyPropsSchema = z.object({
  ticketId: ObjectIdSchema.meta({ description: '工单 ID' }),
  content: z
    .string()
    .min(TicketContentMinLength)
    .max(TicketContentMaxLength)
    .meta({ example: '已收到，正在排查', description: '回复正文（5-3000 字）' })
});
export type TicketReplyPropsType = z.infer<typeof TicketReplyPropsSchema>;

// ---------- 状态变更 ----------
export const TicketUpdateStatusPropsSchema = z.object({
  ticketId: ObjectIdSchema.meta({ description: '工单 ID' }),
  status: z.enum(TicketStatusEnum).meta({
    example: TicketStatusEnum.resolved,
    description: '目标状态：管理员可标记已解决/关闭/重新打开；用户仅可关闭本人已解决工单'
  })
});
export type TicketUpdateStatusPropsType = z.infer<typeof TicketUpdateStatusPropsSchema>;

// ---------- 未读计数 ----------
export const TicketUnreadCountResponseSchema = z.object({
  count: z.number().int().meta({ example: 2, description: '未读总数（用户侧=未读回复数，管理侧=未处理消息数）' })
});
export type TicketUnreadCountResponseType = z.infer<typeof TicketUnreadCountResponseSchema>;
