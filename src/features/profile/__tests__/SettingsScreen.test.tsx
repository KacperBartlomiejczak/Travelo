import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { processColor, StyleSheet } from 'react-native';
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

let session: ReturnType<typeof useFakeAppSession>;

async function renderSettings({ photo = false, email = EMAIL, patch = {} }: Options = {}) {
  session.setEmail(email);
  const base = createInMemoryProfileRepository({ newId: () => '00000000-0000-4000-8000-0000000000aa' });
  await base.createProfile({ username: 'kacper', interests: ['museums'], avatarUri: photo ? 'file:///old.jpg' : null });
  setAppProfileRepository({ ...base, ...patch });
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppProviders>
        <SettingsScreen />
      </AppProviders>
    </SafeAreaProvider>,
  );
}

const hidden = { includeHiddenElements: true };

type JsonNode = { type: string; props: Record<string, unknown>; children: (JsonNode | string)[] | null };

function findNode(node: JsonNode | string | null, type: string): JsonNode | null {
  if (!node || typeof node === 'string') return null;
  if (node.type === type) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, type);
    if (found) return found;
  }
  return null;
}

function gradientStops(): number[] {
  return (findNode(screen.toJSON() as JsonNode | null, 'RNSVGLinearGradient')?.props.gradient as number[] | undefined) ?? [];
}

beforeEach(async () => {
  session = useFakeAppSession();
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

  it('shows a round skeleton over the photo until it loads', async () => {
    await renderSettings({ photo: true });
    const image = await screen.findByTestId('settings-avatar-image', hidden);
    const skeleton = screen.getByTestId('settings-avatar-photo-skeleton', hidden);
    expect(StyleSheet.flatten(skeleton.props.style)).toMatchObject({ width: tokens.components.avatar.xl, height: tokens.components.avatar.xl });
    await fireEvent(image, 'load', { nativeEvent: { source: { width: 1, height: 1 } } });
    expect(screen.queryByTestId('settings-avatar-photo-skeleton', hidden)).toBeNull();
    expect(screen.getByTestId('settings-avatar-image', hidden)).toBeTruthy();
  });

  it('drops the photo skeleton and shows the initial when the photo fails', async () => {
    await renderSettings({ photo: true });
    await fireEvent(await screen.findByTestId('settings-avatar-image', hidden), 'error', { nativeEvent: { error: 'x' } });
    expect(screen.queryByTestId('settings-avatar-photo-skeleton', hidden)).toBeNull();
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
    // The query settles asynchronously (the rejection may still be in flight): wait for the error state first.
    await waitFor(() => expect(screen.queryByTestId('settings-nick-skeleton', hidden)).toBeNull());
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

describe('Settings PRO banner (settings-redesign step 6)', () => {
  const TITLE = { pl: 'Przejdź na PRO', en: 'Go PRO' };
  const LABEL = { pl: 'Przejdź na PRO. Więcej możliwości w Travelo', en: 'Go PRO. More from Travelo' };
  const SOON = { pl: 'Wkrótce! Subskrypcja PRO jest w przygotowaniu.', en: 'Coming soon! The PRO subscription is on its way.' };

  beforeEach(() => jest.mocked(router.push).mockClear());

  it.each([
    ['online', true],
    ['offline', false],
  ] as const)('is visible %s, as a button', async (_name, connected) => {
    setNetwork({ isConnected: connected, isInternetReachable: connected });
    await renderSettings();
    expect(await screen.findByRole('button', { name: LABEL.pl })).toBeTruthy();
    expect(screen.getByText(TITLE.pl)).toBeTruthy();
  });

  it.each(['pl', 'en'] as const)('reads title and subtitle as one label in %s', async (lang) => {
    await i18n.changeLanguage(lang);
    await renderSettings();
    expect(await screen.findByRole('button', { name: LABEL[lang] })).toBeTruthy();
  });

  it('is at least 56 high, with the card radius, surface and border', async () => {
    await renderSettings();
    const style = StyleSheet.flatten((await screen.findByRole('button', { name: LABEL.pl })).props.style);
    expect(style.minHeight).toBe(tokens.components.input.amountHeight);
    expect(style.minHeight).toBeGreaterThanOrEqual(56);
    expect(style).toMatchObject({ borderRadius: tokens.components.card.radius, backgroundColor: lightTheme.surface.primary, borderColor: lightTheme.border.subtle, borderWidth: 1 });
  });

  it.each(['pl', 'en'] as const)('shows the coming-soon snackbar on tap in %s, with no navigation and no repository call', async (lang) => {
    await i18n.changeLanguage(lang);
    const myProfile = jest.fn();
    await renderSettings({ patch: { myProfile: (...args) => { myProfile(); return createInMemoryProfileRepository().myProfile(...args); } } });
    const banner = await screen.findByRole('button', { name: LABEL[lang] });
    const before = myProfile.mock.calls.length;
    await fireEvent.press(banner);
    expect(await screen.findByText(SOON[lang])).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(myProfile.mock.calls.length).toBe(before);
  });

  it('works again after the snackbar has hidden', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      await renderSettings();
      const banner = await screen.findByRole('button', { name: LABEL.pl });
      await fireEvent.press(banner);
      expect(await screen.findByText(SOON.pl)).toBeTruthy();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(tokens.components.snackbar.durationShort);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(tokens.motion.duration.standard + 50);
      });
      expect(screen.queryByText(SOON.pl)).toBeNull();
      await fireEvent.press(banner);
      expect(await screen.findByText(SOON.pl)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('paints the gradient brand.primary to accent.sun in %s mode, with the left part transparent', async (scheme, theme) => {
    mockScheme = scheme;
    await renderSettings();
    await screen.findByRole('button', { name: LABEL.pl });
    // The native gradient prop is [offset, colour, offset, colour, ...]; compare colour channels, not alpha.
    const stops = gradientStops();
    const rgb = (value: unknown) => Number(value) & 0xffffff;
    expect(stops.filter((_, i) => i % 2 === 0)).toEqual([0, 0.4, 1]);
    expect(stops.filter((_, i) => i % 2 === 1).map(rgb)).toEqual([theme.brand.primary, theme.brand.primary, theme.accent.sun].map((c) => rgb(processColor(c))));
    expect(Number(stops[1]) >>> 24).toBe(0);
  });

  it('hides the gradient and the illustration from screen readers', async () => {
    await renderSettings();
    await screen.findByRole('button', { name: LABEL.pl });
    expect(screen.getByTestId('settings-pro-art', hidden).props['aria-hidden']).toBe(true);
  });
});
