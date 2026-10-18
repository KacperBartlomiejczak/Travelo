import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, type TextInput } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { InvalidCodeError } from '@/data/auth';
import { useSendEmailCode, useVerifyEmailCode } from '@/hooks/useSignIn';
import { useIsOffline } from '@/providers/BudgetSync';
import { EmailCodeInputSchema, OTP_CODE_LENGTH } from '@/schemas';

import { AuthFormScreen, FormError } from './AuthFormScreen';
import { useEmailSignIn } from './EmailSignInContext';
import { formatCountdown, spokenSeconds, useResendCountdown } from './useResendCountdown';

/**
 * Step 2 of signing in with an e-mail code (auth-onboarding D6, P3, P4, P5, D17). The address comes from the `(auth)` layout's
 * state, never from the URL; opened without one (e.g. by a deep link) it leaves for the e-mail screen.
 */
export function CodeScreen() {
  const { email, sentAt } = useEmailSignIn();
  if (email === null || sentAt === null) return <Redirect href="/email" />;
  return <Code email={email} sentAt={sentAt} />;
}

// The 6th digit signs in on its own; "Zaloguj się" is for a retry. A success needs nothing here: Supabase's SIGNED_IN moves the
// gate on, so the screen stays busy until it is gone and nothing can be sent twice. A wrong code is a field error (the digits
// stay, the field is focused to correct them); any other failure is fixed copy above the buttons. Neither shows the error's own
// message. The resend button counts down from the last send; its spoken name changes only every 10 s, not every second.
function Code({ email, sentAt }: { email: string; sentAt: number }) {
  const { t } = useTranslation();
  const offline = useIsOffline();
  const { codeSent } = useEmailSignIn();
  const verify = useVerifyEmailCode();
  const resend = useSendEmailCode();
  const remaining = useResendCountdown(sentAt);
  const [code, setCode] = useState('');
  const [formatError, setFormatError] = useState<string>();
  const inputRef = useRef<TextInput>(null);
  // `verify.isPending` only updates on the next render; this closes the gap between two submits in the same moment.
  const submitting = useRef(false);

  const busy = verify.isPending || verify.isSuccess;
  const wrongCode = verify.error instanceof InvalidCodeError;
  const fieldError = formatError ?? (wrongCode ? t('auth.code.invalid') : undefined);
  const generalError = verify.isError && !wrongCode ? t('auth.code.signInError') : resend.isError ? t('auth.email.sendError') : undefined;

  // The digits stay after a wrong code: focus the field so they can be corrected.
  useEffect(() => {
    if (wrongCode) inputRef.current?.focus();
  }, [wrongCode]);

  function announce(message: string) {
    AccessibilityInfo.announceForAccessibility(message);
  }

  function submit(digits: string) {
    if (offline || busy || submitting.current) return;
    const parsed = EmailCodeInputSchema.safeParse({ email, code: digits });
    if (!parsed.success) {
      const message = t((parsed.error.issues.find((issue) => issue.path[0] === 'code') ?? parsed.error.issues[0]).message);
      setFormatError(message);
      announce(message);
      return;
    }
    submitting.current = true;
    resend.reset();
    verify.mutate(parsed.data, {
      onError: (error) => announce(error instanceof InvalidCodeError ? t('auth.code.invalid') : t('auth.code.signInError')),
      onSettled: () => {
        submitting.current = false;
      },
    });
  }

  function change(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH);
    setCode(digits);
    setFormatError(undefined);
    if (verify.isError) verify.reset();
    if (digits.length === OTP_CODE_LENGTH) submit(digits);
  }

  function resendCode() {
    if (offline || busy || remaining > 0 || resend.isPending) return;
    resend.mutate(
      { email },
      {
        onSuccess: () => {
          // A new code was sent, so what was typed for the old one is stale.
          setCode('');
          setFormatError(undefined);
          verify.reset();
          codeSent(email);
        },
        onError: () => announce(t('auth.email.sendError')),
      },
    );
  }

  const counting = remaining > 0;

  return (
    <AuthFormScreen
      testID="code-screen"
      title={t('auth.code.title')}
      hint={t('auth.code.sentTo', { email })}
      footer={
        <>
          {generalError && <FormError testID="code-error" message={generalError} />}
          <PrimaryButton label={t('auth.code.signIn')} onPress={() => submit(code)} loading={busy} disabled={offline} />
          <TextButton
            variant="ghost"
            label={counting ? t('auth.code.resendIn', { time: formatCountdown(remaining) }) : t('auth.code.resend')}
            accessibilityLabel={counting ? t('auth.code.resendWait', { seconds: spokenSeconds(remaining) }) : t('auth.code.resend')}
            onPress={resendCode}
            disabled={offline || busy || counting || resend.isPending}
          />
        </>
      }
    >
      <TextField
        inputRef={inputRef}
        label={t('auth.code.label')}
        value={code}
        onChangeText={change}
        error={fieldError}
        editable={!offline && !busy}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_CODE_LENGTH}
        returnKeyType="done"
        onSubmitEditing={() => submit(code)}
      />
    </AuthFormScreen>
  );
}
