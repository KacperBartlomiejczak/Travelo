import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { isHiddenFromAccessibility } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import AuthLayout from '@/app/(auth)/_layout';
import CodeScreen from '@/app/(auth)/code';
import EmailScreen from '@/app/(auth)/email';
import WelcomeScreen from '@/app/(auth)/welcome';
import RootLayout from '@/app/_layout';
import AuthCallback from '@/app/auth/callback';
import OnboardingScreen from '@/app/onboarding';
import { appAuth } from '@/data/app-auth';
import { InvalidCodeError } from '@/data/auth';
import { ServerUnreachableError } from '@/data/errors';
import { createInMemoryProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import { useCreateProfile } from '@/hooks/useProfile';
import i18n from '@/i18n';
import { repositoryWithProfile, setAppProfileRepository, withMyProfile } from '@/test/fake-profile-repository';
import { useFakeAppSession } from '@/test/fake-session-source';
import { SIGNED_IN_USER_ID } from '@/test/fake-supabase';
import { setNetwork } from '@/test/mock-network';
import { allowGateToStayLoading } from '@/test/settle-gate';

// The sign-in itself (Supabase + the system browser) is never reached: a test decides what it answers.
const mockSignIn = jest.fn<Promise<'signed-in' | 'cancelled'>, ['google' | 'discord']>();
jest.mock('@/data/app-auth', () => ({
  appAuth: {
    signInWithProvider: (provider: 'google' | 'discord') => mockSignIn(provider),
    sendEmailCode: jest.fn(async () => {}),
    verifyEmailCode: jest.fn(async () => {}),
  },
}));

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

const WELCOME = 'Witaj w Travelo';
const ONBOARDING = 'Utwórz profil';
const PROFILE_ERROR = 'Nie udało się wczytać profilu.';
const START_ERROR = 'Nie udało się uruchomić aplikacji.';
const signedOut = { status: 'signedOut' } as const;
const signedIn = { status: 'signedIn', userId: SIGNED_IN_USER_ID } as const;
const SETUP = { username: 'kacper', interests: ['museums' as const], avatarUri: null };

/** The screens of the app that matter to the gate; the home tab and the wizard are plain texts. */
function routes(overrides: Record<string, () => React.JSX.Element | null> = {}) {
  return {
    _layout: RootLayout,
    '(auth)/_layout': AuthLayout,
    '(auth)/welcome': WelcomeScreen,
    '(auth)/email': EmailScreen,
    '(auth)/code': CodeScreen,
    onboarding: OnboardingScreen,
    '(drawer)/_layout': DrawerLayout,
    '(drawer)/(tabs)/_layout': TabsLayout,
    '(drawer)/(tabs)/index': () => <Text>home screen</Text>,
    'trips/new/index': () => <Text>new trip screen</Text>,
    'auth/callback': AuthCallback,
    ...overrides,
  };
}

async function open(initialUrl?: string, overrides?: Record<string, () => React.JSX.Element | null>) {
  const rendered = renderRouter(routes(overrides), initialUrl ? { initialUrl } : undefined);
  const { container } = await rendered;
  // renderRouter attaches getPathname to the returned promise, not to the awaited result.
  return { getPathname: () => rendered.getPathname(), container };
}

const shown = (text: string) => screen.queryByText(text) !== null;
const expectOnly = async (text: string) => {
  await waitFor(() => expect(screen.getByText(text)).toBeTruthy());
  for (const other of [WELCOME, ONBOARDING, 'home screen', 'new trip screen']) {
    if (other !== text) expect(shown(other)).toBe(false);
  }
};

async function visit(href: string) {
  await act(async () => router.push(href as never));
}

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  mockSignIn.mockReset();
  jest.mocked(SplashScreen.hideAsync).mockClear();
});

