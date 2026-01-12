/**
 * 鲁港通 - 管理员用户管理页面
 * 
 * 功能：
 * - 用户列表展示（分页）
 * - 用户搜索
 * - 用户禁用/启用
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Flex,
  Table,
  TableContainer,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Badge,
  Avatar,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Text,
  HStack,
  IconButton
} from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serviceSideProps } from '@/web/common/i18n/utils';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import MyBox from '@fastgpt/web/components/common/MyBox';
import SearchInput from '@fastgpt/web/components/common/Input/SearchInput';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { AdminUserItem, AdminUsersListResponse } from '@/pages/api/admin/users/list';

const PAGE_SIZE = 20;

const AdminUsersPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { userInfo } = useUserStore();
  const { toast } = useToast();

  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userList, setUserList] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);

  const { isOpen: isStatusModalOpen, onOpen: onStatusModalOpen, onClose: onStatusModalClose } = useDisclosure();

  // 检查管理员权限
  useEffect(() => {
    if (!userInfo) {
      router.replace('/login?lastRoute=/admin/users');
      return;
    }
    const isAdmin = userInfo?.team?.permission?.hasManagePer;
    if (!isAdmin) {
      toast({ status: 'warning', title: '您没有管理员权限' });
      router.replace('/chat');
    }
  }, [userInfo, router, toast]);


  // 获取用户列表
  const { runAsync: fetchUsers, loading: loadingUsers } = useRequest2(
    async (page: number = 1, search: string = '') => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search
      });
      const response = await fetch(`/api/admin/users/list?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data: AdminUsersListResponse = await response.json();
      return data;
    },
    {
      onSuccess: (data) => {
        setUserList(data.list);
        setTotal(data.total);
        setCurrentPage(data.page);
      },
      onError: (error) => {
        toast({ status: 'error', title: '获取用户列表失败' });
      }
    }
  );

  // 更新用户状态
  const { runAsync: updateUserStatus, loading: updatingStatus } = useRequest2(
    async (userId: string, status: 'active' | 'forbidden') => {
      const response = await fetch('/api/admin/users/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user status');
      }
      return response.json();
    },
    {
      onSuccess: () => {
        toast({ status: 'success', title: '用户状态更新成功' });
        onStatusModalClose();
        fetchUsers(currentPage, searchText);
      },
      onError: (error: any) => {
        toast({ status: 'error', title: error.message || '更新用户状态失败' });
      }
    }
  );

  // 初始加载
  useEffect(() => {
    if (userInfo?.team?.permission?.hasManagePer) {
      fetchUsers(1, '');
    }
  }, [userInfo]);

  // 搜索处理
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    fetchUsers(1, searchText);
  }, [searchText, fetchUsers]);

  // 分页处理
  const handlePageChange = useCallback((page: number) => {
    fetchUsers(page, searchText);
  }, [searchText, fetchUsers]);

  // 打开状态修改确认框
  const handleStatusClick = useCallback((user: AdminUserItem) => {
    setSelectedUser(user);
    onStatusModalOpen();
  }, [onStatusModalOpen]);

  // 确认修改状态
  const handleConfirmStatusChange = useCallback(() => {
    if (!selectedUser) return;
    const newStatus = selectedUser.status === 'active' ? 'forbidden' : 'active';
    updateUserStatus(selectedUser._id, newStatus);
  }, [selectedUser, updateUserStatus]);

  // 格式化日期
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);


  return (
    <MyBox h="100%" p={6} bg="white">
      {/* 页面标题和搜索 */}
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Text fontSize="xl" fontWeight="bold" color="myGray.900">
            用户管理
          </Text>
          <Text fontSize="sm" color="myGray.500" mt={1}>
            共 {total} 位用户
          </Text>
        </Box>
        <HStack spacing={3}>
          <SearchInput
            placeholder="搜索用户名..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            w="280px"
          />
          <Button
            colorScheme="blue"
            size="sm"
            onClick={handleSearch}
            isLoading={loadingUsers}
          >
            搜索
          </Button>
        </HStack>
      </Flex>

      {/* 用户列表表格 */}
      <TableContainer fontSize="sm" flex={1}>
        <Table variant="simple">
          <Thead bg="myGray.50">
            <Tr>
              <Th>用户</Th>
              <Th>用户名</Th>
              <Th>团队</Th>
              <Th>状态</Th>
              <Th>注册时间</Th>
              <Th>操作</Th>
            </Tr>
          </Thead>
          <Tbody>
            {userList.map((user) => (
              <Tr key={user._id} _hover={{ bg: 'myGray.25' }}>
                <Td>
                  <Flex align="center" gap={3}>
                    <Avatar
                      size="sm"
                      name={user.memberName || user.username}
                      src={user.avatar}
                    />
                    <Text fontWeight="medium">
                      {user.memberName || user.username}
                    </Text>
                  </Flex>
                </Td>
                <Td color="myGray.600">{user.username}</Td>
                <Td color="myGray.600">{user.teamName || '-'}</Td>
                <Td>
                  <Badge
                    colorScheme={user.status === 'active' ? 'green' : 'red'}
                    variant="subtle"
                    px={2}
                    py={1}
                    borderRadius="md"
                  >
                    {user.status === 'active' ? '正常' : '已禁用'}
                  </Badge>
                </Td>
                <Td color="myGray.500" fontSize="xs">
                  {formatDate(user.createTime)}
                </Td>
                <Td>
                  <Button
                    size="xs"
                    variant={user.status === 'active' ? 'outline' : 'solid'}
                    colorScheme={user.status === 'active' ? 'red' : 'green'}
                    onClick={() => handleStatusClick(user)}
                    isDisabled={user.username === 'root'}
                  >
                    {user.status === 'active' ? '禁用' : '启用'}
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      {/* 空状态 */}
      {!loadingUsers && userList.length === 0 && (
        <EmptyTip text="暂无用户数据" />
      )}


      {/* 分页 */}
      {totalPages > 1 && (
        <Flex justify="center" align="center" mt={6} gap={2}>
          <IconButton
            aria-label="上一页"
            icon={<MyIcon name="common/arrowLeft" w={4} />}
            size="sm"
            variant="ghost"
            isDisabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
          />
          <HStack spacing={1}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  size="sm"
                  variant={currentPage === pageNum ? 'solid' : 'ghost'}
                  colorScheme={currentPage === pageNum ? 'blue' : 'gray'}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </HStack>
          <IconButton
            aria-label="下一页"
            icon={<MyIcon name="common/arrowRight" w={4} />}
            size="sm"
            variant="ghost"
            isDisabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          />
          <Text fontSize="sm" color="myGray.500" ml={2}>
            第 {currentPage} / {totalPages} 页
          </Text>
        </Flex>
      )}

      {/* 状态修改确认框 */}
      <Modal isOpen={isStatusModalOpen} onClose={onStatusModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedUser?.status === 'active' ? '禁用用户' : '启用用户'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              确定要{selectedUser?.status === 'active' ? '禁用' : '启用'}用户{' '}
              <Text as="span" fontWeight="bold">
                {selectedUser?.memberName || selectedUser?.username}
              </Text>{' '}
              吗？
            </Text>
            {selectedUser?.status === 'active' && (
              <Text fontSize="sm" color="myGray.500" mt={2}>
                禁用后，该用户将无法登录系统，同时 One API 账户也会被禁用。
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onStatusModalClose}>
              取消
            </Button>
            <Button
              colorScheme={selectedUser?.status === 'active' ? 'red' : 'green'}
              onClick={handleConfirmStatusChange}
              isLoading={updatingStatus}
            >
              确定{selectedUser?.status === 'active' ? '禁用' : '启用'}
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

export default AdminUsersPage;
