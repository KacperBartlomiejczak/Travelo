import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, View } from 'react-native';

import { Field } from '@/components/Field';
import { InterestChips } from '@/components/InterestChips';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { TextField } from '@/components/TextField';
import { UsernameTakenError } from '@/data/profile-repository';
import { AuthFormScreen, FormError } from '@/features/auth/AuthFormScreen';
import { FullScreenError } from '@/features/auth/FullScreenError';
import { useMyProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useIsOffline } from '@/providers/BudgetSync';
import { ProfileEditInputSchema, type InterestTag, type ShownProfile } from '@/schemas';
import { tokens } from '@/theme/tokens';

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item) => b.includes(item));

/**
 * Edit profile (profile-settings D9, A8): the nick and the interests, filled in with the current ones, on the same frame and
 * texts as profile setup. The save button is disabled until `ProfileEditInputSchema` accepts the form AND something changed,
 * and offline (it needs the server). A taken nick is an error on the field; any other failure is fixed copy above the button
 * and the data stays. A success returns to settings; the profile query already holds the new data. While the profile is read
 * there is a skeleton; when it cannot be read (or there is none) there is an error with a retry.
 */
export function EditProfileScreen() {
  const { t } = useTranslation();
  const myProfile = useMyProfile();
  const profile = myProfile.data?.profile;

  if (profile) return <EditForm profile={profile} />;
  if (myProfile.isPending) return <EditSkeleton />;
  return (
    <FullScreenError
      testID="edit-profile-error"
      message={t('auth.profileLoadError')}
      retryLabel={t('auth.retry')}
      onRetry={() => void myProfile.refetch()}
    />
  );
}

function EditSkeleton() {
  const { t } = useTranslation();
  const { spacing } = tokens;
  return (
    <AuthFormScreen testID="edit-profile-loading" title={t('settings.editProfile')} footer={null}>
      <View accessibilityLabel={t('app.loading')} style={{ gap: spacing[4] }}>
        <SkeletonBlock width="100%" height={spacing[8]} />
        <SkeletonBlock width="100%" height={spacing[10]} />
      </View>
    </AuthFormScreen>
  );
}

function EditForm({ profile }: { profile: ShownProfile }) {
  const { t } = useTranslation();
  const offline = useIsOffline();
  const update = useUpdateProfile();
  const [username, setUsername] = useState(profile.username);
  const [interests, setInterests] = useState<InterestTag[]>(profile.interests);
  const [usernameError, setUsernameError] = useState<string>();
  // `update.isPending` only updates on the next render; this closes the gap between two taps in the same moment.
  const saving = useRef(false);

  const parsed = ProfileEditInputSchema.safeParse({ username, interests });
  const changed = !parsed.success || parsed.data.username !== profile.username || !sameSet(parsed.data.interests, profile.interests);
  const busy = update.isPending;
  const saveFailed = update.isError && !(update.error instanceof UsernameTakenError);

  function submit() {
    if (offline || busy || saving.current || !parsed.success || !changed) return;
    saving.current = true;
    update.mutate(parsed.data, {
      onSuccess: () => router.back(),
      onError: (error) => {
        if (error instanceof UsernameTakenError) setUsernameError(t('auth.profile.usernameTaken'));
        else AccessibilityInfo.announceForAccessibility(t('auth.profile.saveError'));
      },
      onSettled: () => {
        saving.current = false;
      },
    });
  }

  return (
    <AuthFormScreen
      testID="edit-profile-screen"
      title={t('settings.editProfile')}
      footer={
        <>
          {saveFailed && <FormError testID="edit-profile-save-error" message={t('auth.profile.saveError')} />}
          <PrimaryButton
            label={t('settings.saveProfile')}
            onPress={submit}
            loading={busy}
            disabled={offline || !parsed.success || !changed}
          />
        </>
      }
    >
      <TextField
        label={t('auth.profile.username')}
        hint={t('auth.profile.usernameHint')}
        value={username}
        onChangeText={(text) => {
          setUsername(text.toLowerCase());
          setUsernameError(undefined);
        }}
        error={usernameError}
        editable={!busy}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Field label={t('auth.profile.interests')} hint={t('auth.profile.interestsHint')} messagesFirst>
        <InterestChips selected={interests} onChange={setInterests} disabled={busy} />
      </Field>
    </AuthFormScreen>
  );
}
