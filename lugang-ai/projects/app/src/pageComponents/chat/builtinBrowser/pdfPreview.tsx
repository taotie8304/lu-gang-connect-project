// 鲁港通 - PDF 页内预览：字节只在本机渲染进程内解析，按滚动可见性逐页绘制，不上传
import { useEffect, useRef, useState } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { DesktopDocumentBytes, DesktopDocumentSnapshot } from './desktopBridge';
import { resolvePdfPageCount, resolvePdfViewportScale } from './pdfPages';
import { LG } from '@/pageComponents/chat/lugangTheme';

type PdfjsModule = typeof import('pdfjs-dist');

// 鲁港通 - pdfjs 按需加载，只有真正打开 PDF 时才付出体积；worker 用静态文件，避免打包器改写
let pdfjsPromise: Promise<PdfjsModule> | null = null;
const loadPdfjs = (): Promise<PdfjsModule> => {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist')
      .then((module) => {
        module.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.mjs';
        return module;
      })
      .catch((error) => {
        pdfjsPromise = null;
        throw error;
      });
  }
  return pdfjsPromise;
};

const PdfPreview = ({
  snapshot,
  readBytes,
  onOpenExternal
}: {
  snapshot: DesktopDocumentSnapshot;
  readBytes?: (token: string) => Promise<DesktopDocumentBytes | null>;
  onOpenExternal?: () => void;
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const tasksRef = useRef<Map<number, RenderTask>>(new Map());
  const renderedRef = useRef<Set<number>>(new Set());
  const [width, setWidth] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [shownPages, setShownPages] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!readBytes) return;
    let cancelled = false;
    void (async () => {
      try {
        const bytes = await readBytes(snapshot.token);
        if (cancelled) return;
        if (!bytes || bytes.data.length === 0) {
          setLoadFailed(true);
          return;
        }
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        const document = await pdfjs.getDocument({ data: bytes.data }).promise;
        if (cancelled) {
          void document.destroy();
          return;
        }
        const firstPage = await document.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1 });
        if (cancelled) {
          void document.destroy();
          return;
        }
        setPageSize({ width: baseViewport.width, height: baseViewport.height });
        setTotalPages(document.numPages);
        setShownPages(resolvePdfPageCount(document.numPages));
        setDoc(document);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot.token, readBytes, attempt]);

  useEffect(() => {
    return () => {
      if (doc) void doc.destroy();
    };
  }, [doc]);

  // 鲁港通 - 只渲染进入视野（含约 800px 预渲染区）的页面，避免一次占满几十张大 canvas
  useEffect(() => {
    if (!doc || width <= 0 || shownPages === 0) return;
    let cancelled = false;
    const tasks = tasksRef.current;
    renderedRef.current.clear();

    const renderPage = async (index: number) => {
      if (cancelled || renderedRef.current.has(index)) return;
      const canvas = canvasRefs.current[index - 1];
      if (!canvas) return;
      renderedRef.current.add(index);
      try {
        const page = await doc.getPage(index);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = resolvePdfViewportScale({
          containerWidth: width,
          pageWidth: baseViewport.width,
          devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio
        });
        const viewport = page.getViewport({ scale });
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext('2d');
        if (!context) return;
        tasks.get(index)?.cancel();
        const task = page.render({ canvasContext: context, viewport });
        tasks.set(index, task);
        await task.promise;
      } catch {
        renderedRef.current.delete(index);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.page);
          if (Number.isFinite(index) && index > 0) void renderPage(index);
        }
      },
      { rootMargin: '800px 0px' }
    );
    for (const canvas of canvasRefs.current) {
      if (canvas) observer.observe(canvas);
    }

    return () => {
      cancelled = true;
      observer.disconnect();
      tasks.forEach((task) => task.cancel());
      tasks.clear();
    };
  }, [doc, width, shownPages]);

  const retry = () => {
    setLoadFailed(false);
    setDoc(null);
    setPageSize(null);
    setTotalPages(0);
    setShownPages(0);
    setAttempt((value) => value + 1);
  };

  const failed = !readBytes || loadFailed;
  const pageText =
    totalPages > 0
      ? t('common:builtin_browser_doc_pdf_page_count' as any, { total: totalPages })
      : '';
  const limitText =
    totalPages > shownPages && shownPages > 0
      ? t('common:builtin_browser_doc_pdf_page_limit' as any, {
          shown: shownPages,
          total: totalPages
        })
      : '';
  // 鲁港通 - PDF 不支持原地修改，右栏必须直接说清边界，避免用户以为 AI 能改 PDF
  const readonlyHint = t('common:builtin_browser_doc_pdf_readonly_hint' as any);

  return (
    <Box ref={containerRef} maxW={'820px'} mx={'auto'}>
      <Flex alignItems={'center'} justifyContent={'space-between'} gap={3} mb={'8px'} px={'2px'}>
        <Flex alignItems={'center'} gap={2} minW={0}>
          <Text fontSize={'12px'} fontWeight={600} color={LG.ink} noOfLines={1}>
            {snapshot.fileName}
          </Text>
          {pageText && (
            <Text fontSize={'9.5px'} color={LG.mutedSoft} flexShrink={0}>
              {pageText}
            </Text>
          )}
        </Flex>
        {onOpenExternal && (
          <Button
            size={'xs'}
            h={'25px'}
            px={'9px'}
            fontSize={'10.5px'}
            fontWeight={500}
            flexShrink={0}
            variant={'ghost'}
            color={LG.mountain}
            _hover={{ bg: LG.paleSoft }}
            onClick={onOpenExternal}
          >
            {t('common:builtin_browser_doc_pdf_open_external' as any)}
          </Button>
        )}
      </Flex>

      {readonlyHint && (
        <Text
          mb={'8px'}
          px={'9px'}
          py={'6px'}
          borderRadius={'5px'}
          border={'1px solid'}
          borderColor={LG.line}
          bg={LG.paleSoft}
          color={LG.muted}
          fontSize={'10px'}
          lineHeight={'1.6'}
        >
          {readonlyHint}
        </Text>
      )}

      {limitText && (
        <Text
          mb={'8px'}
          px={'9px'}
          py={'6px'}
          borderRadius={'5px'}
          border={'1px solid'}
          borderColor={'rgba(217,164,65,0.5)'}
          bg={'rgba(246,201,120,0.2)'}
          color={'#8A6118'}
          fontSize={'10px'}
        >
          {limitText}
        </Text>
      )}

      {failed ? (
        <Flex
          flexDirection={'column'}
          alignItems={'center'}
          justifyContent={'center'}
          gap={3}
          minH={'360px'}
          px={6}
          bg={'white'}
          border={'1px solid'}
          borderColor={LG.line}
          borderRadius={'6px'}
        >
          <Text fontSize={'11.5px'} color={LG.muted} textAlign={'center'}>
            {t(
              (readBytes
                ? 'common:builtin_browser_doc_pdf_failed'
                : 'common:builtin_browser_doc_pdf_unsupported') as any
            )}
          </Text>
          <Flex gap={'8px'}>
            {readBytes && (
              <Button
                size={'xs'}
                h={'26px'}
                px={'12px'}
                fontSize={'10.5px'}
                borderRadius={'6px'}
                variant={'outline'}
                borderColor={LG.line}
                color={LG.text}
                _hover={{ bg: LG.paleSoft }}
                onClick={retry}
              >
                {t('common:builtin_browser_retry' as any)}
              </Button>
            )}
            {onOpenExternal && (
              <Button
                size={'xs'}
                h={'26px'}
                px={'12px'}
                fontSize={'10.5px'}
                borderRadius={'6px'}
                bg={'linear-gradient(140deg, #8FB4DC, #4F80B4)'}
                color={'white'}
                _hover={{ opacity: 0.9 }}
                onClick={onOpenExternal}
              >
                {t('common:builtin_browser_doc_pdf_open_external' as any)}
              </Button>
            )}
          </Flex>
        </Flex>
      ) : shownPages === 0 ? (
        <Flex
          flexDirection={'column'}
          alignItems={'center'}
          justifyContent={'center'}
          gap={3}
          minH={'360px'}
          bg={'white'}
          border={'1px solid'}
          borderColor={LG.line}
          borderRadius={'6px'}
        >
          <MyIcon name={'common/loading'} w={'22px'} h={'22px'} color={LG.lake} />
          <Text fontSize={'11px'} color={LG.muted}>
            {t('common:builtin_browser_doc_pdf_loading' as any)}
          </Text>
        </Flex>
      ) : (
        Array.from({ length: shownPages }, (_, index) => (
          <Box
            key={index}
            mb={'10px'}
            bg={'white'}
            border={'1px solid'}
            borderColor={LG.line}
            borderRadius={'4px'}
            boxShadow={'0 6px 22px rgba(78,128,178,0.08)'}
            overflow={'hidden'}
            style={{
              aspectRatio: pageSize ? `${pageSize.width} / ${pageSize.height}` : '210 / 297'
            }}
          >
            <canvas
              ref={(node) => {
                canvasRefs.current[index] = node;
              }}
              data-page={index + 1}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </Box>
        ))
      )}
    </Box>
  );
};

export default PdfPreview;
