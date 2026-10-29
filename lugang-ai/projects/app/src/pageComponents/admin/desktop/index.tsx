'use client';
/**
 * 鲁港通 - 桌面客户端管理页（仅 root）
 *
 * 三块：AI 操控开关（保存即生效）、全部桌面设备（可强制解绑）、崩溃报告（可展开堆栈）。
 * 守卫口径与后端 isRoot 一致（username === 'root'），接口侧同时校验。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Flex, Textarea } from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyBox from '@fastgpt/web/components/common/MyBox';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import FillRowTabs from '@fastgpt/web/components/common/Tabs/FillRowTabs';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import type {
  DesktopCrashReportType,
  DesktopDeviceView,
  DesktopSwitchMode
} from '@fastgpt/global/support/desktopCommand/type';
import {
  getAdminDesktopCrashReports,
  getAdminDesktopDevices,
  getDesktopSwitchState,
  unbindAdminDesktopDevice,
  updateDesktopSwitchState
} from '@/web/support/desktop/api';
import {
  accountContentScrollStyles,
  accountPageRootStyles,
  accountTitleTextStyles
} from '@/pageComponents/account/styles';

const formatTime = (timestamp?: number) =>
  timestamp ? new Date(timestamp).toLocaleString() : '—';

const crashTypeKeys: Record<DesktopCrashReportType, string> = {
  'uncaught-exception': 'common:desktop_admin.crash_type_uncaught_exception',
  'unhandled-rejection': 'common:desktop_admin.crash_type_unhandled_rejection',
  'renderer-crash': 'common:desktop_admin.crash_type_renderer_crash',
  manual: 'common:desktop_admin.crash_type_manual'
};

const SectionCard = ({
  title,
  desc,
  action,
  children
}: {
  title: string;
  desc: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Flex
    flexDirection={'column'}
    gap={3}
    bg={'white'}
    border={'1px solid'}
    borderColor={'myGray.200'}
    borderRadius={'xl'}
    p={[4, 5]}
  >
    <Flex alignItems={'flex-start'} gap={3} flexWrap={'wrap'}>
      <Box flex={1} minW={0}>
        <Box fontSize={'md'} fontWeight={600} color={'myGray.900'}>
          {title}
        </Box>
        <Box mt={1} fontSize={'xs'} color={'myGray.500'}>
          {desc}
        </Box>
      </Box>
      {action}
    </Flex>
    {children}
  </Flex>
);

const AdminDesktop = () => {
  const { t } = useClientTranslation();
  const { toast } = useToast();
  const { openConfirm, ConfirmModal } = useConfirm({ type: 'delete' });

  // 鲁港通 - AI 操控开关：先读数据库配置，未保存过则显示环境变量灰度值
  const {
    data: switchState,
    loading: switchLoading,
    refresh: refreshSwitch
  } = useRequest(getDesktopSwitchState, { manual: false, errorToast: '' });
  const [mode, setMode] = useState<DesktopSwitchMode>('all');
  const [accountsText, setAccountsText] = useState('');
  useEffect(() => {
    if (!switchState) return;
    setMode(switchState.mode);
    setAccountsText(switchState.accounts.join('\n'));
  }, [switchState]);

  const { runAsync: saveSwitch, loading: savingSwitch } = useRequest(
    updateDesktopSwitchState,
    { manual: true, errorToast: '' }
  );
  const handleSaveSwitch = useCallback(async () => {
    const accounts = accountsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (mode === 'list' && accounts.length === 0) {
      toast({ status: 'warning', title: t('common:desktop_admin.switch_accounts_required') });
      return;
    }
    try {
      await saveSwitch({ mode, accounts: mode === 'list' ? accounts : [] });
      toast({ status: 'success', title: t('common:desktop_admin.switch_saved') });
      refreshSwitch();
    } catch {
      // 服务端错误已由请求层提示，这里不重复弹窗
    }
  }, [accountsText, mode, refreshSwitch, saveSwitch, t, toast]);

  const modeOptions = useMemo(
    () => [
      { label: t('common:desktop_admin.switch_mode_off'), value: 'off' },
      { label: t('common:desktop_admin.switch_mode_all'), value: 'all' },
      { label: t('common:desktop_admin.switch_mode_list'), value: 'list' }
    ],
    [t]
  );

  // 鲁港通 - 设备列表：全部账号绑定的桌面客户端
  const {
    data: deviceData,
    loading: devicesLoading,
    refresh: refreshDevices
  } = useRequest(getAdminDesktopDevices, { manual: false, errorToast: '' });
  const devices = deviceData?.devices ?? [];

  // 鲁港通 - 崩溃报告：最近 50 条，逐条展开堆栈与日志
  const {
    data: crashData,
    loading: crashesLoading,
    refresh: refreshCrashes
  } = useRequest(getAdminDesktopCrashReports, { manual: false, errorToast: '' });
  const crashes = crashData?.reports ?? [];
  const [expandedCrashId, setExpandedCrashId] = useState<string | null>(null);

  const confirmUnbind = useCallback(
    (device: DesktopDeviceView) => {
      openConfirm({
        customContent: t('common:desktop_admin.unbind_confirm'),
        onConfirm: async () => {
          await unbindAdminDesktopDevice(device.deviceId);
          toast({ status: 'success', title: t('common:desktop_admin.device_unbound') });
          refreshDevices();
        }
      })();
    },
    [openConfirm, refreshDevices, t, toast]
  );

  const deviceRow = (device: DesktopDeviceView) => (
    <Flex
      key={device.deviceId}
      alignItems={'center'}
      gap={3}
      flexWrap={'wrap'}
      px={4}
      py={3}
      borderRadius={'lg'}
      border={'1px solid'}
      borderColor={'myGray.200'}
      bg={'white'}
    >
      <Flex alignItems={'center'} gap={2} minW={0} flex={1}>
        <MyIcon name={'core/chat/monitor'} w={'18px'} color={'myGray.600'} />
        <Box fontSize={'sm'} fontWeight={500} color={'myGray.900'} noOfLines={1}>
          {device.deviceName || t('common:desktop_admin.device_unnamed')}
        </Box>
        <Flex alignItems={'center'} gap={1} fontSize={'xs'} color={'myGray.500'}>
          <Box
            w={'8px'}
            h={'8px'}
            borderRadius={'full'}
            bg={device.online ? 'green.500' : 'myGray.300'}
          />
          {device.online
            ? t('common:desktop_admin.device_online')
            : t('common:desktop_admin.device_offline')}
        </Flex>
      </Flex>
      <Box fontSize={'xs'} color={'myGray.500'} minW={'120px'}>
        {device.memberName || t('common:desktop_admin.member_unknown')}
      </Box>
      <Box fontSize={'xs'} color={'myGray.500'} minW={'60px'}>
        v{device.appVersion || '—'}
      </Box>
      <Box fontSize={'xs'} color={'myGray.500'} minW={'170px'}>
        {t('common:desktop_admin.device_registered', { time: formatTime(device.registeredAt) })}
      </Box>
      <Button size={'xs'} variant={'whiteDanger'} onClick={() => confirmUnbind(device)}>
        {t('common:desktop_admin.device_unbind')}
      </Button>
    </Flex>
  );

  const crashRow = (report: (typeof crashes)[number]) => {
    const expanded = expandedCrashId === report.id;
    return (
      <Flex
        key={report.id}
        flexDirection={'column'}
        gap={2}
        px={4}
        py={3}
        borderRadius={'lg'}
        border={'1px solid'}
        borderColor={expanded ? 'primary.300' : 'myGray.200'}
        bg={'white'}
        cursor={'pointer'}
        _hover={{ borderColor: 'primary.300' }}
        onClick={() => setExpandedCrashId(expanded ? null : report.id)}
      >
        <Flex alignItems={'center'} gap={3} flexWrap={'wrap'} fontSize={'xs'} color={'myGray.500'}>
          <Box color={'myGray.900'} fontWeight={500} fontSize={'sm'}>
            {t(crashTypeKeys[report.type] as any)}
          </Box>
          <Box>{formatTime(report.occurredAt)}</Box>
          <Box>
            {report.memberName || t('common:desktop_admin.member_unknown')} ·{' '}
            {report.deviceName || t('common:desktop_admin.device_unnamed')}
          </Box>
          <Box>v{report.appVersion || '—'}</Box>
          <Box flex={1} />
          <MyIcon
            name={'common/downArrowFill'}
            w={'12px'}
            color={'myGray.400'}
            transform={expanded ? 'rotate(180deg)' : undefined}
          />
        </Flex>
        <Box
          fontSize={'sm'}
          color={'myGray.800'}
          whiteSpace={expanded ? 'pre-wrap' : 'normal'}
          noOfLines={expanded ? undefined : 2}
          wordBreak={'break-all'}
        >
          {report.message}
        </Box>
        {expanded && (
          <Box mt={1}>
            {report.stack && (
              <Box mb={2}>
                <Box fontSize={'xs'} fontWeight={600} color={'myGray.600'} mb={1}>
                  {t('common:desktop_admin.crash_stack')}
                </Box>
                <Box
                  as={'pre'}
                  p={3}
                  borderRadius={'md'}
                  bg={'myGray.50'}
                  fontSize={'xs'}
                  color={'myGray.700'}
                  whiteSpace={'pre-wrap'}
                  wordBreak={'break-all'}
                  maxH={'240px'}
                  overflowY={'auto'}
                >
                  {report.stack}
                </Box>
              </Box>
            )}
            {report.log && (
              <Box>
                <Box fontSize={'xs'} fontWeight={600} color={'myGray.600'} mb={1}>
                  {t('common:desktop_admin.crash_log')}
                </Box>
                <Box
                  as={'pre'}
                  p={3}
                  borderRadius={'md'}
                  bg={'myGray.50'}
                  fontSize={'xs'}
                  color={'myGray.700'}
                  whiteSpace={'pre-wrap'}
                  wordBreak={'break-all'}
                  maxH={'240px'}
                  overflowY={'auto'}
                >
                  {report.log}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Flex>
    );
  };

  return (
    <Flex {...accountPageRootStyles} flexDirection={'column'}>
      <Flex
        h={['56px', '64px']}
        flexShrink={0}
        px={[4, 6]}
        alignItems={'center'}
        gap={3}
        borderBottom={'1px solid'}
        borderColor={'myGray.200'}
      >
        <Box as={'h1'} {...accountTitleTextStyles}>
          {t('common:desktop_admin.page_title')}
        </Box>
      </Flex>

      <Box px={[4, 6]} py={[4, 6]} {...accountContentScrollStyles}>
        <Flex flexDirection={'column'} gap={4} pb={4}>
          {/* AI 操控开关 */}
          <SectionCard
            title={t('common:desktop_admin.switch_title')}
            desc={t('common:desktop_admin.switch_desc')}
          >
            <MyBox isLoading={switchLoading} minH={'40px'}>
              <FillRowTabs
                size={'sm'}
                w={['100%', 'auto']}
                alignSelf={['stretch', 'flex-start']}
                list={modeOptions}
                value={mode}
                onChange={(value) => setMode(value as DesktopSwitchMode)}
              />
              {mode === 'list' && (
                <Box mt={3}>
                  <Box fontSize={'xs'} color={'myGray.600'} mb={1}>
                    {t('common:desktop_admin.switch_accounts_label')}
                  </Box>
                  <Textarea
                    rows={4}
                    fontSize={'sm'}
                    bg={'white'}
                    value={accountsText}
                    placeholder={t('common:desktop_admin.switch_accounts_placeholder')}
                    onChange={(event) => setAccountsText(event.target.value)}
                  />
                </Box>
              )}
              <Flex alignItems={'center'} gap={3} mt={3} flexWrap={'wrap'}>
                <Button size={'sm'} isLoading={savingSwitch} onClick={handleSaveSwitch}>
                  {t('common:desktop_admin.switch_save')}
                </Button>
                {switchState && (
                  <Box fontSize={'xs'} color={'myGray.500'}>
                    {switchState.source === 'database'
                      ? t('common:desktop_admin.switch_source_database')
                      : t('common:desktop_admin.switch_source_env')}
                    {switchState.updatedAt
                      ? ` · ${t('common:desktop_admin.switch_updated', {
                          time: formatTime(switchState.updatedAt)
                        })}`
                      : ''}
                  </Box>
                )}
              </Flex>
            </MyBox>
          </SectionCard>

          {/* 桌面设备 */}
          <SectionCard
            title={t('common:desktop_admin.devices_title')}
            desc={t('common:desktop_admin.devices_desc')}
            action={
              <Button
                size={'xs'}
                variant={'whiteBase'}
                leftIcon={<MyIcon name={'common/refresh'} w={'14px'} />}
                isLoading={devicesLoading}
                onClick={() => refreshDevices()}
              >
                {t('common:desktop_admin.refresh')}
              </Button>
            }
          >
            <MyBox isLoading={devicesLoading} minH={'40px'}>
              {devices.length === 0 && !devicesLoading ? (
                <EmptyTip text={t('common:desktop_admin.devices_empty')} />
              ) : (
                <Flex flexDirection={'column'} gap={2}>
                  {devices.map(deviceRow)}
                </Flex>
              )}
            </MyBox>
          </SectionCard>

          {/* 崩溃报告 */}
          <SectionCard
            title={t('common:desktop_admin.crashes_title')}
            desc={t('common:desktop_admin.crashes_desc')}
            action={
              <Button
                size={'xs'}
                variant={'whiteBase'}
                leftIcon={<MyIcon name={'common/refresh'} w={'14px'} />}
                isLoading={crashesLoading}
                onClick={() => refreshCrashes()}
              >
                {t('common:desktop_admin.refresh')}
              </Button>
            }
          >
            <MyBox isLoading={crashesLoading} minH={'40px'}>
              {crashes.length === 0 && !crashesLoading ? (
                <EmptyTip text={t('common:desktop_admin.crashes_empty')} />
              ) : (
                <Flex flexDirection={'column'} gap={2}>
                  {crashes.map(crashRow)}
                </Flex>
              )}
            </MyBox>
          </SectionCard>
        </Flex>
      </Box>

      <ConfirmModal />
    </Flex>
  );
};

export default AdminDesktop;
