import Markdown from '@/components/Markdown';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Flex,
  HStack
} from '@chakra-ui/react';
import { ChatItemValueTypeEnum } from '@fastgpt/global/core/chat/constants';
import type {
  AIChatItemValueItemType,
  ToolModuleResponseItemType,
  UserChatItemValueItemType
} from '@fastgpt/global/core/chat/type';
import React, { useCallback, useMemo } from 'react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import Avatar from '@fastgpt/web/components/common/Avatar';
import { useUserStore } from '@/web/support/user/useUserStore';
import type {
  InteractiveBasicType,
  PaymentPauseInteractive,
  UserInputInteractive,
  UserSelectInteractive
} from '@fastgpt/global/core/workflow/template/system/interactive/type';
import { isEqual } from 'lodash';
import { useTranslation } from 'next-i18next';
import { eventBus, EventNameEnum } from '@/web/common/utils/eventbus';
import { SelectOptionsComponent, FormInputComponent } from './Interactive/InteractiveComponents';
import { extractDeepestInteractive } from '@fastgpt/global/core/workflow/runtime/utils';
import { useContextSelector } from 'use-context-selector';
import { type OnOpenCiteModalProps } from '@/web/core/chat/context/chatItemContext';
import { WorkflowRuntimeContext } from '../ChatContainer/context/workflowRuntimeContext';
import { useCreation } from 'ahooks';

const accordionButtonStyle = {
  w: 'auto',
  bg: 'white',
  borderRadius: 'md',
  borderWidth: '1px',
  borderColor: 'myGray.200',
  boxShadow: '1',
  pl: 3,
  pr: 2.5,
  _hover: {
    bg: 'auto'
  }
};

/**
 * 鲁港通 - 过滤 reasoning 内容中的敏感信息
 * 普通用户可以看到思考过程，但不应看到系统提示词、角色设定、工作流指令等
 */
