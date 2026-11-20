// Stage 1 readers of the ticket import (zxing-wasm + unpdf). Kept apart from ports.ts: unpdf is ESM-only, which Jest
// cannot load, so the adapter test runs this file in a plain Node process (see __tests__/stage1.test.ts).
import { extractImages, getDocumentProxy } from 'unpdf';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import type { ExtractTicketPorts } from './handler.ts';

// Supabase gives an Edge Function 2 s of CPU per request: read only the first pages and a few images of a PDF
// (a ticket has its code on page 1; later pages are terms and conditions).
export const MAX_PDF_PAGES = 3;
export const MAX_PDF_IMAGES = 6;
const FORMATS = ['PDF417', 'Aztec', 'QRCode'] as const;
const READ_OPTIONS = { formats: [...FORMATS], tryHarder: true };

export type Stage1Ports = Pick<ExtractTicketPorts, 'decodeBarcodes' | 'extractPdfText'>;

type PdfImage = { data: ArrayLike<number>; width: number; height: number };

// shortcut: 1-bit and CMYK images give a wrong channel count, so no barcode is read from them and the text path or
// Gemini takes over; upgrade if real tickets hit it.
// unpdf returns 1 (gray), 3 (RGB) or 4 (RGBA) channels per pixel, inferred here from the data length; the reader wants RGBA.
function toRgba({ data, width, height }: PdfImage): Uint8ClampedArray {
  const channels = Math.round(data.length / (width * height));
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const at = i * channels;
    rgba[i * 4] = data[at]!;
    rgba[i * 4 + 1] = data[channels >= 3 ? at + 1 : at]!;
    rgba[i * 4 + 2] = data[channels >= 3 ? at + 2 : at]!;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/**
 * Stage 1 readers. The zxing reader `.wasm` is shipped with the function and passed in as bytes: by default the
 * library downloads it from a CDN at runtime, which must never happen here.
 */
export function createStage1Ports({
  wasmBinary,
  prepare = prepareZXingModule,
}: {
  wasmBinary: ArrayBuffer;
  /** Only for tests. */
  prepare?: typeof prepareZXingModule;
}): Stage1Ports {
  let ready: Promise<unknown> | undefined;
  const reader = () =>
    (ready ??= prepare({ overrides: { wasmBinary }, fireImmediately: true }).catch((error: unknown) => {
      ready = undefined; // a failed load is not cached: the next request tries again
      throw error;
    }));
  const texts = (results: { text: string; isValid: boolean }[]) => results.filter((r) => r.isValid).map((r) => r.text);

  return {
    async decodeBarcodes(bytes, mimeType) {
      await reader();
      if (mimeType === 'image/jpeg') return texts(await readBarcodes(bytes, READ_OPTIONS));
      const doc = await getDocumentProxy(new Uint8Array(bytes));
      const found: string[] = [];
      let images = 0;
      for (let page = 1; page <= Math.min(doc.numPages, MAX_PDF_PAGES) && images < MAX_PDF_IMAGES; page++) {
        for (const image of await extractImages(doc, page)) {
          if (images++ >= MAX_PDF_IMAGES) break;
          const imageData = { data: toRgba(image), width: image.width, height: image.height, colorSpace: 'srgb' };
          found.push(...texts(await readBarcodes(imageData as unknown as ImageData, READ_OPTIONS)));
        }
      }
      return found;
    },
    async extractPdfText(bytes) {
      // Page by page and only the first MAX_PDF_PAGES: extractText would read the whole document (2 s CPU budget).
      const doc = await getDocumentProxy(new Uint8Array(bytes));
      const pages: string[] = [];
      for (let n = 1; n <= Math.min(doc.numPages, MAX_PDF_PAGES); n++) {
        const { items } = await (await doc.getPage(n)).getTextContent();
        pages.push(items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join(''));
      }
      const text = pages.join('\n');
      return text.trim() === '' ? null : text;
    },
  };
}
