/**
 * 鲁港通 - 管理员用户管理页面
 *
 * 功能：
 * - 用户列表展示（分页）
 * - 用户搜索
 * - 用户禁用/启用
 * - 用户详情查看与信息/密码修改（AdminUserDetailModal）
 *
 * 适配 4.16.2：useRequest2 → useRequest（默认 manual）；裸 fetch → GET/POST/DELETE 包装器（自动解包 NextAPI 信封）；
 *   全部用户可见文字走 i18n（common:admin_user.*）。
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
// 鲁港通 - 4.16.2 已将 useRequest2 合并进 useRequest
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import MyBox from '@fastgpt/web/components/common/MyBox';
import SearchInput from '@fastgpt/web/components/common/Input/SearchInput';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { GET, POST, DELETE } from '@/web/common/api/request';
import type { AdminUserItem, AdminUsersListResponse } from '@/pages/api/admin/users/list';
import AdminUserDetailModal from '@/components/AdminUserDetailModal';

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

  const {
    isOpen: isStatusModalOpen,
    onOpen: onStatusModalOpen,
    onClose: onStatusModalClose
  } = useDisclosure();
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onClose: onDeleteModalClose
  } = useDisclosure();

  // 鲁港通：用户详情弹窗状态
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const isAdmin =
    userInfo?.username === 'root' || !!userInfo?.team?.permission?.hasManagePer;

  // 检查管理员权限（root 用户或团队管理员均可访问）
  useEffect(() => {
    if (!userInfo) {
      router.replace('/login?lastRoute=/admin/users');
      return;
    }
    if (!isAdmin) {
      toast({ status: 'warning', title: t('common:admin_user.no_permission') });
      router.replace('/chat');
    }
  }, [userInfo, router, toast, isAdmin, t]);

  // 获取用户列表
  const { runAsync: fetchUsers, loading: loadingUsers } = useRequest(
    async (page: number = 1, search: string = '') => {
      return GET<AdminUsersListResponse>('/admin/users/list', {
        page,
        pageSize: PAGE_SIZE,
        search
      });
    },
    {
      errorToast: '',
      onSuccess: (data) => {
        setUserList(data.list ?? []);
        setTotal(data.total ?? 0);
        setCurrentPage(data.page ?? 1);
      },
      onError: () => {
        toast({ status: 'error', title: t('common:admin_user.fetch_list_failed') });
      }
    }
  );

  // 更新用户状态
  const { runAsync: updateUserStatus, loading: updatingStatus } = useRequest(
    async (userId: string, status: 'active' | 'forbidden') => {
      return POST('/admin/users/status', { userId, status });
    },
    {
      errorToast: '',
      onSuccess: () => {
        toast({ status: 'success', title: t('common:admin_user.status_update_success') });
        onStatusModalClose();
        fetchUsers(currentPage, searchText);
      },
      onError: (error: any) => {
        toast({
          status: 'error',
          title: error.message || t('common:admin_user.status_update_failed')
        });
      }
    }
  );

  // 删除用户
  const { runAsync: deleteUser, loading: deletingUser } = useRequest(
    async (userId: string) => {
      return DELETE('/admin/users/delete', { userId });
    },
    {
      errorToast: '',
      onSuccess: () => {
        toast({ status: 'success', title: t('common:admin_user.delete_success') });
        onDeleteModalClose();
        fetchUsers(currentPage, searchText);
      },
      onError: (error: any) => {
        toast({ status: 'error', title: error.message || t('common:admin_user.delete_failed') });
      }
    }
  );

  // 初始加载
  useEffect(() => {
    if (isAdmin) {
      fetchUsers(1, '');
    }
  }, [userInfo]);

  // 打开删除确认框
  const handleDeleteClick = useCallback(
    (user: AdminUserItem) => {
      setSelectedUser(user);
      onDeleteModalOpen();
    },
    [onDeleteModalOpen]
  );

  // 搜索处理
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    fetchUsers(1, searchText);
  }, [searchText, fetchUsers]);

  // 分页处理
  const handlePageChange = useCallback(
    (page: number) => {
      fetchUsers(page, searchText);
    },
    [searchText, fetchUsers]
  );

  // 打开状态修改确认框
  const handleStatusClick = useCallback(
    (user: AdminUserItem) => {
      setSelectedUser(user);
      onStatusModalOpen();
    },
    [onStatusModalOpen]
  );

  // 确认修改状态
  const handleConfirmStatusChange = useCallback(() => {
    if (!selectedUser) return;
    const newStatus = selectedUser.status === 'active' ? 'forbidden' : 'active';
    updateUserStatus(selectedUser._id, newStatus);
  }, [selectedUser, updateUserStatus]);

  // 格式化日期
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const selectedName = selectedUser?.memberName || selectedUser?.username || '';
  const isSelectedActive = selectedUser?.status === 'active';

  return (
    <MyBox h="100%" p={6} bg="white">
      {/* 页面标题和搜索 */}
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Text fontSize="xl" fontWeight="bold" color="myGray.900">
            {t('common:admin_user.title')}
          </Text>
          <Text fontSize="sm" color="myGray.500" mt={1}>
            {t('common:admin_user.total_users', { count: total })}
          </Text>
        </Box>
        <HStack spacing={3}>
          <SearchInput
            placeholder={t('common:admin_user.search_placeholder')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            w="280px"
          />
          <Button colorScheme="blue" size="sm" onClick={handleSearch} isLoading={loadingUsers}>
            {t('common:admin_user.search')}
          </Button>
        </HStack>
      </Flex>

      {/* 用户列表表格 */}
      <TableContainer fontSize="sm" flex={1}>
        <Table variant="simple">
          <Thead bg="myGray.50">
            <Tr>
              <Th>{t('common:admin_user.col_user')}</Th>
              <Th>{t('common:admin_user.col_username')}</Th>
              <Th>{t('common:admin_user.col_team')}</Th>
              <Th>{t('common:admin_user.status')}</Th>
              <Th>{t('common:admin_user.create_time')}</Th>
              <Th>{t('common:admin_user.col_actions')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {userList.map((user) => (
              <Tr
                key={user._id}
                _hover={{ bg: 'myGray.25' }}
                cursor="pointer"
                onClick={() => setDetailUserId(user._id)}
              >
                <Td>
                  <Flex align="center" gap={3}>
                    <Avatar size="sm" name={user.memberName || user.username} src={user.avatar} />
                    <Text fontWeight="medium">{user.memberName || user.username}</Text>
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
                    {user.status === 'active'
                      ? t('common:admin_user.status_active')
                      : t('common:admin_user.status_forbidden')}
                  </Badge>
                </Td>
                <Td color="myGray.500" fontSize="xs">
                  {formatDate(user.createTime)}
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <Button
                      size="xs"
                      variant={user.status === 'active' ? 'outline' : 'solid'}
                      colorScheme={user.status === 'active' ? 'red' : 'green'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusClick(user);
                      }}
                      isDisabled={user.username === 'root'}
                    >
                      {user.status === 'active'
                        ? t('common:admin_user.disable')
                        : t('common:admin_user.enable')}
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      colorScheme="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(user);
                      }}
                      isDisabled={user.username === 'root'}
                    >
                      {t('common:admin_user.delete')}
                    </Button>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      {/* 空状态 */}
      {!loadingUsers && userList.length === 0 && (
        <EmptyTip text={t('common:admin_user.no_data')} />
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <Flex justify="center" align="center" mt={6} gap={2}>
          <IconButton
            aria-label={t('common:admin_user.prev_page')}
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
            aria-label={t('common:admin_user.next_page')}
            icon={<MyIcon name="common/arrowRight" w={4} />}
            size="sm"
            variant="ghost"
            isDisabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          />
          <Text fontSize="sm" color="myGray.500" ml={2}>
            {t('common:admin_user.page_info', { current: currentPage, total: totalPages })}
          </Text>
        </Flex>
      )}

      {/* 状态修改确认框 */}
      <Modal isOpen={isStatusModalOpen} onClose={onStatusModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {isSelectedActive
              ? t('common:admin_user.status_modal_disable_title')
              : t('common:admin_user.status_modal_enable_title')}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              {isSelectedActive
                ? t('common:admin_user.status_confirm_disable', { name: selectedName })
                : t('common:admin_user.status_confirm_enable', { name: selectedName })}
            </Text>
            {isSelectedActive && (
              <Text fontSize="sm" color="myGray.500" mt={2}>
                {t('common:admin_user.disable_hint')}
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onStatusModalClose}>
              {t('common:admin_user.cancel')}
            </Button>
            <Button
              colorScheme={isSelectedActive ? 'red' : 'green'}
              onClick={handleConfirmStatusChange}
              isLoading={updatingStatus}
            >
              {isSelectedActive
                ? t('common:admin_user.confirm_disable')
                : t('common:admin_user.confirm_enable')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认框 */}
      <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t('common:admin_user.delete_modal_title')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>{t('common:admin_user.delete_confirm', { name: selectedName })}</Text>
            <Text fontSize="sm" color="red.500" mt={2}>
              {t('common:admin_user.delete_warning')}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDeleteModalClose}>
              {t('common:admin_user.cancel')}
            </Button>
            <Button
              colorScheme="red"
              onClick={() => selectedUser && deleteUser(selectedUser._id)}
              isLoading={deletingUser}
            >
              {t('common:admin_user.confirm_delete')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 鲁港通：用户详情弹窗 */}
      {detailUserId && (
        <AdminUserDetailModal
          isOpen={!!detailUserId}
          onClose={() => setDetailUserId(null)}
          userId={detailUserId}
          onSaved={() => fetchUsers(currentPage, searchText)}
        />
      )}
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