const sensitivePatterns = [
  // 中文关键词
  /知识库/,
  /数据库/,
  /检索/,
  /系统指令/,
  /系统提示/,
  /角色设定/,
  /工作流/,
  /不暴露\s*AI\s*身份/,
  /不暴露.*知识库来源/,
  /不编造不确定/,
  /核心结论\s*\+\s*分步实操\s*\+\s*关键提示/,
  /三段式结构/,
  /不提及.*知识库/,
  /保持专业.*客观.*自信/,
  /以专家口吻/,
  /遵守约束条件/,
  /根据我的角色设定/,
  /根据知识库中的信息/,
  /我需要整合这些信息/,
  /我的角色/,
  /约束条件/,
  /指令要求/,
  /参考资料/,
  /引用来源/,
  /数据来源/,
  /背景知识/,
  /提供的信息/,
  /根据.*提供/,
  /根据.*内容/,
  /引用模板/,
  /输出格式/,
  /禁止显示/,
  /禁止提及/,
  /禁止暴露/,
  // 鲁港通 - 知识库 hex ID 泄露（模型在思考中引用知识库条目 ID）
  /[a-f0-9]{24}/i,
  // 鲁港通 - 模型讨论引用匹配/关联性的表达
  /这些引用/,
  /这些.*引用.*内容/,
  /引用.*关联不大/,
  /引用.*关系不大/,
  /无法找到.*引用/,
  /没有.*合适.*引用/,
  /尽量使用.*引用/,
  /现有.*引用/,
  /我需要尽量/,
  /我会尽量/,
  /无法引用/,
  /可能无法/,
  /基于专业知识/,
  /these\s*references/i,
  /these\s*citations/i,
  /not\s*directly\s*relevant/i,
  /not\s*closely\s*related/i,
  /no\s*suitable\s*reference/i,
  /try\s*to\s*use.*references/i,
  /existing\s*references/i,
  // 英文关键词 - 模型复述系统提示词时常用的表达
  /system\s*prompt/i,
  /system\s*instruction/i,
  /role\s*setting/i,
  /knowledge\s*base/i,
  /\bKB\b/,
  /do\s*not\s*mention/i,
  /do\s*not\s*reveal/i,
  /do\s*not\s*show/i,
  /must\s*not\s*reveal/i,
  /no\s*AI\s*identity/i,
  /AI\s*identity\s*disclosure/i,
  /no\s*mention\s*of\s*data\s*source/i,
  /as\s*per\s*the\s*system\s*instruction/i,
  /follow\s*the\s*output\s*format/i,
  /avoid\s*forbidden\s*words/i,
  /forbidden\s*words/i,
  /\bRemember:?\s*Do\s*not/i,
  /\bConstraints?\s*Check/i,
  /\bConstraints?:/i,
  /\bRole:/i,
  /professional\s*tone/i,
  /Core\s*Conclusion\s*\+/i,
  /Step-by-Step\s*Practi/i,
  /Key\s*Tips?\b/i,
  /not\s*"?listed\s*to\s*open"?/i,
  /data\s*sources/i,
  // 鲁港通 - 模型分析知识库时常用的表达
  /Analyze\s*the\s*Knowledge/i,
  /Review\s*Knowledge/i,
  /Refining\s*based\s*on\s*KB/i,
  /Evaluate\s*Knowledge/i,
  /KB\s*Content/i,
  /KB\s*Constraints/i,
  /KB\s*Info/i,
  /KB\s*says/i,
  /KB\s*mentions/i,
  /KB\s*has\s*info/i,
  /Drafting\s*Content/i,
  /Adhering\s*to\s*Constraints/i,
  /Constraint\s*Check/i,
  /align\s*with\s*the\s*KB/i,
  /align\s*with\s*KB/i,
  /provided\s*as\s*"?my\s*knowledge/i,
  /provided\s*as\s*"?your\s*knowledge/i,
  /my\s*knowledge\s*base/i,
  /the\s*knowledge\s*base/i,
  /from\s*the\s*KB/i,
  /in\s*the\s*KB/i,
  /Contains\s*specific\s*info\s*on/i,
  /I\s*need\s*to\s*align/i,
  /system\s*date/i,
  /current\s*date.*provided/i,
  // 鲁港通 - 引用模板和 Cites 标签泄露
  /<\/?Cites>/i,
  /\[citation:/i,
  /\bcite\s*HKMA/i,
  /\bcite\s*SFC/i,
  /\bcite\s*IA\b/i,
  /regulatory\s*doc\s*numbers/i,
  /依据\s*SFC/i,
  /号文件/,
  // 鲁港通 - 模型自我约束检查的表达
  /Checking\s*constraints/i,
  /Verifying\s*constraints/i,
  /Output\s*Format\s*Check/i,
  /Format\s*Check/i,
  /Compliance\s*Check/i,
  /Self[\s-]*Check/i,
  /Let\s*me\s*check\s*the\s*constraints/i,
  /Let\s*me\s*verify/i,
  /Let\s*me\s*review\s*the/i,
  /I\s*need\s*to\s*follow/i,
  /I\s*must\s*follow/i,
  /I\s*should\s*follow/i,
  /I\s*need\s*to\s*check/i,
  /I\s*must\s*not\s*mention/i,
  /I\s*should\s*not\s*mention/i,
  /I\s*must\s*not\s*reveal/i,
  /I\s*should\s*not\s*reveal/i,
  /I\s*must\s*not\s*show/i,
  /I\s*need\s*to\s*ensure/i,
  /I\s*need\s*to\s*make\s*sure/i,
  /I\s*need\s*to\s*integrate/i,
  /I\s*need\s*to\s*combine/i,
  /I\s*need\s*to\s*synthesize/i,
  /I\s*need\s*to\s*use\s*the\s*KB/i,
  /I\s*need\s*to\s*reference/i,
  /I\s*need\s*to\s*cite/i,
  /I\s*should\s*cite/i,
  /I\s*must\s*cite/i,
  /I\s*should\s*include/i,
  /I\s*must\s*include/i,
  /I\s*should\s*use/i,
  /I\s*must\s*use/i,
  // 鲁港通 - 模型分析系统提示词结构的表达
  /system\s*message/i,
  /system\s*role/i,
  /system\s*context/i,
  /the\s*prompt\s*says/i,
  /the\s*prompt\s*mentions/i,
  /the\s*prompt\s*requires/i,
  /the\s*instruction\s*says/i,
  /the\s*instruction\s*requires/i,
  /according\s*to\s*the\s*prompt/i,
  /according\s*to\s*the\s*instruction/i,
  /according\s*to\s*my\s*instructions/i,
  /as\s*instructed/i,
  /as\s*per\s*instructions/i,
  /as\s*per\s*the\s*prompt/i,
  /as\s*per\s*my\s*role/i,
  /per\s*the\s*system/i,
  /per\s*the\s*KB/i,
  /per\s*the\s*knowledge/i,
  // 鲁港通 - 模型引用知识库日期/来源的内部分析
  /Published\s*\d{4}-\d{2}-\d{2}/i,
  /KB\s*date/i,
  /KB\s*source/i,
  /KB\s*reference/i,
  /KB\s*data/i,
  /KB\s*entry/i,
  /KB\s*article/i,
  /KB\s*document/i,
  /KB\s*text/i,
  /KB\s*passage/i,
  /KB\s*section/i,
  /KB\s*chunk/i,
  /KB\s*snippet/i,
  /KB\s*excerpt/i,
  /KB\s*material/i,
  /KB\s*record/i,
  // 鲁港通 - 模型讨论目标用户/HNWI的内部分析
  /Target\s*HNWI/i,
  /target\s*audience/i,
  /target\s*user/i,
  /high[\s-]*net[\s-]*worth/i
];

function filterReasoningContent(content: string): string {
  // 鲁港通 - 按换行分段，过滤包含敏感关键词的行/段落
  // 保留正常的推理分析内容，只移除暴露系统提示词/知识库机制/约束条件的行
  const lines = content.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // 保留空行
    return !sensitivePatterns.some((pattern) => pattern.test(trimmed));
  });

  // 鲁港通 - 清理连续多个空行为最多一个
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const RenderResoningContent = React.memo(function RenderResoningContent({
  content,
  isChatting,
  isLastResponseValue
}: {
  content: string;
  isChatting: boolean;
  isLastResponseValue: boolean;
}) {
  const { t } = useTranslation();
  const showAnimation = isChatting && isLastResponseValue;

  // 鲁港通 - 智能截断：流式输出时完整显示思考过程，完成后默认只显示前 500 字
  // 避免模型在深度思考中输出的"草拟答案"污染用户视野（草拟答案通常长且含结构化 Markdown）
  const MAX_PREVIEW_CHARS = 500;
  const [isExpanded, setIsExpanded] = React.useState(false);
  const needsTruncation = !showAnimation && content.length > MAX_PREVIEW_CHARS;
  const previewContent = needsTruncation && !isExpanded
    ? content.slice(0, MAX_PREVIEW_CHARS) + '…'
    : content;

  // 鲁港通 - 智能截断完成后显示内容（父组件已确保仅 root 用户可见此组件）
  const displayContent = previewContent;

  // 鲁港通 - 移动端响应式优化 (Requirements 6.2, 6.3)
  // 检测是否为小屏幕设备（宽度 < 768px）
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // 初始检测
    checkMobile();
    
    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 鲁港通 - 小屏幕设备上默认折叠思考模式，优先显示最终答案 (Requirements 6.3)
  const defaultIndex = isLastResponseValue && !isMobile ? 0 : undefined;

  return (
    <Accordion allowToggle defaultIndex={defaultIndex}>
      <AccordionItem borderTop={'none'} borderBottom={'none'}>
        <AccordionButton {...accordionButtonStyle} py={1}>
          <HStack mr={2} spacing={1}>
            <MyIcon name={'core/chat/think'} w={'0.85rem'} />
            {/* 鲁港通 - 移动端字体大小确保可读性（至少 14px）(Requirements 6.4) */}
            <Box fontSize={{ base: '14px', md: 'sm' }}>{t('chat:ai_reasoning')}</Box>
          </HStack>

          {showAnimation && <MyIcon name={'common/loading'} w={'0.85rem'} />}
          <AccordionIcon color={'myGray.600'} ml={5} />
        </AccordionButton>
        {/* 鲁港通 - 思考模式背景色修复：添加灰色背景 #F7F8FA，确保样式不污染最终答案 */}
        <AccordionPanel
          py={2}
          pr={3}
          pl={3}
          mt={2}
          mb={3}
          bg={'#F7F8FA'}
          borderRadius={'md'}
          borderLeft={'2px solid'}
          borderColor={'myGray.300'}
          color={'myGray.500'}
          // 鲁港通 - 移动端字体大小确保可读性（至少 14px）(Requirements 6.4)
          fontSize={{ base: '14px', md: 'sm' }}
        >
          <Markdown source={displayContent} showAnimation={showAnimation} />
          {/* 鲁港通 - 思考完成后显示展开/收起按钮，让用户可按需查看完整思考过程 */}
          {needsTruncation && !showAnimation && (
            <Button
              variant={'link'}
              size={'sm'}
              color={'blue.500'}
              mt={2}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? '收起完整思考过程' : '展开完整思考过程'}
            </Button>
          )}
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
});
/**
 * 鲁港通 - 移除回答文本中的 [id](CITE) 引用标记
 * 这些标记会在鼠标悬停时弹出知识库原文内容，暴露内部数据
 * 仅对非 root 用户生效，root 用户保留用于调试
 */