describe('signed out', () => {
  it('shows only the welcome screen, and the user data was cleared before it appeared', async () => {
    const session = useFakeAppSession(signedOut);
    await open();

    await expectOnly(WELCOME);
    expect(session.log).toContain('clear:done');
  });

  it.each(['/', '/trips/new', '/onboarding'])('%s is not reachable: navigating there leaves the welcome screen', async (href) => {
    useFakeAppSession(signedOut);
    await open();
    await expectOnly(WELCOME);

    await visit(href);

    await expectOnly(WELCOME);
  });

  it('a leftover anonymous session (the source drops it and reports signed out) shows the welcome screen too', async () => {
    const session = useFakeAppSession(signedOut);
    await open();
    await expectOnly(WELCOME);
    expect(session.clearUserData).toHaveBeenCalledTimes(1);
  });

  it('shows the English title on an English phone', async () => {
    await i18n.changeLanguage('en');
    useFakeAppSession(signedOut);
    await open();
    await waitFor(() => expect(screen.getByText('Welcome to Travelo')).toBeTruthy());
  });

  // splash-animation step 5: the native splash is hidden on mount; the animated splash covers the screen until the clear has finished.
  it('covers the screen with the animated splash, and shows no welcome screen, until the clear has finished', async () => {
    const session = useFakeAppSession(signedOut);
    const release = session.holdClear();
    allowGateToStayLoading();
    await open();
    await waitFor(() => expect(session.clearUserData).toHaveBeenCalled());
    expect(shown(WELCOME)).toBe(false);
    expect(screen.getByTestId('splash-overlay')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);

    await act(async () => release());
    await expectOnly(WELCOME);
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('a failed clear never shows the welcome screen: an error with a retry that then continues', async () => {
    const session = useFakeAppSession(signedOut);
    session.failClear(new Error('disk full'));
    await open();

    await waitFor(() => expect(screen.getByText(START_ERROR)).toBeTruthy());
    expect(shown(WELCOME)).toBe(false);

    session.failClear(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await expectOnly(WELCOME);
  });

  it('a sign-in while on the welcome screen goes to profile setup (no profile yet)', async () => {
    const session = useFakeAppSession(signedOut);
    setAppProfileRepository(createInMemoryProfileRepository());
    await open();
    await expectOnly(WELCOME);

    await act(async () => session.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID }));

    await expectOnly(ONBOARDING);
  });

  it('a sign-in while on the welcome screen goes straight to the app when the profile exists', async () => {
    const session = useFakeAppSession(signedOut);
    await open();
    await expectOnly(WELCOME);

    await act(async () => session.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID }));

    await expectOnly('home screen');
  });
});

describe('signing in from the welcome screen (auth-onboarding step 6)', () => {
  const openSheet = async () => fireEvent.press(screen.getByRole('button', { name: 'Zaloguj się' }));

  it('shows the real welcome screen: the sentence and the sign-in button', async () => {
    useFakeAppSession(signedOut);
    await open();
    await expectOnly(WELCOME);
    expect(screen.getByText('Zaplanuj wyjazd dla całej ekipy — loty, budżet i dni w jednym miejscu.')).toBeTruthy();
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
  });

  it.each([
    ['Google', 'google', 'Kontynuuj z Google'],
    ['Discord', 'discord', 'Kontynuuj z Discordem'],
  ] as const)('%s success (a SIGNED_IN from the session source) moves a new user on to profile setup', async (_name, provider, label) => {
    const session = useFakeAppSession(signedOut);
    setAppProfileRepository(createInMemoryProfileRepository());
    mockSignIn.mockImplementation(async () => {
      session.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID });
      return 'signed-in';
    });
    await open();
    await expectOnly(WELCOME);
    await openSheet();

    await fireEvent.press(await screen.findByRole('button', { name: label }));

    await expectOnly(ONBOARDING);
    expect(mockSignIn).toHaveBeenCalledWith(provider);
  });

  it('Google success moves a returning user (profile exists) straight to the app', async () => {
    const session = useFakeAppSession(signedOut);
    mockSignIn.mockImplementation(async () => {
      session.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID });
      return 'signed-in';
    });
    await open();
    await expectOnly(WELCOME);
    await openSheet();

    await fireEvent.press(await screen.findByRole('button', { name: 'Kontynuuj z Google' }));

    await expectOnly('home screen');
  });

  it('cancelling the browser stays on the welcome screen with the sheet open and no error', async () => {
    useFakeAppSession(signedOut);
    mockSignIn.mockResolvedValue('cancelled');
    await open();
    await openSheet();

    await fireEvent.press(await screen.findByRole('button', { name: 'Kontynuuj z Google' }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    await expectOnly(WELCOME);
    expect(screen.getByRole('button', { name: 'Kontynuuj z Google' })).toBeEnabled();
    expect(screen.queryByTestId('sign-in-error')).toBeNull();
  });

  it('the e-mail option opens the e-mail screen (still behind the gate: signed out)', async () => {
    useFakeAppSession(signedOut);
    const rendered = await open();
    await openSheet();

    await fireEvent.press(await screen.findByRole('button', { name: 'Kontynuuj z e-mailem' }));

    await waitFor(() => expect(screen.getByTestId('email-screen')).toBeTruthy());
    expect(rendered.getPathname()).toBe('/email');
    expect(screen.getByRole('header', { name: 'Twój e-mail' })).toBeTruthy();
  });

  it('the e-mail screen is not reachable when signed in', async () => {
    await open();
    await expectOnly('home screen');
    await visit('/email');
    await expectOnly('home screen');
  });
});

