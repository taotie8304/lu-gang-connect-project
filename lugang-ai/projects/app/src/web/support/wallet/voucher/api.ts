// 鲁港通 - 代金券前端接口（Credits 改革批 3）：用户持券查询 + 管理员发放/查持券
import { GET, POST } from '@/web/common/api/request';
import type {
  VoucherItemType,
  IssueVoucherProps,
  IssueVoucherResponse
} from '@fastgpt/global/support/wallet/voucher/type';

export const getMyVouchers = () =>
  GET<VoucherItemType[]>('/proApi/support/wallet/voucher/list');

export const postIssueVouchers = (data: IssueVoucherProps) =>
  POST<IssueVoucherResponse>('/proApi/support/wallet/voucher/issue', data);

export const getMemberVouchers = (tmbId: string) =>
  GET<VoucherItemType[]>('/proApi/support/wallet/voucher/memberVouchers', { tmbId });
