// 鲁港通 - 后台功能可见性判定：纯聊天模式（enableUserChatOnly）开启后，
// 只有团队所有者能看到 Studio/知识库/账号设置等后台风格页面，其余角色一律收敛到聊天。
export const decideShowAdminFeatures = ({
  isOwner,
  enableUserChatOnly
}: {
  isOwner: boolean;
  enableUserChatOnly: boolean;
}): boolean => isOwner || !enableUserChatOnly;
