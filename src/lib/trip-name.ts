import type { SegmentInput } from '@/schemas';

import { destinationName } from './airport-search';

/** "<city the outbound starts from> → <destination city>" (trip-flight-tabs-name-cover D3); '' until both airports are picked. */
export function defaultTripName(outbound: Pick<SegmentInput, 'fromIata' | 'toIata'>[]): string {
  const from = outbound[0].fromIata;
  const to = outbound[outbound.length - 1].toIata;
  if (!from || !to) return '';
  return `${destinationName(from)} → ${destinationName(to)}`;
}
