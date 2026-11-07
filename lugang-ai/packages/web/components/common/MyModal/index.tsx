import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  type ModalContentProps,
  Box,
  type ImageProps
} from '@chakra-ui/react';
import MyBox from '../MyBox';
import { useSystem } from '../../../hooks/useSystem';
import Avatar from '../Avatar';

export interface MyModalProps extends ModalContentProps {
  iconSrc?: string;
  iconColor?: ImageProps['color'];
  title?: any;
  isCentered?: boolean;
  isLoading?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  closeOnOverlayClick?: boolean;
  size?: 'md' | 'lg';
  showCloseButton?: boolean;
}

const MyModal = ({
  isOpen = true,
  onClose,
  iconSrc,
  title,
  children,
  isCentered,
  isLoading,
  w = 'auto',
  maxW = ['90vw', '600px'],
  closeOnOverlayClick = true,
  iconColor,
  size = 'md',
  showCloseButton = true,
  ...props
}: MyModalProps) => {
  const { isPc } = useSystem();

  // 鲁港通 - 手机端统一为近全宽卡片：左右各留 4vw、纵向撑满可视高，内容区独立滚动；桌面端保持原样
  const mobileContentProps = isPc
    ? {}
    : {
        w: '92vw',
        minW: 0,
        maxW: '92vw',
        minH: 0,
        maxH: 'calc(100vh - 16px)'
      };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose && onClose()}
      size={size}
      autoFocus={false}
      isCentered={isPc ? isCentered : true}
      blockScrollOnMount={isPc ? false : true}
      allowPinchZoom
      scrollBehavior={'inside'}
      closeOnOverlayClick={closeOnOverlayClick}
      returnFocusOnClose={false}
    >
      <ModalOverlay zIndex={props.zIndex} />
      <ModalContent
        w={w}
        minW={['90vw', '400px']}
        maxW={maxW}
        position={'relative'}
        maxH={'85vh'}
        boxShadow={'7'}
        containerProps={{
          zIndex: props.zIndex
        }}
        {...props}
        {...mobileContentProps}
      >
        {!title && onClose && showCloseButton && <ModalCloseButton zIndex={1} />}
        {!!title && (
          <ModalHeader
            display={'flex'}
            alignItems={'center'}
            background={'#FBFBFC'}
            borderBottom={'1px solid #F4F6F8'}
            roundedTop={'lg'}
            py={'10px'}
            fontSize={'md'}
            fontWeight={'bold'}
            minH={['46px', '53px']}
            flexShrink={0}
          >
            {iconSrc && (
              <>
                <Avatar
                  color={iconColor}
                  objectFit={'contain'}
                  alt=""
                  src={iconSrc}
                  w={'20px'}
                  borderRadius={'sm'}
                />
              </>
            )}
            <Box ml={iconSrc ? 3 : 0} color={'myGray.900'} fontWeight={'500'}>
              {title}
            </Box>
            <Box flex={1} />
            {onClose && (
              <ModalCloseButton position={'relative'} fontSize={'xs'} top={0} right={0} />
            )}
          </ModalHeader>
        )}

        <MyBox
          isLoading={isLoading}
          overflow={isPc ? props.overflow || 'overlay' : 'hidden'}
          overflowX={isPc ? undefined : 'hidden'}
          overflowY={isPc ? undefined : 'auto'}
          overscrollBehavior={isPc ? undefined : 'contain'}
          h={isPc ? '100%' : 'auto'}
          flex={isPc ? undefined : '1 1 auto'}
          minH={isPc ? undefined : 0}
          display={'flex'}
          flexDirection={'column'}
        >
          {children}
        </MyBox>
      </ModalContent>
    </Modal>
  );
};

export default React.memo(MyModal);
