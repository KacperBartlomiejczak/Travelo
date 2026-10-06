import type { z } from 'zod';

import {
  BudgetStepInputSchema,
  CreateTripInputSchema,
  FlightsStepInputSchema,
  FriendInputSchema,
  MAX_COMPANIONS,
  SegmentInputSchema,
  TripDetailsInputSchema,
} from '@/schemas';

type Segment = z.input<typeof SegmentInputSchema>;

const WAW_DXB: Segment = {
  fromIata: 'WAW',
  departTz: 'Europe/Warsaw',
  toIata: 'DXB',
  arriveTz: 'Asia/Dubai',
  departAt: '2026-11-02T10:00',
  arriveAt: '2026-11-02T18:30',
};
const DXB_BKK: Segment = {
  fromIata: 'DXB',
  departTz: 'Asia/Dubai',
  toIata: 'BKK',
  arriveTz: 'Asia/Bangkok',
  departAt: '2026-11-03T03:30',
  arriveAt: '2026-11-03T12:45',
};
const BKK_WAW: Segment = {
  fromIata: 'BKK',
  departTz: 'Asia/Bangkok',
  toIata: 'WAW',
  arriveTz: 'Europe/Warsaw',
  departAt: '2026-11-15T09:00',
  arriveAt: '2026-11-15T17:00',
};

const flights = { outbound: [WAW_DXB, DXB_BKK], return: [BKK_WAW], companionCount: 2 };

function issues(result: { success: boolean; error?: z.ZodError }) {
  return (result.error?.issues ?? []).map((issue) => ({ path: issue.path, message: issue.message }));
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-04T12:00:00+02:00') });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SegmentInput', () => {
  it('accepts a segment with or without a flight number', () => {
    expect(SegmentInputSchema.safeParse(WAW_DXB).success).toBe(true);
    expect(SegmentInputSchema.safeParse({ ...WAW_DXB, flightNumber: 'EK180' }).success).toBe(true);
  });

  it('treats an empty flight number as no flight number', () => {
    expect(SegmentInputSchema.parse({ ...WAW_DXB, flightNumber: '  ' }).flightNumber).toBeUndefined();
  });

  it('accepts an overnight flight that lands earlier on the local clock', () => {
    const wawJfk: Segment = {
      fromIata: 'WAW',
      departTz: 'Europe/Warsaw',
      toIata: 'JFK',
      arriveTz: 'America/New_York',
      departAt: '2026-11-02T23:30',
      arriveAt: '2026-11-03T02:10',
    };
    expect(SegmentInputSchema.safeParse(wawJfk).success).toBe(true);
  });

  it('rejects an arrival before the departure (compared as instants)', () => {
    // 15:00 in Dubai is 12:00 in Warsaw, i.e. before the 13:00 Warsaw departure.
    const result = SegmentInputSchema.safeParse({ ...WAW_DXB, departAt: '2026-11-02T13:00', arriveAt: '2026-11-02T15:00' });
    expect(issues(result)).toEqual([{ path: ['arriveAt'], message: 'validation.arrivalBeforeDeparture' }]);
  });

  it('rejects the same airport on both ends', () => {
    const result = SegmentInputSchema.safeParse({ ...WAW_DXB, toIata: 'WAW', arriveTz: 'Europe/Warsaw' });
    expect(issues(result)).toEqual([{ path: ['toIata'], message: 'validation.sameAirport' }]);
  });

  describe('times skipped when clocks go forward (Warsaw, 28 Mar 2027 02:00 → 03:00)', () => {
    const krkWaw: Segment = {
      fromIata: 'KRK',
      departTz: 'Europe/Warsaw',
      toIata: 'WAW',
      arriveTz: 'Europe/Warsaw',
      departAt: '2027-03-28T01:45',
      arriveAt: '2027-03-28T02:30',
    };

    it('rejects an arrival time that does not exist', () => {
      const result = SegmentInputSchema.safeParse(krkWaw);
      expect(issues(result)).toEqual([{ path: ['arriveAt'], message: 'validation.timeDoesNotExist' }]);
    });

    it('rejects a departure time that does not exist', () => {
      const result = SegmentInputSchema.safeParse({ ...WAW_DXB, departAt: '2027-03-28T02:30', arriveAt: '2027-03-28T12:00' });
      expect(issues(result)).toEqual([{ path: ['departAt'], message: 'validation.timeDoesNotExist' }]);
    });

    it('does not also compare the times when one does not exist', () => {
      // Read as 03:45, the departure would look later than the 03:15 arrival.
      const result = SegmentInputSchema.safeParse({ ...krkWaw, departAt: '2027-03-28T02:45', arriveAt: '2027-03-28T03:15' });
      expect(issues(result)).toEqual([{ path: ['departAt'], message: 'validation.timeDoesNotExist' }]);
    });
  });

  it('rejects an impossible calendar date as a missing date-time', () => {
    const result = SegmentInputSchema.safeParse({ ...WAW_DXB, departAt: '2027-02-31T10:00', arriveAt: '2027-03-01T18:30' });
    expect(issues(result)).toEqual([{ path: ['departAt'], message: 'validation.dateTimeRequired' }]);
  });

  it('reports missing airports and times with i18n keys', () => {
    const result = SegmentInputSchema.safeParse({ ...WAW_DXB, fromIata: '', departAt: '' });
    expect(issues(result)).toEqual(
      expect.arrayContaining([
        { path: ['fromIata'], message: 'validation.airportRequired' },
        { path: ['departAt'], message: 'validation.dateTimeRequired' },
      ]),
    );
  });
});

