// 鲁港通 - 下单前代金券选择流程（Credits 改革批 3）
// 取券 -> 有可用券才弹窗 -> 返回选择结果：券 ID（使用）/ undefined（不使用）/ null（取消购买）
import React, { useCallback, useState } from 'react';
import VoucherUseModal from '@/components/support/wallet/VoucherUseModal';
import { getMyVouchers } from '@/web/support/wallet/voucher/api';
import type { VoucherItemType } from '@fastgpt/global/support/wallet/voucher/type';

type PendingState = {
  amountYuan: number;
  vouchers: VoucherItemType[];
  resolve: (result: string | null | undefined) => void;
};

export const useVoucherSelect = () => {
  const [pending, setPending] = useState<PendingState>();

  /** 取券失败或没有可用券时直接返回 undefined，不阻断购买 */
  const selectVoucher = useCallback(
    async (amountYuan: number): Promise<string | null | undefined> => {
      if (!(amountYuan > 0)) return;

      let vouchers: VoucherItemType[] = [];
      try {
        vouchers = (await getMyVouchers()).filter(
          (voucher) => voucher.remainingAmount > 0 && !voucher.isLocked
        );
      } catch {
        return;
      }
      if (vouchers.length === 0) return;

      return await new Promise<string | null | undefined>((resolve) => {
        setPending({ amountYuan, vouchers, resolve });
      });
    },
    []
  );

  // Promise resolve 幂等，此处直接用渲染闭包中的 pending 安全
  const voucherSelectModal = pending ? (
    <VoucherUseModal
      amountYuan={pending.amountYuan}
      vouchers={pending.vouchers}
      onConfirm={(voucherId) => {
        pending.resolve(voucherId);
        setPending(undefined);
      }}
      onClose={() => {
        pending.resolve(null);
        setPending(undefined);
      }}
    />
  ) : null;

  return { selectVoucher, voucherSelectModal };
};
