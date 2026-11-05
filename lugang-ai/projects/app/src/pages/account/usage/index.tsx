'use client';
import React from 'react';
import { useRouter } from 'next/router';
import AccountContainer from '@/pageComponents/account/AccountContainer';
import UsagePanel from '@/pageComponents/account/usage/UsagePanel';
import { UsageTabEnum } from '@/pageComponents/account/usage/utils';

/** 直链 /account/usage 的兜底入口；日常入口是客户端设置面板里的「用量明细」弹窗 */
const UsagePage = () => {
  const router = useRouter();
  const { usageTab = UsageTabEnum.detail } = router.query as { usageTab?: UsageTabEnum };

  return (
    <AccountContainer>
      <UsagePanel
        tab={usageTab}
        onTabChange={(tab) =>
          router.replace({
            query: {
              ...router.query,
              usageTab: tab
            }
          })
        }
      />
    </AccountContainer>
  );
};

export default React.memo(UsagePage);
