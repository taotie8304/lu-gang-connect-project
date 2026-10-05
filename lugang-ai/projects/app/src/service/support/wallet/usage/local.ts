// 鲁港通 - N4 用量管线：本部署未接入商业版（isProVersion=false）时，官方
// global.createUsageHandler / concatUsageHandler / pushUsageItemsHandler 均为 no-op，
// 导致对话与训练消耗只建了 usage 空壳、明细与总积分永不落库。此处用本地 Mongo 写库顶替，
// 契约与商业版 POST /support/wallet/usage/{createUsage,concatUsage,pushUsageItems} 一致。
import { i18nT } from '@fastgpt/global/common/i18n/utils';
import type {
  ConcatUsageProps,
  CreateUsageProps,
  PushUsageItemsProps
} from '@fastgpt/global/support/wallet/usage/api';
import { UsageItemTypeEnum } from '@fastgpt/global/support/wallet/usage/constants';
import type { UsageItemType } from '@fastgpt/global/support/wallet/usage/type';
import { MongoUsage } from '@fastgpt/service/support/wallet/usage/schema';
import { MongoUsageItem } from '@fastgpt/service/support/wallet/usage/usageItemSchema';

// concat 兜底建明细时的名称（训练/评估会预建明细，此处仅防历史或异常流程缺行）
const itemTypeFallbackNameMap: Record<number, string> = {
  [UsageItemTypeEnum.training_vector]: i18nT('account_usage:embedding_index'),
  [UsageItemTypeEnum.training_qa]: i18nT('account_usage:qa'),
  [UsageItemTypeEnum.training_autoIndex]: i18nT('account_usage:auto_index'),
  [UsageItemTypeEnum.training_paragraph]: i18nT('account_usage:llm_paragraph'),
  [UsageItemTypeEnum.training_imageIndex]: i18nT('account_usage:image_index'),
  [UsageItemTypeEnum.training_imageParse]: i18nT('account_usage:image_parse'),
  [UsageItemTypeEnum.evaluation_generateAnswer]: i18nT('account_usage:generate_answer'),
  [UsageItemTypeEnum.evaluation_answerAccuracy]: i18nT('account_usage:answer_accuracy')
};

const formatUsageItem = ({
  teamId,
  usageId,
  item
}: {
  teamId: string;
  usageId: string;
  item: UsageItemType;
}) => ({
  teamId,
  usageId,
  name: item.moduleName,
  amount: item.amount ?? 0,
  itemType: item.itemType,
  model: item.model,
  inputTokens: item.inputTokens,
  outputTokens: item.outputTokens,
  charsLength: item.charsLength,
  duration: item.duration,
  pages: item.pages,
  count: item.count
});

export const localCreateUsage = async (data: CreateUsageProps) => {
  const { list = [], ...usageData } = data;
  const usage = await MongoUsage.create({
    ...usageData,
    totalPoints: usageData.totalPoints ?? 0
  });

  const items = list.filter((item) => item?.moduleName);
  if (items.length) {
    await MongoUsageItem.create(
      items.map((item) =>
        formatUsageItem({ teamId: data.teamId, usageId: String(usage._id), item })
      )
    );
  }

  return String(usage._id);
};

export const localConcatUsage = async (data: ConcatUsageProps) => {
  const { teamId, usageId, totalPoints, itemType } = data;

  // 只累加实际给出的计数字段：$inc 会给缺失字段补 0，凭空多出 0 值列会污染明细表的列显示
  const inc: Record<string, number> = {};
  if (typeof totalPoints === 'number') inc.amount = totalPoints;
  if (typeof data.inputTokens === 'number') inc.inputTokens = data.inputTokens;
  if (typeof data.outputTokens === 'number') inc.outputTokens = data.outputTokens;
  if (typeof data.charsLength === 'number') inc.charsLength = data.charsLength;
  if (typeof data.duration === 'number') inc.duration = data.duration;
  if (typeof data.pages === 'number') inc.pages = data.pages;
  if (typeof data.count === 'number') inc.count = data.count;

  await MongoUsageItem.updateOne(
    { teamId, usageId, itemType },
    {
      $inc: inc,
      $setOnInsert: { name: itemTypeFallbackNameMap[itemType] ?? String(itemType) }
    },
    { upsert: true }
  );

  if (typeof totalPoints === 'number' && totalPoints !== 0) {
    await MongoUsage.updateOne({ _id: usageId, teamId }, { $inc: { totalPoints } });
  }
};

export const localPushUsageItems = async (data: PushUsageItemsProps) => {
  const { teamId, usageId, list } = data;
  const items = (list ?? []).filter((item) => item?.moduleName);
  if (!items.length) return;

  await MongoUsageItem.create(
    items.map((item) => formatUsageItem({ teamId, usageId, item }))
  );

  const totalPoints = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  if (totalPoints !== 0) {
    await MongoUsage.updateOne({ _id: usageId, teamId }, { $inc: { totalPoints } });
  }
};
