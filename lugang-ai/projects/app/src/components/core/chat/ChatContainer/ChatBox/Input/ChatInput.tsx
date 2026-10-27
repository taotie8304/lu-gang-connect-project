import type { FlexProps, BoxProps } from '@chakra-ui/react';
import { Box, Flex, Textarea, useBoolean } from '@chakra-ui/react';
import React, { useRef, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'next-i18next';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { type ChatBoxInputFormType, type ChatBoxInputType, type SendPromptFnType } from '../type';
import { ChatInputDefaultHeight, ChatTypeEnum, textareaMinH } from '../constants';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { ChatBoxContext } from '../Provider';
import dynamic from 'next/dynamic';
import { useContextSelector } from 'use-context-selector';
import { WorkflowRuntimeContext } from '../../context/workflowRuntimeContext';
import { useSystem } from '@fastgpt/web/hooks/useSystem';
import { ChatItemContext } from '@/web/core/chat/context/chatItemContext';
import FilePreview from '../../components/FilePreview';
import { useFileUpload } from '../hooks/useFileUpload';
import { getFileUploadId } from '../utils/uploadTask';
import { isChatFileAllowedBySelectConfig } from '../utils/file';
import ComplianceTip from '@/components/common/ComplianceTip/index';
import PointsBalanceNotice, { PointsBalanceTag } from '@/pageComponents/chat/PointsBalanceNotice';
import BuiltinBrowserEntryButton from '@/pageComponents/chat/builtinBrowser/entryButton';
import { useToast } from '@fastgpt/web/hooks/useToast';
import VoiceInput, { type VoiceInputComponentRef } from './VoiceInput';
import MyBox from '@fastgpt/web/components/common/MyBox';
import type { WorkflowInteractiveResponseType } from '@fastgpt/global/core/workflow/template/system/interactive/type';
import { ChatSourceTypeEnum } from '@fastgpt/global/core/chat/constants';
import { LG } from '@/pageComponents/chat/lugangTheme';

const InputGuideBox = dynamic(() => import('./InputGuideBox'));
const PLACEHOLDER_APP_NAME_TOKEN = '__APP_NAME__';

type ChatInputProps = BoxProps & {
  lastInteractive?: WorkflowInteractiveResponseType;
  onSendMessage: SendPromptFnType;
  onStopChat: () => Promise<void>;
  enableInputGuide: boolean;
  enableVoiceInput: boolean;
  disableSend?: boolean;
  TextareaDom: React.MutableRefObject<HTMLTextAreaElement | null>;
  resetInputVal: (val: ChatBoxInputType) => void;
  chatForm: UseFormReturn<ChatBoxInputFormType>;
};

const ChatInput = ({
  lastInteractive,
  onSendMessage,
  onStopChat,
  enableInputGuide,
  enableVoiceInput,
  disableSend,
  TextareaDom,
  resetInputVal,
  chatForm,
  ...props
}: ChatInputProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isPc } = useSystem();
  const VoiceInputRef = useRef<VoiceInputComponentRef>(null);

  const { setValue, control } = chatForm;
  const inputValue = useWatch({
    control,
    name: 'input'
  });

  const [focusing, { on: onFocus, off: offFocus }] = useBoolean();

  // Check voice input state
  const [mobilePreSpeak, setMobilePreSpeak] = useState(false);

  const InputLeftComponent = useContextSelector(ChatBoxContext, (v) => v.InputLeftComponent);

  const outLinkAuthData = useContextSelector(WorkflowRuntimeContext, (v) => v.outLinkAuthData);
  const sourceTarget = useContextSelector(WorkflowRuntimeContext, (v) => v.sourceTarget);
  const chatId = useContextSelector(WorkflowRuntimeContext, (v) => v.chatId);
  const formFileUploading = useContextSelector(WorkflowRuntimeContext, (v) => v.fileUploading);
  const isChatting = useContextSelector(ChatBoxContext, (v) => v.isChatting);
  const inputBodyProps = useContextSelector(ChatBoxContext, (v) => v.inputBodyProps);
  const whisperConfig = useContextSelector(ChatBoxContext, (v) => v.whisperConfig);
  const chatInputGuide = useContextSelector(ChatBoxContext, (v) => v.chatInputGuide);
  const fileSelectConfig = useContextSelector(ChatBoxContext, (v) => v.fileSelectConfig);
  const dialogTips = useContextSelector(ChatBoxContext, (v) => v.dialogTips);
  const autoTTSResponse = useContextSelector(ChatBoxContext, (v) => v.autoTTSResponse);
  const chatType = useContextSelector(ChatBoxContext, (v) => v.chatType);
  const appName = useContextSelector(ChatItemContext, (v) => v.chatBoxData.app.name);
  // 鲁港通 - 首页输入框占位名兜底为品牌名（原名 FastGPT 会泄露上游品牌）
  const placeholderAppName = chatType === ChatTypeEnum.home ? '鲁港通' : appName || '鲁港通';
  const appNamePlaceholderParts = useMemo(() => {
    const placeholderText = String(
      t('common:core.chat.Type a message to app', {
        appName: PLACEHOLDER_APP_NAME_TOKEN
      })
    );
    const tokenIndex = placeholderText.indexOf(PLACEHOLDER_APP_NAME_TOKEN);

    if (tokenIndex < 0) {
      return {
        prefix: placeholderText,
        suffix: ''
      };
    }

    return {
      prefix: placeholderText.slice(0, tokenIndex),
      suffix: placeholderText.slice(tokenIndex + PLACEHOLDER_APP_NAME_TOKEN.length)
    };
  }, [t]);

  const fileCtrl = useFieldArray({
    control,
    name: 'files'
  });
  const {
    File,
    onOpenSelectFile,
    fileList,
    onSelectFile,
    uploadFiles,
    selectFileIcon,
    selectFileLabel,
    showSelectFile,
    showSelectImg,
    showSelectVideo,
    showSelectAudio,
    showSelectCustomFileExtension,
    cancelUploadFile,
    clearFiles,
    hasFileUploading
  } = useFileUpload({
    fileSelectConfig,
    fileCtrl,
    outLinkAuthData,
    sourceTarget,
    chatId
  });
  const havInput = !!inputValue || fileList.length > 0;
  const canSendMessage = havInput && !hasFileUploading && !formFileUploading && !disableSend;
  const canUploadFile =
    showSelectFile ||
    showSelectImg ||
    showSelectVideo ||
    showSelectAudio ||
    showSelectCustomFileExtension;
  const isFileTypeAllowed = useCallback(
    (file: File) => isChatFileAllowedBySelectConfig({ file, fileSelectConfig }),
    [fileSelectConfig]
  );
  const canUseInputGuide =
    enableInputGuide &&
    sourceTarget.sourceType === ChatSourceTypeEnum.app &&
    !!sourceTarget.sourceId &&
    !!chatInputGuide.open;
  const canUseVoiceInput =
    enableVoiceInput && !!sourceTarget.sourceId && !!whisperConfig?.open && !formFileUploading;
  const isDefaultInputHeight =
    !mobilePreSpeak && !inputValue && fileList.length === 0 && !canUseInputGuide;

  // Upload files
  useRequest(uploadFiles, {
    manual: false,
    errorToast: t('common:upload_file_error'),
    refreshDeps: [fileList, outLinkAuthData, chatId]
  });

  /* on send */
  const handleSend = useCallback(
    async (val: string = inputValue) => {
      if (!canSendMessage) return;

      onSendMessage({
        text: val.trim(),
        files: fileList,
        interactive: lastInteractive,
        clearInput: true
      });
      clearFiles();
    },
    [inputValue, lastInteractive, canSendMessage, fileList, onSendMessage, clearFiles]
  );
  const { runAsync: handleStop, loading: isStopping } = useRequest(async () => {
    try {
      if (isChatting) {
        await onStopChat();
      }
    } catch {
      return;
    }
  });

  const RenderTextarea = useMemo(
    () => (
      <Flex direction={'column'} mt={fileList.length > 0 ? 1 : 0} minH={'42px'}>
        {/* Textarea */}
        <Flex w={'100%'} position={'relative'}>
          {/* Prompt Container */}
          <Textarea
            ref={TextareaDom}
            py={0}
            mx={0}
            px={0}
            border={'none'}
            borderRadius={0}
            appearance={'none'}
            _focusVisible={{
              border: 'none'
            }}
            placeholder={dialogTips || ''}
            resize={'none'}
            rows={1}
            bg={'transparent'}
            height={textareaMinH}
            lineHeight={textareaMinH}
            maxHeight={[24, 32]}
            minH={textareaMinH}
            mb={0}
            maxLength={-1}
            overflowY={'hidden'}
            overflowX={'hidden'}
            whiteSpace={'pre-wrap'}
            wordBreak={'break-word'}
            boxShadow={'none !important'}
            color={LG.ink}
            fontWeight={400}
            fontSize={'16px'}
            letterSpacing={'0.5px'}
            w={'100%'}
            _placeholder={{
              color: LG.mutedSoft,
              fontSize: 'inherit',
              lineHeight: 'inherit',
              letterSpacing: 'inherit'
            }}
            value={inputValue}
            onChange={(e) => {
              const textarea = e.target;
              textarea.style.height = textareaMinH;
              const maxHeight = 128;
              const newHeight = Math.min(textarea.scrollHeight, maxHeight);
              textarea.style.height = `${newHeight}px`;

              // Only show scrollbar when content exceeds max height
              if (textarea.scrollHeight > maxHeight) {
                textarea.style.overflowY = 'auto';
              } else {
                textarea.style.overflowY = 'hidden';
              }

              setValue('input', textarea.value, {
                shouldDirty: true,
                shouldTouch: true
              });
            }}
            onKeyDown={(e) => {
              // enter send.(pc or iframe && enter and unPress shift)
              const isEnter = e.key === 'Enter';
              const textarea = e.currentTarget;
              if (isEnter && (e.ctrlKey || e.altKey)) {
                // Add a new line
                const index = textarea.selectionStart;
                const val = textarea.value;
                textarea.value = `${val.slice(0, index)}\n${val.slice(index)}`;
                textarea.selectionStart = index + 1;
                textarea.selectionEnd = index + 1;

                textarea.style.height = textareaMinH;
                textarea.style.height = `${textarea.scrollHeight}px`;

                return;
              }

              // Select all content
              if (e.key === 'a' && e.ctrlKey) {
                textarea.select();
              }

              if ((isPc || window !== parent) && e.keyCode === 13 && !e.shiftKey) {
                handleSend(textarea.value);
                e.preventDefault();
              }
            }}
            onPaste={(e) => {
              const clipboardData = e.clipboardData;
              if (clipboardData && canUploadFile) {
                const items = clipboardData.items;
                const files = Array.from(items)
                  .map((item) => (item.kind === 'file' ? item.getAsFile() : undefined))
                  .filter((file) => {
                    return file && isFileTypeAllowed(file);
                  }) as File[];
                onSelectFile({ files });

                if (files.length > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }
            }}
            onFocus={onFocus}
            onBlur={offFocus}
          />
          {!dialogTips && !inputValue && (
            <Flex
              pointerEvents={'none'}
              position={'absolute'}
              left={0}
              right={0}
              top={0}
              h={textareaMinH}
              alignItems={'center'}
              color={LG.mutedSoft}
              fontSize={'16px'}
              lineHeight={textareaMinH}
              letterSpacing={'0.5px'}
              minW={0}
              overflow={'hidden'}
              whiteSpace={'nowrap'}
            >
              <Box flexShrink={0}>{appNamePlaceholderParts.prefix}</Box>
              <Box
                flex={'0 1 auto'}
                minW={0}
                maxW={'100%'}
                overflow={'hidden'}
                textOverflow={'ellipsis'}
                whiteSpace={'nowrap'}
              >
                {placeholderAppName}
              </Box>
              <Box flexShrink={0}>{appNamePlaceholderParts.suffix}</Box>
            </Flex>
          )}
        </Flex>
      </Flex>
    ),
    [
      fileList.length,
      TextareaDom,
      dialogTips,
      appNamePlaceholderParts.prefix,
      appNamePlaceholderParts.suffix,
      placeholderAppName,
      isPc,
      inputValue,
      onFocus,
      offFocus,
      setValue,
      handleSend,
      canUploadFile,
      isFileTypeAllowed,
      onSelectFile
    ]
  );

  const RenderButtonGroup = useMemo(() => {
    const iconSize = {
      w: '18px',
      h: '18px'
    };

    return (
      <Flex
        alignItems={'center'}
        justifyContent={'space-between'}
        w={'100%'}
        mt={0}
        h={'34px'}
        gap={[0, 1]}
      >
        {/* 左侧自定义按钮组 */}
        <Flex alignItems={'center'} gap={2} flex={'1 1 0'} minW={0} w={0}>
          {InputLeftComponent}
          {/* 鲁港通 - 积分余额标签 */}
          <PointsBalanceTag />
        </Flex>

        {/* 右侧原有按钮组 */}
        <Flex alignItems={'center'} gap={[0, 1]}>
          {/* Attachment and Voice Group */}
          <Flex alignItems={'center'} h={'28px'}>
            {/* 鲁港通 - 办事浏览器入口 */}
            <BuiltinBrowserEntryButton />

            {/* file selector button */}
            {canUploadFile && (
              <Flex
                alignItems={'center'}
                justifyContent={'center'}
                w={'28px'}
                h={'28px'}
                borderRadius={'8px'}
                cursor={'pointer'}
                color={LG.muted}
                _hover={{ bg: LG.pale }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSelectFile();
                }}
              >
                <MyTooltip label={selectFileLabel}>
                  <MyIcon name={selectFileIcon as any} {...iconSize} color={'currentColor'} />
                </MyTooltip>
                <File onSelect={(files) => onSelectFile({ files })} />
              </Flex>
            )}

            {/* Voice input button */}
            {canUseVoiceInput && !inputValue && (
              <Flex
                alignItems={'center'}
                justifyContent={'center'}
                w={'28px'}
                h={'28px'}
                borderRadius={'8px'}
                cursor={'pointer'}
                color={LG.muted}
                _hover={{ bg: LG.pale }}
                onClick={(e) => {
                  e.stopPropagation();
                  VoiceInputRef.current?.onSpeak?.();
                }}
              >
                <MyTooltip label={t('common:core.chat.Record')}>
                  <MyIcon name={'core/chat/recordFill'} {...iconSize} color={'currentColor'} />
                </MyTooltip>
              </Flex>
            )}
          </Flex>

          {/* Divider Container */}
          {((canUseVoiceInput && !inputValue) || canUploadFile) && (
            <Flex alignItems={'center'} justifyContent={'center'} h={'16px'} mx={1.5}>
              <Box w={'1px'} h={'100%'} bg={LG.line} />
            </Flex>
          )}

          {/* Send Button Container */}
          <Flex alignItems={'center'} w={'34px'} h={'34px'} borderRadius={'full'}>
            <MyBox
              isLoading={isStopping}
              display={'flex'}
              alignItems={'center'}
              justifyContent={'center'}
              w={'34px'}
              h={'34px'}
              bg={isChatting ? LG.pale : canSendMessage ? LG.send : '#E5EBF2'}
              borderRadius={'full'}
              cursor={isChatting ? 'pointer' : canSendMessage ? 'pointer' : 'not-allowed'}
              boxShadow={canSendMessage && !isChatting ? '0 8px 18px rgba(78,128,178,0.3)' : 'none'}
              _hover={
                canSendMessage && !isChatting
                  ? { bg: 'linear-gradient(140deg, #7FA8D3, #4A7CAE)' }
                  : undefined
              }
              onClick={(e) => {
                e.stopPropagation();
                if (isChatting) {
                  void handleStop();
                  return;
                }
                return void handleSend(inputValue);
              }}
            >
              {isChatting ? (
                <MyIcon {...iconSize} name={'stop'} color={LG.mountain} />
              ) : (
                <MyTooltip label={t('common:core.chat.Send Message')}>
                  <MyIcon
                    name={'core/chat/sendFill'}
                    {...iconSize}
                    color={canSendMessage ? 'white' : LG.mutedSoft}
                  />
                </MyTooltip>
              )}
            </MyBox>
          </Flex>
        </Flex>
      </Flex>
    );
  }, [
    InputLeftComponent,
    canUploadFile,
    selectFileLabel,
    selectFileIcon,
    File,
    canUseVoiceInput,
    inputValue,
    t,
    isStopping,
    isChatting,
    canSendMessage,
    onOpenSelectFile,
    onSelectFile,
    handleSend,
    handleStop
  ]);

  const composerBaseStyle: FlexProps = {
    border: '1px solid',
    borderColor: LG.line,
    boxShadow: '0 18px 40px rgba(78,128,178,0.11)',
    transition: 'border-color 0.16s ease, box-shadow 0.16s ease'
  };

  return (
    <Box
      w={'100%'}
      maxW={inputBodyProps?.maxW ?? ['100%', '780px']}
      mx={inputBodyProps?.mx ?? inputBodyProps?.margin ?? 'auto'}
      pb={inputBodyProps?.pb ?? ['calc(16px + env(safe-area-inset-bottom))', 4]}
      {...props}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();

        if (!canUploadFile) return;
        const files = Array.from(e.dataTransfer.files);

        const droppedFiles: File[] = [];
        const invalidFiles: File[] = [];
        files.forEach((file) => {
          if (isFileTypeAllowed(file)) {
            droppedFiles.push(file);
          } else {
            invalidFiles.push(file);
          }
        });
        if (droppedFiles.length > 0) {
          onSelectFile({ files: droppedFiles });
        }

        const invalidFileName = invalidFiles.map((file) => file.name).join(', ');
        if (invalidFileName) {
          toast({
            status: 'warning',
            title: t('chat:unsupported_file_type'),
            description: invalidFileName
          });
        }
      }}
    >
      {/* 鲁港通 - 低余额购买提示条 */}
      <PointsBalanceNotice />

      {/* Real Chat Input */}
      <Flex
        direction={'column'}
        h={isDefaultInputHeight ? ChatInputDefaultHeight : undefined}
        minH={mobilePreSpeak ? '48px' : ChatInputDefaultHeight}
        p={mobilePreSpeak ? [0, 4] : 4}
        mb={0}
        position={'relative'}
        borderRadius={'20px'}
        bg={'white'}
        overflow={mobilePreSpeak ? 'hidden' : 'display'}
        {...composerBaseStyle}
        {...(focusing
          ? {
              borderColor: LG.lineStrong,
              boxShadow:
                '0 18px 44px rgba(78,128,178,0.14), 0 0 0 3px rgba(111,157,208,0.12)'
            }
          : {
              _hover: { borderColor: 'rgba(111,157,208,0.34)' }
            })}
        onClick={() => TextareaDom?.current?.focus()}
      >
        <Box flex={1}>
          {/* Chat input guide box */}
          {canUseInputGuide && (
            <InputGuideBox
              sourceTarget={sourceTarget}
              text={inputValue}
              onSelect={(e) => {
                setValue('input', e, {
                  shouldDirty: true,
                  shouldTouch: true
                });
              }}
              onSend={(e) => {
                handleSend(e);
              }}
            />
          )}
          {/* file preview */}
          {(!mobilePreSpeak || isPc || inputValue) && (
            <Box>
              <FilePreview
                fileList={fileList}
                onRemoveFile={(file) => cancelUploadFile(getFileUploadId(file))}
                pt={0}
              />
            </Box>
          )}

          {/* voice input and loading container */}
          {canUseVoiceInput && !inputValue && (
            <VoiceInput
              ref={VoiceInputRef}
              handleSend={(text) => {
                onSendMessage({
                  text: text.trim(),
                  files: fileList,
                  autoTTSResponse,
                  clearInput: true
                });
                clearFiles();
              }}
              resetInputVal={(val) => {
                setMobilePreSpeak(false);
                resetInputVal({
                  text: val,
                  files: fileList
                });
              }}
              mobilePreSpeak={mobilePreSpeak}
              setMobilePreSpeak={setMobilePreSpeak}
            />
          )}

          {RenderTextarea}
        </Box>

        {!mobilePreSpeak && <Box>{RenderButtonGroup}</Box>}
      </Flex>
      <ComplianceTip type={'chat'} pt={4} pb={0} />
    </Box>
  );
};

export default React.memo(ChatInput);
