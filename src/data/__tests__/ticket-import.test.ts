import { ServerUnreachableError } from '@/data/errors';
import { extractTicket, NotATicketError, TicketImportError, TicketLimitError, UnsupportedTicketFileError } from '@/data/ticket-import';
import type { ExtractTicketRequest } from '@/schemas';
import { fakeSupabase } from '@/test/fake-supabase';

const { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } = jest.requireActual('@supabase/supabase-js');

const REQUEST: ExtractTicketRequest = { mimeType: 'application/pdf', dataBase64: 'JVBERi0=' };
const SEGMENT = { direction: 'outbound', fromIata: 'WAW', toIata: 'LIS', flightNumber: 'LO123', flightDate: '2026-12-01', departAt: null, arriveAt: null };
const RESPONSE = { segments: [SEGMENT], source: 'parser', complete: false, remainingToday: 4 };

function setup() {
  const supabase = fakeSupabase();
  return { supabase, run: (request: ExtractTicketRequest = REQUEST) => extractTicket(request, { supabase: supabase.client }) };
}

const httpError = (status: number, body: unknown) => new FunctionsHttpError({ status, json: async () => body });
const failure = (promise: Promise<unknown>) => promise.then(() => null, (e: unknown) => e);

describe('extractTicket (ticket-import step 5)', () => {
  it('invokes extract-ticket with the validated body and returns the validated response', async () => {
    const { supabase, run } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: RESPONSE, error: null });
    await expect(run()).resolves.toEqual(RESPONSE);
    expect(supabase.invoke.mock.calls).toEqual([['extract-ticket', { body: REQUEST }]]);
  });

  it('an invalid request fails before any call', async () => {
    const { supabase, run } = setup();
    expect(await failure(run({ ...REQUEST, dataBase64: '' }))).toBeInstanceOf(TicketImportError);
    expect(supabase.invoke).not.toHaveBeenCalled();
  });

  it('a success body of the wrong shape is an error, never returned', async () => {
    const { supabase, run } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: { ...RESPONSE, segments: [] }, error: null });
    expect(await failure(run())).toBeInstanceOf(TicketImportError);
  });

  it('not_a_ticket', async () => {
    const { supabase, run } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error: httpError(422, { error: 'not_a_ticket' }) });
    expect(await failure(run())).toBeInstanceOf(NotATicketError);
  });

  it('limit_reached', async () => {
    const { supabase, run } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error: httpError(429, { error: 'limit_reached' }) });
    expect(await failure(run())).toBeInstanceOf(TicketLimitError);
  });

  it.each([['unsupported_file', 415], ['file_too_large', 413]])('%s carries its code', async (code, status) => {
    const { supabase, run } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error: httpError(status, { error: code }) });
    const error = await failure(run());
    expect(error).toBeInstanceOf(UnsupportedTicketFileError);
    expect((error as UnsupportedTicketFileError).code).toBe(code);
  });

  it('401 is unauthorized', async () => {
    const { supabase, run } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error: httpError(401, { error: 'unauthorized' }) });
    expect(await failure(run())).toMatchObject({ kind: 'unauthorized' });
  });

  it('no answer and a timeout are ServerUnreachableError', async () => {
    for (const cause of [new Error('Network request failed'), new DOMException('Aborted', 'AbortError')]) {
      const { supabase, run } = setup();
      supabase.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(cause) });
      expect(await failure(run())).toBeInstanceOf(ServerUnreachableError);
    }
  });

  it.each([
    ['upstream_failed', httpError(502, { error: 'upstream_failed' })],
    ['an unknown code', httpError(500, { error: 'boom' })],
    ['an unreadable body', new FunctionsHttpError({ status: 500, json: async () => Promise.reject(new Error('not json')) })],
    ['a relay error', new FunctionsRelayError({ status: 502 })],
  ])('%s is a generic failure', async (_name, error) => {
    const { supabase, run } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error });
    expect(await failure(run())).toMatchObject({ kind: 'failed' });
  });
});
