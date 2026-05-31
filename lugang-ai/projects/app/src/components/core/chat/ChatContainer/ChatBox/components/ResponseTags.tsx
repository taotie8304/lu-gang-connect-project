import React, { useMemo, useState } from 'react';
import { Flex, useDisclosure, Box, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import type { SearchDataResponseItemType } from '@fastgpt/global/core/dataset/type';
import dynamic from 'next/dynamic';
import MyTag from '@fastgpt/web/components/common/Tag/index';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { getSourceNameIcon } from '@fastgpt/global/core/dataset/utils';
import ChatBoxDivider from '@/components/core/chat/Divider';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useSystem } from '@fastgpt/web/hooks/useSystem';
import { type ChatSiteItemType } from '@fastgpt/global/core/chat/type';
import { ChatRoleEnum, ChatItemValueTypeEnum } from '@fastgpt/global/core/chat/constants';
import { addStatisticalDataToHistoryItem } from '@/global/core/chat/utils';
import { useSize } from 'ahooks';
import { useContextSelector } from 'use-context-selector';
import { ChatBoxContext } from '../Provider';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { filterCitationsByRelevance } from '@fastgpt/global/core/chat/citationFilter';
import {
  detectVideoPlatform,
  getVideoThumbnail
} from '@fastgpt/global/common/string/videoUtils';

export type CitationRenderItem = {
  type: 'dataset' | 'link' | 'web';
  key: string;
  displayText: string;
  icon?: string;
  thumbnail?: string | null;
  isVideo?: boolean;
  onClick: () => any;
};

const ContextModal = dynamic(() => import('./ContextModal'));
const WholeResponseModal = dynamic(() => import('../../../components/WholeResponseModal'));

