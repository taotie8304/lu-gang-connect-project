// 鲁港通 - 工单系统常量（用户反馈闭环）
import { i18nT } from '../../common/i18n/utils';

export enum TicketTypeEnum {
  suggestion = 'suggestion',
  problem = 'problem',
  other = 'other'
}
export const ticketTypeMap: Record<TicketTypeEnum, { label: string }> = {
  [TicketTypeEnum.suggestion]: { label: i18nT('ticket:type.suggestion') },
  [TicketTypeEnum.problem]: { label: i18nT('ticket:type.problem') },
  [TicketTypeEnum.other]: { label: i18nT('ticket:type.other') }
};

export enum TicketStatusEnum {
  pending = 'pending',
  processing = 'processing',
  resolved = 'resolved',
  closed = 'closed'
}
export const ticketStatusMap: Record<TicketStatusEnum, { label: string }> = {
  [TicketStatusEnum.pending]: { label: i18nT('ticket:status.pending') },
  [TicketStatusEnum.processing]: { label: i18nT('ticket:status.processing') },
  [TicketStatusEnum.resolved]: { label: i18nT('ticket:status.resolved') },
  [TicketStatusEnum.closed]: { label: i18nT('ticket:status.closed') }
};

export enum TicketRoleEnum {
  user = 'user',
  admin = 'admin'
}

export const TicketTitleMaxLength = 80;
export const TicketTitleMinLength = 2;
export const TicketContentMaxLength = 3000;
export const TicketContentMinLength = 5;
// 防滥用：同一用户两次新建工单的最小间隔
export const TicketCreateIntervalMs = 10 * 1000;
