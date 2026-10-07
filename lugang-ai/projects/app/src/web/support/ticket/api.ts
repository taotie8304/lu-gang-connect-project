// 鲁港通 - 工单系统前端请求封装
import { GET, POST } from '@/web/common/api/request';
import type {
  TicketCreatePropsType,
  TicketCreateResponseType,
  TicketDetailResponseType,
  TicketItemSchemaType,
  TicketListPropsType,
  TicketListResponseType,
  TicketReplyPropsType,
  TicketUnreadCountResponseType,
  TicketUpdateStatusPropsType
} from '@fastgpt/global/openapi/support/ticket/api';

export const postCreateTicket = (data: TicketCreatePropsType) =>
  POST<TicketCreateResponseType>(`/proApi/support/ticket/create`, data);

export const postGetTicketList = (data: TicketListPropsType) =>
  POST<TicketListResponseType>(`/proApi/support/ticket/list`, data);

export const getTicketDetail = (ticketId: string) =>
  GET<TicketDetailResponseType>(`/proApi/support/ticket/detail`, { ticketId });

export const postReplyTicket = (data: TicketReplyPropsType) =>
  POST<TicketItemSchemaType>(`/proApi/support/ticket/reply`, data);

export const postUpdateTicketStatus = (data: TicketUpdateStatusPropsType) =>
  POST<TicketItemSchemaType>(`/proApi/support/ticket/updateStatus`, data);

export const getTicketUnreadCount = () =>
  GET<TicketUnreadCountResponseType>(`/proApi/support/ticket/unreadCount`);
