import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { useSendEmailCode } from '@/hooks/useSignIn';
import { useIsOffline } from '@/providers/BudgetSync';
import { EmailSignInInputSchema } from '@/schemas';

import { AuthFormScreen, FormError } from './AuthFormScreen';
import { useEmailSignIn } from './EmailSignInContext';

/**
 * Step 1 of signing in with an e-mail code (auth-onboarding D6, P3, P4, P5, D17): the address, then "Wyślij kod". A bad address is
 * a field error and sends nothing. A sent code stores the normalised address and the send time in the `(auth)` layout's state
 * and opens the code screen. Any failure shows fixed copy, announced, and never the error's own message. Offline the button is
 * disabled under the offline banner.
 */
export function EmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const offline = useIsOffline();
  const { codeSent } = useEmailSignIn();
  const send = useSendEmailCode();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  // `send.isPending` only updates on the next render; this closes the gap between two taps in the same moment (D19).
  const sending = useRef(false);

  function change(text: string) {
    setEmail(text);
    setFieldError(undefined);
    if (send.isError) send.reset();
  }

  function submit() {
    if (offline || send.isPending || sending.current) return;
    const parsed = EmailSignInInputSchema.safeParse({ email });
    if (!parsed.success) {
      const message = t(parsed.error.issues[0].message);
      setFieldError(message);
      AccessibilityInfo.announceForAccessibility(message);
      return;
    }
    sending.current = true;
    send.mutate(parsed.data, {
      onSuccess: () => {
        codeSent(parsed.data.email);
        router.push('/code');
      },
      onError: () => AccessibilityInfo.announceForAccessibility(t('auth.email.sendError')),
      onSettled: () => {
        sending.current = false;
      },
    });
  }

  return (
    <AuthFormScreen
      testID="email-screen"
      title={t('auth.email.title')}
      hint={t('auth.email.hint')}
      footer={
        <>
          {send.isError && <FormError testID="email-send-error" message={t('auth.email.sendError')} />}
          <PrimaryButton label={t('auth.email.send')} onPress={submit} loading={send.isPending} disabled={offline} />
        </>
      }
    >
      <TextField
        label={t('auth.email.label')}
        value={email}
        onChangeText={change}
        editable={!send.isPending}
        error={fieldError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
    </AuthFormScreen>
  );
}
