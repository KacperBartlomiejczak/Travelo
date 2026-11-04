import type { z } from 'zod';

import { DEFAULT_COVER, type CreateTripInputSchema } from '@/schemas';

const DAY_MS = 86_400_000;

// A calendar date `days` after today (UTC), so the "departure not in the past" rule holds on any day the suite runs.
export const inDays = (days: number, time: string) => `${new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10)}T${time}`;

// Shared wizard input for data-layer and screen tests: WAW → DXB → BKK, BKK → WAW, 2 friends.
export function createTripInputFixture(): z.input<typeof CreateTripInputSchema> {
  return {
    flights: {
      outbound: [
        {
          fromIata: 'WAW',
          departTz: 'Europe/Warsaw',
          toIata: 'DXB',
          arriveTz: 'Asia/Dubai',
          departAt: inDays(29, '10:00'),
          arriveAt: inDays(29, '18:30'),
          flightNumber: 'EK180',
        },
        {
          fromIata: 'DXB',
          departTz: 'Asia/Dubai',
          toIata: 'BKK',
          arriveTz: 'Asia/Bangkok',
          departAt: inDays(30, '03:30'),
          arriveAt: inDays(30, '12:45'),
        },
      ],
      return: [
        {
          fromIata: 'BKK',
          departTz: 'Asia/Bangkok',
          toIata: 'WAW',
          arriveTz: 'Europe/Warsaw',
          departAt: inDays(42, '09:00'),
          arriveAt: inDays(42, '17:00'),
        },
      ],
      companionCount: 2,
    },
    friends: {
      friends: [
        { displayName: 'Kasia', interests: ['beaches', 'nightlife'] },
        { displayName: 'Ola', interests: [] },
      ],
    },
    budget: { mode: 'shared', currency: 'THB', organizerDailyMinor: 100000, friendDailyMinor: [100000, 100000] },
    details: { name: 'Warsaw → Bangkok', coverImageUri: DEFAULT_COVER },
  };
}
