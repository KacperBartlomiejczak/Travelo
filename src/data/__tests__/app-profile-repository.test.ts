jest.unmock('@/data/app-profile-repository');

const mockClient = { auth: {} };
const mockStore = Promise.resolve({ name: 'shared store' });
jest.mock('@/data/supabase', () => ({ supabase: mockClient }));
jest.mock('@/data/app-local-store', () => ({ appLocalStore: jest.fn(() => mockStore) }));
jest.mock('@/data/supabase-profile-repository', () => ({ createSupabaseProfileRepository: jest.fn(() => ({ name: 'supabase profile repository' })) }));

/* eslint-disable @typescript-eslint/no-require-imports */
const load = () => require('@/data/app-profile-repository') as typeof import('@/data/app-profile-repository');
const create = () => (require('@/data/supabase-profile-repository') as typeof import('@/data/supabase-profile-repository')).createSupabaseProfileRepository;
/* eslint-enable @typescript-eslint/no-require-imports */

describe('createAppProfileRepository', () => {
  it('is the Supabase profile repository with the app client and the one SQLite store of the app', () => {
    const repository = load().createAppProfileRepository();

    expect(repository).toEqual({ name: 'supabase profile repository' });
    const [{ supabase, local }] = jest.mocked(create()).mock.calls[0];
    expect(supabase).toBe(mockClient);
    expect(local).toBe(mockStore);
  });
});
