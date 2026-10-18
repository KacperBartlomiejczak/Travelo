import { AppState } from 'react-native';

jest.unmock('@/data/app-trip-repository');

const mockClient = { auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() } };
const mockDb = { name: 'db' };
jest.mock('@/data/supabase', () => ({ supabase: mockClient }));
jest.mock('@/data/local-db', () => ({ openLocalDb: jest.fn(async () => mockDb) }));
jest.mock('@/data/local-store', () => ({ createLocalStore: jest.fn((db: unknown) => ({ store: db })) }));
jest.mock('@/data/supabase-trip-repository', () => ({ createSupabaseTripRepository: jest.fn(() => ({ name: 'supabase repository' })) }));
jest.mock('@/data/auth', () => ({ keepSessionFresh: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports */
const load = () => require('@/data/app-trip-repository') as typeof import('@/data/app-trip-repository');
const deps = () => ({
  repository: require('@/data/supabase-trip-repository') as typeof import('@/data/supabase-trip-repository'),
  auth: require('@/data/auth') as typeof import('@/data/auth'),
});
/* eslint-enable @typescript-eslint/no-require-imports */

afterEach(() => jest.clearAllMocks());

describe('createAppTripRepository', () => {
  it('is the Supabase repository with the app client and the SQLite store opened on the device', async () => {
    const repository = load().createAppTripRepository();
    const { createSupabaseTripRepository } = deps().repository;
    expect(repository).toEqual({ name: 'supabase repository' });
    const [{ supabase, local }] = jest.mocked(createSupabaseTripRepository).mock.calls[0];
    expect(supabase).toBe(mockClient);
    await expect(local).resolves.toEqual({ store: mockDb });
  });

  it('shares the app\'s one SQLite store with the profile repository (the database is opened once)', async () => {
    const { appLocalStore } = require('@/data/app-local-store') as typeof import('@/data/app-local-store'); // eslint-disable-line @typescript-eslint/no-require-imports
    load().createAppTripRepository();
    const { createSupabaseTripRepository } = deps().repository;
    const [{ local }] = jest.mocked(createSupabaseTripRepository).mock.calls[0];
    expect(local).toBe(appLocalStore());
  });

  it('does not register the app state listener (it is registered once, next to the client; auth-onboarding D22)', () => {
    const addEventListener = jest.spyOn(AppState, 'addEventListener');
    try {
      load().createAppTripRepository();
      expect(deps().auth.keepSessionFresh).not.toHaveBeenCalled();
      expect(addEventListener).not.toHaveBeenCalled();
    } finally {
      addEventListener.mockRestore();
    }
  });
});
