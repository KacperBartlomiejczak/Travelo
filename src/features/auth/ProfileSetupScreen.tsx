import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, findNodeHandle, View, type ScrollView, type TextInput } from 'react-native';

import { Field } from '@/components/Field';
import { InterestChips } from '@/components/InterestChips';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { appProviderProfile } from '@/data/app-provider-profile';
import { UsernameTakenError } from '@/data/profile-repository';
import { useCreateProfile } from '@/hooks/useProfile';
import { useIsOffline } from '@/providers/BudgetSync';
import { ProfileSetupInputSchema, type InterestTag } from '@/schemas';

import { AuthFormScreen, FormError } from './AuthFormScreen';
import { AvatarPicker } from './AvatarPicker';

/**
 * Profile setup, shown once after the first sign-in (auth-onboarding D7, D20, P1, P2, P4, P5; theme-split-and-profile-prefill D4, P4):
 * the optional photo, the nick (typed letters become lower case) and at least one interest. "Zapisz i zaczynamy" is disabled until
 * `ProfileSetupInputSchema` accepts the form (a valid nick and one interest), so nothing is ever checked on a tap: the nick hint and
 * the interests hint say what is needed, and the keyboard "done" key on an incomplete form does nothing, like the button. A taken nick
 * is an error on the nick field; any other failure is fixed copy above the button, announced, and never the error's own message.
 * After a Google / Discord sign-in the nick and the photo are suggested from the account (theme-split-and-profile-prefill P5, P7): the
 * nick is filled in, the photo is downloaded into a local file while the circle shows a spinner, and the save button does not wait for it.
 * It is only a suggestion: whatever the user typed or picked first is never replaced, a photo that cannot be downloaded leaves the empty
 * circle with no error (the photo is optional), and nothing is set once the screen is gone. A photo that arrives while a save is in flight
 * is shown only if that save fails (D12), so the next try sends it; after a successful save it is dropped. An e-mail sign-in suggests nothing.
 * Whatever failed, the nick, the interests and the photo stay. A success needs nothing here: the profile query now holds the profile,
 * the gate moves on, and until then the screen stays busy so nothing can be sent twice. Offline the button is disabled under the
 * offline banner. The taken-nick error is a live region already, so only the general error and the photo error are announced by
 * hand. A taken nick scrolls to the nick and moves the screen reader focus there (D24); the general error sits in the pinned footer
 * and needs no scroll.
 */
export function ProfileSetupScreen() {
  const { t } = useTranslation();
  const offline = useIsOffline();
  const create = useCreateProfile();
  const [username, setUsername] = useState('');
  const [interests, setInterests] = useState<InterestTag[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  // What the user did themselves wins over the suggestion from the account, however late it arrives (P5, D12): a typed nick, a gallery photo.
  const nickChosen = useRef(false);
  const avatarChosen = useRef(false);
  // The account photo is applied only while no save has succeeded, and a photo that arrives while a save is in flight waits for its outcome (D12).
  const saveOutcome = useRef<'idle' | 'saving' | 'saved'>('idle');
  const latePhoto = useRef<string | null>(null);
  const [usernameError, setUsernameError] = useState<string>();
  // `create.isPending` only updates on the next render; this closes the gap between two taps in the same moment.
  const saving = useRef(false);
  // Where the nick sits in the scrolling content (from onLayout), to scroll to its error; and the input that takes the screen reader focus.
  const scrollRef = useRef<ScrollView>(null);
  const nickY = useRef(0);
  const nickInput = useRef<TextInput>(null);

  // The schema is the one rule for a complete form (D4).
  const parsed = ProfileSetupInputSchema.safeParse({ username, interests, avatarUri });
  const busy = create.isPending || create.isSuccess;
  const saveFailed = create.isError && !(create.error instanceof UsernameTakenError);

  useEffect(() => {
    let mounted = true;
    async function prefill() {
      let suggestion;
      try {
        suggestion = await appProviderProfile.read();
      } catch {
        return;
      }
      if (!mounted) return;
      if (suggestion.suggestedUsername && !nickChosen.current) setUsername(suggestion.suggestedUsername);
      if (!suggestion.avatarUrl || avatarChosen.current) return;
      setAvatarLoading(true);
      try {
        const uri = await appProviderProfile.downloadAvatar(suggestion.avatarUrl);
        if (mounted && !avatarChosen.current) {
          if (saveOutcome.current === 'idle') setAvatarUri(uri);
          else if (saveOutcome.current === 'saving') latePhoto.current = uri;
        }
      } catch {
        // The photo is optional: the circle stays empty and nothing is shown.
      } finally {
        if (mounted) setAvatarLoading(false);
      }
    }
    void prefill();
    return () => {
      mounted = false;
    };
  }, []);

  function changeUsername(text: string) {
    nickChosen.current = true;
    setUsername(text.toLowerCase());
    setUsernameError(undefined);
  }

  function pickAvatar(uri: string) {
    avatarChosen.current = true;
    setAvatarUri(uri);
  }

  /** Jumps to the nick (no animation, so reduced motion needs no special case) and moves the screen reader focus to it. */
  function showNickError() {
    scrollRef.current?.scrollTo({ y: nickY.current, animated: false });
    const handle = findNodeHandle(nickInput.current);
    if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
  }

  function submit() {
    if (offline || busy || saving.current || !parsed.success) return;
    saving.current = true;
    saveOutcome.current = 'saving';
    create.mutate(parsed.data, {
      onSuccess: () => {
        // The profile is saved and the gate moves on: a photo that is still on its way changes nothing any more.
        saveOutcome.current = 'saved';
        latePhoto.current = null;
      },
      onError: (error) => {
        // The form stays, so an account photo that arrived (or arrives) during the save is shown for the next try, unless the user has picked their own.
        saveOutcome.current = 'idle';
        if (latePhoto.current && !avatarChosen.current) setAvatarUri(latePhoto.current);
        latePhoto.current = null;
        if (error instanceof UsernameTakenError) {
          setUsernameError(t('auth.profile.usernameTaken'));
          showNickError();
        } else AccessibilityInfo.announceForAccessibility(t('auth.profile.saveError'));
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
      scrollRef={scrollRef}
      footer={
        <>
          {saveFailed && <FormError testID="profile-save-error" message={t('auth.profile.saveError')} />}
          <PrimaryButton label={t('auth.profile.save')} onPress={submit} loading={busy} disabled={offline || !parsed.success} />
        </>
      }
    >
      <AvatarPicker uri={avatarUri} onPick={pickAvatar} disabled={busy} loading={avatarLoading} />
      <View testID="profile-nick-block" onLayout={(event) => (nickY.current = event.nativeEvent.layout.y)}>
        <TextField
          label={t('auth.profile.username')}
          hint={t('auth.profile.usernameHint')}
          value={username}
          onChangeText={changeUsername}
          error={usernameError}
          inputRef={nickInput}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <Field label={t('auth.profile.interests')} hint={t('auth.profile.interestsHint')} messagesFirst>
        <InterestChips selected={interests} onChange={setInterests} disabled={busy} />
      </Field>
    </AuthFormScreen>
  );
}
