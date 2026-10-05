import type { SegmentInput, Trip } from '@/schemas';

/** Trip dates come from flights (D4): local arrival date of the outbound … local departure date of the return. */
export function deriveTripDates(flights: {
  outbound: Pick<SegmentInput, 'arriveAt'>[];
  return: Pick<SegmentInput, 'departAt'>[];
}): Pick<Trip, 'startDate' | 'endDate'> {
  const lastOutbound = flights.outbound[flights.outbound.length - 1];
  const firstReturn = flights.return[0];
  return { startDate: lastOutbound.arriveAt.slice(0, 10), endDate: firstReturn.departAt.slice(0, 10) };
}
