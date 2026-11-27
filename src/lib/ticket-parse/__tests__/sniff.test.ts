import { TICKET_MAX_BYTES } from '../../../schemas/ticket';
import { sniffTicketFile } from '../sniff';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];

describe('sniffTicketFile', () => {
  it('accepts a PDF with %PDF- magic', () => {
    const r = sniffTicketFile({ mimeType: 'application/pdf', dataBase64: b64(PDF) });
    expect(r).toEqual({ ok: true, bytes: new Uint8Array(PDF) });
  });

  it('rejects PDF mime with other bytes', () => {
    const r = sniffTicketFile({ mimeType: 'application/pdf', dataBase64: b64([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x21]) });
    expect(r).toEqual({ ok: false, error: 'unsupported_file' });
  });

  it('accepts JPEG with FF D8 FF', () => {
    const r = sniffTicketFile({ mimeType: 'image/jpeg', dataBase64: b64([0xff, 0xd8, 0xff, 0xe0, 0x00]) });
    expect(r.ok).toBe(true);
  });

  it('rejects PNG bytes with jpeg mime and JPEG bytes with pdf mime', () => {
    const png = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffTicketFile({ mimeType: 'image/jpeg', dataBase64: png })).toEqual({ ok: false, error: 'unsupported_file' });
    const jpg = b64([0xff, 0xd8, 0xff, 0xe0]);
    expect(sniffTicketFile({ mimeType: 'application/pdf', dataBase64: jpg })).toEqual({ ok: false, error: 'unsupported_file' });
  });

  it('rejects empty and invalid base64', () => {
    expect(sniffTicketFile({ mimeType: 'application/pdf', dataBase64: '' })).toEqual({ ok: false, error: 'unsupported_file' });
    expect(sniffTicketFile({ mimeType: 'application/pdf', dataBase64: '!!!notbase64' })).toEqual({
      ok: false,
      error: 'unsupported_file',
    });
  });

  it('rejects files over 5 MiB without decoding', () => {
    const big = Buffer.alloc(TICKET_MAX_BYTES + 1, 0x41);
    expect(sniffTicketFile({ mimeType: 'application/pdf', dataBase64: big.toString('base64') })).toEqual({
      ok: false,
      error: 'file_too_large',
    });
  });

  it('accepts a file of exactly 5 MiB', () => {
    const buf = Buffer.alloc(TICKET_MAX_BYTES, 0x41);
    PDF.forEach((v, i) => (buf[i] = v));
    expect(sniffTicketFile({ mimeType: 'application/pdf', dataBase64: buf.toString('base64') }).ok).toBe(true);
  });
});
