// 鲁港通 - 面板空状态的「常用代办场景」区：四张模板卡 + 展开表单
import { forwardRef, useEffect, useState } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { LG } from '@/pageComponents/chat/lugangTheme';
import ScenarioCard from './ScenarioCard';
import { scenarioTemplates, validateScenarioValues } from './templates';
import type {
  ScenarioFocus,
  ScenarioFormValues,
  ScenarioId,
  ScenarioPlatform,
  ScenarioTemplate
} from './types';

type Props = {
  onSubmit: (promptText: string) => void;
  focus?: ScenarioFocus | null;
  /** 鲁港通 - 缺省按桌面端：桌面端四卡照常，网页端查询卡走查询提示词、办事卡显示说明 */
  platform?: ScenarioPlatform;
};

const buildDefaultValues = (template: ScenarioTemplate): ScenarioFormValues =>
  Object.fromEntries(template.fields.map((field) => [field.key, field.defaultValue ?? '']));

const ScenarioSection = forwardRef<HTMLDivElement, Props>(function ScenarioSection(
  { onSubmit, focus, platform = 'desktop' },
  ref
) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<ScenarioId | null>(null);
  // 鲁港通 - 网页端办事卡的说明区独立展开，不进入填表流程
  const [desktopOnlyId, setDesktopOnlyId] = useState<ScenarioId | null>(null);
  const [valuesById, setValuesById] = useState<Partial<Record<ScenarioId, ScenarioFormValues>>>({});
  const [errorById, setErrorById] = useState<Partial<Record<ScenarioId, string | null>>>({});

  useEffect(() => {
    if (!focus) return;
    setExpandedId(focus.id ?? null);
    setDesktopOnlyId(null);
  }, [focus?.nonce]);

  const valuesOf = (template: ScenarioTemplate) =>
    valuesById[template.id] ?? buildDefaultValues(template);

  const isDesktopOnlyOnWeb = (template: ScenarioTemplate) =>
    platform === 'web' && template.availability === 'desktop-only';

  const handleToggle = (id: ScenarioId) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleDesktopOnlyToggle = (id: ScenarioId) => {
    setDesktopOnlyId((prev) => (prev === id ? null : id));
  };

  const handleChange = (template: ScenarioTemplate, key: string, value: string) => {
    setValuesById((prev) => ({
      ...prev,
      [template.id]: { ...(prev[template.id] ?? buildDefaultValues(template)), [key]: value }
    }));
  };

  const handleSubmit = (template: ScenarioTemplate) => {
    if (isDesktopOnlyOnWeb(template)) return;
    const values = valuesOf(template);
    const error = validateScenarioValues(template, values);
    setErrorById((prev) => ({ ...prev, [template.id]: error }));
    if (error) return;
    onSubmit(template.buildPrompt(values, platform));
  };

  return (
    <Box ref={ref} w={'100%'} maxW={'380px'}>
      <Flex alignItems={'center'} gap={'6px'} mb={'8px'}>
        <MyIcon name={'common/list'} w={'14px'} h={'14px'} color={LG.mountain} />
        <Text fontSize={'13px'} fontWeight={600} color={LG.ink}>
          {t('common:builtin_browser_scenario_title')}
        </Text>
      </Flex>
      <Flex flexDirection={'column'} gap={'8px'}>
        {scenarioTemplates.map((template) => (
          <ScenarioCard
            key={template.id}
            template={template}
            expanded={expandedId === template.id}
            desktopOnly={isDesktopOnlyOnWeb(template)}
            desktopOnlyOpen={desktopOnlyId === template.id}
            values={valuesOf(template)}
            error={errorById[template.id] ?? null}
            onToggle={() => handleToggle(template.id)}
            onDesktopOnlyToggle={() => handleDesktopOnlyToggle(template.id)}
            onChange={(key, value) => handleChange(template, key, value)}
            onErrorClear={() =>
              setErrorById((prev) => (prev[template.id] ? { ...prev, [template.id]: null } : prev))
            }
            onSubmit={() => handleSubmit(template)}
          />
        ))}
      </Flex>
    </Box>
  );
});

export default ScenarioSection;