function stripCiteMarks(text: string): string {
  // 匹配 [hexId](CITE) 格式，如 [6a7b8c](CITE)
  return text.replace(/\[[\w]+\]\(CITE\)/g, '');
}

const RenderText = React.memo(function RenderText({
  showAnimation,
  text,
  chatItemDataId,
  onOpenCiteModal
}: {
  showAnimation: boolean;
  text: string;
  chatItemDataId: string;
  onOpenCiteModal?: (e?: OnOpenCiteModalProps) => void;
}) {
  const appId = useContextSelector(WorkflowRuntimeContext, (v) => v.appId);
  const chatId = useContextSelector(WorkflowRuntimeContext, (v) => v.chatId);
  const outLinkAuthData = useContextSelector(WorkflowRuntimeContext, (v) => v.outLinkAuthData);
  const { userInfo } = useUserStore();
  const isRoot = userInfo?.username === 'root';

  const source = useMemo(() => {
    if (!text) return '';

    // 鲁港通 - 非 root 用户移除 [id](CITE) 标记，防止悬停弹窗暴露知识库内容
    return isRoot ? text : stripCiteMarks(text);
  }, [text, isRoot]);

  const chatAuthData = useCreation(() => {
    return { appId, chatId, chatItemDataId, ...outLinkAuthData };
  }, [appId, chatId, chatItemDataId, outLinkAuthData]);

  return (
    <Markdown
      source={source}
      showAnimation={showAnimation}
      chatAuthData={chatAuthData}
      onOpenCiteModal={onOpenCiteModal}
    />
  );
});

