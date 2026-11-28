// Runs the stage 1 adapters on the fixtures in a plain Node process (unpdf is ESM-only, Jest cannot load it) and
// prints the results as JSON. Used by stage1.test.ts. fetch is replaced so any network use is recorded.
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const fixture = (name) => new Uint8Array(readFileSync(here(`../__tests__/fixtures/${name}`)));
const wasm = readFileSync(here('../../../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'));
const wasmBinary = wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength);

let fetchCalls = 0;
globalThis.fetch = () => {
  fetchCalls++;
  throw new Error('network is not allowed');
};

const { createStage1Ports, toRgba, MAX_PDF_PAGES, MAX_PDF_IMAGES, MAX_PDF_IMAGE_PIXELS } = await import('../stage1.ts');
const { buildImagePdf } = await import('./make-image-pdf.mjs');
const { extractImages, getDocumentProxy } = await import('unpdf');
const ports = createStage1Ports({ wasmBinary });
// A failed wasm load must not stay cached: the first prepare call rejects, the next one succeeds, then it is cached.
const { prepareZXingModule } = await import('zxing-wasm/reader');
let prepareCalls = 0;
let purgeCalls = 0;
const retrying = createStage1Ports({
  wasmBinary,
  prepare: (options) => {
    if (++prepareCalls === 1) return Promise.reject(new Error('load failed'));
    return prepareZXingModule(options);
  },
  purge: () => {
    purgeCalls++;
  },
});
const firstFailed = await retrying.decodeBarcodes(fixture('pdf417.jpg'), 'image/jpeg').then(() => false, () => true);
const retried = await retrying.decodeBarcodes(fixture('pdf417.jpg'), 'image/jpeg');
await retrying.decodeBarcodes(fixture('pdf417.jpg'), 'image/jpeg');

// The PDF417 image of pdf417.pdf (564x148) as RGB, then the same pixels scaled x4 (2256x592 > MAX_PDF_IMAGE_PIXELS).
const [barcode] = await extractImages(await getDocumentProxy(fixture('pdf417.pdf')), 1);
const scaled = (k) => {
  const width = barcode.width * k;
  const height = barcode.height * k;
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 3; c++) rgb[(y * width + x) * 3 + c] = barcode.data[(Math.floor(y / k) * barcode.width + Math.floor(x / k)) * 4 + c];
  return { width, height, rgb };
};
const filler = (shade) => ({ width: 8, height: 8, rgb: Buffer.alloc(8 * 8 * 3, shade) });
// The same barcode as a 1-bit image mask: dark pixels (gray < 128) are bit 0 = painted, black on a transparent background.
const maskImage = () => {
  const { width, height, rgb } = scaled(1);
  const bytesPerRow = Math.ceil(width / 8);
  const mask = Buffer.alloc(bytesPerRow * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) if (rgb[(y * width + x) * 3] >= 128) mask[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
  return { width, height, mask };
};
// The same barcode as 1-bit DeviceGray (bit 1 = white) and as DeviceCMYK (K channel only).
const grayImage = () => ({ ...maskImage(), mask: undefined, raw: maskImage().mask, space: 'DeviceGray', bits: 1 });
const cmykImage = () => {
  const { width, height, rgb } = scaled(1);
  const raw = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) raw[i * 4 + 3] = 255 - rgb[i * 3];
  return { width, height, raw, space: 'DeviceCMYK', bits: 8 };
};
const warnings = [];
const origWarn = console.log;
console.log = (...args) => warnings.push(args.join(' '));
const oversizedOnly = await ports.decodeBarcodes(buildImagePdf([scaled(4)]), 'application/pdf');
const oversizedAndSmall = await ports.decodeBarcodes(buildImagePdf([scaled(4), scaled(1)]), 'application/pdf');
const smallOnly = await ports.decodeBarcodes(buildImagePdf([scaled(1)]), 'application/pdf');
const sixthImage = await ports.decodeBarcodes(buildImagePdf([1, 2, 3, 4, 5].map(filler).concat(scaled(1))), 'application/pdf');
const seventhImage = await ports.decodeBarcodes(buildImagePdf([1, 2, 3, 4, 5, 6].map(filler).concat(scaled(1))), 'application/pdf');
const imageMask = await ports.decodeBarcodes(buildImagePdf([maskImage()]), 'application/pdf');
const gray1bit = await ports.decodeBarcodes(buildImagePdf([grayImage()]), 'application/pdf');
const cmyk = await ports.decodeBarcodes(buildImagePdf([cmykImage()]), 'application/pdf');
console.log = origWarn;