describe('FlightsStepInput', () => {
  it('accepts outbound with a layover, a return and companions', () => {
    expect(FlightsStepInputSchema.safeParse(flights).success).toBe(true);
  });

  it('accepts a departure today', () => {
    const today = { ...WAW_DXB, departAt: '2026-10-04T22:00', arriveAt: '2026-10-05T06:30' };
    expect(FlightsStepInputSchema.safeParse({ ...flights, outbound: [today], return: [BKK_WAW] }).success).toBe(true);
  });

  it('accepts an open-jaw trip (return from a different airport)', () => {
    const fromHkt = { ...BKK_WAW, fromIata: 'HKT', departTz: 'Asia/Bangkok' };
    expect(FlightsStepInputSchema.safeParse({ ...flights, return: [fromHkt] }).success).toBe(true);
  });

  it.each([0, MAX_COMPANIONS])('accepts %p companions', (companionCount) => {
    expect(FlightsStepInputSchema.safeParse({ ...flights, companionCount }).success).toBe(true);
  });

  it.each([-1, MAX_COMPANIONS + 1, 1.5])('rejects %p companions', (companionCount) => {
    expect(FlightsStepInputSchema.safeParse({ ...flights, companionCount }).success).toBe(false);
  });

  it('allows up to 19 companions (group of 20)', () => {
    expect(MAX_COMPANIONS).toBe(19);
  });

  it('requires at least one outbound and one return segment', () => {
    expect(FlightsStepInputSchema.safeParse({ ...flights, outbound: [] }).success).toBe(false);
    expect(FlightsStepInputSchema.safeParse({ ...flights, return: [] }).success).toBe(false);
  });

  it('rejects a layover segment that departs from another airport than the previous arrival', () => {
    const fromAuh = { ...DXB_BKK, fromIata: 'AUH' };
    const result = FlightsStepInputSchema.safeParse({ ...flights, outbound: [WAW_DXB, fromAuh] });
    expect(issues(result)).toEqual([{ path: ['outbound', 1, 'fromIata'], message: 'validation.layoverAirportMismatch' }]);
  });

  it('rejects a layover segment that departs before the previous one lands', () => {
    const tooEarly = { ...DXB_BKK, departAt: '2026-11-02T18:00' };
    const result = FlightsStepInputSchema.safeParse({ ...flights, outbound: [WAW_DXB, tooEarly] });
    expect(issues(result)).toEqual([
      { path: ['outbound', 1, 'departAt'], message: 'validation.departsBeforePreviousArrival' },
    ]);
  });

  it('checks the chain inside the return as well', () => {
    const bkkDoh = { ...BKK_WAW, toIata: 'DOH', arriveTz: 'Asia/Qatar', arriveAt: '2026-11-15T13:00' };
    const fromAuh = { ...BKK_WAW, fromIata: 'AUH', departTz: 'Asia/Dubai', departAt: '2026-11-15T16:00', arriveAt: '2026-11-15T20:00' };
    const result = FlightsStepInputSchema.safeParse({ ...flights, return: [bkkDoh, fromAuh] });
    expect(issues(result)).toEqual([{ path: ['return', 1, 'fromIata'], message: 'validation.layoverAirportMismatch' }]);
  });

  it('reports a time that does not exist on its segment and adds no chain or return issues', () => {
    // LHR → WAW lands at 02:30 on the night Warsaw skips 02:00–02:59.
    const lhrWaw: Segment = {
      fromIata: 'LHR',
      departTz: 'Europe/London',
      toIata: 'WAW',
      arriveTz: 'Europe/Warsaw',
      departAt: '2027-03-27T22:00',
      arriveAt: '2027-03-28T02:30',
    };
    const wawBkk: Segment = {
      fromIata: 'WAW',
      departTz: 'Europe/Warsaw',
      toIata: 'BKK',
      arriveTz: 'Asia/Bangkok',
      departAt: '2027-03-28T06:00',
      arriveAt: '2027-03-28T21:00',
    };
    const back = { ...BKK_WAW, departAt: '2027-04-05T09:00', arriveAt: '2027-04-05T15:00' };
    const result = FlightsStepInputSchema.safeParse({ ...flights, outbound: [lhrWaw, wawBkk], return: [back] });
    expect(issues(result)).toEqual([{ path: ['outbound', 0, 'arriveAt'], message: 'validation.timeDoesNotExist' }]);
  });

  it('rejects a return that departs before the outbound lands', () => {
    const early = { ...BKK_WAW, departAt: '2026-11-03T10:00', arriveAt: '2026-11-03T16:00' };
    const result = FlightsStepInputSchema.safeParse({ ...flights, return: [early] });
    expect(issues(result)).toEqual([{ path: ['return', 0, 'departAt'], message: 'validation.returnBeforeOutbound' }]);
  });

  it('judges "today" at the departure airport, not on the device', () => {
    // At 10:59 UTC it is 23:59 on 10-04 in Auckland (UTC+13), so a departure dated 10-04 there is today.
    jest.setSystemTime(new Date('2026-10-04T10:59:00Z'));
    const akl = {
      fromIata: 'AKL',
      departTz: 'Pacific/Auckland',
      toIata: 'SYD',
      arriveTz: 'Australia/Sydney',
      departAt: '2026-10-04T23:30',
      arriveAt: '2026-10-05T01:00',
    };
    expect(FlightsStepInputSchema.safeParse({ ...flights, outbound: [akl], return: [BKK_WAW] }).success).toBe(true);
    // At 11:01 UTC it is 10-05 in Auckland, so a departure dated 10-04 there is in the past.
    jest.setSystemTime(new Date('2026-10-04T11:01:00Z'));
    const lateAkl = { ...akl, departAt: '2026-10-04T23:58', arriveAt: '2026-10-05T01:30' };
    const result = FlightsStepInputSchema.safeParse({ ...flights, outbound: [lateAkl], return: [BKK_WAW] });
    expect(issues(result)).toEqual([{ path: ['outbound', 0, 'departAt'], message: 'validation.departureInPast' }]);
  });

  it('rejects a first departure in the past (D15)', () => {
    const yesterday = { ...WAW_DXB, departAt: '2026-10-03T10:00', arriveAt: '2026-10-03T18:30' };
    const result = FlightsStepInputSchema.safeParse({ ...flights, outbound: [yesterday], return: [BKK_WAW] });
    expect(issues(result)).toEqual([{ path: ['outbound', 0, 'departAt'], message: 'validation.departureInPast' }]);
  });
});