const RenderTool = React.memo(
  function RenderTool({
    showAnimation,
    tools
  }: {
    showAnimation: boolean;
    tools: ToolModuleResponseItemType[];
  }) {
    return (
      <Box>
        {tools.map((tool) => {
          const formatJson = (string: string) => {
            try {
              return JSON.stringify(JSON.parse(string), null, 2);
            } catch (error) {
              return string;
            }
          };
          const toolParams = formatJson(tool.params);
          const toolResponse = formatJson(tool.response);

          return (
            <Accordion key={tool.id} allowToggle _notLast={{ mb: 2 }}>
              <AccordionItem borderTop={'none'} borderBottom={'none'}>
                <AccordionButton {...accordionButtonStyle}>
                  <Avatar src={tool.toolAvatar} w={'1.25rem'} h={'1.25rem'} borderRadius={'sm'} />
                  <Box mx={2} fontSize={'sm'} color={'myGray.900'}>
                    {tool.toolName}
                  </Box>
                  {showAnimation && !tool.response && <MyIcon name={'common/loading'} w={'14px'} />}
                  <AccordionIcon color={'myGray.600'} ml={5} />
                </AccordionButton>
                <AccordionPanel
                  py={0}
                  px={0}
                  mt={3}
                  borderRadius={'md'}
                  overflow={'hidden'}
                  maxH={'500px'}
                  overflowY={'auto'}
                >
                  {toolParams && toolParams !== '{}' && (
                    <Box mb={3}>
                      <Markdown
                        source={`~~~json#Input
${toolParams}`}
                      />
                    </Box>
                  )}
                  {toolResponse && (
                    <Markdown
                      source={`~~~json#Response
${toolResponse}`}
                    />
                  )}
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          );
        })}
      </Box>
    );
  },
  (prevProps, nextProps) => isEqual(prevProps, nextProps)
);

const onSendPrompt = (e: { text: string; isInteractivePrompt: boolean }) =>
  eventBus.emit(EventNameEnum.sendQuestion, e);
