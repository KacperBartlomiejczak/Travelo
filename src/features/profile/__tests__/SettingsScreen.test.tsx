import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createInMemoryProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { setAppProfileRepository } from '@/test/fake-profile-repository';
import { useFakeAppSession } from '@/test/fake-session-source';
import { setNetwork } from '@/test/mock-network';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

import { SettingsScreen } from '../SettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));
let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const EMAIL = 'kacper@example.com';

type Options = { photo?: boolean; email?: string | null; patch?: Partial<ProfileRepository> };

async function renderSettings({ photo = false, email = EMAIL, patch = {} }: Options = {}) {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- a test helper named like a hook, not a React hook
  useFakeAppSession().setEmail(email);
  const base = createInMemoryProfileRepository({ newId: () => '00000000-0000-4000-8000-0000000000aa' });
  await base.createProfile({ username: 'kacper', interests: ['museums'], avatarUri: photo ? 'file:///old.jpg' : null });
  setAppProfileRepository({ ...base, ...patch });
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppProviders>
        <SettingsScreen />
      </AppProviders>
    </SafeAreaProvider>,
  );
}

const hidden = { includeHiddenElements: true };

beforeEach(async () => {
  mockScheme = 'light';
  setNetwork({ isConnected: true, isInternetReachable: true });
  await i18n.changeLanguage('pl');
});

describe('Settings identity block (settings-redesign step 5)', () => {
  it('shows the nick and, under it, the e-mail', async () => {
    await renderSettings();
    expect(await screen.findByText('kacper')).toBeTruthy();
    expect(await screen.findByText(EMAIL)).toBeTruthy();
  });

  it('has no e-mail line when the e-mail is unknown, and no placeholder text', async () => {
    await renderSettings({ email: null });
    await screen.findByText('kacper');
    expect(screen.queryByTestId('settings-email')).toBeNull();
    expect(screen.queryByText('-')).toBeNull();
  });

  it('keeps a long e-mail on one line with an ellipsis', async () => {
    await renderSettings({ email: `${'a'.repeat(60)}@example.com` });
    const line = await screen.findByTestId('settings-email');
    expect(line.props.numberOfLines).toBe(1);
    expect(line.props.ellipsizeMode).toBe('tail');
  });

  it('shows the photo from avatarUrl', async () => {
    await renderSettings({ photo: true });
    const image = await screen.findByTestId('settings-avatar-image', hidden);
    expect([image.props.source].flat()[0]).toMatchObject({ uri: expect.stringContaining('https://avatars.invalid/') });
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: tokens.components.avatar.xl, height: tokens.components.avatar.xl });
  });

  it('shows the initial of the nick when there is no photo', async () => {
    await renderSettings();
    await screen.findByText('kacper');
    const initial = screen.getByTestId('settings-avatar-initial', hidden);
    expect(StyleSheet.flatten(initial.props.style)).toMatchObject({ backgroundColor: lightTheme.background.sunken });
    expect(screen.getByText('K', hidden)).toBeTruthy();
  });

  it('falls back to the initial when the photo fails to load', async () => {
    await renderSettings({ photo: true });
    await fireEvent(await screen.findByTestId('settings-avatar-image', hidden), 'error', { nativeEvent: { error: 'x' } });
    expect(screen.queryByTestId('settings-avatar-image', hidden)).toBeNull();
    expect(screen.getByTestId('settings-avatar-initial', hidden)).toBeTruthy();
  });

  it('shows skeletons for the avatar and the nick while the profile loads', async () => {
    await renderSettings({ patch: { myProfile: () => new Promise(() => undefined) } });
    expect(await screen.findByTestId('settings-avatar-skeleton', hidden)).toBeTruthy();
    expect(screen.getByTestId('settings-nick-skeleton', hidden)).toBeTruthy();
    expect(screen.queryByText('kacper')).toBeNull();
  });

  it('shows no nick block when the profile cannot be read', async () => {
    await renderSettings({ patch: { myProfile: () => Promise.reject(new Error('boom')) } });
    await screen.findByTestId('settings-screen');
    expect(screen.queryByTestId('settings-nick-skeleton', hidden)).toBeNull();
    expect(screen.queryByTestId('settings-identity')).toBeNull();
  });

  it('has an avatar that is hidden from screen readers and is not a button', async () => {
    await renderSettings({ photo: true });
    await screen.findByText('kacper');
    const avatar = screen.getByTestId('settings-avatar', hidden);
    expect(avatar.props['aria-hidden']).toBe(true);
    expect(avatar.props.onPress).toBeUndefined();
    expect(screen.queryByRole('button', { name: /zdjęcie|avatar/i })).toBeNull();
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('takes its colors and type from tokens in %s mode', async (scheme, theme) => {
    mockScheme = scheme;
    await renderSettings();
    const nick = await screen.findByText('kacper');
    expect(StyleSheet.flatten(nick.props.style)).toMatchObject({ color: theme.text.primary, ...tokens.typography.styles.headingLG });
    const email = await screen.findByText(EMAIL);
    expect(StyleSheet.flatten(email.props.style)).toMatchObject({ color: theme.text.secondary, ...tokens.typography.styles.bodySM });
    expect(StyleSheet.flatten(screen.getByTestId('settings-avatar-initial', hidden).props.style)).toMatchObject({ backgroundColor: theme.background.sunken });
  });
});
