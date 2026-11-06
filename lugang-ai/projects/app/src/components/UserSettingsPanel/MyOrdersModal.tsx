// 鲁港通 - 「我的订单」弹窗：在客户端内直接查看账单，不再进入 FastGPT 账号页风格
import React, { useState } from 'react';
import { ModalBody } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import BillPanel from '@/pageComponents/account/bill/BillPanel';
import { InvoiceTabEnum } from '@/pageComponents/account/bill/utils';

const MyOrdersModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [tab, setTab] = useState<InvoiceTabEnum>(InvoiceTabEnum.bill);

  return (
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
        <BillPanel tab={tab} onTabChange={setTab} onClose={onClose} />
      </ModalBody>
    </MyModal>
  );
};

export default MyOrdersModal;
