import { AppState, Platform } from 'react-native';

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

  it('keeps the session fresh with the app state on phones', () => {
    load().createAppTripRepository();
    expect(deps().auth.keepSessionFresh).toHaveBeenCalledWith(mockClient.auth, AppState);
  });

  it('does not tie token refresh to the app state on web (Supabase guidance)', () => {
    const os = Platform.OS;
    Platform.OS = 'web';
    try {
      load().createAppTripRepository();
      expect(deps().auth.keepSessionFresh).not.toHaveBeenCalled();
    } finally {
      Platform.OS = os;
    }
  });
});