describe('FriendInput', () => {
  it('accepts a friend with or without interests', () => {
    expect(FriendInputSchema.safeParse({ displayName: 'Kasia', interests: ['beaches'] }).success).toBe(true);
    expect(FriendInputSchema.safeParse({ displayName: 'Ola', interests: [] }).success).toBe(true);
  });

  it('trims the name and rejects an empty one', () => {
    expect(FriendInputSchema.parse({ displayName: ' Ola ', interests: [] }).displayName).toBe('Ola');
    const result = FriendInputSchema.safeParse({ displayName: '  ', interests: [] });
    expect(issues(result)).toEqual([{ path: ['displayName'], message: 'validation.nameRequired' }]);
  });

  it('rejects a name longer than 40 characters and unknown interests', () => {
    expect(FriendInputSchema.safeParse({ displayName: 'a'.repeat(41), interests: [] }).success).toBe(false);
    expect(FriendInputSchema.safeParse({ displayName: 'Ola', interests: ['knitting'] }).success).toBe(false);
  });
});

describe('BudgetStepInput', () => {
  it('accepts a positive amount', () => {
    expect(BudgetStepInputSchema.safeParse({ budgetPerPerson: { amountMinor: 300000, currency: 'EUR' } }).success).toBe(true);
  });

  it('rejects zero', () => {
    const result = BudgetStepInputSchema.safeParse({ budgetPerPerson: { amountMinor: 0, currency: 'EUR' } });
    expect(issues(result)).toEqual([{ path: ['budgetPerPerson', 'amountMinor'], message: 'validation.amountPositive' }]);
  });
});

