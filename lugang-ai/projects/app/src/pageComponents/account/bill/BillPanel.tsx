'use client';
import React, { useState } from 'react';
import { Box, Button, Flex } from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import FillRowTabs from '@fastgpt/web/components/common/Tabs/FillRowTabs';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import ApplyInvoiceModal from './ApplyInvoiceModal';
import { InvoiceTabEnum, resolveBillActiveTab } from './utils';
import { accountPageRootStyles, accountTitleTextStyles } from '../styles';
import { useSystemStore } from '@/web/common/system/useSystemStore';

const BillTable = dynamic(() => import('./BillTable'));
const InvoiceHeaderForm = dynamic(() => import('./InvoiceHeaderForm'));
const InvoiceTable = dynamic(() => import('./InvoiceTable'));

/** 账单与发票：账号页与客户端设置弹窗共用，弹窗态多一个「关闭」 */
const BillPanel = ({
  tab,
  onTabChange,
  onClose
}: {
  tab: InvoiceTabEnum;
  onTabChange: (tab: InvoiceTabEnum) => void;
  onClose?: () => void;
}) => {
  const { t } = useClientTranslation(['account_bill', 'account']);
  const { feConfigs } = useSystemStore();

  // 鲁港通 - N4：未接入商业版/开票服务，隐藏发票页签与申请入口，避免点击后请求报错
  const showInvoice = !!feConfigs?.isPlus;
  const activeTab = resolveBillActiveTab({ queryTab: tab, showInvoice });

  const [isOpenInvoiceModal, setIsOpenInvoiceModal] = useState(false);
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0);

  return (
    <Flex {...accountPageRootStyles} flexDirection={'column'}>
      <Flex
        display={onClose ? 'flex' : ['none', 'flex']}
        h={'64px'}
        flexShrink={0}
        px={[3, 6]}
        alignItems={'center'}
        borderBottom={'1px solid'}
        borderColor={'myGray.200'}
        position={'sticky'}
        top={0}
        bg={'white'}
        zIndex={1}
      >
        <Box as={'h1'} {...accountTitleTextStyles}>
          {t('account:bills_and_invoices')}
        </Box>
        <Box flex={1} />
        {onClose && (
          <Button variant={'whitePrimaryOutline'} size={'sm'} onClick={onClose}>
            {t('common:Close')}
          </Button>
        )}
      </Flex>
      <Flex flex={['0 0 auto', '1 0 0']} minH={0} flexDirection={'column'} py={[2, 6]}>
        <Flex
          px={[2, 6]}
          justifyContent={'space-between'}
          alignItems={['stretch', 'center']}
          flexDirection={['column', 'row']}
          pb={'0.75rem'}
        >
          <Box w={['100%', 'auto']}>
            <FillRowTabs
              w={['100%', 'auto']}
              size={'sm'}
              scrollPositionKey={'account-bill-tabs'}
              list={[
                { label: t('account_bill:bill_record'), value: InvoiceTabEnum.bill },
                ...(showInvoice
                  ? [
                      {
                        label: t('account_bill:support_wallet_bill_tag_invoice'),
                        value: InvoiceTabEnum.invoice
                      },
                      {
                        label: t('account_bill:default_header'),
                        value: InvoiceTabEnum.invoiceHeader
                      }
                    ]
                  : [])
              ]}
              value={activeTab}
              onChange={(e) => onTabChange(e as InvoiceTabEnum)}
            ></FillRowTabs>
          </Box>
          {showInvoice && activeTab !== InvoiceTabEnum.invoiceHeader && (
            <Flex mt={[3, 0]} w={['100%', 'auto']} justifyContent={'flex-end'}>
              <Button
                w={['100%', 'auto']}
                variant={'primary'}
                px="0"
                onClick={() => setIsOpenInvoiceModal(true)}
              >
                <Flex alignItems={'center'} px={'20px'}>
                  <Box px={'1.25rem'} py={'0.5rem'}>
                    {t('account_bill:support_wallet_invoicing')}
                  </Box>
                </Flex>
              </Button>
            </Flex>
          )}
        </Flex>
        <Box flex={['0 0 auto', '1 0 0']} h={['auto', 0]} minH={0} overflow={['visible', 'hidden']}>
          {activeTab === InvoiceTabEnum.bill && <BillTable key={recordsRefreshKey} />}
          {activeTab === InvoiceTabEnum.invoice && <InvoiceTable key={recordsRefreshKey} />}
          {activeTab === InvoiceTabEnum.invoiceHeader && <InvoiceHeaderForm />}
        </Box>
      </Flex>
      {isOpenInvoiceModal && (
        <ApplyInvoiceModal
          onClose={() => {
            setIsOpenInvoiceModal(false);
          }}
          onSuccess={() => {
            setIsOpenInvoiceModal(false);
            setRecordsRefreshKey((key) => key + 1);
          }}
        />
      )}
    </Flex>
  );
};

export default BillPanel;