describe('signing in with an e-mail code (auth-onboarding step 7)', () => {
  const sendEmailCode = jest.mocked(appAuth.sendEmailCode);
  const verifyEmailCode = jest.mocked(appAuth.verifyEmailCode);

  beforeEach(() => {
    sendEmailCode.mockReset();
    sendEmailCode.mockResolvedValue(undefined);
    verifyEmailCode.mockReset();
    verifyEmailCode.mockResolvedValue(undefined);
  });

  /** welcome → the sheet → "Kontynuuj z e-mailem" → the address → the code screen. */
  async function reachCodeScreen(rendered: Awaited<ReturnType<typeof open>>) {
    await expectOnly(WELCOME);
    await fireEvent.press(screen.getByRole('button', { name: 'Zaloguj się' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Kontynuuj z e-mailem' }));
    await waitFor(() => expect(screen.getByTestId('email-screen')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Adres e-mail'), ' Kacper@Example.com ');
    await fireEvent.press(screen.getByRole('button', { name: 'Wyślij kod' }));
    await waitFor(() => expect(screen.getByTestId('code-screen')).toBeTruthy());
    expect(rendered.getPathname()).toBe('/code');
  }

  it('welcome → sheet → e-mail → code → SIGNED_IN moves a new user on to profile setup, with nothing of the e-mail flow left', async () => {
    const session = useFakeAppSession(signedOut);
    setAppProfileRepository(createInMemoryProfileRepository());
    verifyEmailCode.mockImplementation(async () => {
      session.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID });
    });
    const rendered = await open();
    await reachCodeScreen(rendered);
    expect(screen.getByText('Wysłaliśmy go na kacper@example.com.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Kod z e-maila'), '123456');

    await expectOnly(ONBOARDING);
    expect(verifyEmailCode).toHaveBeenCalledWith({ email: 'kacper@example.com', code: '123456' });
    expect(screen.queryByTestId('code-screen')).toBeNull();
    expect(screen.queryByTestId('email-screen')).toBeNull();
  });

  it('a returning user (profile exists) goes straight to the app', async () => {
    const session = useFakeAppSession(signedOut);
    verifyEmailCode.mockImplementation(async () => {
      session.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID });
    });
    const rendered = await open();
    await reachCodeScreen(rendered);

    await fireEvent.changeText(screen.getByLabelText('Kod z e-maila'), '123456');

    await expectOnly('home screen');
  });

  it('a wrong code keeps the user on the code screen, still signed out', async () => {
    useFakeAppSession(signedOut);
    verifyEmailCode.mockRejectedValue(new InvalidCodeError('expired'));
    const rendered = await open();
    await reachCodeScreen(rendered);

    await fireEvent.changeText(screen.getByLabelText('Kod z e-maila'), '123456');

    await waitFor(() => expect(screen.getByText('Kod jest nieprawidłowy albo wygasł.')).toBeTruthy());
    expect(rendered.getPathname()).toBe('/code');
    expect(shown('home screen')).toBe(false);
  });

  it('the code screen opened signed out without an address leaves for the e-mail screen', async () => {
    useFakeAppSession(signedOut);
    const rendered = await open('/code');
    await waitFor(() => expect(rendered.getPathname()).toBe('/email'));
    expect(screen.getByTestId('email-screen')).toBeTruthy();
  });

  it.each(['/email', '/code'])('%s is not reachable when signed in', async (href) => {
    await open();
    await expectOnly('home screen');
    await visit(href);
    await expectOnly('home screen');
  });

  it('the welcome screen is still the first one of the group, with the e-mail screens declared', async () => {
    useFakeAppSession(signedOut);
    const rendered = await open();
    await expectOnly(WELCOME);
    expect(rendered.getPathname()).toBe('/welcome');
    expect(screen.queryByTestId('email-screen')).toBeNull();
    expect(screen.queryByTestId('code-screen')).toBeNull();
  });

  it('the welcome screen has no header, the e-mail screens have one', async () => {
    useFakeAppSession(signedOut);
    const rendered = await open();
    await expectOnly(WELCOME);
    const headers = () => rendered.container.queryAll((node) => node.type === 'RNSScreenStackHeaderConfig' && !node.props.hidden);
    expect(headers()).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Zaloguj się' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Kontynuuj z e-mailem' }));
    await waitFor(() => expect(screen.getByTestId('email-screen')).toBeTruthy());
    expect(headers()).toHaveLength(1);
  });
});

