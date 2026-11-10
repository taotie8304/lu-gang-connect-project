'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, useDisclosure } from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import Avatar from '@fastgpt/web/components/common/Avatar';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { IconNameType } from '@fastgpt/web/components/common/Icon/type';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { getDocPath } from '@/web/common/system/doc';
import { getIsMemberSyncMode } from '@/web/common/system/utils';
import { getUserPointsDetail } from '@/web/support/wallet/points/api';
import { getWorkorderURL } from '@/web/common/workorder/api';
import { getAccountCancellationStatus } from '@/web/support/user/account/cancellation/api';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import { i18nT } from '@fastgpt/global/common/i18n/utils';
import {
  StandardSubLevelEnum,
  standardSubLevelMap
} from '@fastgpt/global/support/wallet/sub/constants';
import { formatNumber } from '@fastgpt/global/common/math/tools';
import { DEFAULT_USER_AVATAR } from '@fastgpt/global/common/system/constants';
import type { UserPointsDetailType } from '@fastgpt/global/support/wallet/points/type';
import AccountContainer from '@/pageComponents/account/AccountContainer';
import UserPointsCard from '@/pageComponents/account/info/UserPointsCard';
import DailyCheckinCard from '@/pageComponents/account/info/DailyCheckinCard';
import EditProfileModal from '@/pageComponents/account/info/EditProfileModal';
import { AccountCancellationConfirmModal } from '@/pageComponents/account/cancel/AccountCancellationConfirmModal';

const StandDetailModal = dynamic(
  () => import('@/pageComponents/account/info/standardDetailModal'),
  {
    ssr: false
  }
);
const UpdatePswModal = dynamic(() => import('@/pageComponents/account/info/UpdatePswModal'), {
  ssr: false
});
const CommunityModal = dynamic(() => import('@/components/CommunityModal'), { ssr: false });
const EnterpriseAuthStatusRow = dynamic(
  () => import('@/pageComponents/account/team/EnterpriseAuth'),
  {
    ssr: false,
    loading: () => <Box mt={4} h={'32px'} />
  }
);

// 鲁港通 - 账号中心卡片统一样式
const cardStyles = {
  bg: '#fff',
  border: '1px solid',
  borderColor: '#E7EEF9',
  borderRadius: ['16px', '18px'],
  boxShadow: '0 10px 30px rgba(36,80,181,.06)',
  px: ['16px', '24px'],
  py: ['17px', '22px']
};

const badgeStyles = {
  fontSize: '11px',
  px: '9px',
  py: '4px',
  borderRadius: '999px',
  lineHeight: 1
} as const;

const Info = () => {
  const { data: pointsDetail, runAsync: refreshPoints } = useRequest(getUserPointsDetail, {
    manual: false
  });
  const { isOpen: isOpenContact, onClose: onCloseContact, onOpen: onOpenContact } = useDisclosure();

  return (
    <AccountContainer>
      <Flex direction={['column', 'row']} gap={['14px', '22px']} alignItems={'flex-start'}>
        <Box w={['100%', '306px']} flexShrink={0}>
          <ProfileCard pointsDetail={pointsDetail} />
        </Box>
        <Flex flex={'1 1 auto'} minW={0} w={'100%'} direction={'column'} gap={['12px', '18px']}>
          <UserPointsCard pointsDetail={pointsDetail} />
          <DailyCheckinCard
            onCheckedIn={() => {
              refreshPoints().catch(() => undefined);
            }}
          />
          <PlanUsage pointsDetail={pointsDetail} />
          <QuickActions onOpenContact={onOpenContact} />
        </Flex>
      </Flex>
      {isOpenContact && <CommunityModal onClose={onCloseContact} />}
    </AccountContainer>
  );
};

export default React.memo(Info);

