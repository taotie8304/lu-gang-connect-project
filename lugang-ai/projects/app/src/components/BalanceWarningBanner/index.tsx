/**
 * 鲁港通 - 余额警告横幅
 * 在聊天界面顶部显示余额不足警告
 * Requirements: 9.4, 9.5
 */

import React from 'react';
import { Alert, AlertIcon, AlertDescription, CloseButton, Box, Button } from '@chakra-ui/react';
import { useAccountMonitor } from '@/hooks/useAccountMonitor';

interface BalanceWarningBannerProps {
  onRecharge?: () => void; // 充值按钮回调
}

/**
 * 余额警告横幅组件
 * Requirement 9.4: 低余额时显示警告通知
 * Requirement 9.5: 定期刷新账户信息
 */
const BalanceWarningBanner: React.FC<BalanceWarningBannerProps> = ({ onRecharge }) => {
  const { hasLowBalance, balanceWarning, accountInfo } = useAccountMonitor({
    enabled: true,
    refreshInterval: 5 * 60 * 1000, // 5 分钟刷新一次
    showToast: false // 不显示 Toast，只显示横幅
  });

  const [isDismissed, setIsDismissed] = React.useState(false);

  // 如果没有警告或已被关闭，不显示
  if (!hasLowBalance || !balanceWarning || isDismissed || !accountInfo) {
    return null;
  }

  // 判断是否完全用尽
  const isZeroBalance = accountInfo.balance.remaining_quota <= 0;

  return (
    <Alert
      status={isZeroBalance ? 'error' : 'warning'}
      variant="solid"
      borderRadius="md"
      mb={4}
      position="relative"
    >
      <AlertIcon />
      <Box flex="1">
        <AlertDescription display="flex" alignItems="center" gap={4}>
          <span>{balanceWarning}</span>
          {onRecharge && (
            <Button
              size="sm"
              colorScheme={isZeroBalance ? 'red' : 'orange'}
              variant="outline"
              bg="white"
              _hover={{ bg: 'gray.100' }}
              onClick={onRecharge}
            >
              立即充值
            </Button>
          )}
        </AlertDescription>
      </Box>
      <CloseButton
        position="absolute"
        right="8px"
        top="8px"
        onClick={() => setIsDismissed(true)}
      />
    </Alert>
  );
};

export default BalanceWarningBanner;
