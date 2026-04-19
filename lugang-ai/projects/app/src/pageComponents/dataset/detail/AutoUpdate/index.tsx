import React, { useState, useMemo } from 'react';
import {
  Box,
  Flex,
  Switch,
  Input,
  Select,
  Button,
  VStack,
  HStack,
  Text,
  useDisclosure
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import MyBox from '@fastgpt/web/components/common/MyBox';
import FormLabel from '@fastgpt/web/components/common/MyBox/FormLabel';
import QuestionTip from '@fastgpt/web/components/common/MyTooltip/QuestionTip';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyDivider from '@fastgpt/web/components/common/MyDivider';
import { useContextSelector } from 'use-context-selector';
import { DatasetPageContext } from '@/web/core/dataset/context/datasetPageContext';
import {
  getAutoUpdateConfig,
  updateAutoUpdateConfig,
  triggerAutoUpdate,
  detectDataset,
  getAutoUpdateHistory
} from '@/web/core/dataset/api/autoUpdate';
import type {
  AutoUpdateConfigType,
  AutoUpdateHistoryType,
  DetectResultType
} from '@/web/core/dataset/type';
import DetectModal from './DetectModal';
import HistoryList from './HistoryList';

// 鲁港通 - 知识库自动更新配置组件
const AutoUpdate = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const { collectionId = '' } = router.query as { collectionId: string };
  const datasetDetail = useContextSelector(DatasetPageContext, (v) => v.datasetDetail);

  const [config, setConfig] = useState<AutoUpdateConfigType>({
    enabled: false,
    source: 'hk-gov-data',
    datasetUrl: '',
    fileFormat: 'csv',
    detection: {
      yearPattern: [],
      checkUpdateTime: true,
      detailPageCheck: false
    }
  });

  const {
    isOpen: isDetectModalOpen,
    onOpen: onDetectModalOpen,
    onClose: onDetectModalClose
  } = useDisclosure();

  const [detectResult, setDetectResult] = useState<DetectResultType | null>(null);

  // 鲁港通 - 加载配置
  const { loading: isLoadingConfig } = useRequest2(
    async () => {
      if (!collectionId) return;
      const data = await getAutoUpdateConfig(collectionId);
      if (data) {
        setConfig(data);
      }
    },
    {
      manual: false,
      refreshDeps: [collectionId]
    }
  );

  // 鲁港通 - 保存配置
  const { runAsync: onSaveConfig, loading: isSaving } = useRequest2(
    async () => {
      await updateAutoUpdateConfig({
        collectionId,
        ...config
      });
    },
    {
      successToast: t('common:update_success'),
      errorToast: t('common:update_failed')
    }
  );

  // 鲁港通 - 手动触发更新
  const { runAsync: onTriggerUpdate, loading: isTriggering } = useRequest2(
    async () => {
      const result = await triggerAutoUpdate(collectionId);
      return result;
    },
    {
      successToast: t('dataset:auto_update_triggered'),
      errorToast: t('dataset:auto_update_trigger_failed')
    }
  );

  // 鲁港通 - 识别数据集
  const { runAsync: onDetect, loading: isDetecting } = useRequest2(
    async () => {
      if (!config.datasetUrl) {
        toast({
          status: 'warning',
          title: t('dataset:please_enter_dataset_url')
        });
        return;
      }
      const result = await detectDataset({
        collectionId,
        datasetUrl: config.datasetUrl
      });
      setDetectResult(result);
      onDetectModalOpen();
    },
    {
      errorToast: t('dataset:detect_failed')
    }
  );

  const canWrite = useMemo(
    () => datasetDetail.permission.hasWritePer,
    [datasetDetail.permission]
  );

  const isLoading = isLoadingConfig || isSaving || isTriggering || isDetecting;

  return (
    <MyBox isLoading={isLoading} h={'100%'} py={[2, 4]}>
      <Flex flexDirection={'column'} h={'100%'} px={[2, 6]}>
        <VStack align="stretch" spacing={5}>
          {/* 鲁港通 - 启用/禁用开关 */}
          <Flex alignItems={'center'}>
            <FormLabel fontSize={'sm'} fontWeight={'500'}>
              {t('dataset:enable_auto_update')}
            </FormLabel>
            <QuestionTip ml={1} label={t('dataset:auto_update_tip')} />
            <Box flex={1} />
            <Switch
              isChecked={config.enabled}
              isDisabled={!canWrite}
              onChange={(e) => {
                const newConfig = { ...config, enabled: e.target.checked };
                setConfig(newConfig);
              }}
            />
          </Flex>

          {config.enabled && (
            <>
              <MyDivider />

              {/* 鲁港通 - 数据源 URL */}
              <Box>
                <FormLabel fontSize={'sm'} fontWeight={'500'} mb={2}>
                  {t('dataset:dataset_url')}
                </FormLabel>
                <HStack>
                  <Input
                    fontSize={'sm'}
                    placeholder="https://data.gov.hk/..."
                    value={config.datasetUrl}
                    isDisabled={!canWrite}
                    onChange={(e) => {
                      setConfig({ ...config, datasetUrl: e.target.value });
                    }}
                  />
                  <Button
                    variant={'whitePrimary'}
                    size={'sm'}
                    isDisabled={!canWrite || !config.datasetUrl}
                    onClick={onDetect}
                  >
                    <MyIcon name={'common/searchLight'} w={'14px'} mr={1} />
                    {t('dataset:detect')}
                  </Button>
                </HStack>
              </Box>

              {/* 鲁港通 - 文件格式 */}
              <Box>
                <FormLabel fontSize={'sm'} fontWeight={'500'} mb={2}>
                  {t('dataset:file_format')}
                </FormLabel>
                <Select
                  fontSize={'sm'}
                  value={config.fileFormat}
                  isDisabled={!canWrite}
                  onChange={(e) => {
                    setConfig({ ...config, fileFormat: e.target.value as any });
                  }}
                >
                  <option value="csv">CSV</option>
                  <option value="xlsx">XLSX</option>
                  <option value="xml">XML</option>
                  <option value="api">API</option>
                </Select>
              </Box>

              {/* 鲁港通 - 检测策略 */}
              <Box>
                <FormLabel fontSize={'sm'} fontWeight={'500'} mb={2}>
                  {t('dataset:detection_strategy')}
                </FormLabel>
                <VStack align="stretch" spacing={2}>
                  <Flex alignItems={'center'}>
                    <Switch
                      size={'sm'}
                      isChecked={config.detection.checkUpdateTime}
                      isDisabled={!canWrite}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          detection: {
                            ...config.detection,
                            checkUpdateTime: e.target.checked
                          }
                        });
                      }}
                    />
                    <Text fontSize={'sm'} ml={2}>
                      {t('dataset:check_update_time')}
                    </Text>
                  </Flex>
                  <Flex alignItems={'center'}>
                    <Switch
                      size={'sm'}
                      isChecked={config.detection.detailPageCheck}
                      isDisabled={!canWrite}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          detection: {
                            ...config.detection,
                            detailPageCheck: e.target.checked
                          }
                        });
                      }}
                    />
                    <Text fontSize={'sm'} ml={2}>
                      {t('dataset:detail_page_check')}
                    </Text>
                  </Flex>
                </VStack>
              </Box>

              <MyDivider />

              {/* 鲁港通 - 操作按钮 */}
              <HStack>
                <Button
                  variant={'primary'}
                  size={'sm'}
                  isDisabled={!canWrite}
                  onClick={onSaveConfig}
                >
                  {t('common:Save')}
                </Button>
                <Button
                  variant={'whitePrimary'}
                  size={'sm'}
                  isDisabled={!canWrite || !config.enabled}
                  onClick={onTriggerUpdate}
                >
                  <MyIcon name={'common/refreshLight'} w={'14px'} mr={1} />
                  {t('dataset:trigger_update_now')}
                </Button>
              </HStack>

              <MyDivider />

              {/* 鲁港通 - 更新历史 */}
              <HistoryList collectionId={collectionId} />
            </>
          )}
        </VStack>
      </Flex>

      {/* 鲁港通 - 识别结果弹窗 */}
      {detectResult && (
        <DetectModal
          isOpen={isDetectModalOpen}
          onClose={onDetectModalClose}
          detectResult={detectResult}
          onSelectFile={(file) => {
            // 鲁港通 - 用户选择文件或 API 后，更新配置
            if (file.format === 'api' && detectResult.apiInfo) {
              // API 类型 - 同时更新 datasetUrl 和 api 配置
              setConfig({
                ...config,
                datasetUrl: detectResult.apiInfo.endpoint, // 鲁港通 - 填入 API 地址到 datasetUrl
                fileFormat: 'api',
                api: {
                  endpoint: detectResult.apiInfo.endpoint,
                  method: 'GET',
                  format: detectResult.apiInfo.format || 'json',
                  cacheKey: detectResult.apiInfo.cacheKey
                }
              });
            } else {
              // 文件类型
              setConfig({
                ...config,
                datasetUrl: file.fileUrl,
                fileFormat: file.format as any
              });
            }
            onDetectModalClose();
          }}
        />
      )}
    </MyBox>
  );
};

export default React.memo(AutoUpdate);