const FactRow = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
  <Flex align={'flex-start'} justify={'space-between'} gap={'12px'}>
    <Text flexShrink={0} fontSize={'12.5px'} color={'#8C99AE'}>
      {label}
    </Text>
    <Text
      fontSize={'13px'}
      fontWeight={500}
      color={warn ? '#D4553F' : '#3C4A63'}
      textAlign={'right'}
      wordBreak={'break-all'}
    >
      {value}
    </Text>
  </Flex>
);

const ProfileCard = ({ pointsDetail }: { pointsDetail?: UserPointsDetailType }) => {
  const { t } = useClientTranslation('account_info');
  const { feConfigs, initd, subPlans } = useSystemStore();
  const { userInfo } = useUserStore();
  const {
    isOpen: isOpenEditProfile,
    onOpen: onOpenEditProfile,
    onClose: onCloseEditProfile
  } = useDisclosure();
  const {
    isOpen: isOpenUpdatePsw,
    onOpen: onOpenUpdatePsw,
    onClose: onCloseUpdatePsw
  } = useDisclosure();
  const [autoOpenEnterpriseAuth, setAutoOpenEnterpriseAuth] = useState(false);
  const showEnterpriseAuth = feConfigs?.show_enterprise_auth;
  const isSyncMember = getIsMemberSyncMode(feConfigs);

  const hasCustomAvatar = !!userInfo?.avatar && userInfo.avatar !== DEFAULT_USER_AVATAR;
  const displayName = userInfo?.team?.memberName || userInfo?.username || '';
  const avatarLetter = (displayName || 'U').charAt(0).toUpperCase();

  const planName = useMemo(() => {
    const level = pointsDetail?.currentSubLevel;
    if (!level) return '';
    if (userInfo?.team?.isWecomTeam && level === StandardSubLevelEnum.free) {
      return i18nT('common:support.wallet.subscription.standardSubLevel.trial');
    }
    return subPlans?.standard?.[level]?.name || standardSubLevelMap[level]?.label || '';
  }, [pointsDetail?.currentSubLevel, subPlans, userInfo?.team?.isWecomTeam]);

  /**
   * 鲁港通 - 清除 URL 中的 #certification hash，避免刷新页面或重新进入时重复触发企业认证弹窗
   */
  const clearCertificationHash = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  /**
   * 鲁港通 - 监听 URL hash 变化，当 hash 为 #certification 且系统初始化完成、开启企业认证功能时，
   * 延迟设置 autoOpenEnterpriseAuth 为 true，以触发企业认证弹窗。
   * 若未开启企业认证功能，则直接清除 hash。
   */
  const triggerEnterpriseAuthFromHash = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#certification') return;
    if (!initd) return;

    if (!showEnterpriseAuth) {
      clearCertificationHash();
      return;
    }

    window.setTimeout(() => {
      setAutoOpenEnterpriseAuth(true);
    }, 0);
  }, [clearCertificationHash, initd, showEnterpriseAuth]);

  useEffect(() => {
    triggerEnterpriseAuthFromHash();
    window.addEventListener('hashchange', triggerEnterpriseAuthFromHash);

    return () => {
      window.removeEventListener('hashchange', triggerEnterpriseAuthFromHash);
    };
  }, [triggerEnterpriseAuthFromHash]);

  return (
    <Box {...cardStyles} px={0} py={0} overflow={'hidden'}>
      <Box
        position={'relative'}
        h={['66px', '82px']}
        bg={'linear-gradient(135deg,#DCE9FF 0%,#EEF5FF 45%,#F9FBFF 100%)'}
        overflow={'hidden'}
      >
        <Box
          position={'absolute'}
          right={'-18px'}
          top={'-36px'}
          w={'120px'}
          h={'120px'}
          borderRadius={'50%'}
          bg={'rgba(94,143,255,.16)'}
        />
        <Box
          position={'absolute'}
          left={'38%'}
          bottom={'-30px'}
          w={'86px'}
          h={'86px'}
          borderRadius={'50%'}
          bg={'rgba(120,200,255,.14)'}
        />
        <Box
          position={'absolute'}
          inset={0}
          backgroundImage={'radial-gradient(rgba(51,112,255,.10) 1px, transparent 1px)'}
          backgroundSize={'10px 10px'}
          opacity={0.5}
        />
      </Box>

      <Box px={['16px', '20px']} pb={['16px', '20px']}>
        <Box
          position={'relative'}
          w={['66px', '78px']}
          h={['66px', '78px']}
          mt={['-32px', '-38px']}
        >
          <Flex
            as={'button'}
            type={'button'}
            w={'100%'}
            h={'100%'}
            flexShrink={0}
            border={'4px solid #fff'}
            borderRadius={['20px', '24px']}
            overflow={'hidden'}
            bg={'#fff'}
            boxShadow={'0 10px 24px rgba(36,80,181,.16)'}
            transition={'0.18s'}
            _hover={{ transform: 'translateY(-1px)' }}
            onClick={onOpenEditProfile}
          >
            {hasCustomAvatar ? (
              <Avatar
                src={userInfo?.avatar}
                w={'100%'}
                h={'100%'}
                borderRadius={['16px', '20px']}
              />
            ) : (
              <Flex
                w={'100%'}
                h={'100%'}
                align={'center'}
                justify={'center'}
                borderRadius={['16px', '20px']}
                bg={'linear-gradient(150deg,#9FC2FF,#5E8FFF 55%,#3370FF)'}
                color={'#fff'}
                fontSize={['25px', '30px']}
                fontWeight={600}
              >
                {avatarLetter}
              </Flex>
            )}
          </Flex>
          <Flex
            position={'absolute'}
            right={'-2px'}
            bottom={'-2px'}
            w={'24px'}
            h={'24px'}
            borderRadius={'50%'}
            bg={'#fff'}
            border={'1px solid #E7EEF9'}
            boxShadow={'0 4px 10px rgba(36,80,181,.16)'}
            align={'center'}
            justify={'center'}
            color={'#3370FF'}
            pointerEvents={'none'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.4A1.5 1.5 0 0 1 9.9 4h4.2c.47 0 .91.22 1.2.6l1 1.4h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle cx="12" cy="12.2" r="3.1" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </Flex>
        </Box>

        <Text
          mt={'10px'}
          fontSize={['17px', '19px']}
          fontWeight={600}
          lineHeight={'26px'}
          color={'#182234'}
          noOfLines={1}
        >
          {displayName}
        </Text>
        <Text mt={'2px'} fontSize={'12.5px'} color={'#8C99AE'} noOfLines={1}>
          {userInfo?.contact || userInfo?.username}
        </Text>

        <Flex mt={'10px'} gap={'6px'} flexWrap={'wrap'}>
          {!!planName && (
            <Box {...badgeStyles} bg={'#E7EFFF'} color={'#2450B5'}>
              {t(planName as any)}
            </Box>
          )}
          <Box {...badgeStyles} bg={'#F1F4FA'} color={'#66758F'}>
            Credits {pointsDetail ? formatNumber(pointsDetail.surplusPoints) : '-'}
          </Box>
        </Flex>

        <Box
          mt={'14px'}
          pt={'14px'}
          borderTop={'1px dashed #E7EEF9'}
          display={'flex'}
          flexDirection={'column'}
          gap={'11px'}
        >
          <FactRow label={t('account_info:user_account')} value={userInfo?.username ?? '-'} />
          <FactRow
            label={t('account_info:member_name')}
            value={userInfo?.team?.memberName || '-'}
          />
          <FactRow
            label={t('common:contact_way')}
            value={userInfo?.contact || t('account_info:contact_not_bound')}
            warn={!userInfo?.contact}
          />
        </Box>

        {showEnterpriseAuth && (
          <Box mt={'10px'}>
            <EnterpriseAuthStatusRow
              labelStyles={{ color: '#8C99AE', fontSize: '12.5px', flex: '0 0 auto' }}
              buttonProps={{ size: 'sm', minW: '52px' }}
              autoOpen={autoOpenEnterpriseAuth}
              onAutoOpenFinish={() => {
                clearCertificationHash();
                setAutoOpenEnterpriseAuth(false);
              }}
            />
          </Box>
        )}

        {isSyncMember && (
          <Text mt={'10px'} fontSize={'11px'} color={'#8C99AE'} lineHeight={'16px'}>
            {t('account_info:nickname_sync_tip')}
          </Text>
        )}

        <Box
          mt={'16px'}
          display={'grid'}
          gridTemplateColumns={feConfigs?.isPlus ? 'repeat(2, minmax(0, 1fr))' : '1fr'}
          gap={'8px'}
        >
          <Flex
            as={'button'}
            type={'button'}
            align={'center'}
            justify={'center'}
            h={'34px'}
            borderRadius={'10px'}
            bg={'#E7EFFF'}
            fontSize={'12.5px'}
            fontWeight={500}
            color={'#2450B5'}
            transition={'0.18s'}
            _hover={{ bg: '#DCE8FF' }}
            onClick={onOpenEditProfile}
          >
            {t('account_info:edit_profile')}
          </Flex>
          {feConfigs?.isPlus && (
            <Flex
              as={'button'}
              type={'button'}
              align={'center'}
              justify={'center'}
              h={'34px'}
              borderRadius={'10px'}
              border={'1px solid'}
              borderColor={'#E7EEF9'}
              bg={'#fff'}
              fontSize={'12.5px'}
              color={'#66758F'}
              transition={'0.18s'}
              _hover={{ borderColor: '#CBDCFB', bg: '#F2F6FF', color: '#2450B5' }}
              onClick={onOpenUpdatePsw}
            >
              {t('account_info:update_password')}
            </Flex>
          )}
        </Box>
      </Box>

      {isOpenEditProfile && <EditProfileModal onClose={onCloseEditProfile} />}
      {isOpenUpdatePsw && <UpdatePswModal onClose={onCloseUpdatePsw} />}
    </Box>
  );
};

