// 鲁港通 - 右栏文档预览：A4 纸面、黄底差异、逐条确认与副本结果
import type { ReactNode } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type {
  DesktopDocumentAppendedRow,
  DesktopDocumentBytes,
  DesktopDocumentFormat,
  DesktopDocumentParagraphBlock,
  DesktopDocumentSheet,
  DesktopDocumentSnapshot,
  DesktopDocumentTableBlock
} from './desktopBridge';
import {
  canReviewNow,
  diffPreviewText,
  findPendingChange,
  findSheetCellMark,
  readSheetCell,
  resolveReviewProgress,
  resolveSheetWidth,
  xlsxColumnLabel
} from './documentTabs';
import PdfPreview from './pdfPreview';
import { LG } from '@/pageComponents/chat/lugangTheme';

const PENDING_TONE = {
  bar: '#D9A441',
  soft: 'rgba(246,201,120,0.26)',
  strong: 'rgba(246,201,120,0.55)',
  border: 'rgba(217,164,65,0.5)',
  text: '#8A6118'
};

const APPLIED_TONE = {
  bar: '#6FB98A',
  soft: 'rgba(116,186,140,0.2)',
  strong: 'rgba(116,186,140,0.4)',
  border: 'rgba(111,185,138,0.5)',
  text: '#3F7A56'
};

const FORMAT_META: Record<DesktopDocumentFormat, { label: string; color: string; bg: string }> = {
  docx: { label: 'W', color: '#2F6B9E', bg: 'rgba(111,157,208,0.16)' },
  xlsx: { label: 'X', color: '#3F7A56', bg: 'rgba(125,190,149,0.18)' },
  pdf: { label: 'P', color: '#B15A4E', bg: 'rgba(214,132,120,0.18)' }
};

export const DocumentFormatChip = ({
  format,
  size = 14
}: {
  format: DesktopDocumentFormat;
  size?: number;
}) => {
  const meta = FORMAT_META[format];
  return (
    <Flex
      flexShrink={0}
      w={`${size}px`}
      h={`${size}px`}
      borderRadius={'3px'}
      alignItems={'center'}
      justifyContent={'center'}
      bg={meta.bg}
      color={meta.color}
      fontSize={`${Math.round(size * 0.62)}px`}
      fontWeight={700}
      lineHeight={1}
    >
      {meta.label}
    </Flex>
  );
};

const headingStyle = (level: number) => ({
  fontWeight: 700,
  color: LG.ink,
  fontSize: `${Math.max(14, 21 - level * 1.6)}px`,
  lineHeight: 1.5,
  mt: '14px',
  mb: '8px'
});

const ChangeBadge = ({ mark }: { mark: 'pending' | 'applied' }) => {
  const { t } = useTranslation();
  const tone = mark === 'pending' ? PENDING_TONE : APPLIED_TONE;
  return (
    <Text
      as={'span'}
      float={'right'}
      ml={'8px'}
      px={'5px'}
      py={'1px'}
      borderRadius={'3px'}
      bg={tone.soft}
      color={tone.text}
      fontSize={'9px'}
      lineHeight={'14px'}
      whiteSpace={'nowrap'}
    >
      {t(
        mark === 'pending'
          ? ('common:builtin_browser_doc_badge_pending' as any)
          : ('common:builtin_browser_doc_badge_applied' as any)
      )}
    </Text>
  );
};

