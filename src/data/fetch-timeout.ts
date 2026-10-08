/** How long a request may wait for the server (trips-supabase D14). */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * `fetch` that gives up after `ms`: a request the server never answers (e.g. a captive portal) is aborted, so
 * callers see a network failure instead of waiting forever. The caller's own signal still cancels it.
 */
export function withTimeout(fetchImpl: typeof fetch, ms: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, ms);
    const callerSignal = init?.signal;
    if (callerSignal?.aborted) abort();
    else callerSignal?.addEventListener('abort', abort);
    return fetchImpl(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abort);
    });
  };
}