const ResponseTags = ({
  showTags,
  historyItem,
  onOpenCiteModal
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
}) => {
  const { isPc } = useSystem();
  const { t } = useTranslation();
  const quoteListRef = React.useRef<HTMLDivElement>(null);
  const dataId = historyItem.dataId;
  // 鲁港通：获取当前用户，普通用户不显示文件类型引用
  const { userInfo } = useUserStore();
  const isRoot = userInfo?.username === 'root';
  // 鲁港通 - 引用相关性过滤阈值
  const { feConfigs } = useSystemStore();

  const chatTime = historyItem.time || new Date();
  const durationSeconds = historyItem.durationSeconds || 0;
  const {
    totalQuoteList: quoteList = [],
    llmModuleAccount = 0,
    historyPreviewLength = 0,
    toolCiteLinks = [],
    webSearchCitations = []
  } = useMemo(() => addStatisticalDataToHistoryItem(historyItem), [historyItem]);

  const [quoteFolded, setQuoteFolded] = useState<boolean>(true);

  // 鲁港通 - 检测回答文本中是否有裸数字引用 [N]，但无联网搜索引用数据
  const hasOrphanInlineRefs = useMemo(() => {
    if (webSearchCitations.length > 0) return false;
    if (historyItem.obj !== ChatRoleEnum.AI) return false;
    const answerText = (historyItem.value as any[])
      .filter((v: any) => v.type === ChatItemValueTypeEnum.text && v.text?.content)
      .map((v: any) => v.text.content)
      .join('');
    return /\[\d+\]/.test(answerText);
  }, [historyItem, webSearchCitations]);

  const chatType = useContextSelector(ChatBoxContext, (v) => v.chatType);

  const notSharePage = useMemo(() => chatType !== 'share', [chatType]);

  const {
    isOpen: isOpenWholeModal,
    onOpen: onOpenWholeModal,
    onClose: onCloseWholeModal
  } = useDisclosure();
  const {
    isOpen: isOpenContextModal,
    onOpen: onOpenContextModal,
    onClose: onCloseContextModal
  } = useDisclosure();

  useSize(quoteListRef);
  const quoteIsOverflow = quoteListRef.current
    ? quoteListRef.current.scrollHeight > (isPc ? 50 : 55)
    : true;

  const citationRenderList: CitationRenderItem[] = useMemo(() => {
    // 鲁港通：按 collectionId 去重
    const uniqueQuoteItems = Object.values(
      quoteList.reduce((acc: Record<string, SearchDataResponseItemType[]>, cur) => {
        if (!acc[cur.collectionId]) {
          acc[cur.collectionId] = [cur];
        }
        return acc;
      }, {})
    ).flat();

    // 鲁港通 - 知识库引用相关性过滤（普通用户）
    const threshold = feConfigs?.citationRelevanceThreshold ?? 0.4;
    const filteredQuoteItems = filterCitationsByRelevance(uniqueQuoteItems, {
      isRoot,
      threshold
    });

    let datasetItems: CitationRenderItem[];

    if (isRoot) {
      // 管理员：显示所有引用，点击打开知识库详情
      datasetItems = filteredQuoteItems.map((item) => ({
        type: 'dataset' as const,
        key: item.collectionId,
        displayText: item.sourceName,
        icon: item.imageId
          ? 'core/dataset/imageFill'
          : getSourceNameIcon({ sourceId: item.sourceId, sourceName: item.sourceName }),
        onClick: () => {
          onOpenCiteModal({
            collectionId: item.collectionId,
            sourceId: item.sourceId,
            sourceName: item.sourceName,
            datasetId: item.datasetId
          });
        }
      }));
    } else {
      // 鲁港通：普通用户只显示有网页链接的引用（sourceId 以 http 开头），点击直接跳转源网站
      datasetItems = filteredQuoteItems
        .filter((item) => item.sourceId && /^https?:\/\//.test(item.sourceId))
        .map((item) => ({
          type: 'link' as const,
          key: item.collectionId,
          displayText: item.sourceName,
          icon: getSourceNameIcon({ sourceId: item.sourceId, sourceName: item.sourceName }),
          onClick: () => {
            window.open(item.sourceId, '_blank');
          }
        }));
    }

    // Link citations（工具返回的外部链接）
    const linkItems = toolCiteLinks.map((r, index) => ({
      type: 'link' as const,
      key: `${r.url}-${index}`,
      displayText: r.name,
      onClick: () => {
        window.open(r.url, '_blank');
      }
    }));

    // 鲁港通 - 联网搜索引用（来自阿里百炼 search_info）
    const webItems: CitationRenderItem[] = webSearchCitations.map((item, index) => {
      const videoInfo = detectVideoPlatform(item.url);
      const thumbnail = videoInfo ? getVideoThumbnail(item.url) : null;

      return {
        type: 'web' as const,
        key: `web-${item.url}-${index}`,
        displayText: item.title || item.url,
        icon: 'common/linkBlue',
        thumbnail,
        isVideo: !!videoInfo,
        onClick: () => {
          window.open(item.url, '_blank');
        }
      };
    });

    // 分组展示：知识库引用 → 联网搜索引用 → 工具链接
    return [...datasetItems, ...webItems, ...linkItems];
  }, [quoteList, toolCiteLinks, webSearchCitations, onOpenCiteModal, isRoot, feConfigs?.citationRelevanceThreshold]);

  const notEmptyTags = notSharePage || quoteList.length > 0 || (isPc && durationSeconds > 0);

  // 鲁港通 - 普通用户完全隐藏引用列表（Requirements 5.1, 5.2, 5.3）
  const shouldShowCitations = isRoot && citationRenderList.length > 0;

  return !showTags ? null : (
    <>
      {/* quote */}
      {shouldShowCitations && (
        <>
          <Flex justifyContent={'space-between'} alignItems={'center'}>
            <Box width={'100%'}>
              <ChatBoxDivider
                icon="core/chat/quoteFill"
                text={t('common:core.chat.Quote')}
                iconColor="#E82F72"
              />
            </Box>
            {quoteFolded && quoteIsOverflow && (
              <MyIcon
                _hover={{ color: 'primary.500', cursor: 'pointer' }}
                name="core/chat/chevronDown"
                w={'14px'}
                onClick={() => setQuoteFolded(!quoteFolded)}
              />
            )}
          </Flex>

          <Flex
            ref={quoteListRef}
            alignItems={'center'}
            position={'relative'}
            flexWrap={'wrap'}
            gap={2}
            maxH={quoteFolded && quoteIsOverflow ? ['50px', '55px'] : 'auto'}
            overflow={'hidden'}
            _after={
              quoteFolded && quoteIsOverflow
                ? {
                    content: '""',
                    position: 'absolute',
                    zIndex: 2,
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '50%',
                    background:
                      'linear-gradient(to bottom, rgba(247,247,247,0), rgba(247, 247, 247, 0.91))'
                  }
                : {}
            }
          >
            {citationRenderList.map((item, index) => {
              // 鲁港通 - 视频引用卡片样式
              if (item.isVideo && item.thumbnail) {
                return (
                  <MyTooltip key={item.key} label={item.displayText}>
                    <Flex
                      alignItems={'center'}
                      fontSize={'xs'}
                      border={'sm'}
                      borderRadius={'sm'}
                      overflow={'hidden'}
                      cursor={'pointer'}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onClick?.();
                      }}
                      height={'48px'}
                      maxW={'200px'}
                    >
                      <Box
                        as="img"
                        src={item.thumbnail}
                        alt={item.displayText}
                        h={'full'}
                        w={'64px'}
                        objectFit={'cover'}
                        flexShrink={0}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          // 缩略图加载失败，降级为平台图标
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <Flex
                        display={'none'}
                        w={'64px'}
                        h={'full'}
                        bg={'myGray.100'}
                        alignItems={'center'}
                        justifyContent={'center'}
                        flexShrink={0}
                      >
                        <MyIcon name={item.icon as any} w={'16px'} />
                      </Flex>
                      <Flex direction={'column'} px={1.5} py={1} overflow={'hidden'} flex={1}>
                        <Box
                          className="textEllipsis3"
                          wordBreak={'break-all'}
                          fontSize={'mini'}
                          lineHeight={'1.3'}
                        >
                          {item.displayText}
                        </Box>
                      </Flex>
                    </Flex>
                  </MyTooltip>
                );
              }

              // 标准引用样式
              return (
                <MyTooltip key={item.key} label={t('common:core.chat.quote.Read Quote')}>
                  <Flex
                    alignItems={'center'}
                    fontSize={'xs'}
                    border={'sm'}
                    borderRadius={'sm'}
                    _hover={{
                      '.controller': {
                        display: 'flex'
                      }
                    }}
                    overflow={'hidden'}
                    position={'relative'}
                    cursor={'pointer'}
                    onClick={(e) => {
                      e.stopPropagation();
                      item.onClick?.();
                    }}
                    height={6}
                  >
                    <Flex
                      color={'myGray.500'}
                      bg={'myGray.150'}
                      w={4}
                      justifyContent={'center'}
                      fontSize={'10px'}
                      h={'full'}
                      alignItems={'center'}
                    >
                      {index + 1}
                    </Flex>
                    <Flex px={1.5}>
                      <MyIcon name={item.icon as any} mr={1} flexShrink={0} w={'12px'} />
                      <Box
                        className="textEllipsis3"
                        wordBreak={'break-all'}
                        flex={'1 0 0'}
                        fontSize={'mini'}
                      >
                        {item.displayText}
                      </Box>
                    </Flex>
                  </Flex>
                </MyTooltip>
              );
            })}
            {!quoteFolded && (
              <MyIcon
                position={'absolute'}
                bottom={0}
                right={0}
                _hover={{ color: 'primary.500', cursor: 'pointer' }}
                name="core/chat/chevronUp"
                w={'14px'}
                onClick={() => setQuoteFolded(!quoteFolded)}
              />
            )}
          </Flex>
        </>
      )}

      {/* 鲁港通 - 回答中有 [N] 引用但无联网搜索引用数据时，显示提示 */}
      {hasOrphanInlineRefs && citationRenderList.length === 0 && (
        <Flex alignItems={'center'} mt={2} gap={1.5}>
          <MyIcon name={'common/linkBlue'} w={'14px'} color={'myGray.500'} />
          <Text fontSize={'xs'} color={'myGray.500'}>
            {t('chat:citation_sources_unavailable')}
          </Text>
        </Flex>
      )}

      {notEmptyTags && (
        <Flex alignItems={'center'} mt={3} flexWrap={'wrap'} gap={2}>
          {quoteList.length > 0 && isRoot && (
            <MyTooltip label={t('chat:view_citations')}>
              <MyTag
                colorSchema="blue"
                type="borderSolid"
                cursor={'pointer'}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCiteModal();
                }}
              >
                {t('chat:citations', { num: quoteList.length })}
              </MyTag>
            </MyTooltip>
          )}
          {llmModuleAccount === 1 && notSharePage && isRoot && (
            <>
              {historyPreviewLength > 0 && (
                <MyTooltip label={t('chat:click_contextual_preview')}>
                  <MyTag
                    colorSchema="green"
                    cursor={'pointer'}
                    type="borderSolid"
                    onClick={onOpenContextModal}
                  >
                    {t('chat:contextual', { num: historyPreviewLength })}
                  </MyTag>
                </MyTooltip>
              )}
            </>
          )}
          {llmModuleAccount > 1 && notSharePage && (
            <MyTag type="borderSolid" colorSchema="blue">
              {t('chat:multiple_AI_conversations')}
            </MyTag>
          )}
          {isPc && isRoot && durationSeconds > 0 && (
            <MyTooltip label={t('chat:module_runtime_and')}>
              <MyTag colorSchema="purple" type="borderSolid" cursor={'default'}>
                {durationSeconds.toFixed(2)}s
              </MyTag>
            </MyTooltip>
          )}

          {notSharePage && isRoot && (
            <MyTooltip label={t('common:core.chat.response.Read complete response tips')}>
              <MyTag
                colorSchema="gray"
                type="borderSolid"
                cursor={'pointer'}
                onClick={onOpenWholeModal}
              >
                {t('common:core.chat.response.Read complete response')}
              </MyTag>
            </MyTooltip>
          )}
        </Flex>
      )}

      {isOpenContextModal && <ContextModal dataId={dataId} onClose={onCloseContextModal} />}
      {isOpenWholeModal && (
        <WholeResponseModal dataId={dataId} chatTime={chatTime} onClose={onCloseWholeModal} />
      )}
    </>
  );
};

export default React.memo(ResponseTags);
