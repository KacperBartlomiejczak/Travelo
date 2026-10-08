import { REQUEST_TIMEOUT_MS, withTimeout } from '@/data/fetch-timeout';

const URL = 'https://example.supabase.co/rest/v1/trips';

/** A fetch whose server never answers: like a real fetch, it rejects only when its signal is (or gets) aborted. */
function neverAnswers() {
  return jest.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        const abort = () => reject(new DOMException('Aborted', 'AbortError'));
        if (init?.signal?.aborted) abort();
        init?.signal?.addEventListener('abort', abort);
      }),
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('gives up after 20 s (trips-supabase D14)', () => {
  expect(REQUEST_TIMEOUT_MS).toBe(20_000);
});

it('aborts a request that never answers once the timeout is over, not before', async () => {
  const request = withTimeout(neverAnswers(), REQUEST_TIMEOUT_MS)(URL);
  let settled = false;
  request.then(
    () => (settled = true),
    () => (settled = true),
  );

  await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
  expect(settled).toBe(false);

  await jest.advanceTimersByTimeAsync(1);
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
});

it('passes an answer through unchanged and never aborts it afterwards', async () => {
  const response = new Response('[]', { status: 200 });
  const fetchImpl = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response);

  await expect(withTimeout(fetchImpl, REQUEST_TIMEOUT_MS)(URL)).resolves.toBe(response);

  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
  expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(false);
});

it('still lets the caller cancel the request', async () => {
  const caller = new AbortController();
  const request = withTimeout(neverAnswers(), REQUEST_TIMEOUT_MS)(URL, { signal: caller.signal });

  caller.abort();

  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  expect(jest.getTimerCount()).toBe(0);
});

it('fails right away when the caller has already cancelled', async () => {
  const caller = new AbortController();
  caller.abort();
  await expect(withTimeout(neverAnswers(), REQUEST_TIMEOUT_MS)(URL, { signal: caller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(jest.getTimerCount()).toBe(0);
});

it('sends the method, headers and body as given', async () => {
  const fetchImpl = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));

  await withTimeout(fetchImpl, REQUEST_TIMEOUT_MS)(URL, { method: 'PATCH', headers: { apikey: 'key' }, body: '{"a":1}' });

  expect(fetchImpl).toHaveBeenCalledWith(
    URL,
    expect.objectContaining({ method: 'PATCH', headers: { apikey: 'key' }, body: '{"a":1}', signal: expect.any(AbortSignal) }),
  );
});
