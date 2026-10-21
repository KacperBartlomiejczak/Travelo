import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmailSignInProvider } from '@/features/auth/EmailSignInContext';
import { useTheme } from '@/theme/legacy/useTheme';

// What a signed-out user can reach (auth-onboarding steps 5-7): the welcome screen, then the e-mail and code screens. The
// welcome screen is declared first so it is the one a signed-out user lands on; without it the first screen would be "code",
// the first by name. It has no header (it is always dark, full screen); the e-mail and code screens have the wizard's native one
// with only a back button, labelled "Wstecz". The address typed on the e-mail screen is kept here, for the code screen (D17).
export default function AuthLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const form = {
    headerShown: true,
    title: '',
    headerBackTitle: t('auth.back'),
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.text.primary,
    headerShadowVisible: false,
  } as const;

  return (
    <EmailSignInProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="email" options={form} />
        <Stack.Screen name="code" options={form} />
      </Stack>
    </EmailSignInProvider>
  );
}
