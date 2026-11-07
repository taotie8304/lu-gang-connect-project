import React, { useState } from 'react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import { Box, Flex, Button, ModalBody } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useUserStore } from '@/web/support/user/useUserStore';
import dayjs from 'dayjs';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { getDiscountCouponList } from '@/web/support/wallet/sub/discountCoupon/api';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import { useRouter } from 'next/router';
import MyImage from '@fastgpt/web/components/common/Image/MyImage';
import MyIcon from '@fastgpt/web/components/common/Icon';
import BillDetailModal from '@/pageComponents/account/bill/BillDetailModal';
import { DiscountCouponStatusEnum } from '@fastgpt/global/support/wallet/sub/discountCoupon/constants';
import { useSystem } from '@fastgpt/web/hooks/useSystem';

const DiscountCouponsModal = ({ onClose }: { onClose: () => void }) => {
  const { t, i18n } = useClientTranslation('discount_coupon');
  const { userInfo } = useUserStore();
  const router = useRouter();
  const isZh = i18n.language === 'zh-CN';
  const { isPc } = useSystem();
  const [billId, setBillId] = useState<string>();
  const teamId = userInfo?.team?.teamId;

  const { data: coupons = [], loading } = useRequest(
    async () => {
      if (!teamId) return [];
      return getDiscountCouponList(teamId);
    },
    {
      manual: !teamId,
      refreshDeps: [teamId]
    }
  );

  const getStatusText = (status: DiscountCouponStatusEnum) => {
    const statusTextMap = {
      [DiscountCouponStatusEnum.active]: '',
      [DiscountCouponStatusEnum.expired]: `(${t('discount_coupon:expired')})`,
      [DiscountCouponStatusEnum.notStart]: `(${t('discount_coupon:not_started_tips')})`,
      [DiscountCouponStatusEnum.used]: `(${t('discount_coupon:used_tips')})`
    };

    return statusTextMap[status];
  };

  return (
    <MyModal
      isOpen
      onClose={onClose}
      title={t('discount_coupon:discount_coupon')}
      isLoading={loading}
      maxW={'900px'}
    >
      <ModalBody minH={'200px'} px={isPc ? 6 : 4} py={isPc ? 4 : 3}>
        {coupons.length > 0 ? (
          <Flex flexDirection={'column'} gap={isPc ? 6 : 4}>
            {coupons.map((coupon) => {
              return (
                <Box
                  key={coupon._id}
                  position={'relative'}
                  filter={'drop-shadow(0 4px 20.2px rgba(14, 66, 187, 0.12))'}
                >
                  {/* 鲁港通 - 手机端券面改为上下堆叠：上半部分券信息、下半部分有效期与操作按钮 */}
                  <Flex
                    alignItems={'stretch'}
                    position={'relative'}
                    minH={'96px'}
                    flexDirection={isPc ? 'row' : 'column'}
                    borderRadius={isPc ? undefined : 'lg'}
                    overflow={isPc ? undefined : 'hidden'}
                    bg={isPc ? undefined : 'white'}
                  >
                    <Flex
                      px={isPc ? 2 : 4}
                      py={isPc ? 0 : 3}
                      bg={'white'}
                      flex={1}
                      alignItems={'center'}
                      borderRight={isPc ? '1px dashed' : undefined}
                      borderBottom={isPc ? undefined : '1px dashed'}
                      borderColor={'myGray.300'}
                      sx={
                        isPc
                          ? {
                              WebkitMask: `
                          radial-gradient(circle at 0 0, transparent 8px, white 8px) top left,
                          radial-gradient(circle at 100% 0, transparent 4px, white 4px) top right,
                          radial-gradient(circle at 0 100%, transparent 8px, white 8px) bottom left,
                          radial-gradient(circle at 100% 100%, transparent 4px, white 4px) bottom right
                        `,
                              WebkitMaskSize: '51% 51%',
                              WebkitMaskRepeat: 'no-repeat',
                              mask: `
                          radial-gradient(circle at 0 0, transparent 8px, white 8px) top left,
                          radial-gradient(circle at 100% 0, transparent 4px, white 4px) top right,
                          radial-gradient(circle at 0 100%, transparent 8px, white 8px) bottom left,
                          radial-gradient(circle at 100% 100%, transparent 4px, white 4px) bottom right
                        `,
                              maskSize: '51% 51%',
                              maskRepeat: 'no-repeat'
                            }
                          : undefined
                      }
                    >
                      <Box
                        w={isPc ? 20 : 14}
                        h={isPc ? 20 : 14}
                        bg={'#F9FAFE'}
                        mr={isPc ? 2 : 3}
                        flexShrink={0}
                        opacity={coupon.status === DiscountCouponStatusEnum.active ? 1 : 0.6}
                      >
                        <MyImage src={isZh ? coupon.iconZh : coupon.iconEn} alt={coupon.name} />
                      </Box>

                      <Box flex={1} pr={isPc ? 4 : 0}>
                        <Box
                          fontSize={isPc ? '18px' : '16px'}
                          fontWeight={'600'}
                          color={
                            coupon.status === DiscountCouponStatusEnum.active
                              ? 'primary.600'
                              : 'myGray.500'
                          }
                          mb={1}
                        >
                          {`${getStatusText(coupon.status as DiscountCouponStatusEnum)}
                            ${t(coupon.name as any)}`}
                        </Box>
                        <Box fontSize={'mini'} color={'myGray.500'}>
                          {t(coupon.description as any)}
                        </Box>
                      </Box>
                    </Flex>

                    <Flex
                      flexDir={isPc ? 'column' : 'row'}
                      alignItems={isPc ? undefined : 'center'}
                      justifyContent={isPc ? 'center' : 'space-between'}
                      gap={isPc ? undefined : 3}
                      w={isPc ? '141px' : '100%'}
                      px={isPc ? '15px' : 4}
                      py={isPc ? 0 : 3}
                      bg={'white'}
                      sx={
                        isPc
                          ? {
                              WebkitMask: `
                          radial-gradient(circle at 0 0, transparent 4px, white 4px) top left,
                          radial-gradient(circle at 100% 0, transparent 8px, white 8px) top right,
                          radial-gradient(circle at 0 100%, transparent 4px, white 4px) bottom left,
                          radial-gradient(circle at 100% 100%, transparent 8px, white 8px) bottom right
                        `,
                              WebkitMaskSize: '51% 51%',
                              WebkitMaskRepeat: 'no-repeat',
                              mask: `
                          radial-gradient(circle at 0 0, transparent 4px, white 4px) top left,
                          radial-gradient(circle at 100% 0, transparent 8px, white 8px) top right,
                          radial-gradient(circle at 0 100%, transparent 4px, white 4px) bottom left,
                          radial-gradient(circle at 100% 100%, transparent 8px, white 8px) bottom right
                        `,
                              maskSize: '51% 51%',
                              maskRepeat: 'no-repeat'
                            }
                          : undefined
                      }
                    >
                      {coupon.usedAt ? (
                        <Box
                          fontSize={'10px'}
                          fontWeight={'medium'}
                          color={'myGray.500'}
                          mb={isPc ? 1 : 0}
                          mx={isPc ? 'auto' : 0}
                        >
                          {`${t('discount_coupon:used_time')}: `}
                          {dayjs(coupon.usedAt).format('YYYY-MM-DD')}
                        </Box>
                      ) : (
                        <Box
                          fontSize={'10px'}
                          fontWeight={'medium'}
                          color={'myGray.500'}
                          mb={isPc ? 1 : 0}
                          mx={isPc ? 'auto' : 0}
                        >
                          {`${t('discount_coupon:expiration_time')}: `}
                          {dayjs(coupon.expiredTime).format('YYYY-MM-DD')}
                        </Box>
                      )}
                      {coupon.status === DiscountCouponStatusEnum.active ? (
                        <Button
                          variant={'primary'}
                          size={'md'}
                          flexShrink={0}
                          onClick={() => router.push('/price')}
                          leftIcon={<MyIcon name={'common/arrowRight'} w={4} />}
                        >
                          {t('discount_coupon:use')}
                        </Button>
                      ) : coupon.status === DiscountCouponStatusEnum.expired ? (
                        <Box
                          mx={isPc ? 'auto' : 0}
                          fontSize={'10px'}
                          fontWeight={'medium'}
                          color={'myGray.500'}
                        >
                          {t('discount_coupon:expired_tips')}
                        </Box>
                      ) : coupon.status === DiscountCouponStatusEnum.notStart ? (
                        <Box
                          mx={isPc ? 'auto' : 0}
                          fontSize={'10px'}
                          fontWeight={'medium'}
                          color={'myGray.500'}
                        >
                          {t('discount_coupon:not_started_tips')}
                        </Box>
                      ) : coupon.status === DiscountCouponStatusEnum.used ? (
                        <Box
                          mx={isPc ? 'auto' : 0}
                          fontSize={'10px'}
                          fontWeight={'medium'}
                          cursor={coupon.billId ? 'pointer' : 'not-allowed'}
                          color={coupon.billId ? 'primary.600' : 'myGray.500'}
                          onClick={() => {
                            router.push('/account/bill');
                          }}
                        >
                          {t('discount_coupon:check_purchase_history')}
                        </Box>
                      ) : null}
                    </Flex>
                  </Flex>
                </Box>
              );
            })}
          </Flex>
        ) : (
          <EmptyTip py={4} />
        )}
        <Flex justifyContent={'flex-end'} mt={6}>
          <Button variant={'whiteBase'} onClick={onClose}>
            {t('common:Close')}
          </Button>
        </Flex>
      </ModalBody>
      {!!billId && <BillDetailModal billId={billId} onClose={() => setBillId(undefined)} />}
    </MyModal>
  );
};

export default DiscountCouponsModal;
