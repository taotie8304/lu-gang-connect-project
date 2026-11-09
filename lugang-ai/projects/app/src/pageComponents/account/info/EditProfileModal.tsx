import React, { useCallback, useState } from 'react';
import { Box, Flex, Input, Text } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import Avatar from '@fastgpt/web/components/common/Avatar';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useUserStore } from '@/web/support/user/useUserStore';
import { putUpdateMemberName } from '@/web/support/user/team/api';
import { useUploadAvatar } from '@fastgpt/web/common/file/hooks/useUploadAvatar';
import { getUploadAvatarPresignedUrl } from '@/web/common/file/api';
import { DEFAULT_USER_AVATAR } from '@fastgpt/global/common/system/constants';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { getIsMemberSyncMode } from '@/web/common/system/utils';

// 鲁港通 - 账号中心编辑资料弹窗：头像（上传或预设）+ 昵称
export const PRESET_AVATARS = [
  '/imgs/avatar/presetBlueAvatar.svg',
  '/imgs/avatar/presetGreenAvatar.svg',
  '/imgs/avatar/presetOrangeAvatar.svg',
  '/imgs/avatar/presetPurpleAvatar.svg'
];

const NICKNAME_MAX_LENGTH = 20;

const EditProfileModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useClientTranslation('account_info');
  const { toast } = useToast();
  const { feConfigs } = useSystemStore();
  const { userInfo, updateUserInfo, initUserInfo } = useUserStore();
  const isSyncMember = getIsMemberSyncMode(feConfigs);

  const initialAvatar =
    userInfo?.avatar && userInfo.avatar !== DEFAULT_USER_AVATAR ? userInfo.avatar : '';
  const [name, setName] = useState(userInfo?.team?.memberName ?? '');
  const [avatar, setAvatar] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const previewLetter = (name.trim() || userInfo?.username || 'U').charAt(0).toUpperCase();

  const { Component: AvatarUploader, handleFileSelectorOpen } = useUploadAvatar(
    getUploadAvatarPresignedUrl,
    {
      onSuccess: (url) => setAvatar(url)
    }
  );

  const onSave = useCallback(async () => {
    const finalName = name.trim();
    if (!finalName) {
      toast({ title: t('account_info:nickname_required'), status: 'warning' });
      return;
    }

    setSaving(true);
    try {
      if (finalName !== (userInfo?.team?.memberName ?? '')) {
        await putUpdateMemberName(finalName);
      }
      if (avatar !== initialAvatar) {
        await updateUserInfo({ avatar: avatar || DEFAULT_USER_AVATAR });
      }
      initUserInfo();
      toast({ title: t('account_info:profile_updated'), status: 'success' });
      onClose();
    } catch {
      // 鲁港通 - 失败提示由请求层统一弹出，这里只保留弹窗便于重试
    } finally {
      setSaving(false);
    }
  }, [avatar, initialAvatar, initUserInfo, name, onClose, t, toast, updateUserInfo, userInfo]);

  return (
    <MyModal isOpen onClose={onClose} w={'468px'} maxW={['92vw', '468px']} p={0}>
      <AvatarUploader />
      <Flex
        px={'22px'}
        pt={'20px'}
        pb={'4px'}
        align={'flex-start'}
        justify={'space-between'}
        flexShrink={0}
      >
        <Text fontSize={'16px'} fontWeight={600} color={'#182234'}>
          {t('account_info:edit_profile')}
        </Text>
        <Flex
          as={'button'}
          type={'button'}
          w={'30px'}
          h={'30px'}
          align={'center'}
          justify={'center'}
          borderRadius={'50%'}
          color={'#8C99AE'}
          transition={'0.18s'}
          _hover={{ bg: '#F2F6FF', color: '#3C4A63' }}
          onClick={onClose}
        >
          <MyIcon name={'close'} w={'14px'} />
        </Flex>
      </Flex>

      <Box px={'22px'} pt={'14px'} pb={'6px'} overflowY={'auto'}>
        <Flex align={'center'} gap={'16px'}>
          {avatar ? (
            <Avatar
              src={avatar}
              w={'72px'}
              h={'72px'}
              borderRadius={'22px'}
              flexShrink={0}
              boxShadow={'0 6px 16px rgba(36,80,181,.12)'}
            />
          ) : (
            <Flex
              w={'72px'}
              h={'72px'}
              flexShrink={0}
              align={'center'}
              justify={'center'}
              borderRadius={'22px'}
              bg={'linear-gradient(150deg,#9FC2FF,#5E8FFF 55%,#3370FF)'}
              color={'#fff'}
              fontSize={'28px'}
              fontWeight={600}
              boxShadow={'0 6px 16px rgba(36,80,181,.12)'}
            >
              {previewLetter}
            </Flex>
          )}
          <Box flex={'1 0 0'} minW={0}>
            <Text fontSize={'13px'} fontWeight={500} color={'#182234'}>
              {t('account_info:avatar')}
            </Text>
            <Text mt={'3px'} fontSize={'11.5px'} color={'#8C99AE'} lineHeight={'17px'}>
              {t('account_info:avatar_upload_tip')}
            </Text>
            <Flex
              as={'button'}
              type={'button'}
              mt={'8px'}
              h={'28px'}
              px={'12px'}
              borderRadius={'999px'}
              border={'1px solid'}
              borderColor={'#E7EEF9'}
              bg={'#fff'}
              align={'center'}
              fontSize={'12px'}
              color={'#2450B5'}
              transition={'0.18s'}
              _hover={{ borderColor: '#CBDCFB', bg: '#F2F6FF' }}
              onClick={handleFileSelectorOpen}
            >
              {t('account_info:upload_image')}
            </Flex>
          </Box>
        </Flex>

        <Text mt={'18px'} fontSize={'12.5px'} color={'#66758F'}>
          {t('account_info:or_choose_preset')}
        </Text>
        <Flex gap={'10px'} mt={'8px'}>
          {PRESET_AVATARS.map((src, index) => {
            const selected = avatar === src;
            return (
              <Flex
                as={'button'}
                type={'button'}
                key={src}
                w={'48px'}
                h={'48px'}
                p={'6px'}
                borderRadius={'14px'}
                border={'1.5px solid'}
                borderColor={selected ? '#3370FF' : 'transparent'}
                bg={selected ? '#F2F6FF' : 'transparent'}
                boxShadow={selected ? '0 0 0 3px rgba(51,112,255,.12)' : 'none'}
                transition={'0.18s'}
                _hover={{ borderColor: '#CBDCFB' }}
                aria-label={t('account_info:preset_avatar_n', { index: index + 1 })}
                onClick={() => setAvatar(src)}
              >
                <Avatar src={src} w={'100%'} h={'100%'} borderRadius={'9px'} />
              </Flex>
            );
          })}
        </Flex>

        <Text mt={'18px'} fontSize={'13px'} fontWeight={500} color={'#182234'}>
          {t('account_info:nickname')}
        </Text>
        <Box position={'relative'} mt={'8px'}>
          <Input
            value={name}
            maxLength={NICKNAME_MAX_LENGTH}
            disabled={isSyncMember}
            placeholder={t('account_info:nickname_placeholder')}
            h={'42px'}
            pr={'56px'}
            borderRadius={'11px'}
            borderColor={'#E7EEF9'}
            bg={'#FBFDFF'}
            fontSize={'13px'}
            color={'#182234'}
            _hover={{ borderColor: '#CBDCFB' }}
            _focusVisible={{ borderColor: '#3370FF', boxShadow: '0 0 0 3px rgba(51,112,255,.12)' }}
            onChange={(e) => setName(e.target.value)}
          />
          <Text
            position={'absolute'}
            right={'14px'}
            top={'50%'}
            transform={'translateY(-50%)'}
            fontSize={'11px'}
            color={'#8C99AE'}
          >
            {name.length}/{NICKNAME_MAX_LENGTH}
          </Text>
        </Box>
        <Text mt={'8px'} fontSize={'11.5px'} color={'#8C99AE'} lineHeight={'17px'}>
          {t('account_info:nickname_hint')}
        </Text>
      </Box>

      <Flex
        px={'22px'}
        pt={'14px'}
        pb={'20px'}
        justify={'flex-end'}
        gap={'8px'}
        borderTop={'1px solid'}
        borderColor={'#EEF3FC'}
        mt={'10px'}
        flexShrink={0}
      >
        <Flex
          as={'button'}
          type={'button'}
          h={'36px'}
          px={'16px'}
          borderRadius={'10px'}
          border={'1px solid'}
          borderColor={'#E7EEF9'}
          bg={'#fff'}
          align={'center'}
          fontSize={'12.5px'}
          color={'#66758F'}
          transition={'0.18s'}
          _hover={{ bg: '#F7FAFF' }}
          onClick={onClose}
        >
          {t('account_info:cancel')}
        </Flex>
        <Flex
          as={'button'}
          type={'button'}
          h={'36px'}
          px={'18px'}
          borderRadius={'10px'}
          bg={'linear-gradient(135deg,#4F86FF,#3370FF)'}
          align={'center'}
          fontSize={'12.5px'}
          fontWeight={500}
          color={'#fff'}
          boxShadow={'0 6px 16px rgba(51,112,255,.26)'}
          transition={'0.18s'}
          opacity={saving ? 0.7 : 1}
          pointerEvents={saving ? 'none' : 'auto'}
          _hover={{ bg: 'linear-gradient(135deg,#3E77F2,#2450B5)' }}
          onClick={onSave}
        >
          {t('account_info:confirm')}
        </Flex>
      </Flex>
    </MyModal>
  );
};

export default EditProfileModal;