const RenderUserSelectInteractive = React.memo(function RenderInteractive({
  interactive
}: {
  interactive: InteractiveBasicType & UserSelectInteractive;
}) {
  return (
    <SelectOptionsComponent
      interactiveParams={interactive.params}
      onSelect={(value) => {
        onSendPrompt({
          text: value,
          isInteractivePrompt: true
        });
      }}
    />
  );
});
const RenderUserFormInteractive = React.memo(function RenderFormInput({
  interactive,
  chatItemDataId
}: {
  interactive: InteractiveBasicType & UserInputInteractive;
  chatItemDataId: string;
}) {
  const { t } = useTranslation();

  const defaultValues = useMemo(() => {
    if (interactive.type === 'userInput') {
      return interactive.params.inputForm?.reduce((acc: Record<string, any>, item, index) => {
        // 使用 ?? 运算符，只有 undefined 或 null 时才使用 defaultValue
        acc[item.key] = item.value ?? item.defaultValue;
        return acc;
      }, {});
    }
    return {};
  }, [interactive]);

  const handleFormSubmit = useCallback(
    (data: Record<string, any>) => {
      const finalData: Record<string, any> = {};
      interactive.params.inputForm?.forEach((item, index) => {
        if (item.key in data) {
          finalData[item.key] = data[item.key];
        }
      });

      if (typeof window !== 'undefined') {
        const dataToSave = { ...data };
        interactive.params.inputForm?.forEach((item) => {
          if (
            item.type === 'fileSelect' &&
            Array.isArray(dataToSave[item.key]) &&
            dataToSave[item.key].length > 0
          ) {
            const files = dataToSave[item.key];
            if (files[0]?.url !== undefined) {
              dataToSave[item.key] = files
                .map((file: any) => ({
                  url: file.url,
                  key: file.key,
                  name: file.name,
                  type: file.type
                }))
                .filter((file: any) => file.url);
            }
          }
        });
        sessionStorage.setItem(`interactiveForm_${chatItemDataId}`, JSON.stringify(dataToSave));
      }

      onSendPrompt({
        text: JSON.stringify(finalData),
        isInteractivePrompt: true
      });
    },
    [interactive.params.inputForm, chatItemDataId]
  );

  return (
    <Flex flexDirection={'column'} gap={2} minW={'250px'}>
      <FormInputComponent
        interactiveParams={interactive.params}
        defaultValues={defaultValues}
        chatItemDataId={chatItemDataId}
        SubmitButton={({ onSubmit, isFileUploading }) => (
          <Button
            onClick={() => onSubmit(handleFormSubmit)()}
            isDisabled={isFileUploading}
            isLoading={isFileUploading}
          >
            {t('common:Submit')}
          </Button>
        )}
      />
    </Flex>
  );
});
const RenderPaymentPauseInteractive = React.memo(function RenderPaymentPauseInteractive({
  interactive
}: {
  interactive: InteractiveBasicType & PaymentPauseInteractive;
}) {
  const { t } = useTranslation();

  return interactive.params.continue ? (
    <Box>{t('chat:task_has_continued')}</Box>
  ) : (
    <>
      <Box color={'myGray.500'}>{t(interactive.params.description)}</Box>
      <Button
        maxW={'250px'}
        onClick={() => {
          onSendPrompt({
            text: 'Continue',
            isInteractivePrompt: true
          });
        }}
      >
        {t('chat:continue_run')}
      </Button>
    </>
  );
});

const AIResponseBox = ({
  chatItemDataId,
  value,
  isLastResponseValue,
  isChatting,
  onOpenCiteModal
}: {
  chatItemDataId: string;
  value: UserChatItemValueItemType | AIChatItemValueItemType;
  isLastResponseValue: boolean;
  isChatting: boolean;
  onOpenCiteModal?: (e?: OnOpenCiteModalProps) => void;
}) => {
  // 鲁港通 - 普通用户不显示深度思考过程 UI（模型仍使用深度思考生成答案）
  const userInfo = useUserStore((s) => s.userInfo);
  const isRoot = userInfo?.username === 'root';

  if (value.type === ChatItemValueTypeEnum.text && value.text) {
    return (
      <RenderText
        chatItemDataId={chatItemDataId}
        showAnimation={isChatting && isLastResponseValue}
        text={value.text.content}
        onOpenCiteModal={onOpenCiteModal}
      />
    );
  }
  if (value.type === ChatItemValueTypeEnum.reasoning && value.reasoning) {
    if (!isRoot) return null;
    return (
      <RenderResoningContent
        isChatting={isChatting}
        isLastResponseValue={isLastResponseValue}
        content={value.reasoning.content}
      />
    );
  }
  if (value.type === ChatItemValueTypeEnum.tool && value.tools) {
    return <RenderTool showAnimation={isChatting} tools={value.tools} />;
  }
  if (value.type === ChatItemValueTypeEnum.interactive && value.interactive) {
    const finalInteractive = extractDeepestInteractive(value.interactive);
    if (finalInteractive.type === 'userSelect') {
      return <RenderUserSelectInteractive interactive={finalInteractive} />;
    }
    if (finalInteractive.type === 'userInput') {
      return (
        <RenderUserFormInteractive interactive={finalInteractive} chatItemDataId={chatItemDataId} />
      );
    }
    if (finalInteractive.type === 'paymentPause') {
      return <RenderPaymentPauseInteractive interactive={finalInteractive} />;
    }
  }
  return null;
};
export default React.memo(AIResponseBox);
