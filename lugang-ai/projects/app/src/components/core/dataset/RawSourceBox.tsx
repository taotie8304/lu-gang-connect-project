import React, { useMemo } from 'react';
import { Box, type BoxProps } from '@chakra-ui/react';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { useTranslation } from 'next-i18next';
import { getCollectionSourceAndOpen } from '@/web/core/dataset/hooks/readCollectionSource';
import { getCollectionIcon } from '@fastgpt/global/core/dataset/utils';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { readCollectionSourceBody } from '@/pages/api/core/dataset/collection/read';
import type { DatasetCollectionTypeEnum } from '@fastgpt/global/core/dataset/constants';
import { useUserStore } from '@/web/support/user/useUserStore';
import { canUserViewCitationSource, isCitationUrl } from '@fastgpt/global/support/permission/citation';

type Props = BoxProps &
  readCollectionSourceBody & {
    collectionType?: DatasetCollectionTypeEnum;
    sourceName?: string;
    sourceId?: string;
    canView?: boolean;
  };

const RawSourceBox = ({
  sourceId,
  collectionType,
  sourceName = '',
  canView = true,

  collectionId,
  appId,
  chatId,
  chatItemDataId,
  shareId,
  outLinkUid,
  teamId,
  teamToken,

  ...props
}: Props) => {
  const { t } = useTranslation();
  // 鲁港通：获取当前用户信息
  const { userInfo } = useUserStore();

  // 鲁港通：检查用户是否有权限查看引用来源
  const hasPermission = useMemo(() => {
    return canUserViewCitationSource(userInfo?.username, collectionType, sourceId);
  }, [userInfo?.username, collectionType, sourceId]);

  // 鲁港通：只有有权限的用户才能预览（点击访问/下载）
  const canPreview = !!sourceId && canView && hasPermission;

  // 鲁港通：普通用户不显示文件类型引用，只显示 URL 类型
  if (!hasPermission && !isCitationUrl(collectionType, sourceId)) {
    return null;
  }

  const icon = useMemo(
    () => getCollectionIcon({ type: collectionType, sourceId, name: sourceName }),
    [collectionType, sourceId, sourceName]
  );
  const read = getCollectionSourceAndOpen({
    collectionId,
    appId,
    chatId,
    chatItemDataId,
    shareId,
    outLinkUid,
    teamId,
    teamToken
  });

  return (
    <MyTooltip
      label={canPreview ? t('file:click_to_view_raw_source') : ''}
      shouldWrapChildren={false}
    >
      <Box
        color={'myGray.900'}
        fontWeight={'medium'}
        display={'inline-flex'}
        whiteSpace={'nowrap'}
        {...(canPreview
          ? {
              cursor: 'pointer',
              textDecoration: 'underline',
              onClick: read
            }
          : {})}
        {...props}
      >
        <MyIcon name={icon as any} w={['1rem', '1.25rem']} mr={2} />
        <Box
          maxW={['200px', '300px']}
          className={props.className ?? 'textEllipsis'}
          wordBreak={'break-all'}
        >
          {sourceName || t('common:unknow_source')}
        </Box>
      </Box>
    </MyTooltip>
  );
};

export default RawSourceBox;
