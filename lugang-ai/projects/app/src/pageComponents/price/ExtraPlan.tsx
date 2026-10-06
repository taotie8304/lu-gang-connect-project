import { Box, Flex, Grid, Button, VStack, HStack, type BoxProps } from '@chakra-ui/react';
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
import type { PricePurchaseIntent } from './purchaseIntent';

const PLAN_CARD_MAX_WIDTH = '483px';

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
  const [selectedPackageIndex, setSelectedPackageIndex] = useState<number>(0);

  const getMonthText = (month: number) => {
    if (month < 12) return `${month} ${t('price:month_text')}`;
    return t('price:one_year');
  };

  const { runAsync: onclickBuyExtraPoints, loading: isLoadingBuyExtraPoints } = useRequest(
    async ({ points, month }: { points: number; month: number }) => {
      points = Math.ceil(points);
      month = Math.ceil(month);

      const res = await postCreatePayBill({
        type: BillTypeEnum.extraPoints,
        extraPoints: points,
        month: month
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
    (intent: Extract<PricePurchaseIntent, { type: 'extraPoints' }>) => {
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

      void onclickBuyExtraPoints({ points: intent.points, month: intent.month });
    },
    [isDisabledBuy, onLoginRequired, onclickBuyExtraPoints, t, toast, userInfo]
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

  const planCardProps = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    w: ['100%', PLAN_CARD_MAX_WIDTH],
    // 鲁港通 - 固定 488px 高度在多语言/长文案下会裁掉底部提示行，改为最小高度由内容撑开
    minH: ['auto', '488px'],
    p: ['16px', '24px 32px'],
    flexShrink: 0,
    bg: 'white',
    borderRadius: 'xl',
    borderWidth: '1px',
    borderColor: 'myGray.200',
    boxShadow: '1.5',
    overflow: 'hidden'
  } satisfies BoxProps;

  return (
    <VStack w={'100%'} alignItems={'center'}>
      <Flex
        w={['100%', PLAN_CARD_MAX_WIDTH]}
        maxW={['100%', PLAN_CARD_MAX_WIDTH]}
        justifyContent={'center'}
      >
        <Box position={'relative'} {...planCardProps}>
          {subPlans?.activityExpirationTime && (
            <>
              <Box
                position={'absolute'}
                top={8}
                left={'36%'}
                width={'55px'}
                height={'64px'}
                zIndex={0}
                bgImage={'url(/imgs/system/extraSnowflake1.svg)'}
                backgroundSize="100% 100%"
                backgroundRepeat="no-repeat"
              />
              <Box
                position={'absolute'}
                top={1}
                left={'60%'}
                width={'25px'}
                height={'25px'}
                zIndex={0}
                bgImage={'url(/imgs/system/extraSnowflake2.svg)'}
                backgroundSize="100% 100%"
                backgroundRepeat="no-repeat"
              />
              <Box
                position={'absolute'}
                top={1}
                right={3}
                width={'67px'}
                height={'72px'}
                zIndex={0}
                bgImage={'url(/imgs/system/extraSnowflake3.svg)'}
                backgroundSize="100% 100%"
                backgroundRepeat="no-repeat"
              />
            </>
          )}
          <Box
            position={'relative'}
            zIndex={1}
            w={'100%'}
            fontSize={'18px'}
            fontWeight={'500'}
            color={'primary.700'}
            pb={subPlans?.activityExpirationTime ? 2 : 6}
            borderBottomWidth={'1px'}
            borderBottomColor={'myGray.200'}
          >
            {t('price:support.wallet.subscription.Extra ai points')}
            <Box fontSize={'12px'} fontWeight={'normal'} color={'myGray.600'} mt={0.5}>
              {activityExpirationTime}
            </Box>
          </Box>
          <Grid
            position={'relative'}
            zIndex={1}
            w={'100%'}
            gridTemplateColumns={['repeat(2, 1fr)', 'repeat(3, 1fr)']}
            gap={[2, 3]}
            py={[3, 4]}
            minHeight={['180px', '220px']}
            flex={'1 0 auto'}
          >
            {extraPointsPackages.map((pkg, index) => (
              <Flex
                key={index}
                flexDir={'column'}
                alignItems={'center'}
                justifyContent={'center'}
                py={extraPointsPackages.length > 6 ? 1 : 2}
                px={[3, 4]}
                borderRadius={['8px', 'sm']}
                borderWidth={'1px'}
                borderColor={selectedPackageIndex === index ? '#3E78FF' : 'myGray.200'}
                bg={selectedPackageIndex === index ? 'primary.25' : 'white'}
                cursor={'pointer'}
                _hover={{
                  borderColor: '#3E78FF',
                  bg: 'primary.25'
                }}
                onClick={() => setSelectedPackageIndex(index)}
                transition={'all 0.2s'}
                position={'relative'}
                overflow={'hidden'}
              >
                {!!pkg.activityBonusPoints && (
                  <Flex
                    position={'absolute'}
                    top={0.5}
                    right={-8}
                    minW={24}
                    py={0.5}
                    justifyContent={'center'}
                    fontSize={'10px'}
                    fontWeight={'bold'}
                    color={'white'}
                    bg={'#ED372C'}
                    transform={'rotate(37deg)'}
                    whiteSpace={'nowrap'}
                  >
                    +{formatNumberWithUnit(pkg.activityBonusPoints, i18n.language)}
                  </Flex>
                )}
                <Box fontSize={'24px'} fontWeight={'medium'} color={'myGray.600'}>
                  {formatNumberWithUnit(pkg.points, i18n.language)}{' '}
                  <Box as={'span'} fontSize={'12px'}>
                    {t('common:support.wallet.subscription.point')}
                  </Box>
                </Box>
                <Box
                  fontSize={['10px', '12px']}
                  fontWeight={'medium'}
                  color={'myGray.500'}
                  mt={[1, 2]}
                >
                  {t('price:invalid_time') + ' '}
                  {getMonthText(pkg.month)}
                </Box>
              </Flex>
            ))}
          </Grid>

          <Flex
            position={'relative'}
            zIndex={1}
            w={'100%'}
            justifyContent={'space-between'}
            alignItems={'center'}
          >
            <Box
              fontSize={['13px', '14px']}
              color={'myGray.600'}
              fontWeight={'medium'}
              textAlign={['center', 'left']}
            >
              {t('price:support.wallet.subscription.total_points')}
            </Box>
            <Box color={'myGray.600'} fontSize={['18px', '20px']} fontWeight={'medium'}>
              {selectedPackageIndex !== undefined && extraPointsPackages[selectedPackageIndex]
                ? formatNumberWithUnit(
                    extraPointsPackages[selectedPackageIndex].points +
                      (extraPointsPackages[selectedPackageIndex]?.activityBonusPoints || 0),
                    i18n.language
                  )
                : '--'}
            </Box>
          </Flex>
          <Flex
            position={'relative'}
            zIndex={1}
            w={'100%'}
            justifyContent={'space-between'}
            alignItems={'center'}
          >
            <Box
              fontSize={['13px', '14px']}
              color={'myGray.600'}
              fontWeight={'medium'}
              textAlign={['center', 'left']}
            >
              {t('price:support.wallet.subscription.Update extra price')}
            </Box>
            <Box color={'myGray.600'} fontSize={['18px', '20px']} fontWeight={'medium'}>
              {selectedPackageIndex !== undefined && extraPointsPackages[selectedPackageIndex]
                ? t('price:extraPointsPrice', {
                    price: extraPointsPackages[selectedPackageIndex].price
                  })
                : '--'}
            </Box>
          </Flex>

          <Button
            position={'relative'}
            zIndex={1}
            w={'100%'}
            h={['40px', '44px']}
            variant={'primaryGhost'}
            isLoading={isLoadingBuyExtraPoints}
            isDisabled={
              selectedPackageIndex === undefined || !extraPointsPackages[selectedPackageIndex]
            }
            onClick={() => {
              if (selectedPackageIndex !== undefined && extraPointsPackages[selectedPackageIndex]) {
                const selectedPackage = extraPointsPackages[selectedPackageIndex];
                submitExtraPointsPurchase({
                  type: 'extraPoints',
                  points: selectedPackage.points,
                  month: selectedPackage.month
                });
              }
            }}
            fontSize={['14px', '16px']}
            color={'primary.700'}
            mt={[3, 4]}
          >
            {t('price:support.wallet.Buy')}
          </Button>

          <HStack
            position={'relative'}
            zIndex={1}
            w={'100%'}
            color={'blue.700'}
            mt={[4, 6]}
            spacing={[2, 0]}
          >
            <MyIcon name={'infoRounded'} w={['16px', '18px']} />
            <Box fontSize={['12px', '14px']} fontWeight={'medium'} lineHeight={['1.4', 'normal']}>
              {t('price:support.wallet.subscription.Update extra ai points tips')}
            </Box>
          </HStack>
        </Box>
      </Flex>

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
