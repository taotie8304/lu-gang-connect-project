import { Box, Flex, Grid, Button, VStack, HStack } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import React, { useCallback, useEffect, useState } from 'react';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { postCreatePayBill } from '@/web/support/wallet/bill/api';
import { BillTypeEnum } from '@fastgpt/global/support/wallet/bill/constants';
import QRCodePayModal, { type QRPayProps } from '@/components/support/wallet/QRCodePayModal';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { formatNumberWithUnit } from '@fastgpt/global/common/string/tools';
import { formatActivityExpirationTime } from './utils';
import { useUserStore } from '@/web/support/user/useUserStore';
import { StandardSubLevelEnum } from '@fastgpt/global/support/wallet/sub/constants';
import { getExtraPointsPackage } from '@fastgpt/global/support/wallet/bill/lugangPrice';
import type { PricePurchaseIntent } from './purchaseIntent';
import { useVoucherSelect } from './useVoucherSelect';
import { buildExtraPointsCardDisplay } from './extraPointsDisplay';

const EXTRA_PLAN_GRID_MAX_WIDTH = '1000px';

const FeatureCheckIcon = () => (
  <svg
    width={'15'}
    height={'15'}
    viewBox={'0 0 16 16'}
    fill={'none'}
    style={{ flexShrink: 0, marginTop: '2.5px' }}
  >
    <circle cx={'8'} cy={'8'} r={'7'} fill={'#EAF1FF'} />
    <path
      d={'M5 8.2l2 2 4-4.2'}
      stroke={'#3E78FF'}
      strokeWidth={'1.6'}
      strokeLinecap={'round'}
      strokeLinejoin={'round'}
    />
  </svg>
);

