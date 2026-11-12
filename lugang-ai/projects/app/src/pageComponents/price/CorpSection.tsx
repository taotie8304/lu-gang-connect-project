import React from 'react';
import { Box, Button, Flex, Grid } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { LUGANG_BUSINESS_EMAIL } from '@/web/common/system/constants';

const CapKnowledgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5v7a1.5 1.5 0 01-1.5 1.5H9l-3.6 2.7A.5.5 0 014.6 16v-2h-.1A1.5 1.5 0 013 12.5v-7z"
      stroke="#9DB9FF"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M6.5 8h7M6.5 10.6h4.5" stroke="#9DB9FF" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const CapAnswerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
    <circle cx="10" cy="10" r="7" stroke="#9DB9FF" strokeWidth="1.4" />
    <path
      d="M6.8 10.2l2 2 4.2-4.4"
      stroke="#9DB9FF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CapDocumentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M6 3.5h5.2L15 7.3v8.2a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 015 15.5v-10A1.5 1.5 0 016.5 4"
      stroke="#9DB9FF"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11 3.8V7.5h3.7M7.6 10.4h4.4M7.6 13h3"
      stroke="#9DB9FF"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CapSupportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M4 8.5v3a1.5 1.5 0 001.5 1.5H7l3.6 2.7a.5.5 0 00.8-.4V4.7a.5.5 0 00-.8-.4L7 7H5.5A1.5 1.5 0 004 8.5z"
      stroke="#9DB9FF"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M13.5 7.2a4 4 0 010 5.6" stroke="#9DB9FF" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const FeatureCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="8" cy="8" r="6.2" stroke="#8FA8D8" strokeWidth="1.2" />
    <path
      d="M5.4 8.1l1.7 1.7 3.5-3.6"
      stroke="#8FA8D8"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 鲁港通 - 价格页企业定制介绍：能力、适用行业与四项服务承诺均由 corp.* 文案驱动，四语种同步维护
const CAPABILITIES = [
  { title: 'corp.cap_1_title', desc: 'corp.cap_1_desc', Icon: CapKnowledgeIcon },
  { title: 'corp.cap_2_title', desc: 'corp.cap_2_desc', Icon: CapAnswerIcon },
  { title: 'corp.cap_3_title', desc: 'corp.cap_3_desc', Icon: CapDocumentIcon },
  { title: 'corp.cap_4_title', desc: 'corp.cap_4_desc', Icon: CapSupportIcon }
] as const;

const CASES = [
  { title: 'corp.case_1_title', desc: 'corp.case_1_desc' },
  { title: 'corp.case_2_title', desc: 'corp.case_2_desc' },
  { title: 'corp.case_3_title', desc: 'corp.case_3_desc' },
  { title: 'corp.case_4_title', desc: 'corp.case_4_desc' }
] as const;

const CORP_FEATURES = [
  'corp.feat_members',
  'corp.feat_payment',
  'corp.feat_support',
  'corp.feat_custom'
] as const;

