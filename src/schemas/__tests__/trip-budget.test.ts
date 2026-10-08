import {
  LocalTripBudgetChangeSchema,
  NearestTripSchema,
  SyncStatusSchema,
  TripBudgetChangeSchema,
  TripBudgetFormSchema,
} from '@/schemas';

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';

const change = {
  tripId: TRIP_ID,
  budgetPerPerson: { amountMinor: 250000, currency: 'EUR' },
  updatedAt: '2026-10-06T09:30:00.000Z',
};

describe('SyncStatus', () => {
  it.each(['synced', 'pending', 'failed'])('accepts %s', (status) => {
    expect(SyncStatusSchema.safeParse(status).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(SyncStatusSchema.safeParse('syncing').success).toBe(false);
  });
});

describe('TripBudgetChange', () => {
  it('accepts a budget change', () => {
    expect(TripBudgetChangeSchema.safeParse(change).success).toBe(true);
  });

  it('accepts a zero budget (the trip schema allows it)', () => {
    expect(TripBudgetChangeSchema.safeParse({ ...change, budgetPerPerson: { amountMinor: 0, currency: 'EUR' } }).success).toBe(true);
  });

  it.each([
    ['a trip id that is not a UUID', { tripId: 'trip-1' }],
    ['an amount with a fraction', { budgetPerPerson: { amountMinor: 1.5, currency: 'EUR' } }],
    ['a negative amount', { budgetPerPerson: { amountMinor: -1, currency: 'EUR' } }],
    ['a lowercase currency', { budgetPerPerson: { amountMinor: 100, currency: 'eur' } }],
    ['a time without an offset', { updatedAt: '2026-10-06T09:30:00' }],
  ])('rejects %s', (_, patch) => {
    expect(TripBudgetChangeSchema.safeParse({ ...change, ...patch }).success).toBe(false);
  });
});

describe('LocalTripBudgetChange', () => {
  const local = { ...change, syncStatus: 'pending', attempts: 0 };

  it.each(['synced', 'pending', 'failed'])('accepts a %s change', (syncStatus) => {
    expect(LocalTripBudgetChangeSchema.safeParse({ ...local, syncStatus }).success).toBe(true);
  });

  it('accepts a failed change with its error and last attempt', () => {
    const failed = { ...local, syncStatus: 'failed', syncError: 'permission denied', attempts: 3, lastAttemptAt: '2026-10-06T09:31:00.000Z' };
    expect(LocalTripBudgetChangeSchema.parse(failed)).toEqual(failed);
  });

  it.each([
    ['an unknown status', { syncStatus: 'sending' }],
    ['negative attempts', { attempts: -1 }],
    ['fractional attempts', { attempts: 1.5 }],
    ['a last attempt without an offset', { lastAttemptAt: '2026-10-06T09:31:00' }],
  ])('rejects %s', (_, patch) => {
    expect(LocalTripBudgetChangeSchema.safeParse({ ...local, ...patch }).success).toBe(false);
  });
});

describe('TripBudgetForm', () => {
  it('accepts a positive amount', () => {
    expect(TripBudgetFormSchema.safeParse({ budgetPerPerson: { amountMinor: 1, currency: 'EUR' } }).success).toBe(true);
  });

  it('rejects 0 with the wizard\'s message', () => {
    const result = TripBudgetFormSchema.safeParse({ budgetPerPerson: { amountMinor: 0, currency: 'EUR' } });
    expect(result.error?.issues[0].message).toBe('validation.amountPositive');
  });
});

describe('NearestTrip', () => {
  const nearest = {
    overview: {
      trip: {
        id: TRIP_ID,
        ownerId: '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d',
        name: 'Barcelona',
        destination: 'BCN',
        startDate: '2026-11-02',
        endDate: '2026-11-09',
        baseCurrency: 'EUR',
        budgetPerPerson: { amountMinor: 300000, currency: 'EUR' },
        createdAt: '2026-10-04T12:00:00+02:00',
        budgetUpdatedAt: '2026-10-04T12:00:00+02:00',
        travellerCount: 1,
      },
      members: [],
      segments: [],
    },
    budgetSyncStatus: 'synced',
    fromCache: false,
  };

  it('accepts the overview with its budget sync status and source', () => {
    expect(NearestTripSchema.safeParse(nearest).success).toBe(true);
    expect(NearestTripSchema.safeParse({ ...nearest, budgetSyncStatus: 'pending', fromCache: true }).success).toBe(true);
  });

  it.each([
    ['an unknown sync status', { budgetSyncStatus: 'unknown' }],
    ['a missing source flag', { fromCache: undefined }],
    ['an invalid overview', { overview: { ...nearest.overview, trip: { ...nearest.overview.trip, travellerCount: 0 } } }],
  ])('rejects %s', (_, patch) => {
    expect(NearestTripSchema.safeParse({ ...nearest, ...patch }).success).toBe(false);
  });
});
