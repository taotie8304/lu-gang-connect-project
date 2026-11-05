'use client';
import { useRouter } from 'next/router';
import AccountContainer from '@/pageComponents/account/AccountContainer';
import BillPanel from '@/pageComponents/account/bill/BillPanel';
import { InvoiceTabEnum } from '@/pageComponents/account/bill/utils';

/** 直链 /account/bill 的兜底入口；日常入口是客户端设置面板里的「我的订单」弹窗 */
const BillAndInvoice = () => {
  const router = useRouter();
  const { invoiceTab = InvoiceTabEnum.bill } = router.query as { invoiceTab?: InvoiceTabEnum };

  return (
    <AccountContainer>
      <BillPanel
        tab={invoiceTab}
        onTabChange={(tab) =>
          router.replace({
            query: {
              ...router.query,
              invoiceTab: tab
            }
          })
        }
      />
    </AccountContainer>
  );
};

export default BillAndInvoice;