describe('signed in without a profile', () => {
  beforeEach(() => {
    useFakeAppSession(signedIn);
    setAppProfileRepository(createInMemoryProfileRepository());
  });

  it('shows only profile setup', async () => {
    await open();
    await expectOnly(ONBOARDING);
  });

  it.each(['/', '/trips/new', '/welcome'])('%s is not reachable', async (href) => {
    await open();
    await expectOnly(ONBOARDING);

    await visit(href);

    await expectOnly(ONBOARDING);
  });

  it('saving the profile moves on to the app at /', async () => {
    function Setup() {
      const create = useCreateProfile();
      return (
        <Text onPress={() => create.mutate(SETUP)} testID="save">
          {ONBOARDING}
        </Text>
      );
    }
    const rendered = await open(undefined, { onboarding: Setup });
    await expectOnly(ONBOARDING);

    await fireEvent.press(screen.getByTestId('save'));

    await expectOnly('home screen');
    expect(rendered.getPathname()).toBe('/');
  });

  it('is signed in, so the data on the phone is not cleared', async () => {
    const session = useFakeAppSession(signedIn);
    await open();
    await expectOnly(ONBOARDING);
    expect(session.clearUserData).not.toHaveBeenCalled();
  });

  // auth-onboarding step 8: the real profile setup screen behind the gate.
  it('shows the real profile setup screen: the nick field, the interests and "Zapisz i zaczynamy"', async () => {
    await open();
    await expectOnly(ONBOARDING);
    expect(screen.getByTestId('profile-setup-screen')).toBeTruthy();
    expect(screen.getByLabelText('Nazwa użytkownika')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zapisz i zaczynamy' })).toBeTruthy();
  });

  it('saving the real profile setup form lands on the app at /, and the screen navigates nowhere by itself', async () => {
    const base = createInMemoryProfileRepository();
    const createProfile = jest.fn((input: Parameters<ProfileRepository['createProfile']>[0]) => base.createProfile(input));
    setAppProfileRepository({ ...base, myProfile: () => base.myProfile(), createProfile });
    const rendered = await open();
    await expectOnly(ONBOARDING);

    await fireEvent.changeText(screen.getByLabelText('Nazwa użytkownika'), 'Kacper');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Muzea' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Zapisz i zaczynamy' }));

    await expectOnly('home screen');
    expect(rendered.getPathname()).toBe('/');
    expect(createProfile).toHaveBeenCalledTimes(1);
    expect(createProfile).toHaveBeenCalledWith({ username: 'kacper', interests: ['museums'], avatarUri: null });
  });

  it('a form that is not valid stays on profile setup and does not save', async () => {
    const base = createInMemoryProfileRepository();
    const createProfile = jest.fn((input: Parameters<ProfileRepository['createProfile']>[0]) => base.createProfile(input));
    setAppProfileRepository({ ...base, myProfile: () => base.myProfile(), createProfile });
    await open();
    await expectOnly(ONBOARDING);

    await fireEvent.press(screen.getByRole('button', { name: 'Zapisz i zaczynamy' }));

    // The button waits for a complete form (theme-split-and-profile-prefill D4): the tap does nothing and no error is shown.
    expect(screen.getByRole('button', { name: 'Zapisz i zaczynamy' })).toBeDisabled();
    expect(screen.queryByText('Wpisz nick.')).toBeNull();
    await expectOnly(ONBOARDING);
    expect(createProfile).not.toHaveBeenCalled();
  });
});

