// 鲁港通 - 账单页签解析：未开通开票服务时只显示账单，页签缺失时回落到账单
import { describe, expect, it } from 'vitest';
import { InvoiceTabEnum, resolveBillActiveTab } from '@/pageComponents/account/bill/utils';

describe('resolveBillActiveTab', () => {
  it('falls back to the bill tab when invoicing is unavailable', () => {
    expect(resolveBillActiveTab({ queryTab: 'invoice', showInvoice: false })).toBe(
      InvoiceTabEnum.bill
    );
  });

  it('falls back to the bill tab when the url carries no tab', () => {
    expect(resolveBillActiveTab({ queryTab: undefined, showInvoice: true })).toBe(
      InvoiceTabEnum.bill
    );
  });

  it('honours the url tab once invoicing is available', () => {
    expect(resolveBillActiveTab({ queryTab: 'invoiceHeader', showInvoice: true })).toBe(
      InvoiceTabEnum.invoiceHeader
    );
  });

  it('ignores an unknown tab and stays on the bill list', () => {
    expect(resolveBillActiveTab({ queryTab: 'nope', showInvoice: true })).toBe(InvoiceTabEnum.bill);
  });
});
