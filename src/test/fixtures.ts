import type { z } from 'zod';

import type { CreateTripInputSchema } from '@/schemas';

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
          departAt: '2026-11-02T10:00',
          arriveAt: '2026-11-02T18:30',
          flightNumber: 'EK180',
        },
        {
          fromIata: 'DXB',
          departTz: 'Asia/Dubai',
          toIata: 'BKK',
          arriveTz: 'Asia/Bangkok',
          departAt: '2026-11-03T03:30',
          arriveAt: '2026-11-03T12:45',
        },
      ],
      return: [
        {
          fromIata: 'BKK',
          departTz: 'Asia/Bangkok',
          toIata: 'WAW',
          arriveTz: 'Europe/Warsaw',
          departAt: '2026-11-15T09:00',
          arriveAt: '2026-11-15T17:00',
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
    budget: { budgetPerPerson: { amountMinor: 3000000, currency: 'THB' } },
  };
}
