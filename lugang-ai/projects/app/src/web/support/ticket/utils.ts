// 鲁港通 - 工单界面共用工具（状态色板 / 相对时间）
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import { TicketStatusEnum } from '@fastgpt/global/support/ticket/constants';

export const ticketStatusColorMap: Record<TicketStatusEnum, { bg: string; color: string }> = {
  [TicketStatusEnum.pending]: { bg: 'red.50', color: 'red.600' },
  [TicketStatusEnum.processing]: { bg: 'blue.50', color: 'blue.600' },
  [TicketStatusEnum.resolved]: { bg: 'green.50', color: 'green.600' },
  [TicketStatusEnum.closed]: { bg: 'myGray.100', color: 'myGray.500' }
};

/** 相对时间显示：刚刚 / N 分钟前 / N 小时前 / 昨天 / 具体日期 */
export const formatTicketTime = (time: Date | string, t: TFunction) => {
  const d = dayjs(time);
  if (!d.isValid()) return '';
  const now = dayjs();

  const diffMin = now.diff(d, 'minute');
  if (diffMin < 1) return t('ticket:just_now');
  if (diffMin < 60) return t('ticket:minutes_ago', { count: diffMin });
  if (now.isSame(d, 'day')) return t('ticket:hours_ago', { count: now.diff(d, 'hour') });
  if (now.subtract(1, 'day').isSame(d, 'day')) return t('ticket:yesterday');
  return d.format('YYYY-MM-DD HH:mm');
};
