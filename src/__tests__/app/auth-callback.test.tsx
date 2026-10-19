import { useFonts } from 'expo-font';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import RootLayout from '@/app/_layout';
import AuthCallback from '@/app/auth/callback';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

describe('auth/callback (auth-onboarding step 3)', () => {
  it('lands on / without an "unmatched route" when the OAuth redirect opens the app here', async () => {
    const rendered = renderRouter(
      {
        _layout: RootLayout,
        '(drawer)/_layout': DrawerLayout,
        '(drawer)/(tabs)/_layout': TabsLayout,
        '(drawer)/(tabs)/index': () => <Text>home screen</Text>,
        'auth/callback': AuthCallback,
        'trips/new/index': () => null,
      },
      { initialUrl: '/auth/callback?code=x' },
    );
    await rendered;

    expect(rendered.getPathname()).toBe('/');
    expect(screen.getByText('home screen')).toBeTruthy();
    expect(screen.queryByText(/unmatched/i)).toBeNull();
  });
});
