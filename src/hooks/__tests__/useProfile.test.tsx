import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ServerUnreachableError } from '@/data/errors';
import { startNewUserEpoch } from '@/data/local-store';
import { createInMemoryProfileRepository, UsernameTakenError, type ProfileRepository } from '@/data/profile-repository';
import { useCreateProfile, useMyProfile } from '@/hooks/useProfile';
import { AppProviders } from '@/providers/AppProviders';
import { createFakeSessionSource } from '@/test/fake-session-source';
import { reopenUserEpoch } from '@/test/user-epoch';
import { setNetwork } from '@/test/mock-network';

const SETUP = { username: 'kacper', interests: ['museums' as const], avatarUri: null };

function setup(repository: ProfileRepository, session = createFakeSessionSource(), queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={client} profileRepository={repository} sessionSource={session.source}>
      {children}
    </AppProviders>
  );
  return { wrapper, queryClient: client, session };
}

describe('useMyProfile', () => {
  it('reads the own profile once signed in; null when there is none yet', async () => {
    const repository = createInMemoryProfileRepository();
    const { result } = await renderHook(() => useMyProfile(), { wrapper: setup(repository).wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();

    await repository.createProfile(SETUP);
    await act(async () => void (await result.current.refetch()));
    await waitFor(() => expect(result.current.data?.profile.username).toBe('kacper'));
    expect(result.current.data?.fromCache).toBe(false);
  });

  it('does not read anything while signed out or while the session is unknown', async () => {
    const repository = createInMemoryProfileRepository();
    const myProfile = jest.fn(() => repository.myProfile());
    const session = createFakeSessionSource({ status: 'signedOut' });
    const { wrapper } = setup({ ...repository, myProfile }, session);
    const { result } = await renderHook(() => useMyProfile(), { wrapper });
    await waitFor(() => expect(session.clearUserData).toHaveBeenCalled());
    expect(myProfile).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('runs when the session is only a stored one that cannot be read offline (the repository answers from its copy)', async () => {
    const repository = createInMemoryProfileRepository();
    await repository.createProfile(SETUP);
    const myProfile = jest.fn(async () => {
      const mine = await repository.myProfile();
      return mine && { ...mine, fromCache: true };
    });
    const { wrapper } = setup({ ...repository, myProfile }, createFakeSessionSource({ status: 'signedIn', userId: null }));
    const { result } = await renderHook(() => useMyProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.fromCache).toBe(true);
  });

  it('reads even when the network is reported offline (the repository falls back to the copy on the phone)', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    const repository = createInMemoryProfileRepository();
    await repository.createProfile(SETUP);
    const { result } = await renderHook(() => useMyProfile(), { wrapper: setup(repository).wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('a failed read is an error at once (the screen offers a retry), and the retry reads again', async () => {
    const repository = createInMemoryProfileRepository();
    const myProfile = jest
      .fn<ReturnType<ProfileRepository['myProfile']>, []>()
      .mockRejectedValueOnce(new ServerUnreachableError('offline'))
      .mockImplementation(() => repository.myProfile());
    // The app's own client settings: the hook itself must not retry.
    const { wrapper } = setup({ ...repository, myProfile }, createFakeSessionSource(), new QueryClient());
    const { result } = await renderHook(() => useMyProfile(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(myProfile).toHaveBeenCalledTimes(1);

    await act(async () => void (await result.current.refetch()));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useCreateProfile', () => {
  it('saves the profile and puts it into the profile query, so the app moves on without another read', async () => {
    const repository = createInMemoryProfileRepository();
    const myProfile = jest.fn(() => repository.myProfile());
    const { wrapper, queryClient } = setup({ ...repository, myProfile });
    const { result } = await renderHook(() => ({ create: useCreateProfile(), mine: useMyProfile() }), { wrapper });
    await waitFor(() => expect(result.current.mine.isSuccess).toBe(true));
    expect(result.current.mine.data).toBeNull();

    await act(async () => void (await result.current.create.mutateAsync(SETUP)));

    expect(queryClient.getQueryData(['profile', 'me'])).toEqual({ profile: expect.objectContaining({ username: 'kacper' }), fromCache: false });
    await waitFor(() => expect(result.current.mine.data?.profile.username).toBe('kacper'));
    expect(myProfile).toHaveBeenCalledTimes(1);
  });

  it('a save that finishes after the user was signed out does not put the profile into the cache (it belongs to the previous user)', async () => {
    const repository = createInMemoryProfileRepository();
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const createProfile = jest.fn(async (input: Parameters<ProfileRepository['createProfile']>[0]) => {
      await held;
      return repository.createProfile(input);
    });
    const { wrapper, queryClient } = setup({ ...repository, createProfile });
    const { result } = await renderHook(() => useCreateProfile(), { wrapper });

    let saving: Promise<unknown> = Promise.resolve();
    await act(async () => {
      saving = result.current.mutateAsync(SETUP);
    });
    startNewUserEpoch(); // the session starts to forget the user while the save is on its way
    queryClient.clear(); // ... and drops its caches
    await act(async () => {
      release();
      await saving;
    });

    expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
  });

  it('a save that was not overtaken by a sign-out still fills the cache', async () => {
    const repository = createInMemoryProfileRepository();
    startNewUserEpoch(); // an older sign-out, long done:
    await reopenUserEpoch(); // its clear has finished
    const { wrapper, queryClient } = setup(repository);
    const { result } = await renderHook(() => useCreateProfile(), { wrapper });

    await act(async () => void (await result.current.mutateAsync(SETUP)));

    expect(queryClient.getQueryData(['profile', 'me'])).toEqual({ profile: expect.objectContaining({ username: 'kacper' }), fromCache: false });
  });

  it('a taken nick stays an error of the mutation and leaves the profile query as it was', async () => {
    const repository = createInMemoryProfileRepository({ takenUsernames: ['kacper'] });
    const { wrapper, queryClient } = setup(repository);
    const { result } = await renderHook(() => useCreateProfile(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(SETUP)).rejects.toBeInstanceOf(UsernameTakenError);
    });

    expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
  });
});
