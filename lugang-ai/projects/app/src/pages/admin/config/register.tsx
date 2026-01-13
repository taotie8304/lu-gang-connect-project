/**
 * 鲁港通 - 注册配置管理页面
 * 
 * 功能：
 * - 邮箱注册开关
 * - SMTP 配置
 * - 配置即时生效
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Switch,
  Input,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  VStack,
  Divider,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  InputGroup,
  InputRightElement,
  IconButton,
  Badge
} from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serviceSideProps } from '@/web/common/i18n/utils';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import MyBox from '@fastgpt/web/components/common/MyBox';
import MyIcon from '@fastgpt/web/components/common/Icon';

// 配置类型
interface RegisterConfig {
  emailRegisterEnabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
}

const defaultConfig: RegisterConfig = {
  emailRegisterEnabled: true,
  smtp: {
    host: '',
    port: 465,
    secure: true,
    user: '',
    pass: '',
    from: ''
  }
};

const AdminRegisterConfigPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { userInfo } = useUserStore();
  const { toast } = useToast();

  const [config, setConfig] = useState<RegisterConfig>(defaultConfig);
  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { isOpen: isTestModalOpen, onOpen: onTestModalOpen, onClose: onTestModalClose } = useDisclosure();
  const [testEmail, setTestEmail] = useState('');


  // 检查管理员权限
  useEffect(() => {
    if (!userInfo) {
      router.replace('/login?lastRoute=/admin/config/register');
      return;
    }
    const isAdmin = userInfo?.team?.permission?.hasManagePer;
    if (!isAdmin) {
      toast({ status: 'warning', title: '您没有管理员权限' });
      router.replace('/chat');
    }
  }, [userInfo, router, toast]);

  // 获取配置
  const { runAsync: fetchConfig, loading: loadingConfig } = useRequest2(
    async () => {
      const response = await fetch('/api/admin/config/register');
      if (!response.ok) {
        throw new Error('Failed to fetch config');
      }
      return response.json();
    },
    {
      onSuccess: (data) => {
        if (data) {
          setConfig(data);
        }
      },
      onError: () => {
        toast({ status: 'error', title: '获取配置失败' });
      }
    }
  );

  // 保存配置
  const { runAsync: saveConfig, loading: savingConfig } = useRequest2(
    async (newConfig: RegisterConfig) => {
      const response = await fetch('/api/admin/config/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save config');
      }
      return response.json();
    },
    {
      onSuccess: () => {
        toast({ status: 'success', title: '配置保存成功' });
        setHasChanges(false);
      },
      onError: (error: any) => {
        toast({ status: 'error', title: error.message || '保存配置失败' });
      }
    }
  );

  // 测试邮件发送
  const { runAsync: sendTestEmail, loading: sendingTest } = useRequest2(
    async (email: string) => {
      const response = await fetch('/api/admin/config/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, smtp: config.smtp })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send test email');
      }
      return response.json();
    },
    {
      onSuccess: () => {
        toast({ status: 'success', title: '测试邮件发送成功' });
        onTestModalClose();
        setTestEmail('');
      },
      onError: (error: any) => {
        toast({ status: 'error', title: error.message || '发送测试邮件失败' });
      }
    }
  );

  // 初始加载
  useEffect(() => {
    if (userInfo?.team?.permission?.hasManagePer) {
      fetchConfig();
    }
  }, [userInfo]);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<RegisterConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // 更新 SMTP 配置
  const updateSmtp = useCallback((updates: Partial<RegisterConfig['smtp']>) => {
    setConfig(prev => ({
      ...prev,
      smtp: { ...prev.smtp, ...updates }
    }));
    setHasChanges(true);
  }, []);

  // 保存处理
  const handleSave = useCallback(() => {
    saveConfig(config);
  }, [config, saveConfig]);

  // 测试邮件处理
  const handleTestEmail = useCallback(() => {
    if (!testEmail) {
      toast({ status: 'warning', title: '请输入测试邮箱地址' });
      return;
    }
    sendTestEmail(testEmail);
  }, [testEmail, sendTestEmail, toast]);


  return (
    <MyBox h="100%" p={6} bg="white" overflow="auto">
      {/* 页面标题 */}
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Text fontSize="xl" fontWeight="bold" color="myGray.900">
            注册配置
          </Text>
          <Text fontSize="sm" color="myGray.500" mt={1}>
            管理用户注册方式和邮箱验证配置
          </Text>
        </Box>
        <Flex gap={3}>
          {hasChanges && (
            <Badge colorScheme="orange" variant="subtle" px={2} py={1}>
              有未保存的更改
            </Badge>
          )}
          <Button
            colorScheme="blue"
            onClick={handleSave}
            isLoading={savingConfig}
            isDisabled={!hasChanges}
          >
            保存配置
          </Button>
        </Flex>
      </Flex>

      <VStack spacing={6} align="stretch">
        {/* 邮箱注册开关 */}
        <Box p={5} borderWidth="1px" borderRadius="lg" borderColor="myGray.200">
          <Flex justify="space-between" align="center">
            <Box>
              <Text fontWeight="medium" color="myGray.900">
                邮箱注册
              </Text>
              <Text fontSize="sm" color="myGray.500" mt={1}>
                允许用户通过邮箱注册账户
              </Text>
            </Box>
            <Switch
              colorScheme="blue"
              size="lg"
              isChecked={config.emailRegisterEnabled}
              onChange={(e) => updateConfig({ emailRegisterEnabled: e.target.checked })}
            />
          </Flex>
        </Box>

        <Divider />

        {/* SMTP 配置 */}
        <Box p={5} borderWidth="1px" borderRadius="lg" borderColor="myGray.200">
          <Flex justify="space-between" align="center" mb={4}>
            <Box>
              <Text fontWeight="medium" color="myGray.900">
                SMTP 邮件服务配置
              </Text>
              <Text fontSize="sm" color="myGray.500" mt={1}>
                用于发送验证码邮件
              </Text>
            </Box>
            <Button
              size="sm"
              variant="outline"
              colorScheme="blue"
              onClick={onTestModalOpen}
              isDisabled={!config.smtp.host || !config.smtp.user}
            >
              发送测试邮件
            </Button>
          </Flex>

          <VStack spacing={4} align="stretch">
            <Flex gap={4}>
              <FormControl flex={2}>
                <FormLabel fontSize="sm">SMTP 服务器</FormLabel>
                <Input
                  placeholder="smtp.example.com"
                  value={config.smtp.host}
                  onChange={(e) => updateSmtp({ host: e.target.value })}
                />
              </FormControl>
              <FormControl flex={1}>
                <FormLabel fontSize="sm">端口</FormLabel>
                <Input
                  type="number"
                  placeholder="465"
                  value={config.smtp.port}
                  onChange={(e) => updateSmtp({ port: parseInt(e.target.value) || 465 })}
                />
              </FormControl>
            </Flex>

            <FormControl>
              <Flex align="center" gap={2}>
                <Switch
                  colorScheme="blue"
                  isChecked={config.smtp.secure}
                  onChange={(e) => updateSmtp({ secure: e.target.checked })}
                />
                <FormLabel mb={0} fontSize="sm">使用 SSL/TLS 加密</FormLabel>
              </Flex>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">SMTP 用户名</FormLabel>
              <Input
                placeholder="your-email@example.com"
                value={config.smtp.user}
                onChange={(e) => updateSmtp({ user: e.target.value })}
              />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">SMTP 密码</FormLabel>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="SMTP 密码或授权码"
                  value={config.smtp.pass}
                  onChange={(e) => updateSmtp({ pass: e.target.value })}
                />
                <InputRightElement>
                  <IconButton
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    icon={<MyIcon name={showPassword ? 'core/chat/eyeClose' : 'core/chat/eyeOpen'} w={4} />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </InputRightElement>
              </InputGroup>
              <FormHelperText>部分邮箱服务需要使用授权码而非密码</FormHelperText>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">发件人地址</FormLabel>
              <Input
                placeholder="noreply@example.com"
                value={config.smtp.from}
                onChange={(e) => updateSmtp({ from: e.target.value })}
              />
              <FormHelperText>显示在收件人邮箱中的发件人地址</FormHelperText>
            </FormControl>
          </VStack>
        </Box>
      </VStack>


      {/* 测试邮件弹窗 */}
      <Modal isOpen={isTestModalOpen} onClose={onTestModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>发送测试邮件</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>收件人邮箱</FormLabel>
              <Input
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <FormHelperText>
                将发送一封测试邮件到此地址，用于验证 SMTP 配置是否正确
              </FormHelperText>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onTestModalClose}>
              取消
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleTestEmail}
              isLoading={sendingTest}
            >
              发送测试
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </MyBox>
  );
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      ...(await serviceSideProps(context, ['app', 'user']))
    }
  };
}

export default AdminRegisterConfigPage;
