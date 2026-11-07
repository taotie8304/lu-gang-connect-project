import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  type ModalContentProps,
  Box,
  Flex,
  type FlexProps,
  type BoxProps
} from '@chakra-ui/react';
import MyBox from '../../../common/MyBox';
import { useSystem } from '../../../../hooks/useSystem';

export interface MyModalProps extends ModalContentProps {
  title?: any;
  isCentered?: boolean;
  isLoading?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  closeOnOverlayClick?: boolean;
  blockScrollOnMount?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  headerStyles?: FlexProps;
  bodyStyles?: BoxProps;
  footerStyles?: FlexProps;
}

const sizeMap = {
  sm: {
    w: '400px'
  },
  md: {
    w: '560px'
  },
  lg: {
    w: '800px'
  },
  xl: {
    w: '900px'
  }
};

const MyModal = ({
  isOpen = true,
  onClose,
  title,
  children,
  isCentered,
  isLoading,
  closeOnOverlayClick = true,
  blockScrollOnMount = false,
  size = 'sm',
  showCloseButton = true,
  headerStyles,
  bodyStyles,
  footerStyles,
  footer,
  ...props
}: MyModalProps) => {
  const { isPc } = useSystem();

  const sizeData = sizeMap[size] || sizeMap.sm;

  // 鲁港通 - 手机端统一为近全宽卡片：左右各留 4vw、纵向撑满可视高，内容区独立滚动；桌面端保持原样
  const mobileContentProps = isPc
    ? {}
    : {
        w: '92vw',
        maxW: '92vw',
        minH: 0,
        maxH: 'calc(100vh - 16px)'
      };
  // 鲁港通 - 手机端收窄内边距，标题右侧预留关闭按钮空间
  const headerPadding = isPc ? { px: 8, pt: 8, pr: 8 } : { px: 4, pt: 5, pr: 12 };
  const bodyPadding = isPc
    ? { px: 8, pt: title ? 6 : 8, pb: footer ? 6 : 8 }
    : { px: 4, pt: title ? 4 : 5, pb: footer ? 4 : 5 };
  const footerPadding = isPc ? { px: 8, pb: 8 } : { px: 4, pb: 5 };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose?.()}
      size={size}
      autoFocus={false}
      isCentered={isPc ? isCentered : true}
      blockScrollOnMount={isPc ? blockScrollOnMount : true}
      allowPinchZoom
      scrollBehavior={'inside'}
      closeOnOverlayClick={closeOnOverlayClick}
      returnFocusOnClose={false}
    >
      <ModalOverlay zIndex={props.zIndex} />
      <ModalContent
        w={sizeData.w}
        maxW={'90vw'}
        position={'relative'}
        maxH={'80vh'}
        boxShadow={'3.5'}
        px={0}
        py={0}
        display={'flex'}
        flexDirection={'column'}
        containerProps={{
          zIndex: props.zIndex
        }}
        {...props}
        {...mobileContentProps}
      >
        {onClose && showCloseButton && (
          <ModalCloseButton position={'absolute'} fontSize={'xs'} top={3} right={3} />
        )}

        {!!title && (
          <Flex
            alignItems={'center'}
            fontSize={'lg'}
            fontWeight={'500'}
            {...headerPadding}
            pb={0}
            gap={3}
            flexShrink={0}
            {...headerStyles}
          >
            <Box
              color="black"
              fontWeight={'500'}
              fontSize={'20px'}
              lineHeight={'26px'}
              letterSpacing={'0.15px'}
            >
              {title}
            </Box>
          </Flex>
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
          {...bodyPadding}
          fontSize={'14px'}
          lineHeight={'20px'}
          letterSpacing={'0.25px'}
          color={'myGray.900'}
          {...bodyStyles}
        >
          {children}
        </MyBox>

        {!!footer && (
          <Flex
            justifyContent={'flex-end'}
            gap={3}
            {...footerPadding}
            pt={0}
            flexShrink={0}
            fontSize={'12px'}
            lineHeight={'16px'}
            letterSpacing={'0.5px'}
            {...footerStyles}
          >
            {footer}
          </Flex>
        )}
      </ModalContent>
    </Modal>
  );
};

export default React.memo(MyModal);