describe('a profile save that finishes after the sign-out', () => {
  it("never shows the old user's profile to the next user: after the next sign-in the app waits for the next user's own profile", async () => {
    const session = useFakeAppSession(signedIn);
    const base = createInMemoryProfileRepository();
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    let secondUserRead: () => void = () => {};
    const secondUser = new Promise<void>((resolve) => (secondUserRead = resolve));
    let reads = 0;
    setAppProfileRepository({
      ...base,
      myProfile: async () => {
        if (reads++ === 0) return null; // the first user has no profile yet
        await secondUser; // the next user's profile is still being read
        return null;
      },
      createProfile: async (input) => {
        await held;
        return base.createProfile(input);
      },
    });
    function Setup() {
      const create = useCreateProfile();
      return (
        <Text onPress={() => create.mutate(SETUP)} testID="save">
          {ONBOARDING}
        </Text>
      );
    }
    await open(undefined, { onboarding: Setup });
    await expectOnly(ONBOARDING);
    await fireEvent.press(screen.getByTestId('save')); // the save is on its way

    await act(async () => session.emit({ type: 'signedOut' }));
    await expectOnly(WELCOME);
    await act(async () => release()); // the save of the first user finishes now, after the sign-out
    await act(async () => session.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID }));
    allowGateToStayLoading();

    // The next user's profile is not known yet: nothing of the first user's may show in its place.
    expect(shown('home screen')).toBe(false);
    await act(async () => secondUserRead());
    await expectOnly(ONBOARDING);
  });
});

