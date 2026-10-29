// 鲁港通 - 「我的设备」弹窗：查看当前账号绑定的桌面客户端并解绑
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, ModalBody, Text } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyBox from '@fastgpt/web/components/common/MyBox';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import { useToast } from '@fastgpt/web/hooks/useToast';
import type { DesktopDeviceView } from '@fastgpt/global/support/desktopCommand/type';
import { getMyDesktopDevices, unbindMyDesktopDevice } from '@/web/support/desktop/api';

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
};

const DeviceRow = ({
  device,
  onUnbind
}: {
  device: DesktopDeviceView;
  onUnbind: (device: DesktopDeviceView) => void;
}) => {
  const { t } = useClientTranslation();

  return (
    <Flex
      alignItems={'center'}
      gap={3}
      px={4}
      py={3}
      borderRadius={'lg'}
      border={'1px solid'}
      borderColor={'myGray.200'}
      bg={'white'}
    >
      <Flex
        alignItems={'center'}
        justifyContent={'center'}
        w={'36px'}
        h={'36px'}
        borderRadius={'md'}
        bg={'primary.50'}
        color={'primary.600'}
        flexShrink={0}
      >
        <MyIcon name={'core/chat/monitor'} w={'20px'} h={'20px'} />
      </Flex>
      <Box flex={1} minW={0}>
        <Flex alignItems={'center'} gap={2}>
          <Box fontSize={'sm'} fontWeight={500} color={'myGray.900'} noOfLines={1}>
            {device.deviceName || t('common:desktop_admin.device_unnamed')}
          </Box>
          <Flex alignItems={'center'} gap={1} flexShrink={0}>
            <Box
              w={'6px'}
              h={'6px'}
              borderRadius={'full'}
              bg={device.online ? 'green.500' : 'myGray.300'}
            />
            <Box fontSize={'xs'} color={device.online ? 'green.600' : 'myGray.500'}>
              {device.online
                ? t('common:desktop_admin.device_online')
                : t('common:desktop_admin.device_offline')}
            </Box>
          </Flex>
        </Flex>
        <Flex mt={1} fontSize={'xs'} color={'myGray.500'} gap={3} flexWrap={'wrap'}>
          {device.appVersion && <Box>v{device.appVersion}</Box>}
          <Box>
            {t('common:desktop_admin.device_registered', {
              time: formatTime(device.registeredAt)
            })}
          </Box>
        </Flex>
      </Box>
      <Button size={'xs'} variant={'whiteDanger'} flexShrink={0} onClick={() => onUnbind(device)}>
        {t('common:desktop_admin.device_unbind')}
      </Button>
    </Flex>
  );
};

/** 设置面板「我的设备」：列出当前账号已绑定的桌面客户端，支持逐个解绑 */
const MyDevicesModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useClientTranslation();
  const { toast } = useToast();

  const { data, loading, run } = useRequest(getMyDesktopDevices, {
    manual: true,
    errorToast: ''
  });
  const devices = data?.devices ?? [];

  // 每次打开都拉一次最新设备状态
  useEffect(() => {
    if (isOpen) run();
  }, [isOpen, run]);

  const { openConfirm, ConfirmModal } = useConfirm({
    type: 'delete',
    content: t('common:desktop_admin.unbind_confirm')
  });

  const handleUnbind = useCallback(
    (device: DesktopDeviceView) => {
      openConfirm({
        onConfirm: async () => {
          await unbindMyDesktopDevice(device.deviceId);
          toast({ status: 'success', title: t('common:desktop_admin.device_unbound') });
          run();
        }
      })();
    },
    [openConfirm, run, t, toast]
  );

  return (
    <>
      <MyModal
        isOpen={isOpen}
        onClose={onClose}
        title={t('common:user_settings.my_devices')}
        size="md"
      >
        <ModalBody py={4}>
          <Text fontSize={'xs'} color={'myGray.500'} mb={3}>
            {t('common:user_settings.devices_hint')}
          </Text>
          <MyBox isLoading={loading} minH={'80px'}>
            {devices.length === 0 && !loading ? (
              <EmptyTip text={t('common:desktop_admin.devices_empty')} />
            ) : (
              <Flex flexDirection={'column'} gap={2}>
                {devices.map((device) => (
                  <DeviceRow key={device.deviceId} device={device} onUnbind={handleUnbind} />
                ))}
              </Flex>
            )}
          </MyBox>
        </ModalBody>
      </MyModal>
      <ConfirmModal />
    </>
  );
};

export default MyDevicesModal;