// Document lifecycle: every opened document is destroyed after success and after a thrown error; image decoders are
// registered once, before the first document is opened.
const events = [];
const tracking = createStage1Ports({
  wasmBinary,
  register: () => events.push('register'),
  openDocument: async (data, options) => {
    events.push('open');
    const doc = await getDocumentProxy(data, options);
    const destroy = doc.loadingTask.destroy.bind(doc.loadingTask);
    doc.loadingTask.destroy = () => (events.push('destroy'), destroy());
    return doc;
  },
});
const lifecycle = {};
await tracking.decodeBarcodes(fixture('pdf417.pdf'), 'application/pdf');
await tracking.extractPdfText(fixture('text.pdf'));
lifecycle.afterSuccess = [...events];
events.length = 0;
const failing = createStage1Ports({
  wasmBinary,
  register: () => {},
  openDocument: async (data, options) => {
    const doc = await getDocumentProxy(data, options);
    doc.getPage = () => Promise.reject(new Error('page failed'));
    const destroy = doc.loadingTask.destroy.bind(doc.loadingTask);
    doc.loadingTask.destroy = () => (events.push('destroy'), destroy());
    return doc;
  },
});
lifecycle.decodeThrew = await failing.decodeBarcodes(fixture('pdf417.pdf'), 'application/pdf').then(() => false, () => true);
lifecycle.extractThrew = await failing.extractPdfText(fixture('text.pdf')).then(() => false, () => true);
lifecycle.afterErrors = [...events];

const rejecting = createStage1Ports({
  wasmBinary,
  register: () => {},
  openDocument: async (data, options) => {
    const doc = await getDocumentProxy(data, options);
    doc.loadingTask.destroy = () => Promise.reject(new Error('destroy failed'));
    return doc;
  },
});
lifecycle.destroyRejects = {
  barcodes: await rejecting.decodeBarcodes(fixture('pdf417.pdf'), 'application/pdf').catch(() => 'threw'),
  text: await rejecting.extractPdfText(fixture('text.pdf')).catch(() => 'threw'),
};

const out = {
  lifecycle,
  imageCount: { sixthImage, seventhImage },
  imageMask,
  gray1bit,
  cmyk,
  oversize: { oversizedOnly, oversizedAndSmall, smallOnly, oversizedPixels: scaled(4).width * scaled(4).height, warnings },
  retry: { firstFailed, retried, prepareCalls, purgeCalls },
  // 2x1 RGBA: a transparent pixel (mask background) and a half-transparent black one; 2x1 RGB and gray stay as they are.
  rgba: Array.from(toRgba({ data: [0, 0, 0, 0, 0, 0, 0, 128], width: 2, height: 1 })),
  rgbaOpaque: Array.from(toRgba({ data: [10, 20, 30, 255, 40, 50, 60, 255], width: 2, height: 1 })),
  rgb: Array.from(toRgba({ data: [1, 2, 3, 4, 5, 6], width: 2, height: 1 })),
  gray: Array.from(toRgba({ data: [7, 8], width: 2, height: 1 })),
  textPage4: await ports.extractPdfText(fixture('text-on-page-4.pdf')),
  // First call also loads the wasm: it must not touch the network.
  jpegPdf417: await ports.decodeBarcodes(fixture('pdf417.jpg'), 'image/jpeg'),
  jpegAztec: await ports.decodeBarcodes(fixture('aztec.jpg'), 'image/jpeg'),
  pdfImage: await ports.decodeBarcodes(fixture('pdf417.pdf'), 'application/pdf'),
  pdfTextOnly: await ports.decodeBarcodes(fixture('text.pdf'), 'application/pdf'),
  garbage: await ports.decodeBarcodes(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), 'image/jpeg'),
  text: await ports.extractPdfText(fixture('text.pdf')),
  textOfImagePdf: await ports.extractPdfText(fixture('pdf417.pdf')),
  limits: { MAX_PDF_PAGES, MAX_PDF_IMAGES, MAX_PDF_IMAGE_PIXELS },
  fetchCalls,
};
console.log(JSON.stringify(out));