const PlanUsage = ({ pointsDetail }: { pointsDetail?: UserPointsDetailType }) => {
  const router = useRouter();
  const { t } = useClientTranslation('account_info');
  const { subPlans } = useSystemStore();
  const { userInfo } = useUserStore();
  const {
    isOpen: isOpenStandardModal,
    onClose: onCloseStandardModal,
    onOpen: onOpenStandardModal
  } = useDisclosure();

  const level = pointsDetail?.currentSubLevel;
  const planName = useMemo(() => {
    if (!level) return '';
    if (userInfo?.team?.isWecomTeam && level === StandardSubLevelEnum.free) {
      return i18nT('common:support.wallet.subscription.standardSubLevel.trial');
    }
    return subPlans?.standard?.[level]?.name || standardSubLevelMap[level]?.label || '';
  }, [level, subPlans, userInfo?.team?.isWecomTeam]);

  const totalPoints = pointsDetail?.totalPoints ?? 0;
  const surplusPoints = pointsDetail?.surplusPoints ?? 0;
  const usedPoints = Math.max(totalPoints - surplusPoints, 0);
  const usedRate = totalPoints > 0 ? Math.min((usedPoints / totalPoints) * 100, 100) : 0;

  const isFreeTeam = level === StandardSubLevelEnum.free;

  if (!level) return null;

  return (
    <Box {...cardStyles}>
      <Flex
        align={['stretch', 'center']}
        justify={'space-between'}
        direction={['column', 'row']}
        gap={['12px', '16px']}
      >
        <Box>
          <Text fontSize={'15.5px'} fontWeight={600} letterSpacing={'0.2px'} color={'#182234'}>
            {t('account_info:package_and_usage')}
          </Text>
          <Text mt={'5px'} fontSize={'12px'} color={'#8C99AE'}>
            {t(planName as any)} · {t('account_info:plan_refresh_30d')}
          </Text>
        </Box>
        <Flex gap={'8px'} w={['100%', 'auto']} flexShrink={0}>
          <Flex
            as={'button'}
            type={'button'}
            flex={['1 1 0', 'initial']}
            align={'center'}
            justify={'center'}
            h={'34px'}
            px={'14px'}
            borderRadius={'10px'}
            border={'1px solid'}
            borderColor={'#E7EEF9'}
            bg={'#fff'}
            fontSize={'12.5px'}
            color={'#66758F'}
            whiteSpace={'nowrap'}
            transition={'0.18s'}
            _hover={{ borderColor: '#CBDCFB', bg: '#F2F6FF', color: '#2450B5' }}
            onClick={onOpenStandardModal}
          >
            {t('account_info:package_details')}
          </Flex>
          <Flex
            as={'button'}
            type={'button'}
            flex={['1 1 0', 'initial']}
            align={'center'}
            justify={'center'}
            h={'34px'}
            px={'14px'}
            borderRadius={'10px'}
            bg={'linear-gradient(135deg,#4F86FF,#3370FF)'}
            color={'#fff'}
            fontSize={'12.5px'}
            fontWeight={500}
            whiteSpace={'nowrap'}
            boxShadow={'0 8px 18px rgba(51,112,255,.24)'}
            transition={'0.18s'}
            _hover={{ bgImage: 'linear-gradient(135deg,#3E77F2,#2450B5)' }}
            onClick={() => {
              router.push(
                subPlans?.planDescriptionUrl ? getDocPath(subPlans.planDescriptionUrl) : '/price'
              );
            }}
          >
            {t('account_info:upgrade_package')}
          </Flex>
        </Flex>
      </Flex>

      {isFreeTeam && (
        <Text mt={'10px'} fontSize={'11.5px'} color={'#D4553F'} lineHeight={'17px'}>
          {t('account_info:account_knowledge_base_cleanup_warning')}
        </Text>
      )}

      <Box mt={'16px'}>
        <Flex justify={'space-between'} align={'center'} mb={'8px'}>
          <Text fontSize={'12.5px'} color={'#66758F'}>
            {t('account_info:plan_period_usage')}
          </Text>
          <Text
            fontSize={'12.5px'}
            fontWeight={500}
            color={'#3C4A63'}
            css={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatNumber(usedPoints)} / {formatNumber(totalPoints)}
          </Text>
        </Flex>
        <Box h={'8px'} borderRadius={'999px'} bg={'#EDF2FC'} overflow={'hidden'}>
          <Box
            h={'100%'}
            w={`${usedRate}%`}
            borderRadius={'999px'}
            bg={'linear-gradient(90deg,#5E8FFF,#3370FF)'}
            transition={'0.3s'}
          />
        </Box>
      </Box>

      {isOpenStandardModal && <StandDetailModal onClose={onCloseStandardModal} />}
    </Box>
  );
};

