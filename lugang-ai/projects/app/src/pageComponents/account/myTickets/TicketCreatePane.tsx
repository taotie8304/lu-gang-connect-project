'use client';
import React, { useMemo, useState } from 'react';
import { Box, Button, Flex, Input, Textarea } from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { postCreateTicket } from '@/web/support/ticket/api';
import {
  TicketTypeEnum,
  ticketTypeMap,
  TicketTitleMaxLength,
  TicketContentMaxLength
} from '@fastgpt/global/support/ticket/constants';

/** 提交工单表单（无历史工单时自动展开，或在列表页点击「提交工单」进入） */
const TicketCreatePane = ({
  onCreated,
  onCancel
}: {
  onCreated: (ticketId: string) => void;
  onCancel: () => void;
}) => {
  const { t } = useClientTranslation('ticket');

  const [type, setType] = useState<TicketTypeEnum>(TicketTypeEnum.problem);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { run: createTicket, loading } = useRequest(
    async () => postCreateTicket({ type, title: title.trim(), content: content.trim() }),
    {
      onSuccess: ({ ticketId }) => onCreated(ticketId),
      successToast: t('ticket:submit_success'),
      errorToast: ''
    }
  );

  const canSubmit = useMemo(
    () => title.trim().length >= 2 && content.trim().length >= 5,
    [title, content]
  );

  return (
    <Flex flexDirection={'column'} maxW={'640px'} mx={'auto'} w={'100%'}>
      <Box fontSize={'sm'} fontWeight={500} color={'myGray.900'}>
        {t('ticket:type_label')}
      </Box>
      <Flex mt={2} gap={2}>
        {Object.values(TicketTypeEnum).map((item) => {
          const selected = type === item;
          return (
            <Box
              key={item}
              cursor={'pointer'}
              px={4}
              py={1.5}
              borderRadius={'full'}
              fontSize={'sm'}
              border={'1px solid'}
              borderColor={selected ? 'primary.500' : 'myGray.200'}
              bg={selected ? 'primary.50' : 'white'}
              color={selected ? 'primary.600' : 'myGray.700'}
              onClick={() => setType(item)}
            >
              {t(ticketTypeMap[item].label as any)}
            </Box>
          );
        })}
      </Flex>

      <Box mt={5} fontSize={'sm'} fontWeight={500} color={'myGray.900'}>
        {t('ticket:title_label')}
      </Box>
      <Input
        mt={2}
        bg={'white'}
        value={title}
        maxLength={TicketTitleMaxLength}
        placeholder={t('ticket:title_placeholder')}
        onChange={(e) => setTitle(e.target.value)}
      />

      <Box mt={5} fontSize={'sm'} fontWeight={500} color={'myGray.900'}>
        {t('ticket:content_label')}
      </Box>
      <Textarea
        mt={2}
        bg={'white'}
        minH={'160px'}
        value={content}
        maxLength={TicketContentMaxLength}
        placeholder={t('ticket:content_placeholder')}
        onChange={(e) => setContent(e.target.value)}
      />

      <Flex mt={3} alignItems={'center'} gap={1.5}>
        <MyIcon name={'common/info'} w={'14px'} color={'red.600'} />
        <Box fontSize={'xs'} color={'myGray.500'}>
          {t('ticket:sensitive_notice')}
        </Box>
      </Flex>

      <Flex mt={6} gap={3} justifyContent={'flex-end'}>
        <Button variant={'whiteBase'} onClick={onCancel}>
          {t('ticket:back_to_list')}
        </Button>
        <Button
          variant={'primary'}
          isDisabled={!canSubmit}
          isLoading={loading}
          onClick={() => createTicket()}
        >
          {t('ticket:submit')}
        </Button>
      </Flex>
    </Flex>
  );
};

export default TicketCreatePane;
