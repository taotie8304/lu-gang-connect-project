import React, { useMemo, useState } from 'react';
import { Flex, useDisclosure, Box } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import type { ToolCiteLinksType } from '@fastgpt/global/core/chat/type';
import type { SearchDataResponseQuoteListItemType } from '@fastgpt/global/core/dataset/type';
import dynamic from 'next/dynamic';
import MyTag from '@fastgpt/web/components/common/Tag/index';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { getSourceNameIcon } from '@fastgpt/global/core/dataset/utils';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useSystem } from '@fastgpt/web/hooks/useSystem';
import type { ChatSiteItemType } from '../type';
import { addStatisticalDataToHistoryItem } from '@/global/core/chat/utils';
import { useSize } from 'ahooks';
import { useContextSelector } from 'use-context-selector';
import { ChatBoxContext } from '../Provider';
import { ChatItemContext } from '@/web/core/chat/context/chatItemContext';
// 鲁港通 - 引用内容权限：按角色控制引用来源是否可点击查看（普通用户仅可见文件名，URL 类来源仍可打开）
import { useUserStore } from '@/web/support/user/useUserStore';
import {
  canUserViewCitationSource,
  isAdminUser
} from '@fastgpt/global/support/permission/citation';
import { LG } from '@/pageComponents/chat/lugangTheme';

export type CitationRenderItem = {
  type: 'dataset' | 'link';
  key: string;
  displayText: string;
  icon?: string;
  // 鲁港通 - 消息区改版（第 4 批）：联网来源卡片显示域名副标题
  domain?: string;
  // 鲁港通 - 引用内容权限：是否可点击查看；普通用户的知识库文件来源为 false，仅展示文件名
  clickable?: boolean;
  onClick: () => any;
};

// 鲁港通 - 消息区改版（第 4 批）：来源卡片域名只做展示，解析失败时不显示
const getLinkDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

const WholeResponseModal = dynamic(() => import('../../../components/WholeResponseModal'));