const QuickActionItem = ({
  icon,
  label,
  href,
  danger,
  onClick
}: {
  icon: IconNameType;
  label: string;
  href?: string;
  danger?: boolean;
  onClick?: () => void;
}) => {
  const content = (
    <>
      <Flex
        w={['28px', '32px']}
        h={['28px', '32px']}
        flexShrink={0}
        align={'center'}
        justify={'center'}
        borderRadius={['9px', '10px']}
        bg={danger ? 'rgba(212,85,63,.08)' : '#F2F6FF'}
        color={danger ? '#D4553F' : '#3370FF'}
      >
        <MyIcon name={icon} w={'16px'} h={'16px'} fill={'none'} />
      </Flex>
      <Text
        fontSize={'12.5px'}
        color={'#3C4A63'}
        whiteSpace={'nowrap'}
        overflow={'hidden'}
        textOverflow={'ellipsis'}
      >
        {label}
      </Text>
    </>
  );

  const commonProps = {
    display: 'flex',
    alignItems: 'center',
    gap: ['8px', '9px'],
    h: ['44px', '48px'],
    px: ['10px', '14px'],
    py: ['11px', '14px'],
    bg: '#fff',
    border: '1px solid',
    borderColor: '#E7EEF9',
    borderRadius: '14px',
    textAlign: 'left' as const,
    transition: '0.18s',
    cursor: 'pointer',
    _hover: danger
      ? { borderColor: '#F0CFC8', bg: '#FFF8F6', transform: 'translateY(-1px)' }
      : { borderColor: '#CBDCFB', bg: '#F2F6FF', transform: 'translateY(-1px)' }
  };

  if (href) {
    return (
      <Flex
        as={'a'}
        href={href}
        target={'_blank'}
        rel={'noreferrer'}
        textDecoration={'none !important'}
        {...commonProps}
      >
        {content}
      </Flex>
    );
  }

  return (
    <Flex as={'button'} type={'button'} onClick={onClick} {...commonProps}>
      {content}
    </Flex>
  );
};

