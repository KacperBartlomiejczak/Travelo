import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';

import { Field } from '@/components/Field';
import { InterestChips } from '@/components/InterestChips';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { UsernameTakenError } from '@/data/profile-repository';
import { useCreateProfile } from '@/hooks/useProfile';
import { useIsOffline } from '@/providers/BudgetSync';
import { ProfileSetupInputSchema, type InterestTag } from '@/schemas';

import { AuthFormScreen, FormError } from './AuthFormScreen';
import { AvatarPicker } from './AvatarPicker';

type FieldErrors = { username?: string; interests?: string };

/**
 * Profile setup, shown once after the first sign-in (auth-onboarding D7, D20, P1, P2, P4, P5): the optional photo, the nick (typed
 * letters become lower case) and at least one interest. Nothing is checked until "Zapisz i zaczynamy": a bad form shows field
 * errors and sends nothing. A taken nick is an error on the nick field; any other failure is fixed copy above the button, announced,
 * and never the error's own message. Whatever failed, the nick, the interests and the photo stay. A success needs nothing here: the
 * profile query now holds the profile, the gate moves on, and until then the screen stays busy so nothing can be sent twice.
 * Offline the button is disabled under the offline banner. Field errors are live regions already, so only the general error and
 * the photo error are announced by hand.
 */
export function ProfileSetupScreen() {
  const { t } = useTranslation();
  const offline = useIsOffline();
  const create = useCreateProfile();
  const [username, setUsername] = useState('');
  const [interests, setInterests] = useState<InterestTag[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  // `create.isPending` only updates on the next render; this closes the gap between two taps in the same moment.
  const saving = useRef(false);

  const busy = create.isPending || create.isSuccess;
  const saveFailed = create.isError && !(create.error instanceof UsernameTakenError);

  function changeUsername(text: string) {
    setUsername(text.toLowerCase());
    setErrors((current) => ({ ...current, username: undefined }));
  }

  function changeInterests(next: InterestTag[]) {
    setInterests(next);
    setErrors((current) => ({ ...current, interests: undefined }));
  }

  function submit() {
    if (offline || busy || saving.current) return;
    const parsed = ProfileSetupInputSchema.safeParse({ username, interests, avatarUri });
    if (!parsed.success) {
      const messageOf = (field: keyof FieldErrors) => {
        const issue = parsed.error.issues.find((candidate) => candidate.path[0] === field);
        return issue && t(issue.message);
      };
      setErrors({ username: messageOf('username'), interests: messageOf('interests') });
      return;
    }
    saving.current = true;
    create.mutate(parsed.data, {
      onError: (error) => {
        if (error instanceof UsernameTakenError) setErrors((current) => ({ ...current, username: t('auth.profile.usernameTaken') }));
        else AccessibilityInfo.announceForAccessibility(t('auth.profile.saveError'));
      },
      onSettled: () => {
        saving.current = false;
      },
    });
  }

  return (
    <AuthFormScreen
      testID="profile-setup-screen"
      title={t('auth.profile.title')}
      topInset
      footer={
        <>
          {saveFailed && <FormError testID="profile-save-error" message={t('auth.profile.saveError')} />}
          <PrimaryButton label={t('auth.profile.save')} onPress={submit} loading={busy} disabled={offline} />
        </>
      }
    >
      <AvatarPicker uri={avatarUri} onPick={setAvatarUri} disabled={busy} />
      <TextField
        label={t('auth.profile.username')}
        hint={t('auth.profile.usernameHint')}
        value={username}
        onChangeText={changeUsername}
        error={errors.username}
        editable={!busy}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Field label={t('auth.profile.interests')} hint={t('auth.profile.interestsHint')} error={errors.interests}>
        <InterestChips selected={interests} onChange={changeInterests} disabled={busy} />
      </Field>
    </AuthFormScreen>
  );
}
