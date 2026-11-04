import {
  CurrentTripSchema,
  LocalTripBudgetChangeSchema,
  SyncStatusSchema,
  TripBudgetChangeSchema,
  TripBudgetFormSchema,
} from '@/schemas';

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const MEMBER_A = '7c2d9e1f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const MEMBER_B = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const change = {
  tripId: TRIP_ID,
  organizerDailyBudget: { amountMinor: 25000, currency: 'EUR' },
  members: [
    { memberId: MEMBER_A, dailyBudgetMinor: 25000 },
    { memberId: MEMBER_B, dailyBudgetMinor: 10000 },
  ],
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

  it('accepts a solo trip with no members', () => {
    expect(TripBudgetChangeSchema.safeParse({ ...change, members: [] }).success).toBe(true);
  });

  it.each([
    ['a trip id that is not a UUID', { tripId: 'trip-1' }],
    ['a zero organizer amount', { organizerDailyBudget: { amountMinor: 0, currency: 'EUR' } }],
    ['an amount with a fraction', { organizerDailyBudget: { amountMinor: 1.5, currency: 'EUR' } }],
    ['a negative amount', { organizerDailyBudget: { amountMinor: -1, currency: 'EUR' } }],
    ['a lowercase currency', { organizerDailyBudget: { amountMinor: 100, currency: 'eur' } }],
    ['a member id that is not a UUID', { members: [{ memberId: 'm1', dailyBudgetMinor: 100 }] }],
    ['a zero member amount', { members: [{ memberId: MEMBER_A, dailyBudgetMinor: 0 }] }],
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
  const individual = {
    mode: 'individual',
    organizerDailyMinor: 20000,
    members: [
      { memberId: MEMBER_A, dailyMinor: 5000 },
      { memberId: MEMBER_B, dailyMinor: 10000 },
    ],
  };

  it('accepts individual mode with different amounts', () => {
    expect(TripBudgetFormSchema.safeParse(individual).success).toBe(true);
  });

  it('accepts shared mode when every amount equals the organizer\'s', () => {
    const shared = { mode: 'shared', organizerDailyMinor: 7000, members: individual.members.map((m) => ({ ...m, dailyMinor: 7000 })) };
    expect(TripBudgetFormSchema.safeParse(shared).success).toBe(true);
  });

  it('rejects shared mode when a member amount differs', () => {
    const result = TripBudgetFormSchema.safeParse({ ...individual, mode: 'shared' });
    expect(result.error?.issues.map((i) => [i.path, i.message])).toEqual([
      [['members', 0, 'dailyMinor'], 'validation.budgetSharedMismatch'],
      [['members', 1, 'dailyMinor'], 'validation.budgetSharedMismatch'],
    ]);
  });

  it('rejects 0 with the wizard\'s message', () => {
    const result = TripBudgetFormSchema.safeParse({ ...individual, organizerDailyMinor: 0 });
    expect(result.error?.issues[0].message).toBe('validation.amountPositive');
    expect(result.error?.issues[0].path).toEqual(['organizerDailyMinor']);
  });

  it('rejects a zero member amount', () => {
    const result = TripBudgetFormSchema.safeParse({ ...individual, members: [{ memberId: MEMBER_A, dailyMinor: 0 }] });
    expect(result.error?.issues[0].message).toBe('validation.amountPositive');
  });
});

describe('CurrentTrip', () => {
  const current = {
    overview: {
      trip: {
        id: TRIP_ID,
        ownerId: '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d',
        name: 'Barcelona',
        coverImageUri: 'preset:auckland',
        destination: 'BCN',
        startDate: '2026-11-02',
        endDate: '2026-11-09',
        baseCurrency: 'EUR',
        dailyBudget: { amountMinor: 30000, currency: 'EUR' },
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
    expect(CurrentTripSchema.safeParse(current).success).toBe(true);
    expect(CurrentTripSchema.safeParse({ ...current, budgetSyncStatus: 'pending', fromCache: true }).success).toBe(true);
  });

  it.each([
    ['an unknown sync status', { budgetSyncStatus: 'unknown' }],
    ['a missing source flag', { fromCache: undefined }],
    ['an invalid overview', { overview: { ...current.overview, trip: { ...current.overview.trip, travellerCount: 0 } } }],
  ])('rejects %s', (_, patch) => {
    expect(CurrentTripSchema.safeParse({ ...current, ...patch }).success).toBe(false);
  });
});
