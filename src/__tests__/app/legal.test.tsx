import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo, Text } from 'react-native';

import AuthLayout from '@/app/(auth)/_layout';
import WelcomeScreen from '@/app/(auth)/welcome';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import ProfileScreen from '@/app/(drawer)/(tabs)/profile';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import LegalRoute from '@/app/legal/[doc]';
import SettingsRoute from '@/app/settings';
import i18n from '@/i18n';
import en from '@/i18n/locales/en.json';
import pl from '@/i18n/locales/pl.json';
import { useFakeAppSession } from '@/test/fake-session-source';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const ROUTES = {
  _layout: RootLayout,
  '(auth)/_layout': AuthLayout,
  '(auth)/welcome': WelcomeScreen,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/(tabs)/_layout': TabsLayout,
  '(drawer)/(tabs)/index': () => <Text>home</Text>,
  '(drawer)/(tabs)/expenses': () => <Text>expenses</Text>,
  '(drawer)/(tabs)/plan': () => <Text>plan</Text>,
  '(drawer)/(tabs)/profile': ProfileScreen,
  settings: SettingsRoute,
  'legal/[doc]': LegalRoute,
};

beforeEach(async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await i18n.changeLanguage('pl');
});

describe('Legal screen', () => {
  const dictionaries = { pl, en };
  it.each([
    ['pl', 'privacy'],
    ['pl', 'terms'],
    ['en', 'privacy'],
    ['en', 'terms'],
  ] as const)('%s /legal/%s shows the title, the version line and every section heading', async (lang, doc) => {
    await i18n.changeLanguage(lang);
    await renderRouter(ROUTES, { initialUrl: `/legal/${doc}` });
    const content = dictionaries[lang].legal[doc];
    expect(await screen.findByTestId('legal-screen')).toBeTruthy();
    expect(screen.getAllByText(content.title).length).toBeGreaterThan(0);
    expect(screen.getByText(content.updated)).toBeTruthy();
    for (const section of content.sections.filter((s) => s.heading)) {
      expect(screen.getByRole('header', { name: section.heading })).toBeTruthy();
    }
  });

  it('an unknown document shows an error state', async () => {
    await renderRouter(ROUTES, { initialUrl: '/legal/foo' });
    expect(await screen.findByText(pl.legal.error)).toBeTruthy();
    expect(screen.queryByTestId('legal-screen')).toBeNull();
  });

  it('is reachable while signed out', async () => {
    useFakeAppSession({ status: 'signedOut' });
    await renderRouter(ROUTES, { initialUrl: '/legal/terms' });
    expect(await screen.findByTestId('legal-screen')).toBeTruthy();
    expect(screen.queryByText('Witaj w Travelo')).toBeNull();
  });
});

describe('Legal header back button', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [false, 'replace', 'back'],
    [true, 'back', 'replace'],
  ] as const)('canGoBack=%s calls router.%s and not router.%s', async (canGoBack, called, notCalled) => {
    await renderRouter(ROUTES, { initialUrl: '/legal/terms' });
    await screen.findByTestId('legal-screen');
    jest.spyOn(router, 'canGoBack').mockReturnValue(canGoBack);
    const spies = { back: jest.spyOn(router, 'back').mockImplementation(), replace: jest.spyOn(router, 'replace').mockImplementation() };
    await fireEvent.press(screen.getByRole('button', { name: pl.legal.back }));
    // HeaderBackButton calls onPress inside requestAnimationFrame.
    await waitFor(() => expect(spies[called]).toHaveBeenCalledWith(...(called === 'replace' ? ['/'] : [])));
    expect(spies[notCalled]).not.toHaveBeenCalled();
  });
});

describe('Settings links to the legal documents', () => {
  it.each([
    ['Polityka prywatności', '/legal/privacy'],
    ['Regulamin', '/legal/terms'],
  ])('"%s" opens %s', async (label, path) => {
    const rendered = renderRouter(ROUTES, { initialUrl: '/settings' });
    await rendered;
    await fireEvent.press(await screen.findByRole('button', { name: label }));
    await waitFor(() => expect(rendered.getPathname()).toBe(path));
    expect(await screen.findByTestId('legal-screen')).toBeTruthy();
  });
});
