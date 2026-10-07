// 鲁港通 - 工单系统类型（用户反馈闭环）
import type { TicketRoleEnum, TicketStatusEnum, TicketTypeEnum } from './constants';

/** 创建工单时留存的用户快照，供管理台展示（提交人昵称 + 邮箱） */
export type TicketUserSnapshotType = {
  name: string;
  email?: string;
};

/** 工单表（support_tickets） */
export type SupportTicketSchemaType = {
  _id: string;
  teamId: string;
  tmbId: string;
  userSnapshot: TicketUserSnapshotType;
  ticketNo: string;
  type: TicketTypeEnum;
  title: string;
  status: TicketStatusEnum;
  lastReplyAt?: Date;
  lastReplyRole?: TicketRoleEnum;
  lastReplyName?: string;
  /** 用户侧未读（管理员回复累计，用户打开详情清零） */
  userUnread: number;
  /** 管理侧未读（用户新建/回复累计，管理员打开详情清零） */
  adminUnread: number;
  /** 最近业务活动时间（回复/状态变更），列表以此排序（打开详情清零未读不改变它） */
  lastActiveTime: Date;
  createTime: Date;
  updateTime: Date;
};

/** 消息表（support_ticket_messages） */
export type SupportTicketMessageSchemaType = {
  _id: string;
  ticketId: string;
  teamId: string;
  role: TicketRoleEnum;
  name: string;
  content: string;
  createTime: Date;
  updateTime: Date;
};