describe('signed in with a profile', () => {
  it('shows the app at /', async () => {
    const rendered = await open();
    await expectOnly('home screen');
    expect(rendered.getPathname()).toBe('/');
  });

  it('the new trip screen is reachable', async () => {
    await open();
    await expectOnly('home screen');
    await visit('/trips/new');
    await waitFor(() => expect(screen.getByText('new trip screen')).toBeTruthy());
  });

  it.each(['/welcome', '/onboarding'])('%s is not reachable', async (href) => {
    await open();
    await expectOnly('home screen');

    await visit(href);

    await expectOnly('home screen');
  });

  it('opens offline on the home screen from the copy of the profile: no welcome, no profile setup, no error', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    useFakeAppSession({ status: 'signedIn', userId: null });
    const base = await repositoryWithProfile();
    setAppProfileRepository(
      withMyProfile(base, async () => {
        const mine = await base.myProfile();
        return mine && { ...mine, fromCache: true };
      }),
    );
    await open();
    await expectOnly('home screen');
  });

  it('covers the screen with the animated splash until the session and the profile are known', async () => {
    const session = useFakeAppSession(signedIn);
    const release = session.holdCurrent();
    allowGateToStayLoading();
    await open();
    expect(shown('home screen')).toBe(false);
    expect(screen.getByTestId('splash-overlay')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);

    await act(async () => release());
    await expectOnly('home screen');
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('a sign-out later clears the user data and leaves for the welcome screen', async () => {
    const session = useFakeAppSession(signedIn);
    await open();
    await expectOnly('home screen');

    await act(async () => session.emit({ type: 'signedOut' }));

    await expectOnly(WELCOME);
    expect(session.log).toContain('clear:done');
  });
});

// app-loading-skeleton step 4 (D2, A3, A4): after signing in the splash is already gone, so while the profile is read the
// gate draws the home skeleton with placeholders for the menu button and the pill, never a blank screen.
describe('the loading view while the profile is read', () => {
  const hidden = { includeHiddenElements: true };

  /** The profile read hangs until the test lets it answer. */
  function pendingProfile(answer: ProfileRepository['myProfile'] | null = null) {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    return async function setUp(base: ProfileRepository) {
      setAppProfileRepository(
        withMyProfile(base, async () => {
          await gate;
          if (answer) return answer();
          return base.myProfile();
        }),
      );
      return release;
    };
  }

  it('shows the home skeleton with the menu and pill placeholders, labelled and busy, and hides it from screen readers', async () => {
    useFakeAppSession(signedIn);
    await pendingProfile()(await repositoryWithProfile());
    allowGateToStayLoading();
    await open();

    const loading = screen.getByTestId('app-loading');
    expect(loading.props.accessibilityLabel).toBe('Wczytywanie');
    expect(loading.props.accessibilityState).toEqual({ busy: true });
    expect(screen.getByTestId('home-skeleton', hidden)).toBeTruthy();
    expect(screen.getByTestId('trip-hero-skeleton', hidden)).toBeTruthy();
    for (const name of ['flights', 'travellers', 'budget']) expect(screen.getByTestId(`home-skeleton-${name}`, hidden)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('app-loading-menu', hidden).props.style)).toMatchObject({ width: 44, height: 44 });
    expect(screen.getByTestId('app-loading-pill', hidden)).toBeTruthy();
    for (const id of ['home-skeleton', 'trip-hero-skeleton', 'app-loading-menu', 'app-loading-pill']) {
      expect(isHiddenFromAccessibility(screen.getByTestId(id, hidden))).toBe(true);
    }
    // splash-animation: the native splash is hidden on mount; the skeleton is rendered under the animated splash.
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('splash-overlay')).toBeTruthy();
  });

  it('is labelled "Loading" on an English phone', async () => {
    await i18n.changeLanguage('en');
    useFakeAppSession(signedIn);
    await pendingProfile()(await repositoryWithProfile());
    allowGateToStayLoading();
    await open();
    expect(screen.getByTestId('app-loading').props.accessibilityLabel).toBe('Loading');
  });

  it('hands over to the app when the account has a profile: the skeleton is gone', async () => {
    useFakeAppSession(signedIn);
    const release = await pendingProfile()(await repositoryWithProfile());
    allowGateToStayLoading();
    await open();
    expect(screen.getByTestId('home-skeleton', hidden)).toBeTruthy();

    await act(async () => release());

    await expectOnly('home screen');
    expect(screen.queryByTestId('app-loading')).toBeNull();
    expect(screen.queryByTestId('home-skeleton', hidden)).toBeNull();
  });

  it('shows the home skeleton for a new account too, then profile setup (D2)', async () => {
    useFakeAppSession(signedIn);
    const release = await pendingProfile()(createInMemoryProfileRepository());
    allowGateToStayLoading();
    await open();
    expect(screen.getByTestId('home-skeleton', hidden)).toBeTruthy();

    await act(async () => release());

    await expectOnly(ONBOARDING);
    expect(screen.queryByTestId('app-loading')).toBeNull();
  });

  it('hands over to the error screen when the profile cannot be read', async () => {
    useFakeAppSession(signedIn);
    const release = await pendingProfile(async () => {
      throw new ServerUnreachableError('offline');
    })(await repositoryWithProfile());
    allowGateToStayLoading();
    await open();
    expect(screen.getByTestId('home-skeleton', hidden)).toBeTruthy();

    await act(async () => release());

    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeTruthy());
    expect(screen.queryByTestId('app-loading')).toBeNull();
    expect(screen.queryByTestId('home-skeleton', hidden)).toBeNull();
  });
});