const CorpSection = () => {
  const { t } = useClientTranslation('price');

  return (
    <Flex
      position={'relative'}
      overflow={'hidden'}
      mt={['32px', '40px']}
      w={'100%'}
      flexDirection={'column'}
      borderRadius={'24px'}
      px={['20px', '40px']}
      py={['24px', '36px']}
      background={'linear-gradient(120deg, #0F1729 0%, #16233D 48%, #1E3054 100%)'}
      boxShadow={'0 28px 56px -30px rgba(16, 23, 41, 0.55)'}
    >
      <Box
        position={'absolute'}
        inset={0}
        pointerEvents={'none'}
        bg={
          'radial-gradient(640px 280px at 86% -18%, rgba(96, 146, 255, 0.30), transparent 62%), radial-gradient(520px 260px at -8% 112%, rgba(80, 120, 220, 0.20), transparent 60%)'
        }
      />
      <Box
        position={'absolute'}
        top={0}
        right={0}
        w={'60%'}
        h={'62%'}
        opacity={0.55}
        pointerEvents={'none'}
        bgImage={
          'linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)'
        }
        bgSize={'46px 46px'}
      />

      <Flex
        position={'relative'}
        zIndex={1}
        flexDirection={['column', 'row']}
        alignItems={'flex-start'}
        justifyContent={'space-between'}
        gap={[5, 8]}
      >
        <Box maxW={['100%', '640px']}>
          <Box
            as={'span'}
            display={'inline-flex'}
            alignItems={'center'}
            gap={'8px'}
            h={'26px'}
            px={'13px'}
            borderRadius={'full'}
            bg={'rgba(122, 158, 255, 0.14)'}
            borderWidth={'1px'}
            borderColor={'rgba(122, 158, 255, 0.34)'}
            color={'#C7D6FF'}
            fontSize={'12px'}
            fontWeight={500}
            letterSpacing={'0.6px'}
          >
            <Box w={'5px'} h={'5px'} borderRadius={'full'} bg={'#7AA0FF'} />
            {t('price:corp.eyebrow')}
          </Box>
          <Box
            as={'h2'}
            mt={'15px'}
            mb={'10px'}
            fontSize={['22px', '26px']}
            fontWeight={600}
            lineHeight={1.35}
            letterSpacing={'0.3px'}
            color={'white'}
          >
            {t('price:corp.headline')}
          </Box>
          <Box fontSize={'13.5px'} lineHeight={1.8} color={'#A7B6D4'}>
            {t('price:corp.desc')}
          </Box>
        </Box>

        <Flex
          flexShrink={0}
          flexDirection={'column'}
          alignItems={['flex-start', 'flex-end']}
          w={['100%', 'auto']}
        >
          <Box
            fontSize={['28px', '34px']}
            fontWeight={650}
            letterSpacing={'-0.6px'}
            color={'white'}
            whiteSpace={'nowrap'}
          >
            {t('price:corp.price_text')}
          </Box>
          <Box fontSize={'12px'} color={'#8296BC'} mt={'7px'}>
            {t('price:corp.price_note')}
          </Box>
          <Button
            as={'a'}
            href={`mailto:${LUGANG_BUSINESS_EMAIL}`}
            mt={'18px'}
            h={'44px'}
            px={'24px'}
            borderRadius={'12px'}
            bg={'#E9EFFF'}
            color={'#16233D'}
            fontSize={'14px'}
            fontWeight={600}
            _hover={{ bg: 'white', transform: 'translateY(-1px)' }}
          >
            {t('price:corp.cta')}
          </Button>
        </Flex>
      </Flex>

      <Grid
        position={'relative'}
        zIndex={1}
        mt={['24px', '30px']}
        gridTemplateColumns={['repeat(2, minmax(0, 1fr))', 'repeat(4, minmax(0, 1fr))']}
        gap={['10px', '14px']}
      >
        {CAPABILITIES.map(({ title, desc, Icon }) => (
          <Flex
            key={title}
            flexDirection={'column'}
            bg={'rgba(255, 255, 255, 0.045)'}
            borderWidth={'1px'}
            borderColor={'rgba(255, 255, 255, 0.09)'}
            borderRadius={'14px'}
            px={[4, 4]}
            pt={['16px', '18px']}
            pb={['14px', '16px']}
            transition={'all 0.2s'}
            _hover={{
              bg: 'rgba(255, 255, 255, 0.08)',
              borderColor: 'rgba(140, 170, 255, 0.38)',
              transform: 'translateY(-2px)'
            }}
          >
            <Flex
              w={'34px'}
              h={'34px'}
              flexShrink={0}
              borderRadius={'10px'}
              bg={'rgba(122, 158, 255, 0.17)'}
              alignItems={'center'}
              justifyContent={'center'}
              mb={'13px'}
            >
              <Icon />
            </Flex>
            <Box fontSize={['13.5px', '14.5px']} fontWeight={600} color={'#F4F7FF'} mb={'7px'}>
              {t(`price:${title}` as any)}
            </Box>
            <Box fontSize={'12.5px'} lineHeight={1.7} color={'#93A5C7'}>
              {t(`price:${desc}` as any)}
            </Box>
          </Flex>
        ))}
      </Grid>

      <Flex
        position={'relative'}
        zIndex={1}
        mt={['20px', '26px']}
        flexDirection={['column', 'row']}
        alignItems={'flex-start'}
        gap={['12px', '18px']}
      >
        <Box
          flexShrink={0}
          pt={['0', '11px']}
          fontSize={'12px'}
          color={'#8296BC'}
          letterSpacing={'2px'}
        >
          {t('price:corp.cases_label')}
        </Box>
        <Grid
          flex={1}
          w={'100%'}
          gridTemplateColumns={['1fr', 'repeat(4, minmax(0, 1fr))']}
          gap={'12px'}
        >
          {CASES.map(({ title, desc }) => (
            <Box
              key={title}
              px={'14px'}
              py={'12px'}
              borderRadius={'12px'}
              borderWidth={'1px'}
              borderStyle={'dashed'}
              borderColor={'rgba(255, 255, 255, 0.15)'}
              bg={'rgba(255, 255, 255, 0.022)'}
              transition={'all 0.2s'}
              _hover={{ borderColor: 'rgba(140, 170, 255, 0.4)', bg: 'rgba(255, 255, 255, 0.045)' }}
            >
              <Box fontSize={'13.5px'} fontWeight={600} color={'#E8EEFF'} mb={'4px'}>
                {t(`price:${title}` as any)}
              </Box>
              <Box fontSize={'12px'} lineHeight={1.65} color={'#8FA1C4'}>
                {t(`price:${desc}` as any)}
              </Box>
            </Box>
          ))}
        </Grid>
      </Flex>

      <Flex
        position={'relative'}
        zIndex={1}
        mt={['20px', '26px']}
        pt={'17px'}
        flexWrap={'wrap'}
        gap={['14px', '26px']}
        borderTopWidth={'1px'}
        borderTopColor={'rgba(255, 255, 255, 0.08)'}
        fontSize={'12.5px'}
        color={'#9FB0D0'}
      >
        {CORP_FEATURES.map((key) => (
          <Flex key={key} alignItems={'center'} gap={'7px'}>
            <FeatureCheckIcon />
            {t(`price:${key}` as any)}
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
};

export default React.memo(CorpSection);
