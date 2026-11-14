// 鲁港通 - 场景模板表单字段渲染（text / textarea / chips / select）
import { Box, Flex, Input, Select, Text, Textarea } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { LG } from '@/pageComponents/chat/lugangTheme';
import type { ScenarioField, ScenarioFormValues, ScenarioTemplate } from './types';

type Props = {
  template: ScenarioTemplate;
  values: ScenarioFormValues;
  onChange: (key: string, value: string) => void;
  onErrorClear: () => void;
};

const ScenarioFields = ({ template, values, onChange, onErrorClear }: Props) => {
  const { t } = useTranslation();

  const renderField = (field: ScenarioField) => {
    const value = values[field.key] ?? '';
    const update = (next: string) => {
      onErrorClear();
      onChange(field.key, next);
    };

    return (
      <Box key={field.key}>
        <Text fontSize={'12px'} fontWeight={600} color={LG.text} mb={'5px'}>
          {t(field.labelKey)}
          {field.required && (
            <Text as={'span'} ml={'2px'} color={'#C97B7B'}>
              *
            </Text>
          )}
        </Text>

        {field.kind === 'text' && (
          <Flex flexDirection={'column'} gap={'6px'}>
            <Input
              size={'sm'}
              h={'32px'}
              fontSize={'13px'}
              value={value}
              maxLength={field.maxLength ?? 120}
              placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
              onChange={(e) => update(e.target.value)}
              bg={'white'}
              border={'1px solid'}
              borderColor={LG.line}
              borderRadius={'7px'}
              color={'#4A5F75'}
              _hover={{ borderColor: 'rgba(111,157,208,0.4)' }}
              _focusVisible={{
                bg: 'white',
                borderColor: LG.lineStrong,
                boxShadow: '0 0 0 3px rgba(111,157,208,0.12)'
              }}
              _placeholder={{ color: '#9DAFC2' }}
            />
            {template.exampleKeys && template.exampleKeys.length > 0 && (
              <Flex flexWrap={'wrap'} gap={'5px'}>
                {template.exampleKeys.map((key) => (
                  <Box
                    key={key}
                    px={'8px'}
                    h={'22px'}
                    lineHeight={'22px'}
                    fontSize={'11.5px'}
                    color={LG.mountain}
                    bg={LG.paleSoft}
                    border={'1px solid'}
                    borderColor={LG.line}
                    borderRadius={'999px'}
                    cursor={'pointer'}
                    _hover={{ bg: LG.pale }}
                    onClick={() => update(t(key))}
                  >
                    {t(key)}
                  </Box>
                ))}
              </Flex>
            )}
          </Flex>
        )}

        {field.kind === 'textarea' && (
          <Textarea
            rows={3}
            fontSize={'13px'}
            value={value}
            maxLength={field.maxLength ?? 300}
            placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
            onChange={(e) => update(e.target.value)}
            bg={'white'}
            border={'1px solid'}
            borderColor={LG.line}
            borderRadius={'7px'}
            color={'#4A5F75'}
            resize={'vertical'}
            _hover={{ borderColor: 'rgba(111,157,208,0.4)' }}
            _focusVisible={{
              bg: 'white',
              borderColor: LG.lineStrong,
              boxShadow: '0 0 0 3px rgba(111,157,208,0.12)'
            }}
            _placeholder={{ color: '#9DAFC2' }}
          />
        )}

        {field.kind === 'chips' && (
          <Flex flexWrap={'wrap'} gap={'6px'}>
            {(field.options ?? []).map((option) => {
              const active = value === option.value;
              return (
                <Box
                  key={option.value}
                  px={'9px'}
                  h={'26px'}
                  lineHeight={'24px'}
                  fontSize={'12px'}
                  color={active ? LG.mountain : LG.text}
                  bg={active ? LG.pale : 'white'}
                  border={'1px solid'}
                  borderColor={active ? LG.lineStrong : LG.line}
                  borderRadius={'999px'}
                  cursor={'pointer'}
                  _hover={{ borderColor: LG.lineStrong }}
                  onClick={() => update(option.value)}
                >
                  {t(option.labelKey)}
                </Box>
              );
            })}
          </Flex>
        )}

        {field.kind === 'select' && (
          <Select
            size={'sm'}
            h={'32px'}
            fontSize={'13px'}
            value={value}
            onChange={(e) => update(e.target.value)}
            bg={'white'}
            border={'1px solid'}
            borderColor={LG.line}
            borderRadius={'7px'}
            color={'#4A5F75'}
            _hover={{ borderColor: 'rgba(111,157,208,0.4)' }}
            _focusVisible={{ borderColor: LG.lineStrong }}
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </Select>
        )}
      </Box>
    );
  };

  return (
    <Flex flexDirection={'column'} gap={'10px'}>
      {template.fields.map(renderField)}
    </Flex>
  );
};

export default ScenarioFields;
