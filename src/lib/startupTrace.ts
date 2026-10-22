// TEMPORARY (prompts/gate-startup-timing): remove after the measurement.
const startedAt = Date.now();

/** Logs `[startup] +<ms> <label>` in production JS only (silent in dev and Jest). */
export function trace(label: string): void {
  if (__DEV__) return;
  console.log(`[startup] +${Date.now() - startedAt}ms ${label}`);
}
