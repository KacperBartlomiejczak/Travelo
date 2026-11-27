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
    expect(out.text.text).toContain('WAW to BCN FR123 Departure 2026-12-06 06:45');
    expect(out.text.skippedPages).toBe(false);
    expect(out.textOfImagePdf).toEqual({ text: null, skippedPages: false });
  });

  it('reads the text of the first 3 pages only, not a flight on page 4, and reports the skipped page', () => {
    expect(out.textPage4.text).toContain('Terms page one');
    expect(out.textPage4.text).toContain('Terms page three');
    expect(out.textPage4.text).not.toContain('FR123');
    expect(out.textPage4.skippedPages).toBe(true);
  });

  it('retries loading the wasm after a failed load, and caches a successful one', () => {
    expect(out.retry).toEqual({ firstFailed: true, retried: [BCBP], prepareCalls: 2, purgeCalls: 1 });
  });

  it('composites RGBA images onto white and leaves opaque, RGB and gray images unchanged', () => {
    expect(out.rgba).toEqual([255, 255, 255, 255, 127, 127, 127, 255]);
    expect(out.rgbaOpaque).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
    expect(out.rgb).toEqual([1, 2, 3, 255, 4, 5, 6, 255]);
    expect(out.gray).toEqual([7, 7, 7, 255, 8, 8, 8, 255]);
  });

  it('loads the reader wasm from the given bytes, with no network request', () => {
    expect(out.fetchCalls).toBe(0);
  });

  it('does not decode a PDF image above the pixel cap, and still reads one under it', () => {
    expect(out.oversize.oversizedPixels).toBeGreaterThan(400_000);
    expect(out.oversize.oversizedOnly).toEqual([]);
    expect(out.oversize.oversizedAndSmall).toEqual([BCBP]);
    expect(out.oversize.smallOnly).toEqual([BCBP]);
  });

  it('reads at most MAX_PDF_IMAGES images: a barcode on the 6th is read, one on the 7th is not', () => {
    expect(out.imageCount).toEqual({ sixthImage: [BCBP], seventhImage: [] });
  });

  it('reads a barcode painted as a 1-bit image mask', () => {
    expect(out.imageMask).toEqual([BCBP]);
  });

  it('reads a barcode from a 1-bit gray image and from a CMYK image', () => {
    expect(out.gray1bit).toEqual([BCBP]);
    expect(out.cmyk).toEqual([BCBP]);
  });

  it('does not log anything for a skipped image', () => {
    expect(out.oversize.warnings).toEqual([]);
  });

  it('registers the image decoders once, before the first document is opened', () => {
    expect(out.lifecycle.afterSuccess[0]).toBe('register');
    expect(out.lifecycle.afterSuccess.filter((e: string) => e === 'register')).toHaveLength(1);
  });

  it('destroys every opened document, after success and after an error', () => {
    expect(out.lifecycle.afterSuccess.filter((e: string) => e !== 'register')).toEqual(['open', 'destroy', 'open', 'destroy']);
    expect(out.lifecycle).toMatchObject({ decodeThrew: true, extractThrew: true });
    expect(out.lifecycle.afterErrors).toEqual(['destroy', 'destroy']);
  });

  it('keeps the result when destroying the document fails', () => {
    expect(out.lifecycle.destroyRejects.barcodes).toEqual([BCBP]);
    expect(out.lifecycle.destroyRejects.text.text).toContain('WAW to BCN FR123');
  });

  it('limits the pages and images it reads to stay within the 2 s CPU budget', () => {
    expect(out.limits).toEqual({ MAX_PDF_PAGES: 3, MAX_PDF_IMAGES: 6, MAX_PDF_IMAGE_PIXELS: 400_000 });
  });
});
