// 鲁港通 - 智能体记忆自动提取：频控、敏感过滤、去重落库，全链路静默失败
import { ChatCompletionRequestMessageRoleEnum } from '@fastgpt/global/core/ai/constants';
import { ChatRoleEnum } from '@fastgpt/global/core/chat/constants';
import {
  containsSensitiveMemory,
  filterNewMemoryCandidates,
  parseMemoryExtractionOutput,
  shouldExtractOnRound,
  UserMemoryCandidateExpireDays,
  UserMemoryExtractDailyLimit,
  UserMemoryIgnoreDedupeDays
} from '@fastgpt/global/support/memory/candidate';
import { getLogger, LogCategories } from '../../common/logger';
import { createLLMResponse } from '../../core/ai/llm/request';
import { getDefaultChatTitleModel } from '../../core/ai/model';
import { MongoChatItem } from '../../core/chat/chatItemSchema';
import { getUserMemorySettingStatus, listPendingCandidateContents } from './controller';
import {
  MongoUserMemory,
  MongoUserMemoryCandidate,
  MongoUserMemoryExtractionLog
} from './schema';

const logger = getLogger(LogCategories.MODULE.CHAT);

const EXTRACT_TIMEOUT_MS = 30_000;
const QUESTION_MAX_LENGTH = 1500;
const ANSWER_MAX_LENGTH = 3000;
const DAY_MS = 24 * 60 * 60 * 1000;

const extractionPrompt = `你是用户记忆提取器，从一轮对话中提取值得长期记住的用户信息。

提取范围（只提取用户本人明确表达的内容）：
- 稳定的个人情况：常驻城市、家庭结构、身份阶段等
- 长期偏好：回答语言、表达详略、关注领域
- 正在推进的长期事项：申请计划、升学安排、办事目标

不要提取：
- 一次性问题本身、助手回答中的内容
- 身份证、护照、银行卡、密码、验证码、指纹、人脸等敏感信息
- 用户没有明确表达的推测性内容

输出要求：
- 只输出 JSON 数组，不要输出任何其他文字
- 最多 3 条，每条一句完整的中文陈述，不超过 60 字
- 没有值得记住的内容时输出 []`;

const buildUserPrompt = ({ question, answer }: { question: string; answer: string }) =>
  `请从下面这轮对话中提取用户的长期记忆（只依据用户消息，助手消息仅用于理解指代）。

<user_message>
${question.slice(0, QUESTION_MAX_LENGTH)}
</user_message>

<assistant_message>
${answer.slice(0, ANSWER_MAX_LENGTH)}
</assistant_message>

只输出 JSON 数组。`;

const countTodayExtractions = async ({ teamId, tmbId }: { teamId: string; tmbId: string }) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return MongoUserMemoryExtractionLog.countDocuments({
    teamId,
    tmbId,
    createTime: { $gte: startOfDay }
  });
};

const collectDedupeSources = async ({ teamId, tmbId }: { teamId: string; tmbId: string }) => {
  const [memories, ignored, pendingContents] = await Promise.all([
    MongoUserMemory.find({ teamId, tmbId }).select('content').limit(200).lean(),
    MongoUserMemoryCandidate.find({
      teamId,
      tmbId,
      status: 'ignored',
      createTime: { $gte: new Date(Date.now() - UserMemoryIgnoreDedupeDays * DAY_MS) }
    })
      .select('content')
      .limit(200)
      .lean(),
    listPendingCandidateContents({ teamId, tmbId })
  ]);

  return {
    existingMemories: memories.map((item) => item.content),
    recentIgnoredContents: ignored.map((item) => item.content),
    pendingContents
  };
};

/** 单次提取：任何环节失败都不影响对话主链路 */
export const runUserMemoryExtractionForChat = async ({
  teamId,
  tmbId,
  chatId,
  question,
  answer
}: {
  teamId: string;
  tmbId: string;
  chatId: string;
  question: string;
  answer: string;
}): Promise<{ createdCount: number }> => {
  // 鲁港通 - 用对话内真人消息总数做轮次频控，避免历史窗口截断导致轮次恒定
  const roundCount = await MongoChatItem.countDocuments({
    teamId,
    chatId,
    obj: ChatRoleEnum.Human,
    deleteTime: null
  });
  if (!shouldExtractOnRound(roundCount)) return { createdCount: 0 };

  const questionText = (question ?? '').trim();
  if (!questionText) return { createdCount: 0 };

  const status = await getUserMemorySettingStatus({ teamId, tmbId });
  if (!status.enabled || !status.autoExtractEnabled) return { createdCount: 0 };

  const titleModel = getDefaultChatTitleModel();
  if (!titleModel?.model) return { createdCount: 0 };

  const todayCount = await countTodayExtractions({ teamId, tmbId });
  if (todayCount >= UserMemoryExtractDailyLimit) return { createdCount: 0 };

  const response = await createLLMResponse({
    teamId,
    throwError: false,
    saveLLMResponseRecord: false,
    timeout: EXTRACT_TIMEOUT_MS,
    body: {
      model: titleModel.model,
      stream: false,
      messages: [
        {
          role: ChatCompletionRequestMessageRoleEnum.System,
          content: extractionPrompt
        },
        {
          role: ChatCompletionRequestMessageRoleEnum.User,
          content: buildUserPrompt({ question: questionText, answer: answer ?? '' })
        }
      ],
      ...(titleModel.reasoning ? { reasoning_effort: 'none' as const } : {})
    }
  });

  const parsed = parseMemoryExtractionOutput(response.answerText ?? '');
  const safeCandidates = parsed.filter((item) => !containsSensitiveMemory(item));
  const dedupeSources = await collectDedupeSources({ teamId, tmbId });
  const candidates = filterNewMemoryCandidates({
    candidates: safeCandidates,
    ...dedupeSources
  });

  if (candidates.length > 0) {
    const expireAt = new Date(Date.now() + UserMemoryCandidateExpireDays * DAY_MS);
    await MongoUserMemoryCandidate.insertMany(
      candidates.map((content) => ({
        teamId,
        tmbId,
        chatId,
        content,
        status: 'pending',
        expireAt
      }))
    );
  }

  await MongoUserMemoryExtractionLog.create({
    teamId,
    tmbId,
    chatId,
    createdCount: candidates.length
  });

  return { createdCount: candidates.length };
};

/** 对话落库后调度提取，不阻塞主流程 */
export const scheduleUserMemoryExtractionForChat = (params: {
  teamId: string;
  tmbId: string;
  chatId: string;
  question: string;
  answer: string;
}) => {
  void runUserMemoryExtractionForChat(params).catch((error) => {
    logger.warn('User memory extraction failed', {
      chatId: params.chatId,
      error
    });
  });
};
