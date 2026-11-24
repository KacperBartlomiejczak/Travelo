// Stage 1 readers of the ticket import (zxing-wasm + unpdf). Kept apart from ports.ts: unpdf is ESM-only, which Jest
// cannot load, so the adapter test runs this file in a plain Node process (see __tests__/stage1.test.ts).
import { getDocumentProxy, getResolvedPDFJS } from 'unpdf';
import { prepareZXingModule, purgeZXingModule, readBarcodes } from 'zxing-wasm/reader';
import type { ExtractTicketPorts } from './handler.ts';

// Supabase gives an Edge Function 2 s of CPU per request: read only the first pages and a few images of a PDF
// (a ticket has its code on page 1; later pages are terms and conditions).
export const MAX_PDF_PAGES = 3;
export const MAX_PDF_IMAGES = 6;
// A ticket barcode is small (the fixtures are 564x148); a bigger image is skipped. pdf.js drops it before decoding.
// shortcut: image count is not bounded before decoding (pdf.js decodes in getOperatorList); only per-image size is, upgrade if real tickets hit memory limits.
export const MAX_PDF_IMAGE_PIXELS = 400_000;
const FORMATS = ['PDF417', 'Aztec', 'QRCode'] as const;
const READ_OPTIONS = { formats: [...FORMATS], tryHarder: true };

export type Stage1Ports = Pick<ExtractTicketPorts, 'decodeBarcodes' | 'extractPdfText'>;

type PdfImage = { data: ArrayLike<number>; width: number; height: number };

type PdfJsImage = PdfImage & { kind: number };

// pdf.js packs 1-bit images (and image masks) 8 pixels per byte, 0 = black / painted. As gray 0 / 255 both come out right once
// toRgba composites onto white: a painted mask pixel is black, an unpainted one is transparent = white.
function unpackBits({ data, width, height }: PdfImage): Uint8Array {
  const gray = new Uint8Array(width * height);
  const bytesPerRow = Math.ceil(width / 8);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) gray[y * width + x] = ((data[y * bytesPerRow + (x >> 3)]! >> (7 - (x & 7))) & 1) * 255;
  return gray;
}

// pdf.js hands a decoded image over through the page's object store; a dropped (too large) image never appears there, but
// its operator is dropped too, so this is never asked for one.
const pageObject = (page: { objs: { get(id: string, cb: (obj: PdfJsImage) => void): void }; commonObjs: { get(id: string, cb: (obj: PdfJsImage) => void): void } }, id: string) =>
  new Promise<PdfJsImage>((resolve) => (id.startsWith('g_') ? page.commonObjs : page.objs).get(id, resolve));

// unpdf returns 1 (gray), 3 (RGB) or 4 (RGBA) channels per pixel, inferred here from the data length; the reader wants RGBA.
export function toRgba({ data, width, height }: PdfImage): Uint8ClampedArray {
  const channels = Math.round(data.length / (width * height));
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const at = i * channels;
    // Image masks come as black RGB with a transparent background: composite onto white, or a mask turns into a black block.
    const alpha = channels === 4 ? data[at + 3]! / 255 : 1;
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = data[channels >= 3 ? at + c : at]! * alpha + 255 * (1 - alpha);
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
  purge = purgeZXingModule,
}: {
  wasmBinary: ArrayBuffer;
  /** Only for tests. */
  prepare?: typeof prepareZXingModule;
  /** Only for tests. */
  purge?: typeof purgeZXingModule;
}): Stage1Ports {
  let ready: Promise<unknown> | undefined;
  const reader = () =>
    (ready ??= prepare({ overrides: { wasmBinary }, fireImmediately: true }).catch((error: unknown) => {
      purge(); // zxing-wasm caches the rejected promise per wasmBinary: drop it, or every retry gets the same failure
      ready = undefined; // a failed load is not cached: the next request tries again
      throw error;
    }));
  const texts = (results: { text: string; isValid: boolean }[]) => results.filter((r) => r.isValid).map((r) => r.text);

  return {
    async decodeBarcodes(bytes, mimeType) {
      await reader();
      if (mimeType === 'image/jpeg') return texts(await readBarcodes(bytes, READ_OPTIONS));
      // verbosity 0: pdf.js logs a warning for every skipped image otherwise
      const doc = await getDocumentProxy(new Uint8Array(bytes), { maxImageSize: MAX_PDF_IMAGE_PIXELS, verbosity: 0 });
      const { OPS, ImageKind } = await getResolvedPDFJS();
      const found: string[] = [];
      let images = 0;
      // Own walk instead of unpdf's extractImages: that converts every image of a page to RGBA up front (4 more bytes
      // per pixel each); here only the first MAX_PDF_IMAGES are converted, then it stops.
      // shortcut: optional-content visibility is not checked, so a hidden image may use up one of the reads, upgrade if real tickets hide images behind optional content.
      for (let n = 1; n <= Math.min(doc.numPages, MAX_PDF_PAGES) && images < MAX_PDF_IMAGES; n++) {
        const page = await doc.getPage(n);
        const { fnArray, argsArray } = await page.getOperatorList();
        for (let i = 0; i < fnArray.length && images < MAX_PDF_IMAGES; i++) {
          const fn = fnArray[i];
          const args = argsArray[i] as [unknown, ...unknown[]];
          let image: PdfJsImage | undefined;
          const isMask = fn === OPS.paintImageMaskXObject; // masks carry no `kind`: always 1-bit
          if (fn === OPS.paintInlineImageXObject) image = args[0] as PdfJsImage;
          else if (fn === OPS.paintImageXObject) image = await pageObject(page, args[0] as string);
          else if (isMask) image = await pageObject(page, (args[0] as { data: string }).data);
          else continue;
          images++;
          if (!image?.data) continue;
          const pixels = isMask || image.kind === ImageKind.GRAYSCALE_1BPP ? unpackBits(image) : image.data;
          const imageData = { data: toRgba({ data: pixels, width: image.width, height: image.height }), width: image.width, height: image.height, colorSpace: 'srgb' };
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
