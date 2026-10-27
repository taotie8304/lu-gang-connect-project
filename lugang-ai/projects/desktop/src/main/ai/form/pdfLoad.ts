// 鲁港通 - PDF 统一加载：带权限加密的文件先在本地解密，再交给 pdf-lib
import { PDFDocument } from 'pdf-lib';
import { decryptPdf } from './pdfDecrypt';

const ENCRYPT_MARKER = new TextEncoder().encode('/Encrypt');

export const hasEncryptMarker = (bytes: Uint8Array): boolean => {
  const limit = bytes.length - ENCRYPT_MARKER.length;
  for (let start = 0; start <= limit; start += 1) {
    let matched = true;
    for (let offset = 0; offset < ENCRYPT_MARKER.length; offset += 1) {
      if (bytes[start + offset] !== ENCRYPT_MARKER[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
};

const loadDecrypted = async (bytes: Uint8Array): Promise<PDFDocument> =>
  PDFDocument.load(await decryptPdf(bytes), { updateMetadata: false });

export const loadPdfDocument = async (bytes: Uint8Array): Promise<PDFDocument> => {
  if (hasEncryptMarker(bytes)) return loadDecrypted(bytes);

  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    const detail = error instanceof Error ? error.message : '';
    if (!/encrypt/i.test(detail)) throw error;
    return loadDecrypted(bytes);
  }
};