describe('errors', () => {
  async function failingProfile(error: Error, then?: ProfileRepository) {
    const base = then ?? (await repositoryWithProfile());
    const myProfile = jest.fn<ReturnType<ProfileRepository['myProfile']>, []>().mockRejectedValueOnce(error).mockImplementation(() => base.myProfile());
    setAppProfileRepository(withMyProfile(base, myProfile));
    return myProfile;
  }

  it('a profile that cannot be read (no copy offline) is an error screen with a retry, never profile setup; the retry reaches the app', async () => {
    const myProfile = await failingProfile(new ServerUnreachableError('offline'));
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await open();

    await waitFor(() => expect(screen.getByText(PROFILE_ERROR)).toBeTruthy());
    expect(shown(ONBOARDING)).toBe(false);
    expect(shown('home screen')).toBe(false);
    expect(announce).toHaveBeenCalledWith(PROFILE_ERROR);
    expect(SplashScreen.hideAsync).toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await expectOnly('home screen');
    expect(myProfile).toHaveBeenCalledTimes(2);
    announce.mockRestore();
  });

  it('another error while online is the same error screen, not profile setup', async () => {
    await failingProfile(new Error('boom'));
    await open();
    await waitFor(() => expect(screen.getByText(PROFILE_ERROR)).toBeTruthy());
    expect(shown(ONBOARDING)).toBe(false);
  });

  it('when the user was unknown (offline start), the retry reads the session again first', async () => {
    const session = useFakeAppSession({ status: 'signedIn', userId: null });
    await failingProfile(new ServerUnreachableError('offline'));
    await open();
    await waitFor(() => expect(screen.getByText(PROFILE_ERROR)).toBeTruthy());
    expect(session.current).toHaveBeenCalledTimes(1);

    session.answerWith(signedIn);
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    await expectOnly('home screen');
    expect(session.current).toHaveBeenCalledTimes(2);
  });

  it('a session that cannot be read is an error with its own message and a retry', async () => {
    const session = useFakeAppSession(new Error('storage broken'));
    await open();

    await waitFor(() => expect(screen.getByText(START_ERROR)).toBeTruthy());
    expect(shown(WELCOME)).toBe(false);
    expect(shown('home screen')).toBe(false);

    session.answerWith(signedIn);
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await expectOnly('home screen');
  });

  it('speaks English on an English phone', async () => {
    await i18n.changeLanguage('en');
    await failingProfile(new Error('boom'));
    await open();
    await waitFor(() => expect(screen.getByText("Couldn't load your profile.")).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('auth/callback is reachable in every state and only leads on', () => {
  it('signed out → welcome', async () => {
    useFakeAppSession(signedOut);
    const rendered = await open('/auth/callback?code=x');
    await expectOnly(WELCOME);
    expect(rendered.getPathname()).toBe('/welcome');
    expect(screen.queryByText(/unmatched/i)).toBeNull();
  });

  it('signed in without a profile → profile setup', async () => {
    setAppProfileRepository(createInMemoryProfileRepository());
    const rendered = await open('/auth/callback?code=x');
    await expectOnly(ONBOARDING);
    expect(rendered.getPathname()).toBe('/onboarding');
    expect(screen.queryByText(/unmatched/i)).toBeNull();
  });

  it('signed in with a profile → home', async () => {
    const rendered = await open('/auth/callback?code=x');
    await expectOnly('home screen');
    expect(rendered.getPathname()).toBe('/');
    expect(screen.queryByText(/unmatched/i)).toBeNull();
  });
});
