import { createInMemoryProfileRepository, LOCAL_PROFILE_ID, type ProfileRepository } from '@/data/profile-repository';

/** A profile that already exists, for tests of a returning user. */
export async function repositoryWithProfile(base: ProfileRepository = createInMemoryProfileRepository()): Promise<ProfileRepository> {
  await base.createProfile({ username: 'kacper', interests: ['museums'], avatarUri: null });
  return base;
}

/** A repository whose `myProfile` is replaced: what a screen sees when the profile read fails, is slow, or comes from the copy. */
export function withMyProfile(base: ProfileRepository, myProfile: ProfileRepository['myProfile']): ProfileRepository {
  return { ...base, myProfile };
}

export { LOCAL_PROFILE_ID };

let active: Promise<ProfileRepository> = repositoryWithProfile();

/** The profile repository the whole app gets in tests (`@/data/app-profile-repository` is mocked with this, see jest.setup.ts). */
export function setAppProfileRepository(repository: ProfileRepository | Promise<ProfileRepository>) {
  active = Promise.resolve(repository);
}

/** Back to a repository with a profile in it. */
export function resetAppProfileRepository() {
  active = repositoryWithProfile();
}

/** Delegates to the current fake, so the repository can be chosen after the app module was created. */
export const delegatingProfileRepository: ProfileRepository = {
  myProfile: async () => (await active).myProfile(),
  createProfile: async (input) => (await active).createProfile(input),
};
