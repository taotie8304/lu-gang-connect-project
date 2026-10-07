// 鲁港通 - 工单系统业务逻辑（用户反馈闭环：提交/列表/详情/回复/状态流转/未读计数）
import dayjs from 'dayjs';
import { Types } from '../../common/mongo';
import {
  MongoSupportTicket,
  MongoSupportTicketMessage,
  MongoSupportTicketSequence
} from './schema';
import { MongoTeamMember } from '../user/team/teamMemberSchema';
import { MongoUser } from '../user/schema';
import {
  TicketCreateIntervalMs,
  TicketRoleEnum,
  TicketStatusEnum
} from '@fastgpt/global/support/ticket/constants';
import type { TicketTypeEnum } from '@fastgpt/global/support/ticket/constants';
import type {
  SupportTicketMessageSchemaType,
  SupportTicketSchemaType,
  TicketUserSnapshotType
} from '@fastgpt/global/support/ticket/type';
import type {
  TicketItemSchemaType,
  TicketListStatsType,
  TicketMessageSchemaType
} from '@fastgpt/global/openapi/support/ticket/api';

/** 生成工单编号：T + 日期 + 当日序号（如 T20261007-001） */
const generateTicketNo = async (): Promise<string> => {
  const dateStr = dayjs().format('YYYYMMDD');
  const upsertSeq = () =>
    MongoSupportTicketSequence.findOneAndUpdate(
      { date: dateStr },
      { $inc: { seq: 1 }, $set: { updateTime: new Date() } },
      { upsert: true, new: true }
    ).lean();

  let seqDoc;
  try {
    seqDoc = await upsertSeq();
  } catch {
    // 当日首次并发创建时唯一索引竞争，重试一次
    seqDoc = await upsertSeq();
  }

  return `T${dateStr}-${String(seqDoc?.seq ?? 1).padStart(3, '0')}`;
};

/** 创建时留存提交人快照（昵称 + 邮箱），供管理台展示 */
const getUserSnapshot = async (tmbId: string): Promise<TicketUserSnapshotType> => {
  const tmb = await MongoTeamMember.findOne({ _id: tmbId }).select('name userId').lean();
  const user = tmb
    ? await MongoUser.findOne({ _id: tmb.userId })
        .select('username email')
        .lean()
    : null;

  return {
    name: tmb?.name || user?.username || '用户',
    email: user?.email || user?.username || undefined
  };
};

/** 客户端可见的工单结构（字符串化 ID） */
const formatTicketItem = (ticket: any): TicketItemSchemaType => ({
  _id: String(ticket._id),
  ticketNo: ticket.ticketNo,
  type: ticket.type,
  title: ticket.title,
  status: ticket.status,
  userSnapshot: {
    name: ticket.userSnapshot?.name ?? '',
    email: ticket.userSnapshot?.email
  },
  lastReplyAt: ticket.lastReplyAt ?? undefined,
  lastReplyRole: ticket.lastReplyRole ?? undefined,
  lastReplyName: ticket.lastReplyName ?? undefined,
  userUnread: ticket.userUnread ?? 0,
  adminUnread: ticket.adminUnread ?? 0,
  lastActiveTime: ticket.lastActiveTime,
  createTime: ticket.createTime
});

const formatTicketMessage = (message: any): TicketMessageSchemaType => ({
  _id: String(message._id),
  role: message.role,
  name: message.name,
  content: message.content,
  createTime: message.createTime
});