describe('TripDetailsInput', () => {
  it('accepts a name without a cover photo', () => {
    expect(TripDetailsInputSchema.parse({ name: 'Kraków → Barcelona' })).toEqual({ name: 'Kraków → Barcelona' });
  });

  it('accepts a name with a cover photo', () => {
    const details = { name: 'Barcelona', coverImageUri: 'file:///cache/cover.jpg' };
    expect(TripDetailsInputSchema.parse(details)).toEqual(details);
  });

  it('trims the name', () => {
    expect(TripDetailsInputSchema.parse({ name: '  Majówka  ' }).name).toBe('Majówka');
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
  ])('rejects a name that is %s', (_, name) => {
    expect(issues(TripDetailsInputSchema.safeParse({ name }))).toEqual([{ path: ['name'], message: 'validation.tripNameRequired' }]);
  });

  it('accepts 60 characters and rejects 61', () => {
    expect(TripDetailsInputSchema.safeParse({ name: 'a'.repeat(60) }).success).toBe(true);
    expect(issues(TripDetailsInputSchema.safeParse({ name: 'a'.repeat(61) }))).toEqual([
      { path: ['name'], message: 'validation.tripNameTooLong' },
    ]);
  });

  it('rejects an empty cover photo URI', () => {
    expect(TripDetailsInputSchema.safeParse({ name: 'Barcelona', coverImageUri: '' }).success).toBe(false);
  });
});

describe('CreateTripInput', () => {
  const input = {
    flights,
    friends: {
      friends: [
        { displayName: 'Kasia', interests: ['beaches'] },
        { displayName: 'Ola', interests: [] },
      ],
    },
    budget: { budgetPerPerson: { amountMinor: 300000, currency: 'THB' } },
    details: { name: 'Warszawa → Bangkok' },
  };

  it('accepts a complete wizard', () => {
    expect(CreateTripInputSchema.safeParse(input).success).toBe(true);
  });

  it('accepts a solo trip with no friends', () => {
    const solo = { ...input, flights: { ...flights, companionCount: 0 }, friends: { friends: [] } };
    expect(CreateTripInputSchema.safeParse(solo).success).toBe(true);
  });

  it('rejects a friend count different from the companion count', () => {
    const result = CreateTripInputSchema.safeParse({ ...input, flights: { ...flights, companionCount: 3 } });
    expect(issues(result)).toEqual([{ path: ['friends', 'friends'], message: 'validation.friendCountMismatch' }]);
  });

  it('requires the trip details', () => {
    const { details: _omit, ...withoutDetails } = input;
    expect(CreateTripInputSchema.safeParse(withoutDetails).success).toBe(false);
  });
});