const ExtraPlan = ({
  onPaySuccess,
  onLoginRequired,
  resumePurchaseIntent,
  onResumePurchaseIntentHandled
}: {
  onPaySuccess?: () => void;
  onLoginRequired?: (intent: PricePurchaseIntent) => void;
  resumePurchaseIntent?: PricePurchaseIntent;
  onResumePurchaseIntentHandled?: () => void;
}) => {
  const { t, i18n } = useClientTranslation('price');
  const { toast } = useToast();
  const { subPlans } = useSystemStore();
  const [qrPayData, setQRPayData] = useState<QRPayProps>();
  const { userInfo, teamPlanStatus } = useUserStore();

  // For Wecom teams, free plan should not be able to buy extra plan
  const isDisabledBuy =
    userInfo?.team.isWecomTeam &&
    teamPlanStatus?.standard?.currentSubLevel === StandardSubLevelEnum.free;

  const extraPointsPackages = subPlans?.extraPoints?.packages || [];
  const [buyingPackageIndex, setBuyingPackageIndex] = useState<number>();
  const { selectVoucher, voucherSelectModal } = useVoucherSelect();

  const { runAsync: onclickBuyExtraPoints, loading: isLoadingBuyExtraPoints } = useRequest(
    async ({ points, month, voucherId }: { points: number; month: number; voucherId?: string }) => {
      points = Math.ceil(points);
      month = Math.ceil(month);

      const res = await postCreatePayBill({
        type: BillTypeEnum.extraPoints,
        extraPoints: points,
        month: month,
        ...(voucherId ? { voucherId } : {})
      });

      setQRPayData({
        tip: t('price:button.extra_points_tip'),
        billId: res.billId!,
        ...res
      });
    },
    {
      manual: true,
      refreshDeps: [extraPointsPackages]
    }
  );

  const submitExtraPointsPurchase = useCallback(
    async (intent: Extract<PricePurchaseIntent, { type: 'extraPoints' }>) => {
      if (!userInfo && onLoginRequired) {
        onLoginRequired(intent);
        return;
      }
      if (isDisabledBuy) {
        toast({
          status: 'warning',
          title: t('price:support.wallet.subscription.extra_plan_disabled_tip')
        });
        return;
      }

      // 鲁港通 - 批3：下单前选券（取券失败或没有可用券时直接放行，不阻断购买）
      const pkg = getExtraPointsPackage({
        subPlans,
        points: Math.ceil(intent.points),
        month: Math.ceil(intent.month)
      });
      const voucherId = await selectVoucher(pkg?.price ?? 0);
      if (voucherId === null) return;

      void onclickBuyExtraPoints({
        points: intent.points,
        month: intent.month,
        ...(voucherId ? { voucherId } : {})
      });
    },
    [isDisabledBuy, onLoginRequired, onclickBuyExtraPoints, selectVoucher, subPlans, t, toast, userInfo]
  );

  useEffect(() => {
    if (!resumePurchaseIntent || resumePurchaseIntent.type === 'standard') return;

    queueMicrotask(() => {
      onResumePurchaseIntentHandled?.();
      // 鲁港通 - 知识库索引量购买已下线：仅恢复积分包购买意图，历史索引量意图直接丢弃
      if (resumePurchaseIntent.type === 'extraPoints') {
        submitExtraPointsPurchase(resumePurchaseIntent);
      }
    });
  }, [onResumePurchaseIntentHandled, resumePurchaseIntent, submitExtraPointsPurchase]);

  // 计算活动时间
  const { text: activityExpirationTime } = formatActivityExpirationTime(
    subPlans?.activityExpirationTime
  );

  return (
    <VStack w={'100%'} alignItems={'center'}>
      {!!subPlans?.activityExpirationTime && (
        <Box fontSize={'12px'} color={'myGray.500'} mb={'16px'}>
          {activityExpirationTime}
        </Box>
      )}

      {/* 鲁港通 - 价格页改版：三档积分包各自成卡、各自购买，与基础套餐卡片视觉规范一致 */}
      <Grid
        w={'100%'}
        maxW={EXTRA_PLAN_GRID_MAX_WIDTH}
        gridTemplateColumns={['1fr', 'repeat(3, minmax(0, 1fr))']}
        gap={[4, 5]}
        alignItems={'stretch'}
      >
        {extraPointsPackages.map((pkg, index) => {
          const display = buildExtraPointsCardDisplay({
            index,
            packageCount: extraPointsPackages.length,
            points: pkg.points,
            price: pkg.price
          });

          return (
            <Flex
              key={index}
              position={'relative'}
              flexDir={'column'}
              alignItems={'stretch'}
              textAlign={'left'}
              h={'100%'}
              bg={'white'}
              borderWidth={'1.5px'}
              borderColor={display.recommended ? '#BFD3FF' : '#EAECF3'}
              borderRadius={'16px'}
              p={['20px', '24px 26px']}
              boxShadow={'0 1px 2px 0 rgba(19,51,107,.10), 0 0 1px 0 rgba(19,51,107,.15)'}
              transition={'transform .2s ease, border-color .2s ease, box-shadow .2s ease'}
              _hover={{
                transform: 'translateY(-3px)',
                borderColor: '#B9CCFF',
                boxShadow:
                  '0 16px 34px -16px rgba(19,51,107,.30), 0 0 1px 0 rgba(19,51,107,.15)'
              }}
            >
              {display.recommended && (
                <Flex
                  position={'absolute'}
                  top={'-11px'}
                  left={'50%'}
                  transform={'translateX(-50%)'}
                  h={'22px'}
                  px={'12px'}
                  borderRadius={'999px'}
                  alignItems={'center'}
                  bg={'#3E78FF'}
                  color={'white'}
                  fontSize={'11.5px'}
                  fontWeight={600}
                  letterSpacing={'.5px'}
                  whiteSpace={'nowrap'}
                  boxShadow={'0 4px 10px -2px rgba(62,120,255,.55)'}
                >
                  {t('price:extra_points.recommended')}
                </Flex>
              )}

              {!!pkg.activityBonusPoints && (
                <Flex
                  position={'absolute'}
                  top={'16px'}
                  right={'16px'}
                  h={'22px'}
                  px={'10px'}
                  borderRadius={'999px'}
                  alignItems={'center'}
                  bg={'#FFF1F0'}
                  color={'#D92D20'}
                  border={'1px solid #FECDCA'}
                  fontSize={'11px'}
                  fontWeight={600}
                  whiteSpace={'nowrap'}
                >
                  {t('price:extra_points.bonus_tag', {
                    count: pkg.activityBonusPoints
                  })}
                </Flex>
              )}

              <Flex alignItems={'baseline'} gap={'7px'} pr={'70px'}>
                <Box
                  fontSize={'29px'}
                  lineHeight={'1.05'}
                  fontWeight={700}
                  letterSpacing={'-.8px'}
                  color={'#101828'}
                >
                  {formatNumberWithUnit(pkg.points, i18n.language)}
                </Box>
                <Box fontSize={'13.5px'} color={'myGray.600'} fontWeight={500}>
                  {t('common:support.wallet.subscription.point')}
                </Box>
              </Flex>

              <Box fontSize={'12px'} color={'myGray.500'} mt={'6px'}>
                {t('price:extra_points.one_time')}
              </Box>

              <Flex alignItems={'flex-end'} gap={'9px'} mt={'18px'}>
                <Box
                  fontSize={'42px'}
                  lineHeight={'1'}
                  fontWeight={700}
                  letterSpacing={'-1.2px'}
                  color={'#101828'}
                >
                  <Box as={'span'} fontSize={'22px'} fontWeight={600} mr={'1px'}>
                    ¥
                  </Box>
                  {pkg.price}
                </Box>
                <Box fontSize={'12px'} color={'myGray.500'} pb={'5px'}>
                  {t('price:extra_points.unit_price', { price: display.unitPrice })}
                </Box>
              </Flex>

              <Box h={'1px'} bg={'#EAECF3'} my={'18px 0 15px'} flexShrink={0} />

              <VStack alignItems={'stretch'} spacing={'10px'} flex={'1'}>
                <Flex
                  alignItems={'flex-start'}
                  gap={'8px'}
                  fontSize={'13px'}
                  color={'#475467'}
                  lineHeight={'1.55'}
                >
                  <FeatureCheckIcon />
                  <Box>{t('price:extra_points.feature_permanent')}</Box>
                </Flex>
                <Flex
                  alignItems={'flex-start'}
                  gap={'8px'}
                  fontSize={'13px'}
                  color={'#475467'}
                  lineHeight={'1.55'}
                >
                  <FeatureCheckIcon />
                  <Box>{t('price:extra_points.feature_universal')}</Box>
                </Flex>
                <Flex
                  alignItems={'flex-start'}
                  gap={'8px'}
                  fontSize={'13px'}
                  color={'#475467'}
                  lineHeight={'1.55'}
                >
                  <FeatureCheckIcon />
                  <Box>
                    {t('price:extra_points.feature_deep_qa', {
                      count: display.deepQaCount
                    })}
                  </Box>
                </Flex>
              </VStack>

              <Button
                mt={'22px'}
                h={'42px'}
                flexShrink={0}
                borderRadius={'10px'}
                variant={display.recommended ? 'primary' : 'primaryGhost'}
                color={display.recommended ? 'white' : 'primary.700'}
                fontSize={['14px', '14.5px']}
                fontWeight={600}
                isLoading={isLoadingBuyExtraPoints && buyingPackageIndex === index}
                isDisabled={isLoadingBuyExtraPoints && buyingPackageIndex !== index}
                onClick={() => {
                  setBuyingPackageIndex(index);
                  submitExtraPointsPurchase({
                    type: 'extraPoints',
                    points: pkg.points,
                    month: pkg.month
                  });
                }}
              >
                {t('price:extra_points.buy_now')}
              </Button>
            </Flex>
          );
        })}
      </Grid>

      <HStack
        w={'100%'}
        justifyContent={'center'}
        color={'primary.700'}
        mt={['20px', '24px']}
        spacing={'6px'}
      >
        <MyIcon name={'infoRounded'} w={'15px'} />
        <Box fontSize={'12.5px'} lineHeight={'1.5'}>
          {t('price:support.wallet.subscription.Update extra ai points tips')}
        </Box>
      </HStack>

      {voucherSelectModal}

      {!!qrPayData && (
        <QRCodePayModal
          onSuccess={onPaySuccess}
          onClose={() => setQRPayData(undefined)}
          {...qrPayData}
        />
      )}
    </VStack>
  );
};

export default React.memo(ExtraPlan);
