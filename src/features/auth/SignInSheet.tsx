import { useRouter } from 'expo-router';
import { CircleX, Mail } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { TextButton } from '@/components/TextButton';
import type { OAuthProvider } from '@/data/auth';
import { useSignIn } from '@/hooks/useSignIn';
import { useIsOffline } from '@/providers/BudgetSync';
import { useTheme } from '@/theme/useTheme';

import { DiscordButton } from './DiscordButton';
import { GoogleButton } from './GoogleButton';

type Props = { onClose: () => void };

// The sign-in options (auth-onboarding D6, D10, D13, P4, P5): Google, Discord, then e-mail. Mounting opens the sheet, like
// the other sheets. While a browser sign-in runs the tapped button shows a spinner, all three are disabled and the sheet
// cannot be dismissed. Cancelling the browser changes nothing. A failure shows fixed copy for the tapped provider, announced,
// and never the error's own message (it can carry text from a deep link). A success needs nothing here: Supabase's
// SIGNED_IN moves the gate on. E-mail closes the sheet and opens its own screens. Offline, everything is disabled.
export function SignInSheet({ onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const offline = useIsOffline();
  const signIn = useSignIn();
  const pending = signIn.isPending;
  const tapped: OAuthProvider | undefined = signIn.variables;

  const errorCopy: Record<OAuthProvider, string> = {
    google: t('auth.signIn.error.google'),
    discord: t('auth.signIn.error.discord'),
  };

  function start(provider: OAuthProvider) {
    signIn.mutate(provider, { onError: () => AccessibilityInfo.announceForAccessibility(errorCopy[provider]) });
  }

  function chooseEmail() {
    onClose();
    router.push('/email');
  }

  return (
    <BottomSheet visible title={t('auth.signIn.title')} onClose={onClose} dismissible={!pending}>
      {offline && <OfflineBanner />}
      <View testID="sign-in-options" style={{ gap: theme.spacing[3] }}>
        <GoogleButton
          label={t('auth.signIn.google')}
          onPress={() => start('google')}
          loading={pending && tapped === 'google'}
          disabled={offline || (pending && tapped !== 'google')}
        />
        <DiscordButton
          label={t('auth.signIn.discord')}
          onPress={() => start('discord')}
          loading={pending && tapped === 'discord'}
          disabled={offline || (pending && tapped !== 'discord')}
        />
        <TextButton variant="secondary" label={t('auth.signIn.email')} icon={Mail} onPress={chooseEmail} disabled={offline || pending} />
      </View>
      {signIn.isError && tapped && (
        // Announced by the call in `start`; a live region as well would read it twice.
        <View testID="sign-in-error" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
          <CircleX
            testID="sign-in-error-icon"
            size={theme.size.iconInline}
            strokeWidth={theme.size.iconStroke}
            color={theme.colors.status.error}
            aria-hidden
          />
          <Text style={[theme.typography.bodyS, { color: theme.colors.status.error, flexShrink: 1 }]}>{errorCopy[tapped]}</Text>
        </View>
      )}
    </BottomSheet>
  );
}