const CitationListCard = React.memo(function CitationListCard({
  items,
  onOpenAll,
  canOpenAll = true
}: {
  items: CitationRenderItem[];
  onOpenAll: () => void;
  // 鲁港通 - 引用内容权限：是否允许点击标题打开全部引用阅读器（仅 root 管理员）
  canOpenAll?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<boolean>(false);
  const cardContentRef = React.useRef<HTMLDivElement>(null);
  const cardContentSize = useSize(cardContentRef);
  const collapsedMaxHeight = 96;
  const isOverflow = (cardContentSize?.height || 0) > collapsedMaxHeight;

  if (items.length === 0) return null;

  return (
    <>
      <Box display={['none', 'block']} mt={'12px'} w={'100%'}>
        <Box
          position={'relative'}
          maxH={!expanded && isOverflow ? `${collapsedMaxHeight}px` : 'none'}
          overflow={'hidden'}
        >
          <Box ref={cardContentRef}>
            <Flex h={'22px'} alignItems={'center'} justifyContent={'space-between'}>
              <MyTooltip label={canOpenAll ? t('chat:view_citations') : ''}>
                <Flex
                  alignItems={'center'}
                  gap={'6px'}
                  color={LG.muted}
                  fontSize={'11.5px'}
                  lineHeight={'18px'}
                  fontWeight={500}
                  cursor={canOpenAll ? 'pointer' : 'default'}
                  _hover={
                    canOpenAll
                      ? {
                          color: LG.mountain,
                          '.citation-count': {
                            color: LG.mountain
                          },
                          '.citation-arrow': {
                            color: LG.mountain
                          }
                        }
                      : undefined
                  }
                  onClick={
                    canOpenAll
                      ? (e) => {
                          e.stopPropagation();
                          onOpenAll();
                        }
                      : undefined
                  }
                >
                  <Box>
                    {t('chat:citation_card_prefix')}
                    <Box as={'span'} className="citation-count" color={LG.mountain}>
                      {items.length}
                    </Box>
                    {t('chat:citation_card_suffix')}
                  </Box>
                  <MyIcon
                    className="citation-arrow"
                    name={'common/arrowRight'}
                    w={'12px'}
                    color={LG.mutedSoft}
                    transform={'rotate(-45deg)'}
                  />
                </Flex>
              </MyTooltip>

              {isOverflow && (
                <MyIcon
                  name={expanded ? 'core/chat/chevronUp' : 'core/chat/chevronDown'}
                  w={'14px'}
                  color={LG.mutedSoft}
                  cursor={'pointer'}
                  _hover={{ color: LG.mountain }}
                  onClick={() => setExpanded((state) => !state)}
                />
              )}
            </Flex>

            <Flex mt={'2px'} flexWrap={'wrap'} gap={'9px'}>
              {items.map((item) => (
                <MyTooltip
                  key={item.key}
                  label={
                    item.clickable ? t('common:core.chat.quote.Read Quote') : item.displayText
                  }
                >
                  <Flex
                    alignItems={'center'}
                    gap={'8px'}
                    flex={'1 1 250px'}
                    minW={0}
                    px={'10px'}
                    py={'9px'}
                    borderRadius={'10px'}
                    border={'1px solid'}
                    borderColor={LG.line}
                    bg={'rgba(255,255,255,0.88)'}
                    color={LG.text}
                    cursor={item.clickable ? 'pointer' : 'default'}
                    _hover={
                      item.clickable
                        ? { borderColor: 'rgba(111,157,208,0.5)', bg: 'white' }
                        : undefined
                    }
                    onClick={
                      item.clickable
                        ? (e) => {
                            e.stopPropagation();
                            item.onClick?.();
                          }
                        : undefined
                    }
                  >
                    <Flex
                      alignItems={'center'}
                      justifyContent={'center'}
                      w={'22px'}
                      h={'22px'}
                      flexShrink={0}
                      borderRadius={'6px'}
                      bg={LG.pale}
                      color={LG.mountain}
                    >
                      <MyIcon name={item.icon as any} w={'13px'} h={'13px'} />
                    </Flex>
                    <Box minW={0} flex={1}>
                      <Box
                        className={'textEllipsis'}
                        fontSize={'11px'}
                        lineHeight={'15px'}
                        color={LG.text}
                      >
                        {item.displayText}
                      </Box>
                      {item.domain && (
                        <Box
                          mt={'2px'}
                          className={'textEllipsis'}
                          fontSize={'9.5px'}
                          lineHeight={'12px'}
                          color={'#93A4B8'}
                        >
                          {item.domain}
                        </Box>
                      )}
                    </Box>
                  </Flex>
                </MyTooltip>
              ))}
            </Flex>
          </Box>

          {!expanded && isOverflow && (
            <Box
              position={'absolute'}
              left={0}
              right={0}
              bottom={0}
              h={'32px'}
              zIndex={1}
              bgGradient={'linear(to-b, rgba(255,255,255,0), rgba(255,255,255,1.0))'}
              pointerEvents={'none'}
            />
          )}
        </Box>
      </Box>

      <Flex
        display={['inline-flex', 'none']}
        mt={3}
        alignItems={'center'}
        gap={'4px'}
        color={'primary.600'}
        fontSize={'14px'}
        lineHeight={'20px'}
        fontWeight={500}
        cursor={canOpenAll ? 'pointer' : 'default'}
        onClick={
          canOpenAll
            ? (e) => {
                e.stopPropagation();
                onOpenAll();
              }
            : undefined
        }
      >
        <MyIcon name={'common/link'} w={'16px'} h={'16px'} color={'primary.600'} />
        <Box>{t('chat:citation_card_title', { num: items.length })}</Box>
      </Flex>
    </>
  );
});

const ResponseTags = ({
  showTags,
  historyItem,
  onOpenCiteModal,
  showFooterMeta = true
}: {
  showTags: boolean;
  historyItem: ChatSiteItemType;
  onOpenCiteModal: (e?: {
    collectionId?: string;
    sourceId?: string;
    sourceName?: string;
    datasetId?: string;
    quoteId?: string;
  }) => void;
  showFooterMeta?: boolean;
}) => {
  const { isPc } = useSystem();
  const { t } = useTranslation();
  const dataId = historyItem.dataId;

  // 鲁港通 - 引用内容权限：仅 root 管理员可查看知识库分块内容；普通用户只可见文件名，URL 类来源仍可点击打开
  const username = useUserStore((s) => s.userInfo?.username);
  const isRoot = isAdminUser(username);

  const durationSeconds = historyItem.durationSeconds || 0;
  const isShowCite = useContextSelector(ChatItemContext, (v) => v.isShowCite);
  const showWholeResponse = useContextSelector(ChatItemContext, (v) => v.showWholeResponse ?? true);
  const responseTags = useMemo(() => {
    return {
      ...addStatisticalDataToHistoryItem(historyItem),
      ...(!isShowCite
        ? {
            totalQuoteList: []
          }
        : {})
    };
  }, [historyItem, isShowCite]);
  const chatType = useContextSelector(ChatBoxContext, (v) => v.chatType);

  const notSharePage = useMemo(() => chatType !== 'share', [chatType]);

  const {
    isOpen: isOpenWholeModal,
    onOpen: onOpenWholeModal,
    onClose: onCloseWholeModal
  } = useDisclosure();

  const citationRenderList: CitationRenderItem[] = useMemo(() => {
    if (!isShowCite) return [];
    const quoteList: SearchDataResponseQuoteListItemType[] = responseTags.totalQuoteList ?? [];
    const toolCiteLinks: ToolCiteLinksType[] = responseTags.toolCiteLinks ?? [];

    // Dataset citations
    const datasetItems = Object.values(
      quoteList.reduce((acc: Record<string, SearchDataResponseQuoteListItemType[]>, cur) => {
        if (!acc[cur.collectionId]) {
          acc[cur.collectionId] = [cur];
        }
        return acc;
      }, {})
    )
      .flat()
      .map((item) => {
        // 鲁港通 - 引用内容权限：root 打开阅读器查看内容；普通用户仅 URL 类来源可点击（新窗口打开），知识库文件来源不可点击查看
        const canView = canUserViewCitationSource(username, undefined, item.sourceId);
        return {
          type: 'dataset' as const,
          key: item.collectionId,
          displayText: item.sourceName,
          icon:
            'imageId' in item && item.imageId
              ? 'core/dataset/imageFill'
              : getSourceNameIcon({ sourceId: item.sourceId, sourceName: item.sourceName }) ||
                'core/chat/quoteFill',
          clickable: canView,
          onClick: () => {
            if (isRoot) {
              onOpenCiteModal({
                collectionId: item.collectionId,
                sourceId: item.sourceId,
                sourceName: item.sourceName,
                datasetId: item.datasetId
              });
            } else if (canView && item.sourceId) {
              window.open(item.sourceId, '_blank');
            }
          }
        };
      });

    // Link citations
    const linkItems = toolCiteLinks.map((r, index) => ({
      type: 'link' as const,
      key: `${r.url}-${index}`,
      displayText: r.name,
      icon: 'common/link',
      domain: getLinkDomain(r.url),
      // 鲁港通 - 互联网引用网址：所有用户均可点击打开（req3A）
      clickable: true,
      onClick: () => {
        window.open(r.url, '_blank');
      }
    }));

    return [...datasetItems, ...linkItems];
  }, [responseTags, onOpenCiteModal, isShowCite, username, isRoot]);

  const notEmptyTags =
    (showFooterMeta && notSharePage) || (showFooterMeta && isPc && durationSeconds > 0);

  return !showTags ? null : (
    <>
      {/* quote */}
      {citationRenderList.length > 0 && (
        <CitationListCard
          items={citationRenderList}
          canOpenAll={isRoot}
          onOpenAll={() => onOpenCiteModal()}
        />
      )}

      {notEmptyTags && (
        <Flex alignItems={'center'} mt={3} flexWrap={'wrap'} gap={2}>
          {showFooterMeta && isPc && durationSeconds > 0 && (
            <MyTooltip label={t('chat:module_runtime_and')}>
              <MyTag colorSchema="purple" type="borderSolid" cursor={'default'}>
                {durationSeconds.toFixed(2)}s
              </MyTag>
            </MyTooltip>
          )}

          {showFooterMeta && notSharePage && showWholeResponse && (
            <MyTooltip label={t('chat:response.read_complete_response_tips')}>
              <MyTag
                colorSchema="gray"
                type="borderSolid"
                cursor={'pointer'}
                onClick={onOpenWholeModal}
              >
                {t('chat:response.read_complete_response')}
              </MyTag>
            </MyTooltip>
          )}
        </Flex>
      )}

      {isOpenWholeModal && <WholeResponseModal dataId={dataId} onClose={onCloseWholeModal} />}
    </>
  );
};

export default React.memo(ResponseTags);
