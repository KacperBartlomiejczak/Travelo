import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { StyleSheet, Text } from 'react-native';

import AuthLayout from '@/app/(auth)/_layout';
import WelcomeScreen from '@/app/(auth)/welcome';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import SettingsRoute from '@/app/settings';
import { writeLanguagePreference, writeThemePreference } from '@/data/preferences';
import i18n from '@/i18n';
import { useFakeAppSession } from '@/test/fake-session-source';
import { tokens } from '@/theme/tokens';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);
// Jest has no app config; the screen reads the version from it.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

// The saved choices, kept in memory so the screen's switches can be read back.
let mockSaved = { theme: 'system', language: 'system' };
jest.mock('@/data/preferences', () => ({
  readThemePreference: jest.fn(() => mockSaved?.theme ?? 'system'),
  readLanguagePreference: jest.fn(() => mockSaved?.language ?? 'system'),
  writeThemePreference: jest.fn(),
  writeLanguagePreference: jest.fn(),
}));

const ROUTES = {
  _layout: RootLayout,
  '(auth)/_layout': AuthLayout,
  '(auth)/welcome': WelcomeScreen,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/(tabs)/_layout': TabsLayout,
  '(drawer)/(tabs)/index': () => <Text>home</Text>,
  '(drawer)/(tabs)/expenses': () => <Text>expenses</Text>,
  '(drawer)/(tabs)/plan': () => <Text>plan</Text>,
  '(drawer)/(tabs)/profile': () => <Text>profile</Text>,
  'edit-profile': () => <Text>edit-profile-screen</Text>,
  settings: SettingsRoute,
};

async function openSettings() {
  const rendered = renderRouter(ROUTES, { initialUrl: '/settings' });
  await rendered;
  await screen.findByTestId('settings-screen');
  return { getPathname: () => rendered.getPathname() };
}

const group = (name: string) => within(screen.getByLabelText(name));

beforeEach(async () => {
  mockSaved = { theme: 'system', language: 'system' };
  jest.mocked(writeThemePreference).mockClear();
  jest.mocked(writeLanguagePreference).mockClear();
  useFakeAppSession();
  await i18n.changeLanguage('pl');
});

describe('Settings list (profile-settings step 8)', () => {
  it('shows the rows and switchers, in Polish', async () => {
    await openSettings();
    for (const name of ['Edytuj profil', 'Polityka prywatności', 'Regulamin']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.getByText('Wersja')).toBeTruthy();
    expect(screen.getByText('1.2.3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edytuj profil' })).toBeTruthy();
    expect(screen.getByText('Motyw')).toBeTruthy();
    expect(screen.getByText('Język')).toBeTruthy();
  });

  it('shows the rows and switchers, in English', async () => {
    await i18n.changeLanguage('en');
    await openSettings();
    for (const text of ['Privacy policy', 'Terms of use', 'Theme', 'Language', 'Version']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeTruthy();
    expect(group('Theme').getByRole('radio', { name: 'System' })).toBeTruthy();
    expect(group('Theme').getByRole('radio', { name: 'Light' })).toBeTruthy();
    expect(group('Theme').getByRole('radio', { name: 'Dark' })).toBeTruthy();
    expect(group('Language').getByRole('radio', { name: 'Polish' })).toBeTruthy();
    expect(group('Language').getByRole('radio', { name: 'English' })).toBeTruthy();
  });

  it('"Edytuj profil" opens /edit-profile', async () => {
    const app = await openSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Edytuj profil' }));
    expect(await screen.findByText('edit-profile-screen')).toBeTruthy();
    expect(app.getPathname()).toBe('/edit-profile');
  });

  it('the switches show the saved choice', async () => {
    mockSaved = { theme: 'dark', language: 'en' };
    await openSettings();
    expect(group('Motyw').getByRole('radio', { name: 'Ciemny' })).toBeChecked();
    expect(group('Motyw').getByRole('radio', { name: 'Jasny' })).not.toBeChecked();
    expect(group('Język').getByRole('radio', { name: 'Polski' })).not.toBeChecked();
    expect(group('Język').getByRole('radio', { name: 'Angielski' })).toBeChecked();
  });

  it('with nothing saved both switches are on "Systemowy"', async () => {
    await openSettings();
    expect(group('Motyw').getByRole('radio', { name: 'Systemowy' })).toBeChecked();
    expect(group('Język').getByRole('radio', { name: 'Systemowy' })).toBeChecked();
  });

  it('choosing a theme saves it and moves the selection', async () => {
    await openSettings();
    await fireEvent.press(group('Motyw').getByRole('radio', { name: 'Jasny' }));
    expect(writeThemePreference).toHaveBeenCalledWith('light');
    expect(group('Motyw').getByRole('radio', { name: 'Jasny' })).toBeChecked();
  });

  it('choosing a language saves it and switches the screen to it, naming the languages in that language', async () => {
    await openSettings();
    await fireEvent.press(group('Język').getByRole('radio', { name: 'Angielski' }));
    expect(writeLanguagePreference).toHaveBeenCalledWith('en');
    expect(await screen.findByText('Edit profile')).toBeTruthy();
    expect(group('Language').getByRole('radio', { name: 'English' })).toBeChecked();
  });

  it('shows the app version from expo-constants and the links to the legal documents (legal step B2, supersedes D5)', async () => {
    await openSettings();
    const version = Constants.expoConfig?.version;
    expect(version).toBeTruthy();
    expect(screen.getByText('Wersja')).toBeTruthy();
    expect(screen.getByText(version as string)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Polityka prywatności' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Regulamin' })).toBeTruthy();
  });

  it('keeps "Wyloguj się" below every section, with "Usuń konto" as the very last button under it (D7)', async () => {
    await openSettings();
    const labels = within(screen.getByTestId('settings-scroll')).getAllByRole('button').map((b) => b.props.accessibilityLabel ?? '');
    expect(labels.at(-2)).toBe('Wyloguj się');
    expect(labels.at(-1)).toBe('Usuń konto');
  });

  it('has rows at least 56dp tall in the order Edytuj profil, Polityka prywatności, Regulamin, Wersja; Wersja is not a button', async () => {
    await openSettings();
    const rows = screen.getAllByTestId('settings-row');
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(StyleSheet.flatten(row.props.style).minHeight).toBe(tokens.components.listRow.minHeight);
    for (const name of ['Edytuj profil', 'Polityka prywatności', 'Regulamin']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(tokens.components.listRow.minHeight).toBe(56);
    expect(screen.queryByRole('button', { name: /Wersja/ })).toBeNull();
    const texts = within(screen.getByTestId('settings-scroll')).getAllByText(/^(Edytuj profil|Polityka prywatności|Regulamin|Wersja)$/).map((n) => n.props.children);
    expect(texts).toEqual(['Edytuj profil', 'Polityka prywatności', 'Regulamin', 'Wersja']);
  });

  it('hides the arrow circles from assistive tech and shows one only on button rows', async () => {
    await openSettings();
    const circles = screen.getAllByTestId('settings-row-arrow', { includeHiddenElements: true });
    expect(circles).toHaveLength(3);
    for (const circle of circles) {
      expect(circle.props['aria-hidden']).toBe(true);
      expect(StyleSheet.flatten(circle.props.style)).toMatchObject({ width: tokens.spacing[8], height: tokens.spacing[8] });
    }
  });
});
