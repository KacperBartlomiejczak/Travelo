import { router, Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import AuthLayout from '@/app/(auth)/_layout';
import { CodeScreen } from '@/features/auth/CodeScreen';
import { EmailScreen } from '@/features/auth/EmailScreen';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';

/**
 * The e-mail and code screens inside the real `(auth)` layout (auth-onboarding step 7), with a stand-in welcome screen:
 * what they show and where they go is tested here, the gate around them in `auth-gate.test.tsx`.
 */
export function renderEmailFlow(initialUrl = '/welcome') {
  return renderRouter(
    {
      _layout: () => (
        <AppProviders>
          <Slot />
        </AppProviders>
      ),
      '(auth)/_layout': AuthLayout,
      '(auth)/welcome': () => <Text>welcome stand-in</Text>,
      '(auth)/email': EmailScreen,
      '(auth)/code': CodeScreen,
    },
    { initialUrl },
  );
}

/** The headers the native stack was given, in stack order. Native headers are not <Text> in Jest: they are read from their config. */
export function headerConfigs(container: Awaited<ReturnType<typeof renderEmailFlow>>['container']) {
  return container.queryAll((node) => node.type === 'RNSScreenStackHeaderConfig');
}

/** Opens the flow on the welcome stand-in, then the e-mail screen. */
export async function openEmailScreen() {
  // renderRouter attaches getPathname to the returned promise, not to the awaited result.
  const rendered = renderEmailFlow('/welcome');
  const { container } = await rendered;
  await waitFor(() => expect(screen.getByText('welcome stand-in')).toBeTruthy());
  await act(async () => router.push('/email'));
  await waitFor(() => expect(screen.getByTestId('email-screen')).toBeTruthy());
  return { container, getPathname: () => rendered.getPathname() };
}

/** Types an address on the e-mail screen (in the phone's language) and sends the code, ending on the code screen. */
export async function openCodeScreen(email = 'kacper@example.com') {
  const opened = await openEmailScreen();
  await fireEvent.changeText(screen.getByLabelText(i18n.t('auth.email.label')), email);
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('auth.email.send') }));
  await waitFor(() => expect(screen.getByTestId('code-screen')).toBeTruthy());
  return opened;
}
