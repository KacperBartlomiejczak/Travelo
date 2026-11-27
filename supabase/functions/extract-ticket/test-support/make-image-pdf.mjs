// Builds a one-page PDF with Flate-compressed images: RGB ({ width, height, rgb }) or 1-bit image masks ({ width, height, mask }, rows
// packed 8 pixels per byte, bit 0 = painted) or raw samples in another color space ({ width, height, raw, space, bits }). Used by stage1-driver.mjs.
import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';

export function buildImagePdf(images) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << ${images.map((_, i) => `/Im${i} ${5 + i} 0 R`).join(' ')} >> >> >>`,
  ];
  const content = Buffer.from(images.map((_, i) => `q 200 0 0 100 10 ${10 + i * 110} cm /Im${i} Do Q`).join('\n'));
  objs.push({ dict: `<< /Length ${content.length} >>`, stream: content });
  for (const { width, height, rgb, mask, raw, space, bits } of images) {
    const z = deflateSync(rgb ?? mask ?? raw);
    const format = mask ? '/ImageMask true /BitsPerComponent 1' : `/ColorSpace /${space ?? 'DeviceRGB'} /BitsPerComponent ${bits ?? 8}`;
    objs.push({ dict: `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ${format} /Filter /FlateDecode /Length ${z.length} >>`, stream: z });
  }
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => {
    const buf = typeof o === 'string'
      ? Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`)
      : Buffer.concat([Buffer.from(`${i + 1} 0 obj\n${o.dict}\nstream\n`), o.stream, Buffer.from('\nendstream\nendobj\n')]);
    offsets.push(pos);
    pos += buf.length;
    parts.push(buf);
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  return new Uint8Array(Buffer.concat([...parts, Buffer.from(xref)]));
}