const ParagraphView = ({ block }: { block: DesktopDocumentParagraphBlock }) => {
  const baseStyle = block.heading
    ? headingStyle(block.heading)
    : { fontSize: '13.5px', lineHeight: 1.9, color: LG.text, mb: '9px' };

  if (!block.mark || block.originalText === undefined) {
    return block.text ? <Text {...baseStyle}>{block.text}</Text> : <Box h={'10px'} />;
  }

  const tone = block.mark === 'pending' ? PENDING_TONE : APPLIED_TONE;
  const segments = diffPreviewText(block.originalText, block.text);
  return (
    <Box
      position={'relative'}
      borderLeft={'3px solid'}
      borderLeftColor={tone.bar}
      bg={tone.soft}
      borderRadius={'3px'}
      pl={'9px'}
      pr={'9px'}
      py={'5px'}
      mb={'9px'}
    >
      <ChangeBadge mark={block.mark} />
      <Text {...baseStyle} mb={0}>
        {segments.map((segment, index) =>
          segment.kind === 'same' ? (
            <Text as={'span'} key={index}>
              {segment.text}
            </Text>
          ) : segment.kind === 'removed' ? (
            <Text
              as={'span'}
              key={index}
              textDecorationLine={'line-through'}
              textDecorationColor={'rgba(196,130,120,0.75)'}
              color={LG.mutedSoft}
            >
              {segment.text}
            </Text>
          ) : (
            <Text
              as={'span'}
              key={index}
              bg={tone.strong}
              borderRadius={'2px'}
              px={'1px'}
              color={tone.text}
            >
              {segment.text}
            </Text>
          )
        )}
      </Text>
    </Box>
  );
};

