// 鲁港通 - 个人资料库面板：列表、搜索筛选排序、缺失态、图片预览与空状态
import { useCallback, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Box, Button, Flex, Input, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { IconNameType } from '@fastgpt/web/components/common/Icon/type';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { LG } from '@/pageComponents/chat/lugangTheme';
import type { DesktopDocumentFormat, DesktopLibraryItem } from './desktopBridge';
import { DocumentFormatChip } from './documentPreview';
import {
  canContinueLibraryItem,
  filterLibraryItems,
  formatLibrarySize,
  formatLibraryTime,
  libraryContinueLabel,
  libraryCounts,
  libraryGroupLabel,
  libraryKindBadge,
  librarySourceLabel,
  resolveLibraryMenuPosition,
  sortLibraryItems,
  type LibraryFilter,
  type LibrarySort
} from './libraryList';

const MENU_WIDTH = 172;
const MENU_HEIGHT = 268;

const TIP_STORAGE_KEY = 'lugang-library-tip-dismissed';

const KIND_TONE: Record<string, { color: string; bg: string }> = {
  docx: { color: '#2F6B9E', bg: 'rgba(111,157,208,0.16)' },
  xlsx: { color: '#3F7A56', bg: 'rgba(125,190,149,0.18)' },
  pdf: { color: '#B15A4E', bg: 'rgba(214,132,120,0.18)' },
  image: { color: '#9A7434', bg: 'rgba(183,168,136,0.2)' },
  archive: { color: '#6E5AA0', bg: 'rgba(154,132,208,0.18)' },
  other: { color: '#6E8299', bg: 'rgba(157,175,194,0.22)' }
};

const SORT_ORDER: LibrarySort[] = ['recent', 'name', 'size'];

const SORT_LABEL_KEY: Record<LibrarySort, string> = {
  recent: 'builtin_browser_library_sort_recent',
  name: 'builtin_browser_library_sort_name',
  size: 'builtin_browser_library_sort_size'
};

export type LibraryItemActions = {
  open: (item: DesktopLibraryItem) => void;
  continueEdit: (item: DesktopLibraryItem) => void;
  toggleStar: (item: DesktopLibraryItem) => void;
  reveal: (item: DesktopLibraryItem) => void;
  openExternal: (item: DesktopLibraryItem) => void;
  trash: (item: DesktopLibraryItem) => void;
  remove: (item: DesktopLibraryItem) => void;
  relocate: (item: DesktopLibraryItem) => void;
};

export type LibraryPreview =
  | { kind: 'image'; itemId: string; name: string; url: string }
  | { kind: 'unsupported'; itemId: string; name: string; reason?: 'image_too_large' }
  | { kind: 'missing'; itemId: string; name: string };

type MenuState = { item: DesktopLibraryItem; left: number; top: number };

const MenuItem = ({
  icon,
  glyph,
  label,
  danger,
  onClick
}: {
  icon?: IconNameType;
  glyph?: string;
  label: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) => (
  <Flex
    as={'button'}
    type={'button'}
    alignItems={'center'}
    gap={'7px'}
    w={'100%'}
    px={'9px'}
    py={'6px'}
    borderRadius={'5px'}
    fontSize={'11px'}
    color={danger ? '#B4544E' : LG.text}
    textAlign={'left'}
    _hover={{ bg: danger ? 'rgba(200,90,80,0.08)' : 'rgba(111,157,208,0.1)' }}
    onClick={onClick}
  >
    {icon ? (
      <MyIcon name={icon} w={'12px'} h={'12px'} flexShrink={0} color={'currentColor'} />
    ) : (
      <Text as={'span'} fontSize={'11px'} lineHeight={'12px'} w={'12px'} textAlign={'center'}>
        {glyph ?? ''}
      </Text>
    )}
    <Text flex={'1 1 0'} minW={0} noOfLines={1}>
      {label}
    </Text>
  </Flex>
);

// 鲁港通 - 资料库行菜单：缺失时只给重新定位/移除，正常时给完整操作
export const LibraryItemMenu = ({
  item,
  left,
  top,
  actions,
  onClose
}: {
  item: DesktopLibraryItem;
  left: number;
  top: number;
  actions: LibraryItemActions;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const run = (action: () => void) => () => {
    onClose();
    action();
  };
  const starLabel = item.starred
    ? t('common:builtin_browser_library_unstar' as any)
    : t('common:builtin_browser_library_star' as any);

  return (
    <>
      <Box position={'fixed'} inset={0} zIndex={1400} onClick={onClose} cursor={'default'} />
      <Box
        position={'fixed'}
        left={`${left}px`}
        top={`${top}px`}
        w={`${MENU_WIDTH}px`}
        zIndex={1401}
        p={'4px'}
        bg={'white'}
        border={'1px solid'}
        borderColor={LG.line}
        borderRadius={'8px'}
        boxShadow={'0 14px 34px rgba(42,78,116,0.18)'}
      >
        {item.missing ? (
          <>
            <MenuItem
              icon={'common/file/move'}
              label={t('common:builtin_browser_library_menu_relocate' as any)}
              onClick={run(() => actions.relocate(item))}
            />
            <MenuItem
              icon={'close'}
              label={t('common:builtin_browser_library_menu_remove' as any)}
              onClick={run(() => actions.remove(item))}
            />
          </>
        ) : (
          <>
            <MenuItem
              icon={'preview'}
              label={t('common:builtin_browser_library_menu_preview' as any)}
              onClick={run(() => actions.open(item))}
            />
            {canContinueLibraryItem(item.kind) && (
              <MenuItem
                icon={'core/app/aiLight'}
                label={libraryContinueLabel(item.kind)}
                onClick={run(() => actions.continueEdit(item))}
              />
            )}
            <MenuItem glyph={item.starred ? '★' : '☆'} label={starLabel} onClick={run(() => actions.toggleStar(item))} />
            <Box my={'3px'} h={'1px'} bg={LG.lineSoft} />
            <MenuItem
              icon={'common/folderFill'}
              label={t('common:builtin_browser_library_reveal' as any)}
              onClick={run(() => actions.reveal(item))}
            />
            <MenuItem
              icon={'out'}
              label={t('common:builtin_browser_library_open_original' as any)}
              onClick={run(() => actions.openExternal(item))}
            />
            <Box my={'3px'} h={'1px'} bg={LG.lineSoft} />
            <MenuItem
              icon={'close'}
              label={t('common:builtin_browser_library_menu_remove' as any)}
              onClick={run(() => actions.remove(item))}
            />
            <MenuItem
              icon={'common/trash'}
              label={t('common:builtin_browser_library_menu_trash' as any)}
              danger
              onClick={run(() => actions.trash(item))}
            />
          </>
        )}
      </Box>
    </>
  );
};

const KindTile = ({ item, size = 34 }: { item: DesktopLibraryItem; size?: number }) => {
  const tone = KIND_TONE[item.kind] ?? KIND_TONE.other;
  return (
    <Flex
      flexShrink={0}
      alignItems={'center'}
      justifyContent={'center'}
      w={`${size}px`}
      h={`${size + 4}px`}
      borderRadius={'6px'}
      bg={tone.bg}
      color={tone.color}
      fontSize={`${Math.round(size * 0.32)}px`}
      fontWeight={700}
      lineHeight={1}
    >
      {libraryKindBadge(item.kind)}
    </Flex>
  );
};

const formatDocumentKind = (kind: DesktopLibraryItem['kind']): DesktopDocumentFormat | null => {
  if (kind === 'docx' || kind === 'xlsx' || kind === 'pdf') return kind as DesktopDocumentFormat;
  return null;
};

const useLibraryMenu = (actions: LibraryItemActions) => {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const openMenu = useCallback((item: DesktopLibraryItem, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const position = resolveLibraryMenuPosition(
      { right: rect.right, top: rect.top, bottom: rect.bottom },
      { width: window.innerWidth, height: window.innerHeight },
      { width: MENU_WIDTH, height: MENU_HEIGHT }
    );
    setMenu({ item, ...position });
  }, []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const menuNode = menu ? (
    <LibraryItemMenu
      item={menu.item}
      left={menu.left}
      top={menu.top}
      actions={actions}
      onClose={closeMenu}
    />
  ) : null;
  return { openMenu, closeMenu, menuNode };
};

const ToolbarButton = ({
  icon,
  label,
  busy,
  onClick
}: {
  icon?: IconNameType;
  label: string;
  busy?: boolean;
  onClick: () => void;
}) => (
  <Button
    size={'xs'}
    h={'24px'}
    px={'8px'}
    gap={'4px'}
    fontSize={'10.5px'}
    fontWeight={500}
    borderRadius={'6px'}
    border={'1px solid'}
    borderColor={LG.line}
    bg={'white'}
    color={LG.text}
    isLoading={busy}
    _hover={{ bg: 'rgba(111,157,208,0.1)' }}
    onClick={onClick}
  >
    {icon && <MyIcon name={icon} w={'11px'} h={'11px'} color={'currentColor'} />}
    {label}
  </Button>
);

const IconAction = ({
  icon,
  label,
  onClick
}: {
  icon: IconNameType;
  label: string;
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
}) => (
  <MyTooltip label={label}>
    <Flex
      alignItems={'center'}
      justifyContent={'center'}
      w={'22px'}
      h={'22px'}
      flexShrink={0}
      borderRadius={'5px'}
      color={LG.muted}
      cursor={'pointer'}
      _hover={{ bg: 'rgba(54,101,150,0.08)', color: LG.mountain }}
      aria-label={label}
      onClick={(event: ReactMouseEvent<HTMLElement>) => {
        // 鲁港通 - 行内「更多」不能冒泡到整行，否则会直接触发打开文件
        event.stopPropagation();
        onClick(event);
      }}
    >
      <MyIcon name={icon} w={'13px'} h={'13px'} />
    </Flex>
  </MyTooltip>
);

const StarButton = ({ item, onToggle }: { item: DesktopLibraryItem; onToggle: () => void }) => {
  const { t } = useTranslation();
  return (
    <MyTooltip
      label={t(
        (item.starred
          ? 'common:builtin_browser_library_unstar'
          : 'common:builtin_browser_library_star') as any
      )}
    >
      <Text
        as={'button'}
        type={'button'}
        w={'20px'}
        h={'20px'}
        lineHeight={'20px'}
        textAlign={'center'}
        fontSize={'12px'}
        color={item.starred ? LG.sand : LG.mutedSoft}
        cursor={'pointer'}
        _hover={{ color: LG.sand }}
        onClick={(e: ReactMouseEvent<HTMLElement>) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {item.starred ? '★' : '☆'}
      </Text>
    </MyTooltip>
  );
};

// 鲁港通 - 文档预览顶部的资料库工具条：返回、收藏、继续修改、打开原文件与更多
export const LibraryDocToolbar = ({
  item,
  busy,
  onBack,
  actions
}: {
  item: DesktopLibraryItem;
  busy?: boolean;
  onBack: () => void;
  actions: LibraryItemActions;
}) => {
  const { t } = useTranslation();
  const { openMenu, menuNode } = useLibraryMenu(actions);
  const format = formatDocumentKind(item.kind);

  return (
    <>
      <Flex
        flexShrink={0}
        alignItems={'center'}
        gap={'6px'}
        px={'10px'}
        py={'6px'}
        bg={'white'}
        borderBottom={'1px solid'}
        borderBottomColor={LG.lineSoft}
      >
        <ToolbarButton icon={'common/arrowLeft'} label={t('common:builtin_browser_library_back' as any)} onClick={onBack} />
        {format && <DocumentFormatChip format={format} size={14} />}
        <Text flex={'1 1 0'} minW={0} fontSize={'10.5px'} color={LG.ink} noOfLines={1}>
          {item.name}
        </Text>
        <StarButton item={item} onToggle={() => actions.toggleStar(item)} />
        {canContinueLibraryItem(item.kind) && (
          <ToolbarButton
            icon={'core/app/aiLight'}
            label={libraryContinueLabel(item.kind)}
            busy={busy}
            onClick={() => actions.continueEdit(item)}
          />
        )}
        <MyTooltip label={t('common:builtin_browser_library_open_original' as any)}>
          <Flex
            alignItems={'center'}
            justifyContent={'center'}
            w={'22px'}
            h={'22px'}
            flexShrink={0}
            borderRadius={'5px'}
            color={LG.muted}
            cursor={'pointer'}
            _hover={{ bg: 'rgba(54,101,150,0.08)', color: LG.mountain }}
            onClick={() => actions.openExternal(item)}
          >
            <MyIcon name={'out'} w={'13px'} h={'13px'} />
          </Flex>
        </MyTooltip>
        <IconAction
          icon={'common/ellipsis'}
          label={t('common:builtin_browser_more' as any)}
          onClick={(event) => openMenu(item, event.currentTarget)}
        />
      </Flex>
      {menuNode}
    </>
  );
};

const FileRow = ({
  item,
  now,
  actions,
  onOpenMenu
}: {
  item: DesktopLibraryItem;
  now: number;
  actions: LibraryItemActions;
  onOpenMenu: (item: DesktopLibraryItem, anchor: HTMLElement) => void;
}) => {
  const { t } = useTranslation();
  const sub =
    item.source === 'download' && item.origin
      ? item.origin
      : item.source === 'edit' && item.parentName
        ? t('common:builtin_browser_library_parent' as any, { name: item.parentName })
        : '';

  if (item.missing) {
    return (
      <Flex
        alignItems={'center'}
        gap={'9px'}
        px={'10px'}
        py={'8px'}
        borderRadius={'8px'}
        border={'1px solid'}
        borderColor={'rgba(217,164,65,0.32)'}
        bg={'#FFFDF6'}
        cursor={'pointer'}
        _hover={{ borderColor: 'rgba(217,164,65,0.5)' }}
        onClick={() => actions.relocate(item)}
      >
        <KindTile item={item} />
        <Box flex={'1 1 0'} minW={0}>
          <Text fontSize={'11.5px'} color={LG.ink} noOfLines={1} title={item.name}>
            {item.name}
          </Text>
          <Flex alignItems={'center'} gap={'5px'} mt={'2px'} flexWrap={'wrap'}>
            <Text fontSize={'9.5px'} color={'#A97B2E'}>
              {t('common:builtin_browser_library_missing_tag' as any)}
            </Text>
            <Text
              as={'button'}
              type={'button'}
              fontSize={'9.5px'}
              color={LG.mountain}
              cursor={'pointer'}
              _hover={{ textDecoration: 'underline' }}
              onClick={(e: ReactMouseEvent<HTMLElement>) => {
                e.stopPropagation();
                actions.relocate(item);
              }}
            >
              {t('common:builtin_browser_library_menu_relocate' as any)}
            </Text>
            <Text
              as={'button'}
              type={'button'}
              fontSize={'9.5px'}
              color={LG.muted}
              cursor={'pointer'}
              _hover={{ textDecoration: 'underline' }}
              onClick={(e: ReactMouseEvent<HTMLElement>) => {
                e.stopPropagation();
                actions.remove(item);
              }}
            >
              {t('common:builtin_browser_library_menu_remove' as any)}
            </Text>
          </Flex>
        </Box>
        <IconAction
          icon={'common/ellipsis'}
          label={t('common:builtin_browser_more' as any)}
          onClick={(event) => onOpenMenu(item, event.currentTarget)}
        />
      </Flex>
    );
  }

  return (
    <Flex
      alignItems={'center'}
      gap={'9px'}
      px={'10px'}
      py={'8px'}
      borderRadius={'8px'}
      border={'1px solid'}
      borderColor={'transparent'}
      bg={'white'}
      cursor={'pointer'}
      _hover={{ borderColor: LG.line, boxShadow: '0 4px 14px rgba(78,128,178,0.08)' }}
      onClick={() => actions.open(item)}
    >
      <KindTile item={item} />
      <Box flex={'1 1 0'} minW={0}>
        <Text fontSize={'11.5px'} color={LG.ink} noOfLines={1} title={item.name}>
          {item.name}
        </Text>
        <Flex alignItems={'center'} gap={'5px'} mt={'2px'} minW={0}>
          <Text
            flexShrink={0}
            px={'5px'}
            h={'13px'}
            lineHeight={'13px'}
            borderRadius={'3px'}
            fontSize={'8.5px'}
            color={LG.mountain}
            bg={'rgba(111,157,208,0.12)'}
          >
            {librarySourceLabel(item.source)}
          </Text>
          {sub && (
            <Text fontSize={'9.5px'} color={LG.mutedSoft} noOfLines={1} minW={0} maxW={'42%'}>
              {sub}
            </Text>
          )}
          <Text fontSize={'9.5px'} color={LG.mutedSoft} flexShrink={0}>
            {formatLibrarySize(item.size)}
          </Text>
          <Text fontSize={'9.5px'} color={LG.mutedSoft} flexShrink={0} noOfLines={1}>
            {formatLibraryTime(item.usedAt, now)}
          </Text>
        </Flex>
      </Box>
      <Flex alignItems={'center'} gap={'2px'} flexShrink={0}>
        <StarButton item={item} onToggle={() => actions.toggleStar(item)} />
        <IconAction
          icon={'common/ellipsis'}
          label={t('common:builtin_browser_more' as any)}
          onClick={(event) => onOpenMenu(item, event.currentTarget)}
        />
      </Flex>
    </Flex>
  );
};

const Chip = ({
  active,
  label,
  count,
  onClick
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) => (
  <Flex
    as={'button'}
    type={'button'}
    flexShrink={0}
    alignItems={'center'}
    gap={'4px'}
    h={'22px'}
    px={'9px'}
    borderRadius={'full'}
    fontSize={'10px'}
    fontWeight={500}
    border={'1px solid'}
    borderColor={active ? 'transparent' : LG.line}
    bg={active ? 'linear-gradient(140deg, #8FB4DC, #4F80B4)' : 'white'}
    color={active ? 'white' : LG.muted}
    _hover={active ? { opacity: 0.9 } : { bg: 'rgba(111,157,208,0.08)' }}
    onClick={onClick}
  >
    {label}
    <Text as={'span'} fontSize={'9px'} opacity={0.8}>
      {count}
    </Text>
  </Flex>
);

const PreviewShell = ({
  item,
  onBack,
  actions,
  children
}: {
  item: DesktopLibraryItem;
  onBack: () => void;
  actions: LibraryItemActions;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const { openMenu, menuNode } = useLibraryMenu(actions);

  return (
    <Flex flexDirection={'column'} h={'100%'} minH={0} bg={'#F7FAFE'}>
      <Flex
        flexShrink={0}
        alignItems={'center'}
        gap={'6px'}
        px={'10px'}
        py={'6px'}
        bg={'white'}
        borderBottom={'1px solid'}
        borderBottomColor={LG.lineSoft}
      >
        <ToolbarButton
          icon={'common/arrowLeft'}
          label={t('common:builtin_browser_library_back' as any)}
          onClick={onBack}
        />
        <KindTile item={item} size={16} />
        <Text flex={'1 1 0'} minW={0} fontSize={'10.5px'} color={LG.ink} noOfLines={1}>
          {item.name}
        </Text>
        <StarButton item={item} onToggle={() => actions.toggleStar(item)} />
        <MyTooltip label={t('common:builtin_browser_library_open_original' as any)}>
          <Flex
            alignItems={'center'}
            justifyContent={'center'}
            w={'22px'}
            h={'22px'}
            flexShrink={0}
            borderRadius={'5px'}
            color={LG.muted}
            cursor={'pointer'}
            _hover={{ bg: 'rgba(54,101,150,0.08)', color: LG.mountain }}
            onClick={() => actions.openExternal(item)}
          >
            <MyIcon name={'out'} w={'13px'} h={'13px'} />
          </Flex>
        </MyTooltip>
        <IconAction
          icon={'common/ellipsis'}
          label={t('common:builtin_browser_more' as any)}
          onClick={(event) => openMenu(item, event.currentTarget)}
        />
      </Flex>
      <Box flex={'1 1 0'} minH={0} overflowY={'auto'}>
        {children}
      </Box>
      {menuNode}
    </Flex>
  );
};

const LibraryPanel = ({
  items,
  preview,
  busy,
  actions,
  onImport,
  onClosePreview,
  onRevealFolder
}: {
  items: DesktopLibraryItem[];
  preview: LibraryPreview | null;
  busy?: boolean;
  actions: LibraryItemActions;
  onImport: () => void;
  onClosePreview: () => void;
  onRevealFolder?: () => void;
}) => {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const [missingOnly, setMissingOnly] = useState(false);
  const [tipHidden, setTipHidden] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(TIP_STORAGE_KEY) === '1';
    } catch {
      return true;
    }
  });
  const { openMenu, menuNode } = useLibraryMenu(actions);

  const now = Date.now();
  const counts = useMemo(() => libraryCounts(items), [items]);
  const totalSize = useMemo(() => items.reduce((sum, item) => sum + item.size, 0), [items]);
  const missingCount = useMemo(() => items.filter((item) => item.missing).length, [items]);

  const visible = useMemo(() => {
    const base = missingOnly ? items.filter((item) => item.missing) : items;
    return sortLibraryItems(filterLibraryItems(base, { keyword, filter }), sort);
  }, [items, keyword, filter, sort, missingOnly]);

  const groups = useMemo(() => {
    const labels = ['今天', '昨天', '更早'];
    return labels
      .map((label) => ({
        label,
        rows: visible.filter((item) => libraryGroupLabel(item.usedAt, now) === label)
      }))
      .filter((group) => group.rows.length > 0);
  }, [visible, now]);

  const dismissTip = () => {
    setTipHidden(true);
    try {
      window.localStorage.setItem(TIP_STORAGE_KEY, '1');
    } catch {
      // 本地存储不可用不影响使用
    }
  };

  const cycleSort = () => {
    const index = SORT_ORDER.indexOf(sort);
    setSort(SORT_ORDER[(index + 1) % SORT_ORDER.length]);
  };

  const previewItem = preview ? items.find((item) => item.id === preview.itemId) ?? null : null;

  if (preview && previewItem) {
    if (preview.kind === 'image') {
      return (
        <PreviewShell item={previewItem} onBack={onClosePreview} actions={actions}>
          <Flex alignItems={'center'} justifyContent={'center'} minH={'100%'} p={'14px'}>
            <Box
              as={'img'}
              src={preview.url}
              alt={preview.name}
              maxW={'100%'}
              maxH={'100%'}
              borderRadius={'8px'}
              border={'1px solid'}
              borderColor={LG.line}
              bg={'white'}
              boxShadow={'0 10px 30px rgba(42,78,116,0.12)'}
            />
          </Flex>
        </PreviewShell>
      );
    }

    if (preview.kind === 'unsupported') {
      const tooLarge = preview.reason === 'image_too_large';
      return (
        <PreviewShell item={previewItem} onBack={onClosePreview} actions={actions}>
          <Flex
            h={'100%'}
            minH={'320px'}
            flexDirection={'column'}
            alignItems={'center'}
            justifyContent={'center'}
            px={'22px'}
            textAlign={'center'}
          >
            <KindTile item={previewItem} size={44} />
            <Text mt={'12px'} fontSize={'12px'} fontWeight={600} color={LG.ink}>
              {t(
                (tooLarge
                  ? 'common:builtin_browser_library_image_too_large'
                  : 'common:builtin_browser_library_unsupported_title') as any
              )}
            </Text>
            {!tooLarge && (
              <Text mt={'6px'} fontSize={'10px'} lineHeight={1.8} color={LG.muted}>
                {t('common:builtin_browser_library_unsupported_copy' as any)}
              </Text>
            )}
            <Flex mt={'14px'} gap={'6px'}>
              <ToolbarButton
                label={t('common:builtin_browser_library_open_with_system' as any)}
                onClick={() => actions.openExternal(previewItem)}
              />
              <ToolbarButton
                label={t('common:builtin_browser_library_reveal' as any)}
                onClick={() => actions.reveal(previewItem)}
              />
            </Flex>
          </Flex>
        </PreviewShell>
      );
    }

    return (
      <PreviewShell item={previewItem} onBack={onClosePreview} actions={actions}>
        <Flex
          h={'100%'}
          minH={'320px'}
          flexDirection={'column'}
          alignItems={'center'}
          justifyContent={'center'}
          px={'22px'}
          textAlign={'center'}
        >
          <MyIcon name={'common/fileNotFound'} w={'34px'} h={'34px'} color={'#C9A45C'} />
          <Text mt={'12px'} fontSize={'11px'} lineHeight={1.8} color={LG.text} maxW={'340px'}>
            {t('common:builtin_browser_library_missing_title' as any)}
          </Text>
          <Flex mt={'14px'} gap={'6px'}>
            <ToolbarButton
              label={t('common:builtin_browser_library_menu_relocate' as any)}
              onClick={() => actions.relocate(previewItem)}
            />
            <ToolbarButton
              label={t('common:builtin_browser_library_menu_remove' as any)}
              onClick={() => actions.remove(previewItem)}
            />
          </Flex>
        </Flex>
      </PreviewShell>
    );
  }

  // 鲁港通 - 空资料库只留引导与导入入口，不显示搜索筛选与统计
  if (items.length === 0) {
    return (
      <Flex
        h={'100%'}
        flexDirection={'column'}
        alignItems={'center'}
        justifyContent={'center'}
        px={'24px'}
        textAlign={'center'}
        bg={'#F7FAFE'}
      >
        <Flex position={'relative'} w={'86px'} h={'64px'} mb={'12px'}>
          <Box
            position={'absolute'}
            left={'10px'}
            top={'4px'}
            w={'30px'}
            h={'40px'}
            borderRadius={'4px'}
            bg={'white'}
            border={'1px solid'}
            borderColor={LG.line}
            transform={'rotate(-8deg)'}
          />
          <Box
            position={'absolute'}
            left={'28px'}
            top={'0'}
            w={'30px'}
            h={'44px'}
            borderRadius={'4px'}
            bg={'white'}
            border={'1px solid'}
            borderColor={LG.line}
          />
          <Box
            position={'absolute'}
            left={'46px'}
            top={'6px'}
            w={'30px'}
            h={'40px'}
            borderRadius={'4px'}
            bg={'white'}
            border={'1px solid'}
            borderColor={LG.line}
            transform={'rotate(8deg)'}
          />
          <Box
            position={'absolute'}
            left={'6px'}
            right={'6px'}
            bottom={'0'}
            h={'4px'}
            borderRadius={'2px'}
            bg={'rgba(111,157,208,0.25)'}
          />
        </Flex>
        <Text fontSize={'13px'} fontWeight={600} color={LG.ink}>
          {t('common:builtin_browser_library_empty_title' as any)}
        </Text>
        <Text mt={'6px'} fontSize={'10.5px'} lineHeight={1.8} color={LG.muted} maxW={'330px'}>
          {t('common:builtin_browser_library_empty_copy' as any)}
        </Text>
        <Button
          mt={'14px'}
          size={'sm'}
          h={'30px'}
          px={'16px'}
          fontSize={'11px'}
          borderRadius={'7px'}
          bg={'linear-gradient(140deg, #8FB4DC, #4F80B4)'}
          color={'white'}
          _hover={{ opacity: 0.9 }}
          isLoading={busy}
          onClick={onImport}
        >
          {t('common:builtin_browser_library_import' as any)}
        </Button>
        <Flex mt={'10px'} alignItems={'center'} gap={'4px'}>
          <MyIcon name={'support/permission/privateLight'} w={'10px'} h={'10px'} color={LG.mutedSoft} />
          <Text fontSize={'9.5px'} color={LG.mutedSoft}>
            {t('common:builtin_browser_library_empty_note' as any)}
          </Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex flexDirection={'column'} h={'100%'} minH={0} bg={'#F7FAFE'}>
      {!tipHidden && (
        <Flex
          flexShrink={0}
          alignItems={'flex-start'}
          gap={'6px'}
          mx={'10px'}
          mt={'8px'}
          px={'9px'}
          py={'6px'}
          borderRadius={'7px'}
          border={'1px solid'}
          borderColor={'rgba(111,157,208,0.22)'}
          bg={'rgba(231,241,251,0.6)'}
        >
          <MyIcon
            name={'common/info'}
            w={'12px'}
            h={'12px'}
            mt={'1px'}
            flexShrink={0}
            color={LG.mountain}
          />
          <Text flex={'1 1 0'} fontSize={'9.5px'} lineHeight={1.7} color={LG.text}>
            {t('common:builtin_browser_library_tip' as any)}
          </Text>
          <MyIcon
            name={'close'}
            w={'10px'}
            h={'10px'}
            mt={'2px'}
            flexShrink={0}
            color={LG.mutedSoft}
            cursor={'pointer'}
            _hover={{ color: LG.mountain }}
            aria-label={String(t('common:builtin_browser_library_tip_dismiss' as any))}
            onClick={dismissTip}
          />
        </Flex>
      )}

      <Flex flexShrink={0} alignItems={'center'} gap={'6px'} px={'10px'} mt={'8px'}>
        <Flex
          flex={'1 1 0'}
          minW={0}
          alignItems={'center'}
          gap={'5px'}
          h={'26px'}
          px={'8px'}
          borderRadius={'7px'}
          border={'1px solid'}
          borderColor={LG.line}
          bg={'white'}
        >
          <MyIcon name={'common/searchLight'} w={'12px'} h={'12px'} color={LG.mutedSoft} />
          <Input
            flex={'1 1 0'}
            minW={0}
            h={'100%'}
            p={0}
            border={'none'}
            fontSize={'10.5px'}
            color={LG.ink}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('common:builtin_browser_library_search' as any)}
            _placeholder={{ color: LG.mutedSoft }}
            _focusVisible={{ boxShadow: 'none' }}
          />
        </Flex>
        <MyTooltip label={t('common:builtin_browser_library_sort' as any)}>
          <Flex
            as={'button'}
            type={'button'}
            flexShrink={0}
            alignItems={'center'}
            gap={'4px'}
            h={'26px'}
            px={'8px'}
            borderRadius={'7px'}
            border={'1px solid'}
            borderColor={LG.line}
            bg={'white'}
            fontSize={'10px'}
            color={LG.muted}
            cursor={'pointer'}
            _hover={{ bg: 'rgba(111,157,208,0.08)' }}
            onClick={cycleSort}
          >
            <MyIcon name={'common/filter'} w={'11px'} h={'11px'} />
            {t(SORT_LABEL_KEY[sort] as any)}
          </Flex>
        </MyTooltip>
        <MyTooltip label={t('common:builtin_browser_library_import' as any)}>
          <Flex
            alignItems={'center'}
            justifyContent={'center'}
            w={'26px'}
            h={'26px'}
            flexShrink={0}
            borderRadius={'7px'}
            border={'1px solid'}
            borderColor={LG.line}
            bg={'white'}
            color={LG.muted}
            cursor={'pointer'}
            _hover={{ bg: 'rgba(111,157,208,0.08)', color: LG.mountain }}
            onClick={onImport}
          >
            <MyIcon name={'common/addLight'} w={'12px'} h={'12px'} />
          </Flex>
        </MyTooltip>
      </Flex>

      <Flex flexShrink={0} gap={'5px'} px={'10px'} mt={'7px'} flexWrap={'wrap'}>
        <Chip
          active={filter === 'all' && !missingOnly}
          label={t('common:builtin_browser_library_filter_all' as any)}
          count={counts.all}
          onClick={() => {
            setFilter('all');
            setMissingOnly(false);
          }}
        />
        <Chip
          active={filter === 'docx' && !missingOnly}
          label={'Word'}
          count={counts.docx}
          onClick={() => {
            setFilter('docx');
            setMissingOnly(false);
          }}
        />
        <Chip
          active={filter === 'xlsx' && !missingOnly}
          label={'Excel'}
          count={counts.xlsx}
          onClick={() => {
            setFilter('xlsx');
            setMissingOnly(false);
          }}
        />
        <Chip
          active={filter === 'pdf' && !missingOnly}
          label={'PDF'}
          count={counts.pdf}
          onClick={() => {
            setFilter('pdf');
            setMissingOnly(false);
          }}
        />
        <Chip
          active={filter === 'other' && !missingOnly}
          label={t('common:builtin_browser_library_filter_other' as any)}
          count={counts.other}
          onClick={() => {
            setFilter('other');
            setMissingOnly(false);
          }}
        />
      </Flex>

      <Flex
        flexShrink={0}
        alignItems={'center'}
        gap={'4px'}
        px={'10px'}
        mt={'7px'}
        fontSize={'9px'}
        color={LG.mutedSoft}
        whiteSpace={'nowrap'}
      >
        <Text as={'b'} fontSize={'9.5px'} color={LG.muted} fontWeight={600}>
          {t('common:builtin_browser_library_summary' as any, {
            count: items.length,
            size: formatLibrarySize(totalSize)
          })}
        </Text>
        <Text>·</Text>
        <Text noOfLines={1}>{t('common:builtin_browser_library_local_only' as any)}</Text>
        <Box flex={'1 1 0'} />
        {onRevealFolder && (
          <Text
            as={'button'}
            type={'button'}
            flexShrink={0}
            color={LG.mountain}
            cursor={'pointer'}
            _hover={{ textDecoration: 'underline' }}
            onClick={onRevealFolder}
          >
            {t('common:builtin_browser_library_reveal_folder' as any)}
          </Text>
        )}
      </Flex>

      {missingCount > 0 && (
        <Flex
          flexShrink={0}
          alignItems={'center'}
          gap={'6px'}
          mx={'10px'}
          mt={'7px'}
          px={'9px'}
          py={'5px'}
          borderRadius={'6px'}
          border={'1px solid'}
          borderColor={'rgba(217,164,65,0.4)'}
          bg={'#FFF9ED'}
        >
          <MyIcon name={'common/exclamationMark'} w={'12px'} h={'12px'} color={'#A97B2E'} />
          <Text flex={'1 1 0'} fontSize={'9.5px'} lineHeight={1.6} color={'#8A6118'}>
            {t('common:builtin_browser_library_missing_banner' as any, { count: missingCount })}
          </Text>
          <Text
            as={'button'}
            type={'button'}
            flexShrink={0}
            fontSize={'9.5px'}
            fontWeight={600}
            color={LG.mountain}
            cursor={'pointer'}
            _hover={{ textDecoration: 'underline' }}
            onClick={() => setMissingOnly((value) => !value)}
          >
            {missingOnly
              ? t('common:builtin_browser_library_missing_view_all' as any)
              : t('common:builtin_browser_library_missing_view' as any)}
          </Text>
        </Flex>
      )}

      <Box flex={'1 1 0'} minH={0} overflowY={'auto'} px={'10px'} py={'7px'}>
        {visible.length === 0 ? (
          <Flex
            h={'100%'}
            minH={'120px'}
            alignItems={'center'}
            justifyContent={'center'}
            textAlign={'center'}
            fontSize={'10px'}
            lineHeight={1.8}
            color={LG.mutedSoft}
          >
            {t('common:builtin_browser_library_no_result' as any)}
          </Flex>
        ) : (
          groups.map((group) => (
            <Box key={group.label} mb={'6px'}>
              <Text px={'2px'} py={'3px'} fontSize={'9px'} fontWeight={600} color={LG.mutedSoft}>
                {group.label}
              </Text>
              <Flex flexDirection={'column'} gap={'4px'}>
                {group.rows.map((item) => (
                  <FileRow
                    key={item.id}
                    item={item}
                    now={now}
                    actions={actions}
                    onOpenMenu={openMenu}
                  />
                ))}
              </Flex>
            </Box>
          ))
        )}
      </Box>

      <Flex
        flexShrink={0}
        alignItems={'center'}
        gap={'5px'}
        px={'10px'}
        py={'6px'}
        borderTop={'1px solid'}
        borderTopColor={LG.lineSoft}
        bg={'white'}
      >
        <Flex
          as={'button'}
          type={'button'}
          alignItems={'center'}
          gap={'4px'}
          fontSize={'10px'}
          color={LG.mountain}
          cursor={'pointer'}
          _hover={{ textDecoration: 'underline' }}
          onClick={onImport}
        >
          <MyIcon name={'common/addLight'} w={'11px'} h={'11px'} />
          {t('common:builtin_browser_library_import' as any)}
        </Flex>
        <Box flex={'1 1 0'} />
        <MyIcon name={'support/permission/privateLight'} w={'10px'} h={'10px'} color={LG.mutedSoft} />
        <Text fontSize={'9px'} color={LG.mutedSoft}>
          {t('common:builtin_browser_library_footer_local' as any)}
        </Text>
      </Flex>

      {menuNode}
    </Flex>
  );
};

export default LibraryPanel;
