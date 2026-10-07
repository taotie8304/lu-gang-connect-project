import React from 'react';
import { Box, Flex, Grid } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';

const FAQ = () => {
  const { t } = useClientTranslation('price');
  const faqs = [
    {
      title: t('price:FAQ.switch_package_q'),
      desc: t('price:FAQ.switch_package_a')
    },
    {
      title: t('price:FAQ.check_subscription_q'),
      desc: t('price:FAQ.check_subscription_a')
    },
    {
      title: t('price:FAQ.ai_point_q'),
      desc: t('price:FAQ.ai_point_a')
    },
    {
      title: t('price:FAQ.ai_point_expire_q'),
      desc: t('price:FAQ.ai_point_expire_a')
    },
    {
      title: t('price:FAQ.package_overlay_q'),
      desc: t('price:FAQ.package_overlay_a')
    },
    {
      title: t('price:FAQ.upload_limit_q'),
      desc: t('price:FAQ.upload_limit_a')
    },
    {
      title: t('price:FAQ.year_day_q'),
      desc: t('price:FAQ.year_day_a')
    }
  ];

  return (
    <Flex
      mt={['40px', '100px']}
      pb={'10vh'}
      flexDirection={'column'}
      alignItems={'center'}
      position={'relative'}
    >
      <Box fontWeight={'bold'} fontSize={['24px', '36px']} color={'myGray.900'}>
        {t('price:support.wallet.subscription.FAQ')}
      </Box>
      <Grid mt={12} gridTemplateColumns={['1fr', '1fr 1fr']} gap={4} w={'100%'}>
        {faqs.map((item, i) => (
          <Box
            key={i}
            py={8}
            px={9}
            borderRadius={'lg'}
            borderWidth={'1px'}
            borderColor={'myGray.150'}
            bg={'rgba(255,255,255,0.9)'}
            _hover={{
              borderColor: 'primary.300'
            }}
          >
            <Box fontWeight={'bold'} pb={3} color={'myGray.900'}>
              {item.title}
            </Box>
            <Box fontSize={'sm'} color={'myGray.600'}>
              {item.desc}
            </Box>
          </Box>
        ))}
      </Grid>
    </Flex>
  );
};

export default FAQ;
