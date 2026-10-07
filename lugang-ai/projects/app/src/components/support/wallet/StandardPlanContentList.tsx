import { useSystemStore } from '@/web/common/system/useSystemStore';
import {
  StandardSubLevelEnum,
  SubModeEnum
} from '@fastgpt/global/support/wallet/sub/constants';
import React, { useMemo } from 'react';
import { Box, Flex, Grid, Text } from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useUserStore } from '@/web/support/user/useUserStore';
import { formatFileSize } from '@fastgpt/global/common/file/tools';
import type { TeamPlanStandardType } from '@fastgpt/global/support/wallet/sub/type';

/** 鲁港通 - 积分数千分位展示，跨语言稳定（如 82,800） */
const formatPoints = (points: number) => points.toLocaleString('en-US');

/**
 * 鲁港通 - 套餐权益列表（价格页/账号页共用）。
 * 销售口径（豆包式）：免费版直列功能与额度；付费档仅「包括免费版的所有权益」+ 积分数 + 积分长期有效。
 * 不再展示深度问答次数与对话记录保留天数（无强制执行保障的依据），上传限制四档统一。
 */
const StandardPlanContentList = ({
  level,
  mode,
  standplan
}: {
  level: `${StandardSubLevelEnum}`;
  mode: `${SubModeEnum}`;
  standplan?: TeamPlanStandardType;
}) => {
  const { t } = useClientTranslation();
  const { subPlans, feConfigs } = useSystemStore();
  const { userInfo } = useUserStore();

  const planContent = useMemo(() => {
    const isWecomTeam = !!userInfo?.team?.isWecomTeam;
    const formatMode = isWecomTeam ? SubModeEnum.year : mode;

    // For wecom teams, free plan should use basic plan config
    const effectiveLevel =
      isWecomTeam && level === StandardSubLevelEnum.free ? StandardSubLevelEnum.basic : level;
    const plan = subPlans?.standard?.[effectiveLevel];

    if (!plan) return;

    // 鲁港通 - 免费档固定展示注册赠送额度，不随付费模式翻倍
    const isFreeLevel = effectiveLevel === StandardSubLevelEnum.free;
    const monthMultiplier = formatMode === SubModeEnum.month || isFreeLevel ? 1 : 12;

    return {
      level: level as `${StandardSubLevelEnum}`,
      isFreeLevel,
      isYearMode: formatMode === SubModeEnum.year,
      annualBonusPoints:
        formatMode === SubModeEnum.month
          ? 0
          : (standplan?.annualBonusPoints ?? plan.annualBonusPoints),
      totalPoints:
        standplan?.totalPoints ??
        (isWecomTeam ? (plan.wecom?.points ?? 2000) : plan.totalPoints * monthMultiplier),
      maxUploadFileSize: formatFileSize(
        (standplan?.maxUploadFileSize || plan.maxUploadFileSize || feConfigs.uploadFileMaxSize) *
          1024 ** 2
      ),
      maxUploadFileCount:
        standplan?.maxUploadFileCount || plan.maxUploadFileCount || feConfigs.uploadFileMaxAmount
    };
  }, [
    subPlans?.standard,
    level,
    mode,
    userInfo?.team?.isWecomTeam,
    standplan?.annualBonusPoints,
    standplan?.totalPoints,
    standplan?.maxUploadFileSize,
    standplan?.maxUploadFileCount,
    feConfigs?.uploadFileMaxSize,
    feConfigs?.uploadFileMaxAmount
  ]);

  if (!planContent) return null;

  // 鲁港通 - 价格页（无真实订阅传入）付费档展示「积分/月（年）」；账号页展示真实到账总量，不带周期单位
  const pointsUnit =
    !standplan && !planContent.isFreeLevel
      ? planContent.isYearMode
        ? t('price:plan.points_unit_year')
        : t('price:plan.points_unit_month')
      : t('common:support.wallet.subscription.point');

  return (
    <Grid gap={4} fontSize={'sm'} fontWeight={500}>
      {/* 首行：付费档「包括免费版的所有权益」；免费档列功能范围 */}
      <Flex alignItems={'center'}>
        <MyIcon name={'price/right'} w={'16px'} mr={3} color={'primary.600'} />
        <Box color={'myGray.600'}>
          {planContent.isFreeLevel
            ? t('price:plan.feature.free_all_open')
            : t('price:plan.feature.all_free')}
        </Box>
      </Flex>
      {/* 积分行（年付赠送时划掉原值展示到账总量） */}
      <Flex alignItems={'center'}>
        <MyIcon
          name={'price/right'}
          w={'16px'}
          mr={3}
          color={planContent.annualBonusPoints ? '#BB182C' : 'primary.600'}
        />
        <Flex alignItems={'center'}>
          {planContent.annualBonusPoints ? (
            <>
              <Text fontWeight={'bold'} color={'myGray.600'} textDecoration={'line-through'} mr={1}>
                {formatPoints(planContent.totalPoints)}
              </Text>
              <Text fontWeight={'bold'} color={'#DF531E'}>
                {formatPoints(planContent.totalPoints + planContent.annualBonusPoints)}
              </Text>
              <Text color={'myGray.600'} ml={1}>
                {pointsUnit}
              </Text>
            </>
          ) : (
            <Box fontWeight={'bold'} color={'myGray.600'} display={'flex'}>
              <Text>{formatPoints(planContent.totalPoints)}</Text>
              <Text ml={1}>{pointsUnit}</Text>
            </Box>
          )}
        </Flex>
      </Flex>
      {planContent.isFreeLevel ? (
        <>
          {/* 免费档：上传限制 + 云端对话记录/工单反馈 */}
          <Flex alignItems={'center'}>
            <MyIcon name={'price/right'} w={'16px'} mr={3} color={'primary.600'} />
            <Box color={'myGray.600'}>
              {t('price:plan.feature.upload_limit', {
                count: planContent.maxUploadFileCount,
                size: planContent.maxUploadFileSize
              })}
            </Box>
          </Flex>
          <Flex alignItems={'center'}>
            <MyIcon name={'price/right'} w={'16px'} mr={3} color={'primary.600'} />
            <Box color={'myGray.600'}>{t('price:plan.feature.free_cloud_ticket')}</Box>
          </Flex>
        </>
      ) : (
        <Flex alignItems={'center'}>
          <MyIcon name={'price/right'} w={'16px'} mr={3} color={'primary.600'} />
          <Box color={'myGray.600'}>{t('price:plan.feature.points_permanent')}</Box>
        </Flex>
      )}
    </Grid>
  );
};

export default StandardPlanContentList;
