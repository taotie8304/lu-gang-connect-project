// 鲁港通 - 代金券选用弹窗（Credits 改革批 3）：充值下单前选择一张代金券抵扣，单笔订单最多一张
import React, { useMemo, useState } from 'react';
import MyModal from '@fastgpt/web/components/v2/common/MyModal';
import { Box, Button, Flex, VStack } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { format } from 'date-fns/format';
import { VoucherSourceEnum } from '@fastgpt/global/support/wallet/voucher/constants';
import type { VoucherItemType } from '@fastgpt/global/support/wallet/voucher/type';

/** 「不使用代金券」选项的内部标识（与真实券 ID 区分） */
export const VOUCHER_NOT_USE = '__not_use__';

export type VoucherUseModalProps = {
  /** 订单应付原价（元） */
  amountYuan: number;
  vouchers: VoucherItemType[];
  /** 确认：传券 ID（使用）或 undefined（不使用），随后继续下单 */
  onConfirm: (voucherId?: string) => void;
  /** 关闭弹窗：取消本次购买 */
  onClose: () => void;
};

/** 抵扣数学：min(券剩余金额, 订单应付) —— 与服务端 calcVoucherDeduct 同口径 */
export const calcVoucherDeductYuan = (voucher: VoucherItemType, amountYuan: number) =>
  Math.min(voucher.remainingAmount, amountYuan);

const RadioDot = ({ isActive }: { isActive: boolean }) => (
  <Flex
    w={'18px'}
    h={'18px'}
    borderRadius={'50%'}
    borderWidth={'1.5px'}
    borderColor={isActive ? 'primary.500' : 'myGray.300'}
    bg={isActive ? 'primary.500' : 'white'}
    alignItems={'center'}
    justifyContent={'center'}
    flexShrink={0}
  >
    {isActive && <MyIcon name={'common/check'} w={'10px'} color={'white'} />}
  </Flex>
);

const VoucherUseModal = ({ amountYuan, vouchers, onConfirm, onClose }: VoucherUseModalProps) => {
  const { t } = useClientTranslation();

  // 按可抵扣金额降序展示，默认选中可抵扣最多的一张（设计定案）
  const sortedVouchers = useMemo(
    () =>
      [...vouchers].sort(
        (a, b) => calcVoucherDeductYuan(b, amountYuan) - calcVoucherDeductYuan(a, amountYuan)
      ),
    [vouchers, amountYuan]
  );
  const [selected, setSelected] = useState<string>(
    sortedVouchers[0]?._id ?? VOUCHER_NOT_USE
  );

  const selectedVoucher = sortedVouchers.find((v) => v._id === selected);
  const deductYuan = selectedVoucher ? calcVoucherDeductYuan(selectedVoucher, amountYuan) : 0;
  const realPayYuan = Math.max(0, Math.round((amountYuan - deductYuan) * 100) / 100);

  const optionStyle = (isActive: boolean) => ({
    borderWidth: '1px',
    borderColor: isActive ? 'primary.500' : 'myGray.200',
    bg: isActive ? 'primary.50' : 'white',
    borderRadius: 'md',
    cursor: 'pointer',
    transition: 'all 0.2s'
  });

  return (
    <MyModal
      isOpen
      title={t('common:voucher_use_title')}
      w={'520px'}
      onClose={onClose}
      closeOnOverlayClick={false}
      bodyStyles={{ px: 6, pb: 6 }}
    >
      <Box fontSize={'12px'} color={'myGray.500'} mb={3}>
        {t('common:voucher_use_subtitle')}
      </Box>

      <VStack align={'stretch'} spacing={2} maxH={'300px'} overflowY={'auto'}>
        {sortedVouchers.map((voucher) => {
          const isActive = selected === voucher._id;
          const deduct = calcVoucherDeductYuan(voucher, amountYuan);
          return (
            <Flex
              key={voucher._id}
              px={4}
              py={3}
              alignItems={'center'}
              gap={3}
              {...optionStyle(isActive)}
              onClick={() => setSelected(voucher._id)}
            >
              <RadioDot isActive={isActive} />
              <Box flex={1} minW={0}>
                <Flex alignItems={'baseline'} gap={2}>
                  <Box fontSize={'20px'} fontWeight={'600'} color={'primary.600'}>
                    ¥{voucher.remainingAmount.toFixed(2)}
                  </Box>
                  <Box fontSize={'12px'} color={'myGray.500'}>
                    {voucher.source === VoucherSourceEnum.register
                      ? t('common:voucher_source_register')
                      : t('common:voucher_source_admin')}
                  </Box>
                </Flex>
                <Flex fontSize={'11px'} color={'myGray.500'} mt={0.5} gap={2}>
                  {voucher.note && <Box className={'textEllipsis'}>{voucher.note}</Box>}
                  <Box flexShrink={0}>
                    {format(new Date(voucher.createTime), 'yyyy-MM-dd')}
                  </Box>
                </Flex>
              </Box>
              <Box fontSize={'12px'} color={'myGray.600'} flexShrink={0}>
                {t('common:voucher_deduct_amount', { amount: deduct.toFixed(2) })}
              </Box>
            </Flex>
          );
        })}

        <Flex
          px={4}
          py={3}
          alignItems={'center'}
          gap={3}
          {...optionStyle(selected === VOUCHER_NOT_USE)}
          onClick={() => setSelected(VOUCHER_NOT_USE)}
        >
          <RadioDot isActive={selected === VOUCHER_NOT_USE} />
          <Box fontSize={'13px'} color={'myGray.700'}>
            {t('common:voucher_not_use')}
          </Box>
        </Flex>
      </VStack>

      <Flex mt={5} alignItems={'center'} justifyContent={'space-between'}>
        <Box fontSize={'12px'} color={'myGray.600'}>
          {t('common:voucher_pay_real_tip', { amount: realPayYuan.toFixed(2) })}
        </Box>
        <Button
          h={9}
          px={6}
          variant={'primary'}
          onClick={() =>
            onConfirm(selected === VOUCHER_NOT_USE ? undefined : selected)
          }
        >
          {realPayYuan <= 0 ? t('common:voucher_confirm_free') : t('common:voucher_confirm_pay')}
        </Button>
      </Flex>
    </MyModal>
  );
};

export default React.memo(VoucherUseModal);