/** 逐字转义搜索关键词，避免正则特殊字符注入 */
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createTicket = async ({
  teamId,
  tmbId,
  type,
  title,
  content
}: {
  teamId: string;
  tmbId: string;
  type: TicketTypeEnum;
  title: string;
  content: string;
}) => {
  // 防滥用：同一用户两次新建工单最小间隔 10 秒
  const lastTicket = await MongoSupportTicket.findOne({ tmbId })
    .sort({ createTime: -1 })
    .select('createTime')
    .lean();
  if (
    lastTicket &&
    Date.now() - new Date(lastTicket.createTime as Date).getTime() < TicketCreateIntervalMs
  ) {
    return Promise.reject('提交过于频繁，请稍等几秒后再试');
  }

  const [ticketNo, userSnapshot] = await Promise.all([
    generateTicketNo(),
    getUserSnapshot(tmbId)
  ]);

  const ticket = await MongoSupportTicket.create({
    teamId,
    tmbId,
    userSnapshot,
    ticketNo,
    type,
    title,
    status: TicketStatusEnum.pending,
    userUnread: 0,
    adminUnread: 1,
    lastActiveTime: new Date()
  });

  await MongoSupportTicketMessage.create({
    ticketId: ticket._id,
    teamId,
    role: TicketRoleEnum.user,
    name: userSnapshot.name,
    content
  });

  return { ticketId: String(ticket._id), ticketNo };
};

