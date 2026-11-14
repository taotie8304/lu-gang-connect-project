// 鲁港通 - 单张场景卡：标题行点击展开，展开后填表并提交
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { LG } from '@/pageComponents/chat/lugangTheme';
import ScenarioFields from './ScenarioFields';
import type { ScenarioFormValues, ScenarioTemplate } from './types';

type Props = {
  template: ScenarioTemplate;
  expanded: boolean;
  values: ScenarioFormValues;
  error: string | null;
  onToggle: () => void;
  onChange: (key: string, value: string) => void;
  onErrorClear: () => void;
  onSubmit: () => void;
};

const ScenarioCard = ({
  template,
  expanded,
  values,
  error,
  onToggle,
  onChange,
  onErrorClear,
  onSubmit
}: Props) => {
  const { t } = useTranslation();
  const submitKey =
    template.id === 'generic'
      ? 'common:builtin_browser_scenario_plan'
      : 'common:builtin_browser_scenario_start';

  return (
    <Box
      w={'100%'}
      bg={'white'}
      border={'1px solid'}
      borderColor={expanded ? LG.lineStrong : LG.line}
      borderRadius={'10px'}
      boxShadow={expanded ? '0 6px 22px rgba(78,128,178,0.08)' : '0 2px 10px rgba(78,128,178,0.04)'}
      overflow={'hidden'}
      transition={'border-color .15s ease'}
    >
      <Flex
        as={'button'}
        type={'button'}
        w={'100%'}
        alignItems={'center'}
        gap={'9px'}
        px={'12px'}
        py={'10px'}
        textAlign={'left'}
        cursor={'pointer'}
        aria-expanded={expanded}
        _hover={{ bg: 'rgba(231,241,251,0.35)' }}
        onClick={onToggle}
      >
        <Flex
          w={'26px'}
          h={'26px'}
          flexShrink={0}
          alignItems={'center'}
          justifyContent={'center'}
          borderRadius={'8px'}
          bg={LG.paleSoft}
          color={LG.mountain}
        >
          <MyIcon name={template.icon} w={'14px'} h={'14px'} color={'currentColor'} />
        </Flex>
        <Box flex={1} minW={0}>
          <Text fontSize={'13px'} fontWeight={600} color={LG.text} lineHeight={'1.35'}>
            {t(template.titleKey)}
          </Text>
          <Text mt={'2px'} fontSize={'11.5px'} color={LG.muted} lineHeight={'1.45'}>
            {t(template.descKey)}
          </Text>
        </Box>
        <MyIcon
          name={'common/rightArrow'}
          w={'12px'}
          h={'12px'}
          color={LG.mutedSoft}
          transform={expanded ? 'rotate(90deg)' : 'none'}
          transition={'transform .15s ease'}
        />
      </Flex>

      {expanded && (
        <Box px={'12px'} pt={'10px'} pb={'12px'} borderTop={'1px solid'} borderColor={LG.lineSoft}>
          <ScenarioFields
            template={template}
            values={values}
            onChange={onChange}
            onErrorClear={onErrorClear}
          />

          {error && (
            <Text mt={'8px'} fontSize={'12px'} color={'#B4544F'}>
              {t(error)}
            </Text>
          )}

          <Text mt={'10px'} fontSize={'11px'} color={LG.mutedSoft} lineHeight={'1.5'}>
            {t('common:builtin_browser_scenario_privacy_note')}
          </Text>

          <Flex justifyContent={'flex-end'} mt={'8px'}>
            <Button
              size={'sm'}
              h={'30px'}
              px={'14px'}
              fontSize={'12.5px'}
              borderRadius={'7px'}
              bg={'linear-gradient(140deg, #8FB4DC, #4F80B4)'}
              color={'white'}
              _hover={{ opacity: 0.9 }}
              onClick={onSubmit}
            >
              {t(submitKey)}
            </Button>
          </Flex>
        </Box>
      )}
    </Box>
  );
};

export default ScenarioCard;