const TableView = ({ block }: { block: DesktopDocumentTableBlock }) => (
  <Box my={'10px'} overflowX={'auto'} border={'1px solid'} borderColor={LG.line} borderRadius={'4px'}>
    <Box as={'table'} w={'100%'} fontSize={'12px'} sx={{ borderCollapse: 'collapse' }}>
      <Box as={'tbody'}>
        {block.rows.map((row, rowIndex) => (
          <Box as={'tr'} key={rowIndex} borderBottom={'1px solid'} borderBottomColor={LG.lineSoft}>
            {row.map((cell, cellIndex) => {
              const cellMark = block.cellMarks?.find(
                (mark) => mark.row === rowIndex && mark.cell === cellIndex
              );
              const tone = cellMark?.mark === 'applied' ? APPLIED_TONE : PENDING_TONE;
              return (
                <Box
                  as={'td'}
                  key={cellIndex}
                  px={'7px'}
                  py={'5px'}
                  verticalAlign={'top'}
                  borderRight={'1px solid'}
                  borderRightColor={LG.lineSoft}
                  bg={
                    cellMark
                      ? tone.soft
                      : rowIndex === 0
                        ? LG.paleSoft
                        : undefined
                  }
                  color={cellMark ? tone.text : LG.text}
                  fontWeight={rowIndex === 0 ? 600 : 400}
                >
                  {cellMark ? (
                    <>
                      <Text
                        as={'span'}
                        textDecorationLine={'line-through'}
                        textDecorationColor={'rgba(196,130,120,0.75)'}
                        color={LG.mutedSoft}
                        mr={'4px'}
                      >
                        {cellMark.original}
                      </Text>
                      <Text as={'span'} bg={tone.strong} borderRadius={'2px'} px={'1px'}>
                        {cell}
                      </Text>
                    </>
                  ) : (
                    cell
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
);

const Paper = ({ children, wide = false }: { children: ReactNode; wide?: boolean }) => (
  <Box
    maxW={wide ? '980px' : '720px'}
    mx={'auto'}
    bg={'white'}
    borderRadius={'4px'}
    border={'1px solid'}
    borderColor={LG.line}
    boxShadow={'0 6px 22px rgba(78,128,178,0.08)'}
    px={wide ? { base: '10px', md: '14px' } : { base: '18px', md: '30px' }}
    py={wide ? '14px' : '26px'}
    minH={'520px'}
  >
    {children}
  </Box>
);

const sheetCellBase = {
  px: '6px',
  py: '4px',
  verticalAlign: 'top',
  borderRight: '1px solid',
  borderRightColor: LG.lineSoft,
  borderBottom: '1px solid',
  borderBottomColor: LG.lineSoft,
  maxW: '220px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
} as const;

const SheetCellContent = ({
  sheet,
  row,
  cell
}: {
  sheet: DesktopDocumentSheet;
  row: number;
  cell: number;
}) => {
  const mark = findSheetCellMark(sheet, row, cell);
  const value = readSheetCell(sheet, row, cell);
  if (!mark) return <>{value}</>;
  const tone = mark.mark === 'applied' ? APPLIED_TONE : PENDING_TONE;
  return (
    <>
      {mark.original && (
        <Text
          as={'span'}
          textDecorationLine={'line-through'}
          textDecorationColor={'rgba(196,130,120,0.75)'}
          color={LG.mutedSoft}
          mr={'4px'}
        >
          {mark.original}
        </Text>
      )}
      <Text as={'span'} bg={tone.strong} borderRadius={'2px'} px={'1px'}>
        {value}
      </Text>
    </>
  );
};

const SheetRowNumber = ({
  value,
  bg,
  badge
}: {
  value: number;
  bg: string;
  badge?: { text: string; tone: { soft: string; strong: string; text: string } };
}) => (
  <Box
    as={'td'}
    position={'sticky'}
    left={0}
    zIndex={1}
    w={'36px'}
    minW={'36px'}
    px={'4px'}
    py={'4px'}
    textAlign={'center'}
    verticalAlign={'top'}
    bg={bg}
    fontSize={'9.5px'}
    color={badge ? badge.tone.text : LG.mutedSoft}
    borderRight={'1px solid'}
    borderRightColor={LG.line}
    borderBottom={'1px solid'}
    borderBottomColor={LG.lineSoft}
  >
    <Flex flexDirection={'column'} alignItems={'center'} gap={'1px'}>
      <Text as={'span'}>{value}</Text>
      {badge && (
        <Text
          as={'span'}
          px={'3px'}
          borderRadius={'2px'}
          bg={badge.tone.strong}
          color={badge.tone.text}
          fontSize={'8px'}
          lineHeight={'11px'}
          whiteSpace={'nowrap'}
        >
          {badge.text}
        </Text>
      )}
    </Flex>
  </Box>
);

const SheetGrid = ({ sheet }: { sheet: DesktopDocumentSheet }) => {
  const { t } = useTranslation();
  const width = resolveSheetWidth(sheet);
  const labels = Array.from({ length: width }, (_, index) => xlsxColumnLabel(index));
  const rows = sheet.rows ?? [];
  const appendedRows: DesktopDocumentAppendedRow[] = sheet.appendedRows ?? [];
  const newRowBadge = t('common:builtin_browser_doc_sheet_new_row' as any);

  return (
    <Box overflowX={'auto'}>
      <Box as={'table'} minW={'100%'} fontSize={'11px'} sx={{ borderCollapse: 'collapse' }}>
        <Box as={'thead'}>
          <Box as={'tr'}>
            <Box
              as={'th'}
              position={'sticky'}
              left={0}
              zIndex={2}
              w={'36px'}
              minW={'36px'}
              px={'4px'}
              py={'3px'}
              bg={LG.paleSoft}
              color={LG.mutedSoft}
              fontSize={'9px'}
              fontWeight={500}
              borderRight={'1px solid'}
              borderRightColor={LG.line}
              borderBottom={'1px solid'}
              borderBottomColor={LG.line}
            />
            {labels.map((label) => (
              <Box
                as={'th'}
                key={label}
                px={'6px'}
                py={'3px'}
                bg={LG.paleSoft}
                color={LG.mutedSoft}
                fontSize={'9px'}
                fontWeight={500}
                borderRight={'1px solid'}
                borderRightColor={LG.lineSoft}
                borderBottom={'1px solid'}
                borderBottomColor={LG.line}
                minW={'48px'}
              >
                {label}
              </Box>
            ))}
          </Box>
        </Box>
        <Box as={'tbody'}>
          {rows.map((_row, rowIndex) => (
            <Box as={'tr'} key={rowIndex}>
              <SheetRowNumber value={rowIndex + 1} bg={LG.paleSoft} />
              {labels.map((label, cellIndex) => {
                const mark = findSheetCellMark(sheet, rowIndex, cellIndex);
                const tone = mark?.mark === 'applied' ? APPLIED_TONE : PENDING_TONE;
                return (
                  <Box
                    as={'td'}
                    key={label}
                    {...sheetCellBase}
                    bg={mark ? tone.soft : rowIndex === 0 ? LG.paleSoft : undefined}
                    color={mark ? tone.text : LG.text}
                    fontWeight={rowIndex === 0 ? 600 : 400}
                  >
                    <SheetCellContent sheet={sheet} row={rowIndex} cell={cellIndex} />
                  </Box>
                );
              })}
            </Box>
          ))}
          {appendedRows.map((row) => {
            const tone = row.mark === 'applied' ? APPLIED_TONE : PENDING_TONE;
            return (
              <Box as={'tr'} key={`append-${row.rowNumber}`} bg={tone.soft}>
                <SheetRowNumber
                  value={row.rowNumber}
                  bg={tone.soft}
                  badge={{ text: newRowBadge, tone }}
                />
                {labels.map((label, cellIndex) => (
                  <Box
                    as={'td'}
                    key={label}
                    {...sheetCellBase}
                    bg={tone.soft}
                    color={tone.text}
                    fontWeight={500}
                  >
                    {row.values[cellIndex] ?? ''}
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

const SheetCard = ({ sheet }: { sheet: DesktopDocumentSheet }) => {
  const { t } = useTranslation();
  const rows = sheet.rows ?? [];
  const width = resolveSheetWidth(sheet);
  const hasContent = width > 0;
  const truncated = sheet.truncatedRows || sheet.truncatedColumns;

  return (
    <Box
      mb={'3'}
      border={'1px solid'}
      borderColor={LG.line}
      borderRadius={'6px'}
      overflow={'hidden'}
      bg={'white'}
    >
      <Flex
        alignItems={'center'}
        gap={2}
        px={'10px'}
        py={'6px'}
        bg={LG.paleSoft}
        borderBottom={hasContent ? '1px solid' : undefined}
        borderBottomColor={LG.lineSoft}
      >
        <Text fontSize={'12px'} fontWeight={600} color={LG.text} noOfLines={1}>
          {sheet.name}
        </Text>
        <Text fontSize={'10px'} color={LG.muted} flexShrink={0}>
          {t('common:builtin_browser_doc_sheet_size' as any, {
            rows: sheet.rowCount,
            columns: sheet.columnCount
          })}
        </Text>
      </Flex>
      {hasContent ? (
        <SheetGrid sheet={sheet} />
      ) : (
        <Box px={'10px'} py={'8px'}>
          {sheet.header.length > 0 ? (
            <Text fontSize={'10px'} color={LG.muted} noOfLines={2}>
              {sheet.header.join(' / ')}
            </Text>
          ) : (
            <Text fontSize={'10.5px'} color={LG.mutedSoft}>
              {t('common:builtin_browser_doc_sheet_empty' as any)}
            </Text>
          )}
        </Box>
      )}
      {truncated && (
        <Text
          px={'10px'}
          py={'5px'}
          fontSize={'9.5px'}
          color={PENDING_TONE.text}
          bg={PENDING_TONE.soft}
          borderTop={'1px solid'}
          borderTopColor={PENDING_TONE.border}
        >
          {t('common:builtin_browser_doc_sheet_truncated' as any, {
            rows: rows.length,
            columns: width
          })}
        </Text>
      )}
    </Box>
  );
};

const SheetPreview = ({ snapshot }: { snapshot: DesktopDocumentSnapshot }) => {
  const { t } = useTranslation();
  const sheets = snapshot.sheets ?? [];
  return (
    <Paper wide>
      <Text fontSize={'12px'} fontWeight={600} color={LG.ink} mb={'8px'}>
        {t('common:builtin_browser_doc_xlsx_hint' as any)}
      </Text>
      {sheets.length > 0 ? (
        sheets.map((sheet) => <SheetCard key={sheet.name} sheet={sheet} />)
      ) : (
        <Text fontSize={'11px'} color={LG.mutedSoft}>
          {t('common:builtin_browser_doc_unavailable' as any)}
        </Text>
      )}
    </Paper>
  );
};

const StatusCard = ({
  tone,
  title,
  description,
  action
}: {
  tone: 'amber' | 'green' | 'gray';
  title: string;
  description?: string;
  action?: ReactNode;
}) => {
  const palette =
    tone === 'green'
      ? { border: APPLIED_TONE.border, bg: APPLIED_TONE.soft }
      : tone === 'amber'
        ? { border: PENDING_TONE.border, bg: PENDING_TONE.soft }
        : { border: LG.line, bg: LG.mist };
  return (
    <Flex
      flexShrink={0}
      alignItems={'center'}
      gap={3}
      px={'14px'}
      py={'10px'}
      borderTop={'1px solid'}
      borderTopColor={LG.lineSoft}
      bg={'white'}
    >
      <Flex
        flex={'1 1 0'}
        flexDirection={'column'}
        gap={'2px'}
        px={'10px'}
        py={'7px'}
        border={'1px solid'}
        borderColor={palette.border}
        bg={palette.bg}
        borderRadius={'6px'}
      >
        <Text fontSize={'11.5px'} fontWeight={600} color={LG.text}>
          {title}
        </Text>
        {description && (
          <Text fontSize={'10.5px'} color={LG.muted}>
            {description}
          </Text>
        )}
      </Flex>
      {action}
    </Flex>
  );
};

const ReviewCard = ({
  snapshot,
  busy,
  onDecide,
  onApplyAll
}: {
  snapshot: DesktopDocumentSnapshot;
  busy: boolean;
  onDecide: (index: number, decision: 'apply' | 'skip') => void;
  onApplyAll: () => void;
}) => {
  const { t } = useTranslation();
  const progress = resolveReviewProgress(snapshot);
  const current = findPendingChange(snapshot);

  if (snapshot.state === 'finalizing') {
    return (
      <StatusCard tone={'gray'} title={t('common:builtin_browser_doc_review_finalizing' as any)} />
    );
  }

  if (snapshot.state === 'pending' || !current) {
    return (
      <StatusCard tone={'gray'} title={t('common:builtin_browser_doc_review_preparing' as any)} />
    );
  }

  const editable = canReviewNow(snapshot) && !busy;
  const position = current.section ? `${current.section} · ${current.target}` : current.target;

  return (
    <Box
      flexShrink={0}
      px={'14px'}
      py={'10px'}
      borderTop={'1px solid'}
      borderTopColor={LG.lineSoft}
      bg={'white'}
    >
      <Flex alignItems={'center'} justifyContent={'space-between'} mb={'5px'}>
        <Text fontSize={'11px'} fontWeight={600} color={LG.text}>
          {t('common:builtin_browser_doc_review_progress' as any, {
            current: progress.decided + 1,
            total: progress.total
          })}
        </Text>
        <Text fontSize={'10px'} color={LG.mutedSoft}>
          {progress.percent}%
        </Text>
      </Flex>
      <Box h={'4px'} borderRadius={'2px'} bg={LG.pale} overflow={'hidden'} mb={'7px'}>
        <Box
          h={'100%'}
          w={`${progress.percent}%`}
          bg={'linear-gradient(90deg, #8FB4DC, #4F80B4)'}
          transition={'width 0.2s ease'}
        />
      </Box>
      <Text fontSize={'10px'} color={PENDING_TONE.text} mb={'5px'}>
        {t('common:builtin_browser_doc_review_source_hint' as any)}
      </Text>
      <Text fontSize={'11px'} color={LG.muted} mb={'6px'} noOfLines={1}>
        {position}
      </Text>
      <Flex gap={'7px'} mb={'8px'}>
        <Box
          flex={'1 1 0'}
          minW={0}
          px={'7px'}
          py={'5px'}
          bg={LG.mist}
          borderRadius={'4px'}
          border={'1px solid'}
          borderColor={LG.lineSoft}
        >
          <Text fontSize={'9px'} color={LG.mutedSoft} mb={'1px'}>
            {t('common:builtin_browser_doc_review_before' as any)}
          </Text>
          <Text
            fontSize={'11px'}
            color={current.before ? LG.muted : LG.mutedSoft}
            textDecorationLine={current.before ? 'line-through' : undefined}
            textDecorationColor={'rgba(196,130,120,0.7)'}
            maxH={'54px'}
            overflowY={'auto'}
            whiteSpace={'pre-wrap'}
          >
            {current.before || t('common:builtin_browser_doc_review_empty' as any)}
          </Text>
        </Box>
        <Box
          flex={'1 1 0'}
          minW={0}
          px={'7px'}
          py={'5px'}
          bg={PENDING_TONE.soft}
          borderRadius={'4px'}
          border={'1px solid'}
          borderColor={PENDING_TONE.border}
        >
          <Text fontSize={'9px'} color={PENDING_TONE.text} mb={'1px'}>
            {t('common:builtin_browser_doc_review_after' as any)}
          </Text>
          <Text
            fontSize={'11px'}
            color={PENDING_TONE.text}
            maxH={'54px'}
            overflowY={'auto'}
            whiteSpace={'pre-wrap'}
          >
            {current.after}
          </Text>
        </Box>
      </Flex>
      <Flex alignItems={'center'} gap={'6px'}>
        <Button
          size={'xs'}
          h={'25px'}
          px={'8px'}
          fontSize={'10.5px'}
          variant={'ghost'}
          color={LG.mountain}
          isDisabled={!editable}
          onClick={onApplyAll}
        >
          {t('common:builtin_browser_doc_review_apply_all' as any)}
        </Button>
        <Box flex={'1 1 0'} />
        <Button
          size={'xs'}
          h={'25px'}
          px={'10px'}
          fontSize={'10.5px'}
          variant={'outline'}
          color={LG.muted}
          borderColor={LG.line}
          isDisabled={!editable}
          onClick={() => onDecide(current.index, 'skip')}
        >
          {t('common:builtin_browser_doc_review_skip' as any)}
        </Button>
        <Button
          size={'xs'}
          h={'25px'}
          px={'12px'}
          fontSize={'10.5px'}
          borderRadius={'6px'}
          bg={'linear-gradient(140deg, #8FB4DC, #4F80B4)'}
          color={'white'}
          _hover={{ opacity: 0.9 }}
          isDisabled={!editable}
          onClick={() => onDecide(current.index, 'apply')}
        >
          {t('common:builtin_browser_doc_review_apply' as any)}
        </Button>
      </Flex>
    </Box>
  );
};

const ResultCard = ({
  snapshot,
  onOpenCopy
}: {
  snapshot: DesktopDocumentSnapshot;
  onOpenCopy: () => void;
}) => {
  const { t } = useTranslation();

  if (snapshot.state === 'done') {
    return (
      <StatusCard
        tone={'green'}
        title={
          snapshot.copy
            ? t('common:builtin_browser_doc_done_title' as any, { name: snapshot.copy.name })
            : t('common:builtin_browser_doc_done_title' as any, { name: snapshot.fileName })
        }
        description={
          snapshot.copy
            ? t('common:builtin_browser_doc_done_hint' as any, { folder: snapshot.copy.folder })
            : undefined
        }
        action={
          snapshot.copy ? (
            <Button
              size={'xs'}
              h={'25px'}
              px={'12px'}
              fontSize={'10.5px'}
              borderRadius={'6px'}
              bg={'linear-gradient(140deg, #8FB4DC, #4F80B4)'}
              color={'white'}
              _hover={{ opacity: 0.9 }}
              onClick={onOpenCopy}
            >
              {t('common:builtin_browser_doc_open_copy' as any)}
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (snapshot.state === 'no_change') {
    return (
      <StatusCard
        tone={'gray'}
        title={t('common:builtin_browser_doc_no_change' as any)}
      />
    );
  }

  if (snapshot.state === 'failed') {
    return (
      <StatusCard
        tone={'amber'}
        title={t('common:builtin_browser_doc_failed' as any)}
        description={snapshot.message}
      />
    );
  }

  if (snapshot.state === 'declined' || snapshot.state === 'timeout') {
    return (
      <StatusCard tone={'gray'} title={t('common:builtin_browser_doc_expired' as any)} />
    );
  }

  return null;
};

const DocumentPreviewPanel = ({
  snapshot,
  busy = false,
  onDecide,
  onApplyAll,
  onOpenCopy,
  readBytes,
  onOpenExternal
}: {
  snapshot: DesktopDocumentSnapshot;
  busy?: boolean;
  onDecide: (index: number, decision: 'apply' | 'skip') => void;
  onApplyAll: () => void;
  onOpenCopy: () => void;
  readBytes?: (token: string) => Promise<DesktopDocumentBytes | null>;
  onOpenExternal?: () => void;
}) => {
  const { t } = useTranslation();
  const isReview = snapshot.mode === 'review';

  return (
    <Flex flexDirection={'column'} h={'100%'} minH={0} bg={'#F4F8FD'}>
      <Box flex={'1 1 0'} minH={0} overflowY={'auto'} px={'10px'} py={'12px'}>
        {snapshot.warnings.length > 0 && (
          <Box
            maxW={'720px'}
            mx={'auto'}
            mb={'8px'}
            px={'10px'}
            py={'7px'}
            borderRadius={'6px'}
            border={'1px solid'}
            borderColor={PENDING_TONE.border}
            bg={PENDING_TONE.soft}
          >
            {snapshot.warnings.map((warning, index) => (
              <Text key={index} fontSize={'10.5px'} color={PENDING_TONE.text}>
                {warning}
              </Text>
            ))}
          </Box>
        )}

        {snapshot.format === 'pdf' ? (
          <PdfPreview
            key={snapshot.token}
            snapshot={snapshot}
            readBytes={readBytes}
            onOpenExternal={onOpenExternal}
          />
        ) : snapshot.format === 'xlsx' ? (
          <SheetPreview snapshot={snapshot} />
        ) : snapshot.blocks.length > 0 ? (
          <Paper>
            {snapshot.blocks.map((block) =>
              block.kind === 'paragraph' ? (
                <ParagraphView key={block.id} block={block} />
              ) : (
                <TableView key={block.id} block={block} />
              )
            )}
          </Paper>
        ) : (
          <Paper>
            <Flex alignItems={'center'} justifyContent={'center'} h={'460px'}>
              <Text fontSize={'11px'} color={LG.muted}>
                {snapshot.message || t('common:builtin_browser_doc_unavailable' as any)}
              </Text>
            </Flex>
          </Paper>
        )}
      </Box>

      {isReview ? (
        snapshot.state === 'done' ||
        snapshot.state === 'no_change' ||
        snapshot.state === 'failed' ||
        snapshot.state === 'declined' ||
        snapshot.state === 'timeout' ? (
          <ResultCard snapshot={snapshot} onOpenCopy={onOpenCopy} />
        ) : (
          <ReviewCard
            snapshot={snapshot}
            busy={busy}
            onDecide={onDecide}
            onApplyAll={onApplyAll}
          />
        )
      ) : (
        <Flex
          flexShrink={0}
          alignItems={'center'}
          gap={'6px'}
          px={'14px'}
          py={'7px'}
          borderTop={'1px solid'}
          borderTopColor={LG.lineSoft}
          bg={'white'}
        >
          <MyIcon name={'common/globalLine'} w={'12px'} h={'12px'} color={LG.mutedSoft} />
          <Text fontSize={'10px'} color={LG.mutedSoft} noOfLines={1}>
            {t('common:builtin_browser_doc_local_hint' as any)}
          </Text>
        </Flex>
      )}
    </Flex>
  );
};

export default DocumentPreviewPanel;
