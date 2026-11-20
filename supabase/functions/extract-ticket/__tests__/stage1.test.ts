import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Real fixtures made for this test (fake data only, see fixtures/): JPEGs with PDF417 / Aztec, a PDF with a text
// layer, a PDF with an embedded PDF417 image. The adapters run in plain Node (unpdf is ESM-only, Jest cannot load it).
const BCBP = readFileSync(join(__dirname, 'fixtures', 'bcbp.txt'), 'utf8');
const out = JSON.parse(
  execFileSync(process.execPath, [join(__dirname, '..', 'test-support', 'stage1-driver.mjs')], { encoding: 'utf8', timeout: 60_000 }),
);

describe('extract-ticket stage 1 ports', () => {
  it('reads a PDF417 and an Aztec code from a JPEG', () => {
    expect(out.jpegPdf417).toEqual([BCBP]);
    expect(out.jpegAztec).toEqual([BCBP]);
  });

  it('reads a PDF417 image embedded in a PDF, without a page renderer', () => {
    expect(out.pdfImage).toEqual([BCBP]);
  });

  it('finds no barcode in a PDF with text only, and in garbage', () => {
    expect(out.pdfTextOnly).toEqual([]);
    expect(out.garbage).toEqual([]);
  });

  it('extracts the text layer of a PDF and returns null when there is none', () => {
    expect(out.text).toContain('WAW to BCN FR123 Departure 2026-12-06 06:45');
    expect(out.textOfImagePdf).toBeNull();
  });

  it('reads the text of the first 3 pages only, not a flight on page 4', () => {
    expect(out.textPage4).toContain('Terms page one');
    expect(out.textPage4).toContain('Terms page three');
    expect(out.textPage4).not.toContain('FR123');
  });

  it('retries loading the wasm after a failed load, and caches a successful one', () => {
    expect(out.retry).toEqual({ firstFailed: true, retried: [BCBP], prepareCalls: 2 });
  });

  it('loads the reader wasm from the given bytes, with no network request', () => {
    expect(out.fetchCalls).toBe(0);
  });

  it('limits the pages and images it reads to stay within the 2 s CPU budget', () => {
    expect(out.limits).toEqual({ MAX_PDF_PAGES: 3, MAX_PDF_IMAGES: 6 });
  });
});
