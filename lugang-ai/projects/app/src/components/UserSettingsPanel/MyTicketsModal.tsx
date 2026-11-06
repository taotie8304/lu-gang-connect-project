// 鲁港通 - 「工单反馈」弹窗：在客户端内直接查看与提交工单，不再进入 FastGPT 账号页风格
import React from 'react';
import { ModalBody } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import MyTicketsPanel from '@/pageComponents/account/myTickets/MyTicketsPanel';

const MyTicketsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <MyModal
    isOpen={isOpen}
    onClose={onClose}
    size={'lg'}
    maxW={['94vw', '860px']}
    // 鲁港通 - 面板沿用账号页的百分比高度布局，弹窗必须给出确定高度，否则内容区会塌成 0
    h={['88dvh', '80vh']}
    maxH={['92dvh', '85vh']}
    showCloseButton={false}
  >
    <ModalBody p={0} overflowY={'auto'}>
      <MyTicketsPanel onClose={onClose} />
    </ModalBody>
  </MyModal>
);

export default MyTicketsModal;
