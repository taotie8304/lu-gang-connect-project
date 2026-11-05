export enum InvoiceTabEnum {
  bill = 'bill',
  invoice = 'invoice',
  invoiceHeader = 'invoiceHeader'
}

// 鲁港通 - N4 未开通开票服务时只显示账单；URL 带未知页签也回落到账单，避免出现空白面板
export const resolveBillActiveTab = ({
  queryTab,
  showInvoice
}: {
  queryTab?: string;
  showInvoice: boolean;
}): InvoiceTabEnum => {
  const knownTab = Object.values(InvoiceTabEnum).find((tab) => tab === queryTab);
  const tab = knownTab ?? InvoiceTabEnum.bill;
  return showInvoice ? tab : InvoiceTabEnum.bill;
};
