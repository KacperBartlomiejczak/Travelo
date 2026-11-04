import { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ServerUnreachableError } from '@/data/errors';
import { UsernameMismatchError, type ProfileRepository } from '@/data/profile-repository';
import { AppProviders } from '@/providers/AppProviders';
import { repositoryWithProfile, setAppProfileRepository } from '@/test/fake-profile-repository';
import { useFakeAppSession, type FakeSession } from '@/test/fake-session-source';

import { useDeleteAccount } from '../useDeleteAccount';

let fake: FakeSession;
let queryClient: QueryClient;
let deleteAccount: jest.Mock<Promise<void>, [string]>;

async function setup() {
  const base = await repositoryWithProfile();
  deleteAccount = jest.fn(async (_confirmUsername: string) => {});
  setAppProfileRepository({ ...base, deleteAccount } as ProfileRepository);
  const wrapper = ({ children }: { children: ReactNode }) => <AppProviders queryClient={queryClient}>{children}</AppProviders>;
  return renderHook(() => useDeleteAccount(), { wrapper });
}

beforeEach(() => {
  fake = useFakeAppSession();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe('useDeleteAccount (profile-settings step 11)', () => {
  it('deletes with the typed nick, then signs out on this phone once; stays pending (the gate takes the screen away)', async () => {
    const { result } = await setup();
    let outcome;
    await act(async () => {
      outcome = await result.current.run('kacper');
    });
    expect(outcome).toBe('deleted');
    expect(deleteAccount).toHaveBeenCalledWith('kacper');
    expect(fake.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sends the nick normalized (trimmed, lower case), so long padding cannot break the 64-character limit', async () => {
    const { result } = await setup();
    await act(async () => result.current.run(`${' '.repeat(60)}KaCPer${' '.repeat(10)}`));
    expect(deleteAccount).toHaveBeenCalledWith('kacper');
  });

  it('a double call before the first has finished is one call to the server and one sign-out', async () => {
    const { result } = await setup();
    let finish: () => void = () => {};
    deleteAccount.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    await act(async () => {
      void result.current.run('kacper');
      void result.current.run('kacper');
    });
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    await act(async () => finish());
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(fake.signOut).toHaveBeenCalledTimes(1);
  });

  it('a call after a success is ignored too', async () => {
    const { result } = await setup();
    await act(async () => result.current.run('kacper'));
    await act(async () => result.current.run('kacper'));
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(fake.signOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a server error', new Error('http 500')],
    ['no answer from the server', new ServerUnreachableError('no answer')],
  ])('%s: "failed", not pending, no sign-out, and the same call can be repeated', async (_name, failure) => {
    const { result } = await setup();
    deleteAccount.mockRejectedValueOnce(failure);
    let outcome;
    await act(async () => {
      outcome = await result.current.run('kacper');
    });
    expect(outcome).toBe('failed');
    expect(result.current.error).toBe('failed');
    expect(result.current.pending).toBe(false);
    expect(fake.signOut).not.toHaveBeenCalled();

    await act(async () => {
      outcome = await result.current.run('kacper');
    });
    expect(outcome).toBe('deleted');
    expect(deleteAccount).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(fake.signOut).toHaveBeenCalledTimes(1);
  });

  it('a stale nick (UsernameMismatchError): "mismatch", the own profile is read again, nothing is signed out', async () => {
    const { result } = await setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    deleteAccount.mockRejectedValueOnce(new UsernameMismatchError('username-mismatch'));
    let outcome;
    await act(async () => {
      outcome = await result.current.run('old');
    });
    expect(outcome).toBe('mismatch');
    expect(result.current.error).toBe('mismatch');
    expect(result.current.pending).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile', 'me'] });
    expect(fake.signOut).not.toHaveBeenCalled();
  });

  it('reset clears the error', async () => {
    const { result } = await setup();
    deleteAccount.mockRejectedValueOnce(new Error('http 500'));
    await act(async () => result.current.run('kacper'));
    expect(result.current.error).toBe('failed');
    await act(async () => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});
