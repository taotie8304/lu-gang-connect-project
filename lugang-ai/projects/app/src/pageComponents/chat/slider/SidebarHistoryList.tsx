import React, { useMemo, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { Box, Flex, IconButton } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyMenu from '@fastgpt/web/components/common/MyMenu';
import { ChatContext } from '@/web/core/chat/context/chatContext';
import { ChatItemContext } from '@/web/core/chat/context/chatItemContext';
import { useChatStore } from '@/web/core/chat/context/useChatStore';
import { useEditTitle } from '@/web/common/hooks/useEditTitle';
import { ChatGenerateStatusEnum } from '@fastgpt/global/core/chat/constants';
import { getDisplayHistoryTitle } from '@/web/core/chat/context/historyTitleUtils';
import { LG } from '@/pageComponents/chat/lugangTheme';

type GroupKey = 'pinned' | 'today' | 'week' | 'earlier';

type HistoryRowType = {
  id: string;
  title: string;
  customTitle?: string;
  top?: boolean;
  updateTime: Date;
  chatGenerateStatus?: ChatGenerateStatusEnum;
  hasBeenRead?: boolean;
  isTemporary?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const getGroupKey = (item: HistoryRowType, now: number): GroupKey => {
  if (item.top) return 'pinned';

  const time = new Date(item.updateTime).getTime();
  if (!Number.isFinite(time)) return 'earlier';

  const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  if (time >= startOfToday) return 'today';
  if (time >= startOfToday - 6 * DAY_MS) return 'week';
  return 'earlier';
};

const GROUP_LABEL_KEY = {
  pinned: 'chat:sidebar.history_pinned',
  today: 'chat:sidebar.history_today',
  week: 'chat:sidebar.history_week',
  earlier: 'chat:sidebar.history_earlier'
} as const;

const GROUP_ORDER: GroupKey[] = ['pinned', 'today', 'week', 'earlier'];

const GroupLabel = ({ label }: { label: string }) => (
  <Flex alignItems={'center'} gap={'6px'} px={'8px'} pt={'8px'} pb={'5px'}>
    <Box w={'4px'} h={'4px'} borderRadius={'50%'} bg={LG.lake} flexShrink={0} />
    <Box fontSize={'10.5px'} letterSpacing={'0.16em'} color={'#788DA0'} whiteSpace={'nowrap'}>
      {label}
    </Box>
  </Flex>
);

type Props = {
  searchText?: string;
};

// 鲁港通 - 左侧栏会话历史：今天 / 近 7 天 / 更早分组，支持标题搜索，保留置顶/改名/删除
const SidebarHistoryList = ({ searchText = '' }: Props) => {
  const { t } = useTranslation();
  const { chatId: activeChatId, appId } = useChatStore();

  const histories = useContextSelector(ChatContext, (v) => v.histories);
  const onDelHistory = useContextSelector(ChatContext, (v) => v.onDelHistory);
  const onUpdateHistory = useContextSelector(ChatContext, (v) => v.onUpdateHistory);
  const onChangeChatId = useContextSelector(ChatContext, (v) => v.onChangeChatId);

  const setCiteModalData = useContextSelector(ChatItemContext, (v) => v.setCiteModalData);
  const clearChatRecords = useContextSelector(ChatItemContext, (v) => v.clearChatRecords);
  const chatBoxData = useContextSelector(ChatItemContext, (v) => v.chatBoxData);

  const { onOpenModal, EditModal: EditTitleModal } = useEditTitle({
    title: t('common:core.chat.Custom History Title'),
    placeholder: t('common:core.chat.Custom History Title Description')
  });

  // 鲁港通 - 分组基准时间在挂载时取一次，避免渲染期读取当前时间导致重复渲染不稳定
  const [now] = useState(() => Date.now());

  const groups = useMemo(() => {
    const newChatTitle = t('common:core.chat.New Chat');
    const keyword = searchText.trim().toLowerCase();

    const rows: HistoryRowType[] = histories
      .filter((item) => item.appId === appId)
      .map((item) => {
        const isActiveChat =
          item.chatId === activeChatId &&
          chatBoxData.chatId === item.chatId &&
          chatBoxData.appId === item.appId;
        const customTitle = item.customTitle?.trim() ? item.customTitle : undefined;
        const realtimeTitle = chatBoxData.title?.trim() ? chatBoxData.title : undefined;

        return {
          id: item.chatId,
          title: getDisplayHistoryTitle({
            customTitle,
            title: (isActiveChat ? realtimeTitle : undefined) || item.title,
            fallbackTitle: newChatTitle
          }),
          customTitle,
          top: item.top,
          updateTime: item.updateTime,
          chatGenerateStatus: isActiveChat
            ? (chatBoxData.chatGenerateStatus ?? item.chatGenerateStatus)
            : item.chatGenerateStatus,
          hasBeenRead: isActiveChat ? (chatBoxData.hasBeenRead ?? item.hasBeenRead) : item.hasBeenRead
        };
      })
      .filter((item) => !keyword || item.title.toLowerCase().includes(keyword));

    const grouped: Record<GroupKey, HistoryRowType[]> = {
      pinned: [],
      today: [],
      week: [],
      earlier: []
    };
    rows.forEach((item) => grouped[getGroupKey(item, now)].push(item));

    return GROUP_ORDER.map((key) => ({ key, rows: grouped[key] })).filter(
      (group) => group.rows.length > 0
    );
  }, [
    activeChatId,
    appId,
    chatBoxData.appId,
    chatBoxData.chatGenerateStatus,
    chatBoxData.chatId,
    chatBoxData.hasBeenRead,
    chatBoxData.title,
    histories,
    now,
    searchText,
    t
  ]);

  return (
    <Flex flex={'1 0 0'} h={0} flexDir={'column'} overflowY={'auto'} overflowX={'hidden'} pb={2}>
      {groups.length === 0 ? (
        <Box px={'9px'} py={3} fontSize={'11.5px'} color={LG.mutedSoft}>
          {searchText.trim() ? t('chat:sidebar.history_no_match') : t('chat:sidebar.history_empty')}
        </Box>
      ) : (
        groups.map((group) => (
          <Box key={group.key} mb={'2px'}>
            <GroupLabel label={t(GROUP_LABEL_KEY[group.key])} />
            {group.rows.map((item) => (
              <Flex
                key={item.id}
                alignItems={'center'}
                gap={'8px'}
                h={'32px'}
                minH={'32px'}
                px={'9px'}
                borderRadius={'8px'}
                fontSize={'12.5px'}
                color={item.id === activeChatId ? '#245173' : '#4A5F70'}
                bg={item.id === activeChatId ? LG.activeItem : 'transparent'}
                boxShadow={item.id === activeChatId ? `inset 2px 0 0 ${LG.lake}` : 'none'}
                cursor={'pointer'}
                userSelect={'none'}
                _hover={{ bg: 'rgba(255,255,255,0.8)', color: '#23405A', '& .more': { display: 'flex' } }}
                onClick={
                  item.id === activeChatId
                    ? undefined
                    : () => {
                        onChangeChatId(item.id);
                        setCiteModalData(undefined);
                      }
                }
              >
                <Box flex={'1 0 0'} minW={0} className={'textEllipsis'}>
                  {item.title}
                </Box>

                {(item.chatGenerateStatus === ChatGenerateStatusEnum.generating ||
                  item.hasBeenRead === false) && (
                  <Box w={'6px'} h={'6px'} borderRadius={'full'} bg={LG.lake} flexShrink={0} />
                )}

                <Box className={'more'} display={'none'} flexShrink={0}>
                  <MyMenu
                    Button={
                      <IconButton
                        size={'xs'}
                        variant={'ghost'}
                        border={'none'}
                        bg={'transparent'}
                        color={LG.muted}
                        _hover={{ bg: 'transparent', color: LG.ink }}
                        _active={{ bg: 'transparent' }}
                        icon={<MyIcon name={'more'} w={'14px'} p={1} color={'currentColor'} />}
                        aria-label={''}
                      />
                    }
                    menuList={[
                      {
                        children: [
                          {
                            label: item.top
                              ? t('common:core.chat.Unpin')
                              : t('common:core.chat.Pin'),
                            icon: 'core/chat/setTopLight',
                            onClick: () => {
                              onUpdateHistory({
                                chatId: item.id,
                                top: !item.top
                              });
                            }
                          },
                          {
                            label: t('common:custom_title'),
                            icon: 'common/customTitleLight',
                            onClick: () => {
                              onOpenModal({
                                defaultVal: item.customTitle || item.title,
                                onSuccess: (e) =>
                                  onUpdateHistory({
                                    chatId: item.id,
                                    customTitle: e
                                  })
                              });
                            }
                          },
                          {
                            label: t('common:Delete'),
                            icon: 'delete',
                            onClick: () => {
                              onDelHistory(item.id);
                              if (item.id === activeChatId) {
                                clearChatRecords();
                                onChangeChatId();
                                setCiteModalData(undefined);
                              }
                            },
                            type: 'danger'
                          }
                        ]
                      }
                    ]}
                  />
                </Box>
              </Flex>
            ))}
          </Box>
        ))
      )}

      <EditTitleModal />
    </Flex>
  );
};

export default React.memo(SidebarHistoryList);
