'use client';
import React, { useCallback, useState } from 'react';
import { Box, Button, Flex, Switch, Textarea } from '@chakra-ui/react';
import dayjs from 'dayjs';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyBox from '@fastgpt/web/components/common/MyBox';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import type { UserMemoryItemType } from '@fastgpt/global/support/memory/type';
import {
  getUserMemoryList,
  postAdoptMemoryCandidate,
  postClearUserMemories,
  postDeleteUserMemory,
  postIgnoreMemoryCandidate,
  postSaveUserMemory,
  postToggleUserMemory,
  postUpdateUserMemorySetting
} from '@/web/support/memory/api';
import {
  accountContentScrollStyles,
  accountPageRootStyles,
  accountTitleTextStyles
} from '../styles';

/** 记忆时间统一按本地时区展示到分钟 */
const formatMemoryTime = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm');

const Memories = () => {
  const { t } = useClientTranslation('account');

  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [editingContent, setEditingContent] = useState('');
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [autoExtractEnabled, setAutoExtractEnabled] = useState(true);
  const [pendingDrafts, setPendingDrafts] = useState<Record<string, string>>({});

  const { data, loading, refresh } = useRequest(getUserMemoryList, {
    manual: false,
    onSuccess: (res) => {
      setMasterEnabled(res.enabled);
      setAutoExtractEnabled(res.autoExtractEnabled);
      setPendingDrafts(
        Object.fromEntries((res.pending ?? []).map((item) => [item.id, item.content]))
      );
    }
  });

  const list = data?.list ?? [];
  const pendingList = data?.pending ?? [];
  const maxCount = data?.maxCount ?? 50;
  const maxContentLength = data?.maxContentLength ?? 200;
  const reachedLimit = list.length >= maxCount;
  const trimmedNewContent = newContent.trim();
  const canAdd =
    !reachedLimit &&
    trimmedNewContent.length > 0 &&
    trimmedNewContent.length <= maxContentLength;

  const { run: addMemory, loading: adding } = useRequest(postSaveUserMemory, {
    onSuccess: () => {
      setNewContent('');
      refresh();
    },
    successToast: t('account:memory_added')
  });

  const { run: updateMemory, loading: updating } = useRequest(postSaveUserMemory, {
    onSuccess: () => {
      setEditingId(undefined);
      setEditingContent('');
      refresh();
    },
    successToast: t('account:memory_updated')
  });

  const { run: toggleMemory } = useRequest(postToggleUserMemory, {
    onSuccess: () => refresh()
  });

  const { run: deleteMemory } = useRequest(postDeleteUserMemory, {
    onSuccess: () => refresh(),
    successToast: t('account:memory_deleted')
  });

  const { run: clearMemories, loading: clearing } = useRequest(postClearUserMemories, {
    onSuccess: () => refresh(),
    successToast: t('account:memory_cleared')
  });

  const { run: updateSettings, loading: savingSettings } = useRequest(
    postUpdateUserMemorySetting,
    {
      onSuccess: () => refresh()
    }
  );

  const { run: adoptCandidate, loading: adoptingCandidate } = useRequest(
    postAdoptMemoryCandidate,
    {
      onSuccess: () => refresh(),
      successToast: t('account:memory_pending_adopted')
    }
  );

  const { run: ignoreCandidate } = useRequest(postIgnoreMemoryCandidate, {
    onSuccess: () => refresh(),
    successToast: t('account:memory_pending_ignored')
  });

  const { openConfirm, ConfirmModal } = useConfirm({ type: 'delete' });

  const handleDelete = useCallback(
    (item: UserMemoryItemType) => {
      openConfirm({
        customContent: t('account:memory_delete_confirm'),
        onConfirm: () => deleteMemory(item.id)
      })();
    },
    [deleteMemory, openConfirm, t]
  );

  const handleClear = useCallback(() => {
    openConfirm({
      customContent: t('account:memory_clear_confirm'),
      onConfirm: () => clearMemories()
    })();
  }, [clearMemories, openConfirm, t]);

  const handleStartEdit = useCallback((item: UserMemoryItemType) => {
    setEditingId(item.id);
    setEditingContent(item.content);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(undefined);
    setEditingContent('');
  }, []);

  return (
    <Flex {...accountPageRootStyles} flexDirection={'column'}>
      <Flex
        h={['56px', '64px']}
        flexShrink={0}
        px={[4, 6]}
        alignItems={'center'}
        borderBottom={'1px solid'}
        borderColor={'myGray.200'}
      >
        <Box as={'h1'} {...accountTitleTextStyles}>
          {t('account:memories')}
        </Box>
      </Flex>

      <Box px={[4, 6]} pt={[4, 6]} pb={[4, 6]} {...accountContentScrollStyles}>
        <Flex maxW={'760px'} w={'100%'} mx={'auto'} flexDirection={'column'} gap={4}>
          {/* 总开关：关闭后助手不再使用记忆，但资料保留 */}
          <Flex
            px={4}
            py={3.5}
            borderRadius={'xl'}
            border={'1px solid'}
            borderColor={'myGray.200'}
            bg={'white'}
            alignItems={'center'}
            gap={3}
          >
            <MyIcon
              name={'core/chat/deepThinking'}
              w={'20px'}
              flexShrink={0}
              color={'primary.600'}
            />
            <Box flex={1} minW={0}>
              <Box fontSize={'sm'} fontWeight={500} color={'myGray.900'}>
                {t('account:memory_master_switch')}
              </Box>
              <Box mt={0.5} fontSize={'xs'} color={'myGray.500'} lineHeight={1.6}>
                {t('account:memory_master_switch_desc')}
              </Box>
            </Box>
            <Switch
              flexShrink={0}
              colorScheme={'blue'}
              isChecked={masterEnabled}
              isDisabled={loading || savingSettings}
              onChange={(e) => updateSettings({ enabled: e.target.checked })}
            />
          </Flex>

          {/* 自动记住：对话中识别到的候选先确认再保存 */}
          <Flex
            px={4}
            py={3.5}
            borderRadius={'xl'}
            border={'1px solid'}
            borderColor={'myGray.200'}
            bg={'white'}
            alignItems={'center'}
            gap={3}
          >
            <MyIcon
              name={'core/chat/think'}
              w={'20px'}
              flexShrink={0}
              color={'primary.600'}
            />
            <Box flex={1} minW={0}>
              <Box fontSize={'sm'} fontWeight={500} color={'myGray.900'}>
                {t('account:memory_auto_extract_switch')}
              </Box>
              <Box mt={0.5} fontSize={'xs'} color={'myGray.500'} lineHeight={1.6}>
                {t('account:memory_auto_extract_switch_desc')}
              </Box>
            </Box>
            <Switch
              flexShrink={0}
              colorScheme={'blue'}
              isChecked={autoExtractEnabled}
              isDisabled={loading || savingSettings || !masterEnabled}
              onChange={(e) => updateSettings({ autoExtractEnabled: e.target.checked })}
            />
          </Flex>

          {/* 待确认记忆 */}
          {pendingList.length > 0 && (
            <Box>
              <Flex alignItems={'center'} mb={2}>
                <Box fontSize={'sm'} fontWeight={500} color={'myGray.900'}>
                  {t('account:memory_pending_title', { count: pendingList.length })}
                </Box>
              </Flex>
              <Box mb={2} fontSize={'xs'} color={'myGray.500'} lineHeight={1.6}>
                {t('account:memory_pending_desc')}
              </Box>
              <Flex flexDirection={'column'} gap={3}>
                {pendingList.map((item) => {
                  const draft = pendingDrafts[item.id] ?? item.content;
                  const trimmedDraft = draft.trim();
                  return (
                    <Box
                      key={item.id}
                      px={4}
                      py={3.5}
                      borderRadius={'xl'}
                      border={'1px solid'}
                      borderColor={'primary.200'}
                      bg={'primary.50'}
                    >
                      <Textarea
                        rows={2}
                        resize={'none'}
                        bg={'white'}
                        borderColor={'primary.200'}
                        fontSize={'sm'}
                        value={draft}
                        maxLength={maxContentLength}
                        onChange={(e) =>
                          setPendingDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                      <Flex mt={2} alignItems={'center'} gap={2}>
                        <Box fontSize={'xs'} color={'myGray.400'}>
                          {formatMemoryTime(item.createdAt)}
                        </Box>
                        <Box flex={1} />
                        <Button
                          size={'sm'}
                          variant={'whiteBase'}
                          onClick={() => ignoreCandidate(item.id)}
                        >
                          {t('account:memory_pending_ignore')}
                        </Button>
                        <Button
                          size={'sm'}
                          variant={'primary'}
                          isLoading={adoptingCandidate}
                          isDisabled={!trimmedDraft || reachedLimit}
                          onClick={() =>
                            adoptCandidate({ id: item.id, content: trimmedDraft })
                          }
                        >
                          {t('account:memory_pending_adopt')}
                        </Button>
                      </Flex>
                    </Box>
                  );
                })}
              </Flex>
            </Box>
          )}

          {/* 新增记忆 */}
          <Box
            px={4}
            py={4}
            borderRadius={'xl'}
            border={'1px solid'}
            borderColor={'myGray.200'}
            bg={'white'}
          >
            <Textarea
              rows={3}
              resize={'none'}
              bg={'myGray.50'}
              borderColor={'myGray.200'}
              fontSize={'sm'}
              value={newContent}
              maxLength={maxContentLength}
              placeholder={t('account:memory_placeholder')}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <Flex mt={2.5} alignItems={'center'} gap={3}>
              <Box
                fontSize={'xs'}
                flexShrink={0}
                color={newContent.length >= maxContentLength ? 'orange.600' : 'myGray.400'}
              >
                {t('account:memory_char_count', {
                  count: newContent.length,
                  max: maxContentLength
                })}
              </Box>
              <Box flex={1} />
              {reachedLimit && (
                <Box fontSize={'xs'} color={'orange.600'} textAlign={'right'}>
                  {t('account:memory_limit_reached', { max: maxCount })}
                </Box>
              )}
              <Button
                size={'sm'}
                variant={'primary'}
                flexShrink={0}
                isDisabled={!canAdd}
                isLoading={adding}
                onClick={() => addMemory({ content: trimmedNewContent })}
              >
                {t('account:memory_add_button')}
              </Button>
            </Flex>
          </Box>

          <Flex alignItems={'center'} mt={2}>
            <Box fontSize={'sm'} fontWeight={500} color={'myGray.900'}>
              {t('account:memory_list_title')}
            </Box>
            <Box ml={2} fontSize={'xs'} color={'myGray.500'}>
              {t('account:memory_count', { count: list.length, max: maxCount })}
            </Box>
            <Box flex={1} />
            {list.length > 0 && (
              <Button
                size={'xs'}
                variant={'whiteDanger'}
                isLoading={clearing}
                onClick={handleClear}
              >
                {t('account:memory_clear_all')}
              </Button>
            )}
          </Flex>

          <Box fontSize={'xs'} color={'myGray.500'} px={1} mx={-1} lineHeight={1.6}>
            {t('account:memory_limit_tip', { max: maxCount, length: maxContentLength })}
          </Box>

          <MyBox isLoading={loading} flex={['0 0 auto', '1 0 0']} minH={0}>
            {list.length === 0 && !loading ? (
              <EmptyTip text={t('account:memory_empty')} />
            ) : (
              <Flex flexDirection={'column'} gap={3} pb={4}>
                {list.map((item) => (
                  <Box
                    key={item.id}
                    px={4}
                    py={3.5}
                    borderRadius={'xl'}
                    border={'1px solid'}
                    borderColor={'myGray.200'}
                    bg={'white'}
                  >
                    {editingId === item.id ? (
                      <>
                        <Textarea
                          rows={3}
                          resize={'none'}
                          bg={'myGray.50'}
                          borderColor={'myGray.200'}
                          fontSize={'sm'}
                          autoFocus
                          value={editingContent}
                          maxLength={maxContentLength}
                          onChange={(e) => setEditingContent(e.target.value)}
                        />
                        <Flex mt={2} alignItems={'center'} gap={2}>
                          <Box fontSize={'xs'} color={'myGray.400'}>
                            {t('account:memory_char_count', {
                              count: editingContent.length,
                              max: maxContentLength
                            })}
                          </Box>
                          <Box flex={1} />
                          <Button size={'sm'} variant={'whiteBase'} onClick={handleCancelEdit}>
                            {t('account:memory_cancel_button')}
                          </Button>
                          <Button
                            size={'sm'}
                            variant={'primary'}
                            isLoading={updating}
                            isDisabled={!editingContent.trim()}
                            onClick={() =>
                              updateMemory({
                                id: item.id,
                                content: editingContent.trim()
                              })
                            }
                          >
                            {t('account:memory_save_button')}
                          </Button>
                        </Flex>
                      </>
                    ) : (
                      <>
                        <Flex alignItems={'flex-start'} gap={3}>
                          <Box
                            flex={1}
                            minW={0}
                            fontSize={'sm'}
                            lineHeight={1.7}
                            whiteSpace={'pre-wrap'}
                            wordBreak={'break-word'}
                            color={item.enabled ? 'myGray.900' : 'myGray.400'}
                          >
                            {item.content}
                          </Box>
                          <Switch
                            size={'sm'}
                            flexShrink={0}
                            colorScheme={'blue'}
                            isChecked={item.enabled}
                            onChange={(e) =>
                              toggleMemory({ id: item.id, enabled: e.target.checked })
                            }
                          />
                        </Flex>
                        <Flex mt={2} alignItems={'center'} gap={2} fontSize={'xs'}>
                          <Box color={'myGray.400'}>{formatMemoryTime(item.createdAt)}</Box>
                          <Box color={'myGray.300'}>·</Box>
                          <Box color={'myGray.400'}>
                            {item.source === 'auto'
                              ? t('account:memory_source_auto')
                              : t('account:memory_source_manual')}
                          </Box>
                          <Box flex={1} />
                          <Button
                            size={'xs'}
                            variant={'grayGhost'}
                            leftIcon={<MyIcon name={'common/edit'} w={'14px'} />}
                            onClick={() => handleStartEdit(item)}
                          >
                            {t('account:memory_edit')}
                          </Button>
                          <Button
                            size={'xs'}
                            variant={'grayGhost'}
                            leftIcon={<MyIcon name={'delete'} w={'14px'} />}
                            onClick={() => handleDelete(item)}
                          >
                            {t('account:memory_delete')}
                          </Button>
                        </Flex>
                      </>
                    )}
                  </Box>
                ))}
              </Flex>
            )}
          </MyBox>
        </Flex>
      </Box>

      <ConfirmModal />
    </Flex>
  );
};

export default Memories;
