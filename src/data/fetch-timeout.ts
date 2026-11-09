/** How long a request may wait for the server (trips-supabase D14). */
export const REQUEST_TIMEOUT_MS = 20_000;

/** The `recommend-places` call waits longer: the server worst case is Places 10 s + Gemini 20 s + photos 5 s (places-legal-navbar D22). */
export const RECOMMEND_PLACES_TIMEOUT_MS = 45_000;

const RECOMMEND_PLACES_PATH = '/functions/v1/recommend-places';

/**
 * `fetch` that gives up after `ms`: a request the server never answers (e.g. a captive portal) is aborted, so
 * callers see a network failure instead of waiting forever. The caller's own signal still cancels it.
 */
export function withTimeout(fetchImpl: typeof fetch, ms: number): typeof fetch {
  return (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const limit = url.includes(RECOMMEND_PLACES_PATH) ? Math.max(ms, RECOMMEND_PLACES_TIMEOUT_MS) : ms;
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, limit);
    const callerSignal = init?.signal;
    if (callerSignal?.aborted) abort();
    else callerSignal?.addEventListener('abort', abort);
    return fetchImpl(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abort);
    });
  };
}
