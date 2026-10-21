import { onlineManager, QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ServerUnreachableError } from '@/data/errors';
import { createInMemoryProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import { useFriendLookup } from '@/hooks/useFriendLookup';
import { AppProviders } from '@/providers/AppProviders';
import { createFakeSessionSource } from '@/test/fake-session-source';

const OLA = { username: 'ola_b', interests: ['museums' as const, 'beaches' as const] };

function setup(repository: ProfileRepository) {
  const client = new QueryClient();
  const session = createFakeSessionSource();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={client} profileRepository={repository} sessionSource={session.source}>
      {children}
    </AppProviders>
  );
  return { wrapper };
}

function spied(repository: ProfileRepository) {
  const findByFriendCode = jest.fn((code: string) => repository.findByFriendCode(code));
  return { repository: { ...repository, findByFriendCode }, findByFriendCode };
}

describe('useFriendLookup', () => {
  it('finds the friend by the code', async () => {
    const { repository, findByFriendCode } = spied(createInMemoryProfileRepository({ friendAccounts: { '5ZMRX8': OLA } }));
    const { result } = await renderHook(() => useFriendLookup('5ZMRX8'), { wrapper: setup(repository).wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(OLA);
    expect(findByFriendCode).toHaveBeenCalledTimes(1);
    expect(findByFriendCode).toHaveBeenCalledWith('5ZMRX8');
  });

  it('answers null for a code nobody has', async () => {
    const { repository } = spied(createInMemoryProfileRepository());
    const { result } = await renderHook(() => useFriendLookup('5ZMRX8'), { wrapper: setup(repository).wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('does not ask while there is no code to check', async () => {
    const { repository, findByFriendCode } = spied(createInMemoryProfileRepository());
    const { result } = await renderHook(() => useFriendLookup(null), { wrapper: setup(repository).wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(findByFriendCode).not.toHaveBeenCalled();
  });

  it('asks once per code: a re-render does not ask again, a new code does', async () => {
    const { repository, findByFriendCode } = spied(createInMemoryProfileRepository({ friendAccounts: { '5ZMRX8': OLA } }));
    const { result, rerender } = await renderHook((code: string | null) => useFriendLookup(code), {
      wrapper: setup(repository).wrapper,
      initialProps: '5ZMRX8' as string | null,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await rerender('5ZMRX8');
    await rerender('5ZMRX8');
    expect(findByFriendCode).toHaveBeenCalledTimes(1);

    await rerender('K7PQ2D');
    await waitFor(() => expect(findByFriendCode).toHaveBeenCalledTimes(2));
    expect(findByFriendCode).toHaveBeenLastCalledWith('K7PQ2D');
  });

  it('answers for the new code after the code changed, not with the old answer', async () => {
    const { repository } = spied(createInMemoryProfileRepository({ friendAccounts: { '5ZMRX8': OLA } }));
    const { result, rerender } = await renderHook((code: string | null) => useFriendLookup(code), {
      wrapper: setup(repository).wrapper,
      initialProps: 'K7PQ2D' as string | null,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    await rerender('5ZMRX8');
    await waitFor(() => expect(result.current.data).toEqual(OLA));
  });

  it('still asks when TanStack believes the device is offline (the repository reports a lost connection itself)', async () => {
    onlineManager.setOnline(false);
    try {
      const { repository, findByFriendCode } = spied(createInMemoryProfileRepository({ friendAccounts: { '5ZMRX8': OLA } }));
      const { result } = await renderHook(() => useFriendLookup('5ZMRX8'), { wrapper: setup(repository).wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(OLA);
      expect(findByFriendCode).toHaveBeenCalledTimes(1);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('reports an unreachable server as that error, without retrying by itself', async () => {
    const base = createInMemoryProfileRepository();
    const findByFriendCode = jest.fn().mockRejectedValue(new ServerUnreachableError('offline'));
    const { result } = await renderHook(() => useFriendLookup('5ZMRX8'), {
      wrapper: setup({ ...base, findByFriendCode }).wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ServerUnreachableError);
    expect(findByFriendCode).toHaveBeenCalledTimes(1);
  });

  it('asks again when the same code is typed again after it was changed (a failed check is retried by editing)', async () => {
    const base = createInMemoryProfileRepository();
    const findByFriendCode = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(OLA);
    // Plain values read in every render: the query result only re-renders for the properties that were read.
    const { result, rerender } = await renderHook(
      (code: string | null) => {
        const { status, data } = useFriendLookup(code);
        return { status, data };
      },
      { wrapper: setup({ ...base, findByFriendCode }).wrapper, initialProps: '5ZMRX8' as string | null },
    );
    await waitFor(() => expect(result.current.status).toBe('error'));
    await rerender(null);
    await rerender('5ZMRX8');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(findByFriendCode).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(OLA);
  });
});
