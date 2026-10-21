import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { currentUserEpoch, isEpochCurrent } from '@/data/local-store';
import type { MyProfile } from '@/data/profile-repository';
import { useProfileRepository } from '@/providers/AppProviders';
import { useSession } from '@/providers/Session';
import type { ProfileSetupInputValues } from '@/schemas';

const PROFILE_KEY = ['profile', 'me'] as const;

/**
 * The signed-in user's own profile; null data when there is none yet (profile setup comes next). It does not run for a
 * user who is signed out or not known yet. Failures are not retried by themselves: the gate shows an error with a retry
 * button, and never the setup form (a lost answer must not offer a new nick).
 */
export function useMyProfile() {
  const repository = useProfileRepository();
  const { state } = useSession();
  // 'always': offline the repository answers from the copy on the device (auth-onboarding D9).
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => repository.myProfile(),
    enabled: state.status === 'signedIn',
    networkMode: 'always',
    retry: false,
  });
}

/**
 * The signed-in user's account id, from the own profile (cached on the phone, so it is known offline too); undefined until
 * the profile is read. The session's `userId` is not used: it can be null on an offline start (friend-invite A2).
 */
export function useMyProfileId(): string | undefined {
  return useMyProfile().data?.profile.id;
}

/**
 * Whether the trip is the signed-in user's own (friend-invite A2): its owner is the own account. False while either is
 * unknown, so edit controls never show for a trip that may be someone else's.
 */
export function useIsTripOwner(ownerId: string | undefined): boolean {
  const myId = useMyProfileId();
  return ownerId !== undefined && myId === ownerId;
}

/**
 * Saves the profile from the setup form; on success the profile query holds it, so the app moves on at once.
 * The cache is written only if no sign-out began while the save was on its way: otherwise the profile belongs to the previous
 * user, and the next user would be shown it. That is decided by the user epoch captured when `mutate` is called (the same one
 * the local store uses, auth-onboarding D15), not by comparing user ids: an offline start does not know the id, and a sign-out
 * followed by the same person signing in again must not take over a save that began before it either.
 */
export function useCreateProfile() {
  const repository = useProfileRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileSetupInputValues) => repository.createProfile(input),
    onMutate: () => ({ epoch: currentUserEpoch() }),
    onSuccess: (profile, _input, context) => {
      if (!isEpochCurrent(context.epoch)) return;
      const mine: MyProfile = { profile, fromCache: false };
      queryClient.setQueryData(PROFILE_KEY, mine);
    },
  });
}
