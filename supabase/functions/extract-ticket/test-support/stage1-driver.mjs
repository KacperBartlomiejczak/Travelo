// Runs the stage 1 adapters on the fixtures in a plain Node process (unpdf is ESM-only, Jest cannot load it) and
// prints the results as JSON. Used by stage1.test.ts. fetch is replaced so any network use is recorded.
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

const { createStage1Ports, MAX_PDF_PAGES, MAX_PDF_IMAGES } = await import('../stage1.ts');
const ports = createStage1Ports({ wasmBinary });
// A failed wasm load must not stay cached: the first prepare call rejects, the next one succeeds, then it is cached.
const { prepareZXingModule } = await import('zxing-wasm/reader');
let prepareCalls = 0;
const retrying = createStage1Ports({
  wasmBinary,
  prepare: (options) => {
    if (++prepareCalls === 1) return Promise.reject(new Error('load failed'));
    return prepareZXingModule(options);
  },
});
const firstFailed = await retrying.decodeBarcodes(fixture('pdf417.jpg'), 'image/jpeg').then(() => false, () => true);
const retried = await retrying.decodeBarcodes(fixture('pdf417.jpg'), 'image/jpeg');
await retrying.decodeBarcodes(fixture('pdf417.jpg'), 'image/jpeg');

const out = {
  retry: { firstFailed, retried, prepareCalls },
  textPage4: await ports.extractPdfText(fixture('text-on-page-4.pdf')),
  // First call also loads the wasm: it must not touch the network.
  jpegPdf417: await ports.decodeBarcodes(fixture('pdf417.jpg'), 'image/jpeg'),
  jpegAztec: await ports.decodeBarcodes(fixture('aztec.jpg'), 'image/jpeg'),
  pdfImage: await ports.decodeBarcodes(fixture('pdf417.pdf'), 'application/pdf'),
  pdfTextOnly: await ports.decodeBarcodes(fixture('text.pdf'), 'application/pdf'),
  garbage: await ports.decodeBarcodes(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), 'image/jpeg'),
  text: await ports.extractPdfText(fixture('text.pdf')),
  textOfImagePdf: await ports.extractPdfText(fixture('pdf417.pdf')),
  limits: { MAX_PDF_PAGES, MAX_PDF_IMAGES },
  fetchCalls,
};
console.log(JSON.stringify(out));