export const listTickets = async ({
  tmbId,
  isRoot,
  status,
  type,
  search,
  page,
  pageSize
}: {
  tmbId: string;
  isRoot: boolean;
  status?: TicketStatusEnum;
  type?: TicketTypeEnum;
  search?: string;
  page: number;
  pageSize: number;
}) => {
  const conditions: Record<string, any> = {};
  // 普通用户严格限定本人；管理员（root）可见全部
  if (!isRoot) conditions.tmbId = tmbId;
  if (status) conditions.status = status;
  if (type) conditions.type = type;
  if (isRoot && search) {
    const keyword = new RegExp(escapeRegExp(search), 'i');
    conditions.$or = [
      { ticketNo: keyword },
      { title: keyword },
      { 'userSnapshot.email': keyword }
    ];
  }

  const [total, list] = await Promise.all([
    MongoSupportTicket.countDocuments(conditions),
    MongoSupportTicket.find(conditions)
      .sort({ lastActiveTime: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
  ]);

  let stats: TicketListStatsType | undefined;
  if (isRoot) {
    const todayStart = dayjs().startOf('day').toDate();
    const [pending, processing, todayNew, unreadAgg] = await Promise.all([
      MongoSupportTicket.countDocuments({ status: TicketStatusEnum.pending }),
      MongoSupportTicket.countDocuments({ status: TicketStatusEnum.processing }),
      MongoSupportTicket.countDocuments({ createTime: { $gte: todayStart } }),
      MongoSupportTicket.aggregate<{ total: number }>([
        { $group: { _id: null, total: { $sum: '$adminUnread' } } }
      ])
    ]);
    stats = { pending, processing, todayNew, unreadReplies: unreadAgg[0]?.total ?? 0 };
  }

  return { list: list.map(formatTicketItem), total, stats };
};

/** 读工单并校验访问权：本人或管理员（root）；返回 null 表示不存在 */
export const getTicketWithAccess = async ({
  ticketId,
  tmbId,
  isRoot
}: {
  ticketId: string;
  tmbId: string;
  isRoot: boolean;
}): Promise<SupportTicketSchemaType | null> => {
  const ticket = await MongoSupportTicket.findById(ticketId).lean();
  if (!ticket) return null;
  if (!isRoot && String(ticket.tmbId) !== String(tmbId)) {
    return Promise.reject('无权访问该工单');
  }
  return ticket;
};

export const getTicketDetail = async ({
  ticketId,
  tmbId,
  isRoot
}: {
  ticketId: string;
  tmbId: string;
  isRoot: boolean;
}) => {
  const ticket = await getTicketWithAccess({ ticketId, tmbId, isRoot });
  if (!ticket) return Promise.reject('工单不存在或已被删除');

  const messages = await MongoSupportTicketMessage.find({ ticketId })
    .sort({ createTime: 1, _id: 1 })
    .lean();

  // 打开详情即清零本人侧未读（管理员看全部，普通用户看自己）
  if (isRoot && (ticket.adminUnread ?? 0) > 0) {
    await MongoSupportTicket.updateOne({ _id: ticketId }, { $set: { adminUnread: 0 } });
    ticket.adminUnread = 0;
  }
  if (!isRoot && (ticket.userUnread ?? 0) > 0) {
    await MongoSupportTicket.updateOne({ _id: ticketId }, { $set: { userUnread: 0 } });
    ticket.userUnread = 0;
  }

  return {
    ticket: formatTicketItem(ticket),
    messages: messages.map(formatTicketMessage)
  };
};

export const replyTicket = async ({
  ticketId,
  tmbId,
  isRoot,
  content
}: {
  ticketId: string;
  tmbId: string;
  isRoot: boolean;
  content: string;
}) => {
  const ticket = await getTicketWithAccess({ ticketId, tmbId, isRoot });
  if (!ticket) return Promise.reject('工单不存在或已被删除');

  const role = isRoot ? TicketRoleEnum.admin : TicketRoleEnum.user;
  const name = isRoot ? '管理员' : ticket.userSnapshot?.name || '用户';
  const now = new Date();

  // 状态流转：已解决/已关闭被任意一方回复即重新打开（处理中）；客服回复待处理→处理中
  let status = ticket.status;
  if (status === TicketStatusEnum.resolved || status === TicketStatusEnum.closed) {
    status = TicketStatusEnum.processing;
  } else if (isRoot && status === TicketStatusEnum.pending) {
    status = TicketStatusEnum.processing;
  }

  await MongoSupportTicketMessage.create({
    ticketId,
    teamId: ticket.teamId,
    role,
    name,
    content
  });

  // 未读：回复方自动清零本人侧，对方 +1
  const update: Record<string, any> = {
    status,
    lastReplyAt: now,
    lastReplyRole: role,
    lastReplyName: name,
    lastActiveTime: now
  };
  if (isRoot) {
    update.userUnread = (ticket.userUnread ?? 0) + 1;
    update.adminUnread = 0;
  } else {
    update.adminUnread = (ticket.adminUnread ?? 0) + 1;
    update.userUnread = 0;
  }

  const updated = await MongoSupportTicket.findByIdAndUpdate(ticketId, { $set: update }, {
    new: true
  }).lean();

  return formatTicketItem(updated);
};

export const updateTicketStatus = async ({
  ticketId,
  tmbId,
  isRoot,
  status
}: {
  ticketId: string;
  tmbId: string;
  isRoot: boolean;
  status: TicketStatusEnum;
}) => {
  const ticket = await getTicketWithAccess({ ticketId, tmbId, isRoot });
  if (!ticket) return Promise.reject('工单不存在或已被删除');

  if (!isRoot) {
    // 用户仅可关闭本人「已解决」工单
    if (status !== TicketStatusEnum.closed || ticket.status !== TicketStatusEnum.resolved) {
      return Promise.reject('该工单当前状态不可关闭');
    }
  } else if (status === TicketStatusEnum.pending) {
    // 管理员重新打开统一回到处理中，不回到待处理队列
    status = TicketStatusEnum.processing;
  }

  const updated = await MongoSupportTicket.findByIdAndUpdate(
    ticketId,
    { $set: { status, lastActiveTime: new Date() } },
    { new: true }
  ).lean();

  return formatTicketItem(updated);
};

export const getTicketUnreadCount = async ({
  tmbId,
  isRoot
}: {
  tmbId: string;
  isRoot: boolean;
}): Promise<number> => {
  const match = isRoot ? {} : { tmbId: new Types.ObjectId(tmbId) };
  const field = isRoot ? '$adminUnread' : '$userUnread';
  const result = await MongoSupportTicket.aggregate<{ total: number }>([
    { $match: match },
    { $group: { _id: null, total: { $sum: field } } }
  ]);
  return result[0]?.total ?? 0;
};
