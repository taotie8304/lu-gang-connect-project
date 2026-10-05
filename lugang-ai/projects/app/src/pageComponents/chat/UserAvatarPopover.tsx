import React, { useState } from 'react';
import { Box } from '@chakra-ui/react';
import MyPopover from '@fastgpt/web/components/common/MyPopover';
import UserSettingsPanel from '@/components/UserSettingsPanel';

type UserAvatarPopoverProps = {
  isCollapsed: boolean;
  children: React.ReactNode;
  placement?: Parameters<typeof MyPopover>[0]['placement'];
};

// 鲁港通 - 统一口径：所有用户（含 root）点击头像都打开「用户设置面板」。
// 面板内已含语言切换/修改密码/反馈/无障碍/法律条款/登出 + D10 商业化入口（订阅套餐/我的订单/用量明细），
// 不再区分 root 的官方头像菜单，保证付款与消费入口对全体用户一致可达。
const UserAvatarPopover = ({ children }: UserAvatarPopoverProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <Box cursor="pointer" w="full" onClick={() => setIsSettingsOpen(true)}>
        {children}
      </Box>
      <UserSettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};

export default UserAvatarPopover;
