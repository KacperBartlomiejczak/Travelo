import type { z } from 'zod';

import { defaultTripName } from '@/lib/trip-name';
import type { CreateTripInputSchema, SegmentInputSchema } from '@/schemas';

type TripInput = z.input<typeof CreateTripInputSchema>;
type Segment = z.input<typeof SegmentInputSchema>;

/** `date` (YYYY-MM-DD) moved by `days`. */
function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

function segment(from: [string, string], to: [string, string], departAt: string, arriveAt: string, flightNumber: string): Segment {
  return { fromIata: from[0], departTz: from[1], toIata: to[0], arriveTz: to[1], departAt, arriveAt, flightNumber };
}

function trip(flights: TripInput['flights'], friends: TripInput['friends']['friends'], budget: TripInput['budget']): TripInput {
  return { flights, friends: { friends }, budget, details: { name: defaultTripName(flights.outbound) } };
}

const KRK: [string, string] = ['KRK', 'Europe/Warsaw'];
const WAW: [string, string] = ['WAW', 'Europe/Warsaw'];
const LIS: [string, string] = ['LIS', 'Europe/Lisbon'];
const DXB: [string, string] = ['DXB', 'Asia/Dubai'];
const BKK: [string, string] = ['BKK', 'Asia/Bangkok'];
const FCO: [string, string] = ['FCO', 'Europe/Rome'];

/**
 * Three trips shown in development builds (trip-flight-tabs-name-cover D8), dated from `today` (YYYY-MM-DD)
 * so they always lie in the future. Times avoid 02:00–03:00 in Europe, where clocks change.
 */
export function exampleTrips(today: string): TripInput[] {
  const day = (offset: number, time: string) => `${addDays(today, offset)}T${time}`;
  return [
    trip(
      {
        outbound: [segment(KRK, LIS, day(10, '06:10'), day(10, '09:05'), 'TP1271')],
        return: [segment(LIS, KRK, day(15, '10:00'), day(15, '15:45'), 'TP1270')],
        companionCount: 2,
      },
      [
        { displayName: 'Kasia', interests: ['beaches', 'nightlife'] },
        { displayName: 'Ola', interests: ['museums', 'local_cuisine'] },
      ],
      { budgetPerPerson: { amountMinor: 250000, currency: 'EUR' } },
    ),
    trip(
      {
        outbound: [
          segment(WAW, DXB, day(40, '14:00'), day(40, '22:10'), 'EK180'),
          segment(DXB, BKK, day(41, '03:30'), day(41, '12:45'), 'EK384'),
        ],
        return: [segment(BKK, WAW, day(52, '09:00'), day(52, '17:00'), 'LO791')],
        companionCount: 3,
      },
      [
        { displayName: 'Kasia', interests: ['beaches'] },
        { displayName: 'Bartek', interests: ['street_food', 'nightlife'] },
        { displayName: 'Ola', interests: [] },
      ],
      { budgetPerPerson: { amountMinor: 3000000, currency: 'THB' } },
    ),
    trip(
      {
        outbound: [segment(WAW, FCO, day(75, '07:00'), day(75, '09:20'), 'LO325')],
        return: [segment(FCO, WAW, day(79, '18:00'), day(79, '20:20'), 'LO326')],
        companionCount: 0,
      },
      [],
      { budgetPerPerson: { amountMinor: 150000, currency: 'EUR' } },
    ),
  ];
}
