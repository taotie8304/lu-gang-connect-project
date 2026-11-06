// 鲁港通 - 「用量明细」弹窗：在客户端内直接查看消耗明细，不再进入 FastGPT 账号页风格
import React, { useState } from 'react';
import { ModalBody } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import UsagePanel from '@/pageComponents/account/usage/UsagePanel';
import { UsageTabEnum } from '@/pageComponents/account/usage/utils';

const UsageDetailModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [tab, setTab] = useState<UsageTabEnum>(UsageTabEnum.detail);

  return (
    <MyModal
      isOpen={isOpen}
      onClose={onClose}
      size={'lg'}
      maxW={['94vw', '900px']}
      // 鲁港通 - 面板沿用账号页的百分比高度布局，弹窗必须给出确定高度，否则内容区会塌成 0
      h={['88dvh', '80vh']}
      maxH={['92dvh', '85vh']}
      showCloseButton={false}
    >
      <ModalBody p={0} overflowY={'auto'}>
        <UsagePanel tab={tab} onTabChange={setTab} onClose={onClose} />
      </ModalBody>
    </MyModal>
  );
};

export default UsageDetailModal;