const QuickActions = ({ onOpenContact }: { onOpenContact: () => void }) => {
  const { t } = useClientTranslation('account_info');
  const router = useRouter();
  const { feConfigs, setNotSufficientModalType, subPlans } = useSystemStore();
  const { teamPlanStatus, userInfo } = useUserStore();
  const {
    isOpen: isCancellationConfirmOpen,
    onOpen: onOpenCancellationConfirm,
    onClose: onCloseCancellationConfirm
  } = useDisclosure();
  const { data: accountCancellationStatus } = useRequest(getAccountCancellationStatus, {
    manual: false,
    refreshDeps: [userInfo?._id]
  });

  const { runAsync: onFeedback } = useRequest(
    async () => {
      const plan = teamPlanStatus?.standard?.currentSubLevel
        ? subPlans?.standard?.[teamPlanStatus?.standard?.currentSubLevel]
        : undefined;

      const ticketResponseTime =
        teamPlanStatus?.standard?.ticketResponseTime ?? plan?.ticketResponseTime;
      if (!ticketResponseTime) {
        setNotSufficientModalType(TeamErrEnum.ticketNotAvailable);
        return;
      }

      const data = await getWorkorderURL();
      if (data) {
        window.open(data.redirectUrl);
      }
    },
    {
      manual: true
    }
  );

  const showCancellation =
    accountCancellationStatus?.status === 'pending' ||
    (accountCancellationStatus?.status === 'none' &&
      accountCancellationStatus.canRequestCancellation);

  return (
    <Box>
      <Box
        display={'grid'}
        gridTemplateColumns={['repeat(2, minmax(0, 1fr))', 'repeat(4, minmax(0, 1fr))']}
        gap={['8px', '12px']}
      >
        {/* 鲁港通 - 帮助文档改为站内帮助中心，不再指向 FastGPT 官方文档站 */}
        <QuickActionItem
          icon={'common/quickActionBook'}
          label={t('account_info:help_document')}
          onClick={() => router.push('/help')}
        />
        {!!feConfigs?.concatMd && (
          <QuickActionItem
            icon={'common/quickActionPhone'}
            label={t('account_info:contact_us')}
            onClick={onOpenContact}
          />
        )}
        {!!feConfigs?.show_workorder && (
          <QuickActionItem
            icon={'common/quickActionFeedback'}
            label={t('common:question_feedback')}
            onClick={() => void onFeedback()}
          />
        )}
        {showCancellation && (
          <QuickActionItem
            icon={'common/quickActionUserX'}
            label={t('account_info:account_cancellation')}
            danger
            onClick={() => {
              if (accountCancellationStatus?.status === 'pending') {
                void router.push('/account/cancel');
                return;
              }
              onOpenCancellationConfirm();
            }}
          />
        )}
      </Box>

      {accountCancellationStatus?.status === 'none' &&
        accountCancellationStatus.canRequestCancellation && (
          <AccountCancellationConfirmModal
            isOpen={isCancellationConfirmOpen}
            onClose={onCloseCancellationConfirm}
            onConfirm={() => {
              onCloseCancellationConfirm();
              void router.push('/account/cancel?confirmed=1');
            }}
          />
        )}
    </Box>
  );
};
