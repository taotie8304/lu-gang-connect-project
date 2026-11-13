// 鲁港通 - 本次操作时间线：底部折叠条，只展示动作与目标摘要，绝不展示输入内容
import { useEffect, useRef } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { IconNameType } from '@fastgpt/web/components/common/Icon/type';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { LG } from '@/pageComponents/chat/lugangTheme';
import type { DesktopAiStep } from './desktopBridge';
import { aiStepLabel, aiStepStatusLabel } from './aiStatus';

const STEP_ICONS: Record<string, IconNameType> = {
  navigate: 'common/globalLine',
  read: 'common/detail',
  read_image: 'common/detail',
  click: 'common/select',
  type: 'common/edit',
  select: 'common/downArrowFill',
  scroll: 'common/downArrowFill',
  upload: 'common/uploadFileFill',
  generate_file: 'file/fill/file',
  open_form: 'common/edit-filled',
  fill_form: 'common/edit-filled',
  open_document: 'file/fill/file',
  edit_document: 'file/fill/file',
  fill_pdf: 'file/fill/pdf',
  stop: 'common/lineStop',
  pause: 'common/lineUser',
  resume: 'common/arrowRight'
};

const STEP_STATUS_ICONS: Record<DesktopAiStep['status'], IconNameType> = {
  running: 'common/running',
  ok: 'common/check',
  failed: 'common/error',
  confirming: 'common/ellipsis',
  paused: 'common/lineStop'
};

const STEP_STATUS_COLORS: Record<DesktopAiStep['status'], string> = {
  running: LG.lake,
  ok: '#3E9C74',
  failed: '#CC5B4E',
  confirming: '#C08A2E',
  paused: '#C08A2E'
};

const formatStepTime = (at: number) => {
  try {
    return new Date(at).toLocaleTimeString('zh-CN', { hour12: false });
  } catch {
    return '';
  }
};

const EMPTY_STEPS: DesktopAiStep[] = [];

const AiTimeline = ({
  steps = EMPTY_STEPS,
  open,
  onToggle
}: {
  steps?: DesktopAiStep[];
  open: boolean;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const pendingConfirm = steps.some((step) => step.status === 'confirming');

  // 鲁港通 - 展开后持续跟随最新一步；收起时不打扰，展开瞬间落到最新
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, steps.length]);

  if (steps.length === 0) return null;

  return (
    <Flex flexDirection={'column'} alignItems={'flex-end'} mb={2}>
      {open && (
        <Box
          ref={listRef}
          w={'100%'}
          maxH={'200px'}
          overflowY={'auto'}
          mb={1}
          px={2}
          py={1.5}
          bg={LG.paper}
          border={`1px solid ${LG.lineSoft}`}
          borderRadius={'10px'}
          boxShadow={'0 6px 18px rgba(31,49,66,0.08)'}
        >
          {steps.map((step) => (
            <Flex
              key={step.id}
              role={'listitem'}
              alignItems={'center'}
              gap={1.5}
              minH={'26px'}
              fontSize={'13px'}
              lineHeight={'17px'}
              color={LG.text}
            >
              <Text
                flexShrink={0}
                w={'54px'}
                color={LG.mutedSoft}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatStepTime(step.at)}
              </Text>
              <MyIcon
                name={STEP_ICONS[step.action] ?? 'common/ellipsis'}
                w={'12px'}
                h={'12px'}
                flexShrink={0}
                color={LG.muted}
              />
              <Text flexShrink={0}>{t(aiStepLabel(step.action) as any)}</Text>
              {step.target && (
                <Text
                  flex={1}
                  minW={0}
                  isTruncated
                  color={LG.mutedSoft}
                  title={step.target}
                >
                  {step.target}
                </Text>
              )}
              <MyTooltip label={t(aiStepStatusLabel(step.status) as any)}>
                <Flex flexShrink={0} alignItems={'center'}>
                  <MyIcon
                    name={STEP_STATUS_ICONS[step.status]}
                    w={'12px'}
                    h={'12px'}
                    color={STEP_STATUS_COLORS[step.status]}
                  />
                </Flex>
              </MyTooltip>
            </Flex>
          ))}
        </Box>
      )}
      <Flex
        as={'button'}
        type={'button'}
        alignItems={'center'}
        gap={1}
        h={'28px'}
        px={2.5}
        borderRadius={'8px'}
        border={`1px solid ${pendingConfirm ? 'rgba(192,138,46,0.45)' : LG.lineSoft}`}
        bg={pendingConfirm ? 'rgba(192,138,46,0.1)' : LG.paper}
        color={pendingConfirm ? '#A06A12' : LG.muted}
        fontSize={'13px'}
        cursor={'pointer'}
        _hover={{ bg: pendingConfirm ? 'rgba(192,138,46,0.16)' : LG.paleSoft }}
        onClick={onToggle}
        title={t('common:builtin_browser_ai_timeline_title', { count: steps.length }) as any}
      >
        <Text>{t('common:builtin_browser_ai_timeline_title', { count: steps.length })}</Text>
        <MyIcon
          name={'common/downArrowFill'}
          w={'11px'}
          h={'11px'}
          transform={open ? 'rotate(180deg)' : undefined}
          transition={'transform 0.15s'}
        />
      </Flex>
    </Flex>
  );
};

export default AiTimeline;
