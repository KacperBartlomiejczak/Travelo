import { TICKET_MAX_BYTES } from '../../../../src/schemas/ticket';
import { MAX_BODY_BYTES, readJsonBody } from '../body';

const enc = new TextEncoder();

function streamOf(chunks: Uint8Array[], onCancel?: () => void) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
    cancel: onCancel,
  });
}

const reqOf = (body: ReadableStream<Uint8Array> | null, headers: Record<string, string> = {}) =>
  ({ headers: new Headers(headers), body }) as unknown as Request;

describe('readJsonBody', () => {
  it('derives the cap from TICKET_MAX_BYTES (base64 + envelope margin)', () => {
    expect(MAX_BODY_BYTES).toBeGreaterThan(Math.ceil(TICKET_MAX_BYTES / 3) * 4);
  });

  it('returns the parsed object under the cap', async () => {
    const req = reqOf(streamOf([enc.encode('{"a":'), enc.encode('1}')]));
    expect(await readJsonBody(req)).toEqual({ ok: true, body: { a: 1 } });
  });

  it('rejects early when Content-Length is over the cap, without reading', async () => {
    const body = new ReadableStream<Uint8Array>();
    const req = reqOf(body, { 'content-length': String(MAX_BODY_BYTES + 1) });
    expect(await readJsonBody(req)).toEqual({ ok: false, error: 'too_large' });
    expect(body.locked).toBe(false);
  });

  it('rejects a streamed body over the cap without Content-Length and cancels the stream', async () => {
    const cancel = jest.fn();
    const chunk = new Uint8Array(MAX_BODY_BYTES / 2 + 1);
    const req = reqOf(streamOf([chunk, chunk, chunk], cancel));
    expect(await readJsonBody(req)).toEqual({ ok: false, error: 'too_large' });
    expect(cancel).toHaveBeenCalled();
  });

  it('counts real bytes when Content-Length lies', async () => {
    const chunk = new Uint8Array(MAX_BODY_BYTES + 1);
    const req = reqOf(streamOf([chunk]), { 'content-length': '10' });
    expect(await readJsonBody(req)).toEqual({ ok: false, error: 'too_large' });
  });

  it('returns undefined body for invalid JSON or no body', async () => {
    expect(await readJsonBody(reqOf(streamOf([enc.encode('{nope')])))).toEqual({ ok: true, body: undefined });
    expect(await readJsonBody(reqOf(null))).toEqual({ ok: true, body: undefined });
  });
});
