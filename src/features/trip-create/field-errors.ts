import type { z } from 'zod';

/** First error message (an i18n key) per field, keyed by dotted path: "outbound.0.departAt". */
export function fieldErrors(result: { success: boolean; error?: z.ZodError }): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) {
    const key = issue.path.join('.');
    errors[key] ??= issue.message;
  }
  return errors;
}
