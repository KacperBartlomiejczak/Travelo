import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { act, fireEvent, isHiddenFromAccessibility, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import ProfileScreen from '@/app/(drawer)/(tabs)/profile';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import { AIRPORTS } from '@/data/airports';
import { createInMemoryProfileRepository, type MyProfile } from '@/data/profile-repository';
import { useMyProfile } from '@/hooks/useProfile';
import i18n from '@/i18n';
import { travelStats } from '@/lib/travel-stats';
import type { TripListItem } from '@/schemas';
import { setAppProfileRepository, withMyProfile } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';
import { darkTheme, lightTheme } from '@/theme/legacy/theme';
import { colors } from '@/theme/tokens';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
// Sunline's press scale also calls withTiming; the pulse tests below must count only the skeleton's calls.
jest.mock('@/components/usePressScale', () => ({ usePressScale: () => ({ style: {}, onPressIn: () => undefined, onPressOut: () => undefined }) }));

let mockScheme: 'light' | 'dark' = 'light';
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 812, scale: 2, fontScale: mockFontScale }),
}));

// The trips the repository answers with; a test replaces `mockList` to hold, fail or empty the read.
let mockList: () => Promise<TripListItem[]> = async () => [];
jest.mock('@/data/app-trip-repository', () => ({
  createAppTripRepository: () => ({
    ...jest.requireActual('@/data/trip-repository').createInMemoryTripRepository(),
    list: () => mockList(),
  }),
}));

const id = (n: number) => `00000000-0000-4000-8000-0000000000b${n}`;
const trip = (n: number, destination: string, startDate: string, endDate: string, flights: [string, string][]): TripListItem => ({
  id: id(n),
  name: `Trip ${n}`,
  coverImageUri: 'preset:auckland',
  destination,
  flights: flights.map(([fromIata, toIata]) => ({ fromIata, toIata })),
  startDate,
  endDate,
});

// Three past trips in two countries (USA, Portugal): 5 + 3 + 2 days, 5 flights. One trip far in the future does not count.
const NEW_YORK = trip(1, 'JFK', '2024-05-01', '2024-05-05', [['WAW', 'JFK'], ['JFK', 'WAW']]);
const LISBON = trip(2, 'LIS', '2024-06-10', '2024-06-12', [['WAW', 'FRA'], ['FRA', 'LIS']]);
const LISBON_AGAIN = trip(3, 'LIS', '2023-01-01', '2023-01-02', [['WAW', 'LIS']]);
const FUTURE = trip(4, 'BCN', '2099-01-01', '2099-01-10', [['WAW', 'BCN']]);
const TRIPS = [NEW_YORK, LISBON, LISBON_AGAIN, FUTURE];

function SettingsStub() {
  useMyProfile();
  return <Text>settings</Text>;
}

const ROUTES = {
  _layout: RootLayout,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/(tabs)/_layout': TabsLayout,
  '(drawer)/(tabs)/index': () => <Text>home</Text>,
  '(drawer)/(tabs)/expenses': () => <Text>expenses</Text>,
  '(drawer)/(tabs)/places': () => <Text>places</Text>,
  '(drawer)/(tabs)/plan': () => <Text>plan</Text>,
  '(drawer)/(tabs)/profile': ProfileScreen,
  // Opening it mounts one more reader of the profile, which reads it again without the phone going offline and online.
  settings: SettingsStub,
};

// renderRouter attaches getPathname to the promise it returns, so the helper hands the promise on. By default it also
// waits until the profile and the trips have arrived, so no state update lands after the test; `settle: false` is for
// the tests that look at the screen while the trips are still loading.
function renderProfile({ settle = true }: { settle?: boolean } = {}) {
  const rendered = renderRouter(ROUTES, { initialUrl: '/profile' });
  const done = rendered.then(async () => {
    if (!settle) return;
    await screen.findByText('kacper');
    await waitFor(() => expect(screen.queryAllByTestId('stat-skeleton', { includeHiddenElements: true })).toHaveLength(0));
  });
  return Object.assign(done, { getPathname: () => rendered.getPathname() });
}

const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);
const fmt = (value: number, language: string) => new Intl.NumberFormat(language).format(value);

async function profileWithPhoto() {
  const base = createInMemoryProfileRepository({ newId: () => '00000000-0000-4000-8000-0000000000aa' });
  await base.createProfile({ username: 'kacper', interests: ['museums'], avatarUri: 'file:///avatar.jpg' });
  return base;
}

// What stands in the photo's place: the skeleton while the photo is not shown yet (D20), the person placeholder when
// the profile has no photo (A3).
const photoSkeleton = () => screen.queryByTestId('profile-photo-skeleton', { includeHiddenElements: true });
// expo-image decorates the event it is given, so each `fireEvent` gets a fresh one.
const loadEvent = () => ({ nativeEvent: { source: { url: 'https://avatars.invalid/a.jpg', width: 96, height: 96 } } });
const errorEvent = () => ({ nativeEvent: { error: 'cannot load' } });

// The Reanimated test mock (jest.setup.ts) turns every animation into a plain number; these spies record how a pulse was
// built. The mock is already loaded when this file starts, so a `jest.mock` of its own would not replace it.
let withRepeatSpy: jest.SpyInstance;
let withTimingSpy: jest.SpyInstance;
let useAnimatedStyleSpy: jest.SpyInstance;

beforeEach(async () => {
  withRepeatSpy = jest.spyOn(Reanimated, 'withRepeat').mockClear();
  withTimingSpy = jest.spyOn(Reanimated, 'withTiming').mockClear();
  useAnimatedStyleSpy = jest.spyOn(Reanimated, 'useAnimatedStyle').mockClear();
  mockScheme = 'light';
  mockFontScale = 1;
  mockList = async () => TRIPS;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await i18n.changeLanguage('pl');
});

describe('Profile screen — header (profile-screen D6, D10)', () => {
  it('shows "Profil" as the screen title and none of the old placeholder', async () => {
    await renderProfile();
    expect(screen.getByRole('header', { name: 'Profil' })).toBeTruthy();
    expect(screen.queryByText('Ten ekran pojawi się wkrótce.')).toBeNull();
    expect(screen.queryByText('Profil użytkownika')).toBeNull();
  });

  it('shows "Profile" in English', async () => {
    await i18n.changeLanguage('en');
    await renderProfile();
    expect(screen.getByRole('header', { name: 'Profile' })).toBeTruthy();
    expect(screen.queryByText('User profile')).toBeNull();
  });

  it('puts the title on the left and the gear on the right', async () => {
    await renderProfile();
    const header = screen.getByTestId('profile-header');
    expect(style(header)).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' });
    // Both are direct children of the header row, the title first and the gear after it.
    const title = within(header).getByRole('header', { name: 'Profil' });
    const gear = within(header).getByRole('button', { name: 'Ustawienia' });
    expect(header.children).toHaveLength(2);
    expect(header.children[0]).toBe(title);
    expect(header.children[1]).toBe(gear);
  });

  it('has a gear button labelled "Ustawienia", at least 44dp, that opens /settings', async () => {
    const rendered = renderProfile();
    await rendered;
    const gear = screen.getByRole('button', { name: 'Ustawienia' });
    expect(gear).toHaveStyle({ width: lightTheme.size.touchTarget, height: lightTheme.size.touchTarget });
    await fireEvent.press(gear);
    await waitFor(() => expect(rendered.getPathname()).toBe('/settings'));
  });

  it('labels the gear "Settings" in English', async () => {
    await i18n.changeLanguage('en');
    await renderProfile();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });
});

describe('Profile screen — photo and nick (A3)', () => {
  it('shows the nick', async () => {
    await renderProfile();
    expect(await screen.findByText('kacper')).toBeTruthy();
  });

  it('shows the photo, round and 96dp, when the profile has one', async () => {
    setAppProfileRepository(await profileWithPhoto());
    await renderProfile();
    const photo = await screen.findByTestId('profile-photo', { includeHiddenElements: true });
    expect(photo.props.source).toEqual([{ uri: expect.stringMatching(/^https:\/\/avatars\.invalid\//) }]);
    expect(style(photo)).toMatchObject({
      width: lightTheme.size.avatarSetup,
      height: lightTheme.size.avatarSetup,
      borderRadius: lightTheme.radius.full,
    });
    expect(screen.queryByTestId('profile-photo-placeholder', { includeHiddenElements: true })).toBeNull();
  });

  it('shows the placeholder, same size and shape, when there is no photo', async () => {
    await renderProfile();
    await screen.findByText('kacper');
    const placeholder = screen.getByTestId('profile-photo-placeholder', { includeHiddenElements: true });
    expect(style(placeholder)).toMatchObject({
      width: lightTheme.size.avatarSetup,
      height: lightTheme.size.avatarSetup,
      borderRadius: lightTheme.radius.full,
    });
    expect(screen.queryByTestId('profile-photo', { includeHiddenElements: true })).toBeNull();
  });

  it('falls back to the skeleton, not the placeholder, when the photo cannot load (D20)', async () => {
    setAppProfileRepository(await profileWithPhoto());
    await renderProfile();
    const photo = await screen.findByTestId('profile-photo', { includeHiddenElements: true });
    await fireEvent(photo, 'error', { nativeEvent: { error: 'cannot load' } });
    expect(photoSkeleton()).toBeTruthy();
    expect(screen.queryByTestId('profile-photo-placeholder', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('profile-photo', { includeHiddenElements: true })).toBeNull();
  });

  describe('retries a failed photo when the phone comes back online (D18)', () => {
    const photo = () => screen.queryByTestId('profile-photo', { includeHiddenElements: true });
    const placeholder = () => screen.queryByTestId('profile-photo-placeholder', { includeHiddenElements: true });
    const skeleton = photoSkeleton;
    const failPhoto = async () => {
      const shown = await screen.findByTestId('profile-photo', { includeHiddenElements: true });
      await fireEvent(shown, 'error', { nativeEvent: { error: 'cannot load' } });
      return shown.props.source;
    };
    const go = (online: boolean) => act(async () => setNetwork({ isConnected: online, isInternetReachable: online }));

    // Guard (passes before the change): the starting point of the others, a photo that failed offline is the skeleton.
    it('a photo that failed while offline is the skeleton', async () => {
      setAppProfileRepository(await profileWithPhoto());
      await go(false);
      await renderProfile();
      await failPhoto();
      expect(skeleton()).toBeTruthy();
      expect(placeholder()).toBeNull();
      expect(photo()).toBeNull();
    });

    it('going online shows the Image again, with the same uri', async () => {
      setAppProfileRepository(await profileWithPhoto());
      await go(false);
      await renderProfile();
      const source = await failPhoto();
      expect(photo()).toBeNull();

      await go(true);
      expect(photo()).toBeTruthy();
      expect(photo()?.props.source).toEqual(source);
      expect(placeholder()).toBeNull();
    });

    // Guard (passes before the change): the retry waits for the connection, it does not happen on its own.
    it('staying offline keeps the skeleton', async () => {
      setAppProfileRepository(await profileWithPhoto());
      await go(false);
      await renderProfile();
      await failPhoto();
      // A report of the same offline state again (e.g. the connection type changes) is not a reconnect.
      await go(false);
      expect(skeleton()).toBeTruthy();
      expect(photo()).toBeNull();
    });

    it('a photo that fails again while online stays the skeleton: no retry loop, until the next offline to online', async () => {
      setAppProfileRepository(await profileWithPhoto());
      await go(false);
      await renderProfile();
      await failPhoto();

      await go(true);
      expect(photo()).toBeTruthy();
      await failPhoto();
      expect(skeleton()).toBeTruthy();
      expect(photo()).toBeNull();

      // Another report of "online" is not a transition: still the skeleton.
      await go(true);
      expect(skeleton()).toBeTruthy();
      expect(photo()).toBeNull();

      // The next real reconnect tries again.
      await go(false);
      expect(skeleton()).toBeTruthy();
      await go(true);
      expect(photo()).toBeTruthy();
    });
  });

  // After an offline start the profile comes from the copy on the phone, which has no signed photo url (D18, step 6d).
  // The Profile screen's own observer may read the profile once more when it mounts (the data is already stale), so the
  // tests count the reads after the screen settled and compare against that.
  describe('fetches the profile again when the phone comes back online after an offline start (D18)', () => {
    const photo = () => screen.queryByTestId('profile-photo', { includeHiddenElements: true });
    const placeholder = () => screen.queryByTestId('profile-photo-placeholder', { includeHiddenElements: true });
    const skeleton = photoSkeleton;
    const go = (online: boolean) => act(async () => setNetwork({ isConnected: online, isInternetReachable: online }));
    // TanStack hands its updates to React on a timer (setTimeout 0, faked here): this runs what is pending, so a read
    // that has been attempted has also reached the screen, and a read that is still to come would have started by now.
    const flushTimers = () =>
      act(async () => {
        jest.runOnlyPendingTimers();
      });

    // Offline `myProfile` answers with the copy (no photo url); online it answers with `onlineRead`.
    async function startOffline(onlineRead: (fresh: MyProfile) => Promise<MyProfile> = async (fresh) => fresh) {
      const base = await profileWithPhoto();
      const fresh = await base.myProfile();
      if (!fresh) throw new Error('the profile should exist');
      const { avatarUrl, ...copy } = fresh.profile;
      expect(avatarUrl).toBeTruthy();
      let online = false;
      const myProfile = jest.fn<Promise<MyProfile | null>, []>(async () => (online ? onlineRead(fresh) : { profile: copy, fromCache: true }));
      setAppProfileRepository(withMyProfile(base, myProfile));
      await go(false);
      await renderProfile();
      await act(async () => {});
      const readsAtStart = myProfile.mock.calls.length;
      return {
        freshUrl: avatarUrl,
        reads: () => myProfile.mock.calls.length - readsAtStart,
        reconnect: () => {
          online = true;
          return go(true);
        },
        disconnect: () => {
          online = false;
          return go(false);
        },
      };
    }

    it('an offline start with a copy without a photo url shows the skeleton', async () => {
      await startOffline();
      expect(skeleton()).toBeTruthy();
      expect(placeholder()).toBeNull();
      expect(photo()).toBeNull();
    });

    it('going online reads the profile again and shows the photo with the new url', async () => {
      const { reads, reconnect, freshUrl } = await startOffline();

      await reconnect();
      await waitFor(() => expect(photo()).toBeTruthy());
      await flushTimers();
      expect(reads()).toBe(1);
      expect(photo()?.props.source).toEqual([{ uri: freshUrl }]);
      expect(placeholder()).toBeNull();
    });

    it('a read that fails keeps the skeleton, the nick and the numbers, and the gate shows no error screen', async () => {
      const { reads, reconnect } = await startOffline(async () => {
        throw new Error('server error');
      });

      await reconnect();
      await waitFor(() => expect(reads()).toBe(1));
      // The failed read has been attempted; let its error reach the query and the screen before looking.
      await flushTimers();
      await flushTimers();
      expect(reads()).toBe(1);
      expect(screen.queryByTestId('profile-error')).toBeNull();
      expect(screen.queryByTestId('app-loading')).toBeNull();
      expect(screen.getByTestId('profile-screen')).toBeTruthy();
      expect(screen.getByText('kacper')).toBeTruthy();
      expect(screen.getByLabelText('3 Podróże')).toBeTruthy();
      expect(skeleton()).toBeTruthy();
      expect(placeholder()).toBeNull();
      expect(photo()).toBeNull();
    });

    it('staying offline, or the same offline state reported again, does not read the profile again', async () => {
      const { reads, disconnect } = await startOffline();

      await disconnect();
      await disconnect();
      await flushTimers();
      expect(reads()).toBe(0);
      expect(skeleton()).toBeTruthy();
    });

    it('is one read per reconnect: online again is not a transition, the next reconnect reads again', async () => {
      const { reads, reconnect, disconnect } = await startOffline();

      await reconnect();
      await waitFor(() => expect(photo()).toBeTruthy());
      await flushTimers();
      expect(reads()).toBe(1);
      await reconnect();
      await flushTimers();
      expect(reads()).toBe(1);

      await disconnect();
      await flushTimers();
      expect(reads()).toBe(1);
      await reconnect();
      await waitFor(() => expect(reads()).toBe(2));
      await flushTimers();
      expect(reads()).toBe(2);
    });
  });

  // D20: with a photo (`avatarId` set) that is not shown yet, the photo's place is a pulsing skeleton, never the person.
  describe('shows a skeleton while the photo is not shown yet (D20)', () => {
    const photo = () => screen.queryByTestId('profile-photo', { includeHiddenElements: true });
    const placeholder = () => screen.queryByTestId('profile-photo-placeholder', { includeHiddenElements: true });
    const go = (online: boolean) => act(async () => setNetwork({ isConnected: online, isInternetReachable: online }));
    const findPhoto = () => screen.findByTestId('profile-photo', { includeHiddenElements: true });
    const theSkeleton = () => {
      const found = photoSkeleton();
      if (!found) throw new Error('the photo skeleton should be on the screen');
      return found;
    };

    it('a profile with a photo but no signed url (an offline start) shows the skeleton, 96dp round, and no placeholder', async () => {
      const base = await profileWithPhoto();
      setAppProfileRepository(
        withMyProfile(base, async () => {
          const mine = await base.myProfile();
          if (!mine) return null;
          const { avatarUrl, ...copy } = mine.profile;
          expect(avatarUrl).toBeTruthy();
          return { profile: copy, fromCache: true };
        }),
      );
      await go(false);
      await renderProfile();
      expect(style(theSkeleton())).toMatchObject({
        width: lightTheme.size.avatarSetup,
        height: lightTheme.size.avatarSetup,
        borderRadius: lightTheme.radius.full,
      });
      expect(placeholder()).toBeNull();
      expect(photo()).toBeNull();
    });

    it('with a url, the skeleton shows until the Image has loaded, then only the photo remains', async () => {
      setAppProfileRepository(await profileWithPhoto());
      await renderProfile();
      const shown = await findPhoto();
      expect(photoSkeleton()).toBeTruthy();
      expect(placeholder()).toBeNull();

      await fireEvent(shown, 'load', loadEvent());
      expect(photoSkeleton()).toBeNull();
      expect(placeholder()).toBeNull();
      expect(photo()).toBeTruthy();
    });

    it('the skeleton and the photo fill the same 96dp circle, so nothing jumps when the photo loads', async () => {
      setAppProfileRepository(await profileWithPhoto());
      await renderProfile();
      const shown = await findPhoto();
      const circle = { width: lightTheme.size.avatarSetup, height: lightTheme.size.avatarSetup, borderRadius: lightTheme.radius.full };
      expect(style(shown)).toMatchObject(circle);
      expect(style(theSkeleton())).toMatchObject(circle);
      // Both sit in one 96dp box, so the row (and the nick next to it) has the same size before and after the load.
      const box = shown.parent;
      if (!box) throw new Error('the photo should have a parent');
      expect(style(box)).toMatchObject({ width: circle.width, height: circle.height });
      expect(within(box).getByTestId('profile-photo-skeleton', { includeHiddenElements: true })).toBeTruthy();
    });

    // The skeleton pulses over the Image; a backdrop of the skeleton's own colour behind it would hide the pulse (6h).
    it.each([
      ['light', lightTheme],
      ['dark', darkTheme],
    ] as const)('%s: the Image under the skeleton has no backdrop, so the skeleton pulses on the page', async (scheme, theme) => {
      mockScheme = scheme;
      setAppProfileRepository(await profileWithPhoto());
      await renderProfile();
      const shown = await findPhoto();
      expect(photoSkeleton()).toBeTruthy();
      expect(style(shown).backgroundColor).toBeUndefined();
      expect(style(theSkeleton()).backgroundColor).toBe(colors[scheme].skeleton.base);
    });

    it('a photo that cannot load is the skeleton, not the placeholder', async () => {
      setAppProfileRepository(await profileWithPhoto());
      await renderProfile();
      await fireEvent(await findPhoto(), 'error', errorEvent());
      expect(photoSkeleton()).toBeTruthy();
      expect(placeholder()).toBeNull();
      expect(photo()).toBeNull();
    });

    it('a profile without a photo keeps the person placeholder and no skeleton', async () => {
      await renderProfile();
      expect(placeholder()).toBeTruthy();
      expect(photoSkeleton()).toBeNull();
      expect(photo()).toBeNull();
    });

    it('is hidden from screen readers, and the loaded photo too', async () => {
      setAppProfileRepository(await profileWithPhoto());
      await renderProfile();
      const shown = await findPhoto();
      expect(isHiddenFromAccessibility(theSkeleton())).toBe(true);
      await fireEvent(shown, 'load', loadEvent());
      expect(isHiddenFromAccessibility(shown)).toBe(true);
    });

    // Every profile read signs a new url for the same file, and the screen reads again on every reconnect (D18, 6d). The
    // photo is identified by `avatarId`, not by the url, so a photo that is already shown does not turn back into the skeleton.
    // Every read answers with a new token on the url; `change` can also give the read another `avatarId` (or none).
    // `withUrl` false makes a read answer without a url (the phone's copy, or signing failed).
    async function signedAgainOnEveryRead(
      change: (profile: MyProfile['profile']) => MyProfile['profile'] = (profile) => profile,
      withUrl: () => boolean = () => true,
    ) {
      const base = await profileWithPhoto();
      const first = await base.myProfile();
      if (!first) throw new Error('the profile should exist');
      let read = 0;
      setAppProfileRepository(
        withMyProfile(base, async () => {
          read += 1;
          const profile = change(first.profile);
          const { avatarUrl: _avatarUrl, ...copy } = profile;
          const signed = profile.avatarId !== null && withUrl();
          return { profile: signed ? { ...copy, avatarUrl: `${first.profile.avatarUrl}?token=${read}` } : copy, fromCache: !signed };
        }),
      );
      return { reads: () => read };
    }
    const urlOfPhoto = () => (photo()?.props.source as { uri: string }[] | undefined)?.[0]?.uri;
    const afterFade = () =>
      act(async () => {
        jest.advanceTimersByTime(lightTheme.duration.small);
      });
    // Shows the photo (loaded, fade over), runs `beforeReconnect`, goes offline and online again, and waits for the new url.
    async function showPhotoThenReconnect(beforeReconnect: () => void = () => {}) {
      await renderProfile();
      const shown = await findPhoto();
      await fireEvent(shown, 'load', loadEvent());
      await afterFade();
      expect(photoSkeleton()).toBeNull();
      const before = urlOfPhoto();
      beforeReconnect();
      await go(false);
      await go(true);
      await waitFor(() => expect(urlOfPhoto()).not.toBe(before));
      await act(async () => {});
    }

    describe('a photo that is already shown (the url is signed again on every read)', () => {
      it('a re-signed url for a photo already shown does not bring the skeleton back', async () => {
        await signedAgainOnEveryRead();
        await showPhotoThenReconnect();
        expect(photoSkeleton()).toBeNull();
        expect(photo()).toBeTruthy();
        expect(placeholder()).toBeNull();
      });

      it('a different photo (another avatarId) shows the skeleton until it has loaded', async () => {
        let newPhoto = false;
        await signedAgainOnEveryRead((profile) => (newPhoto ? { ...profile, avatarId: '00000000-0000-4000-8000-0000000000bb' } : profile));
        await showPhotoThenReconnect(() => {
          newPhoto = true;
        });
        expect(photoSkeleton()).toBeTruthy();
        await fireEvent(photo() as NonNullable<ReturnType<typeof photo>>, 'load', loadEvent());
        await afterFade();
        expect(photoSkeleton()).toBeNull();
        expect(photo()).toBeTruthy();
      });

      it('the same photo after a spell without one (avatarId null and back) is not "loaded": the skeleton shows until it loads', async () => {
        let noPhoto = false;
        await signedAgainOnEveryRead((profile) => (noPhoto ? { ...profile, avatarId: null } : profile));
        await renderProfile();
        await fireEvent(await findPhoto(), 'load', loadEvent());
        await afterFade();
        expect(photoSkeleton()).toBeNull();

        noPhoto = true;
        await go(false);
        await go(true);
        await waitFor(() => expect(placeholder()).toBeTruthy());
        expect(photoSkeleton()).toBeNull();

        noPhoto = false;
        await go(false);
        await go(true);
        await waitFor(() => expect(photo()).toBeTruthy());
        expect(photoSkeleton()).toBeTruthy();
        await fireEvent(photo() as NonNullable<ReturnType<typeof photo>>, 'load', loadEvent());
        await afterFade();
        expect(photoSkeleton()).toBeNull();
      });

      // D21: expo-image keeps the pixels it has when a new source fails (Android: Glide's `onLoadFailed` is a no-op in
      // ImageViewWrapperTarget.kt; iOS: `imageLoadCompleted` only fires `onError`, the image is cleared only by `recyclingKey`).
      it('a re-signed url that fails to load keeps the photo that is shown, and the next offline to online tries again (D21)', async () => {
        await signedAgainOnEveryRead();
        await showPhotoThenReconnect();
        const failedUrl = urlOfPhoto();
        await fireEvent(photo() as NonNullable<ReturnType<typeof photo>>, 'error', errorEvent());
        await act(async () => {});
        expect(photo()).toBeTruthy();
        expect(photoSkeleton()).toBeNull();
        expect(placeholder()).toBeNull();

        await go(false);
        await go(true);
        await waitFor(() => expect(urlOfPhoto()).not.toBe(failedUrl));
        expect(photo()).toBeTruthy();
        expect(photoSkeleton()).toBeNull();
      });

      it('a photo that was never shown and fails is still the skeleton (D20)', async () => {
        await signedAgainOnEveryRead();
        await renderProfile();
        await fireEvent(await findPhoto(), 'error', errorEvent());
        expect(photoSkeleton()).toBeTruthy();
        expect(photo()).toBeNull();
        expect(placeholder()).toBeNull();
      });

      // A url that failed is remembered until the next offline to online change (6c). A read that comes in some other way
      // (here: another screen starts reading the profile) must not let that memory cover a photo that is shown.
      it('a url that failed before comes back while another photo is shown: the shown photo stays', async () => {
        let version = 'x';
        let reads = 0;
        const base = await profileWithPhoto();
        const first = await base.myProfile();
        if (!first) throw new Error('the profile should exist');
        setAppProfileRepository(
          withMyProfile(base, async () => {
            reads += 1;
            return { profile: { ...first.profile, avatarUrl: `${first.profile.avatarUrl}?v=${version}` }, fromCache: false };
          }),
        );
        const rendered = renderProfile();
        await rendered;
        const gear = () => screen.getByRole('button', { name: 'Ustawienia' });
        const readOnceMore = async (next: string) => {
          version = next;
          const before = reads;
          await fireEvent.press(gear());
          await waitFor(() => expect(rendered.getPathname()).toBe('/settings'));
          await waitFor(() => expect(reads).toBeGreaterThan(before));
          // TanStack hands the answer to the screen on a timer (0 ms).
          await act(async () => {
            jest.advanceTimersByTime(1);
          });
          await act(async () => {
            router.back();
          });
          await waitFor(() => expect(rendered.getPathname()).toBe('/profile'));
        };

        // x fails: the skeleton, and x is remembered as failed.
        await fireEvent(await findPhoto(), 'error', errorEvent());
        expect(photoSkeleton()).toBeTruthy();
        // y is read and loads: the photo is shown.
        await readOnceMore('y');
        expect(urlOfPhoto()).toMatch(/v=y$/);
        await fireEvent(photo() as NonNullable<ReturnType<typeof photo>>, 'load', loadEvent());
        expect(photoSkeleton()).toBeNull();
        // x is read again: it is not "failed" any more, the photo stays.
        await readOnceMore('x');
        expect(photoSkeleton()).toBeNull();
        expect(urlOfPhoto()).toMatch(/v=x$/);
      });

      // D23: a read without a url (the phone's copy, signing failed) does not take a shown photo away.
      describe('a read without a url (D23)', () => {
        let urlAvailable = true;
        beforeEach(() => {
          urlAvailable = true;
        });
        const reconnectRead = async (reads: () => number) => {
          const before = reads();
          await go(false);
          await go(true);
          await waitFor(() => expect(reads()).toBeGreaterThan(before));
          // TanStack hands the answer to the screen on a timer (0 ms).
          await act(async () => {
            jest.advanceTimersByTime(1);
          });
        };

        it('keeps the photo with the last url: no skeleton, no placeholder; then the next url reaches the Image and the photo never leaves', async () => {
          const { reads } = await signedAgainOnEveryRead((profile) => profile, () => urlAvailable);
          await showPhotoThenReconnect();
          // The re-signed url loads: it is the last one that was shown.
          await fireEvent(photo() as NonNullable<ReturnType<typeof photo>>, 'load', loadEvent());
          const lastUrl = urlOfPhoto();

          urlAvailable = false;
          await reconnectRead(reads);
          expect(photo()).toBeTruthy();
          expect(urlOfPhoto()).toBe(lastUrl);
          expect(photoSkeleton()).toBeNull();
          expect(placeholder()).toBeNull();

          urlAvailable = true;
          await go(false);
          await go(true);
          await waitFor(() => expect(urlOfPhoto()).not.toBe(lastUrl));
          expect(photo()).toBeTruthy();
          expect(photoSkeleton()).toBeNull();
          expect(placeholder()).toBeNull();
        });

        it('the url that comes back and then fails to load still leaves the photo (D21)', async () => {
          const { reads } = await signedAgainOnEveryRead((profile) => profile, () => urlAvailable);
          await showPhotoThenReconnect();
          await fireEvent(photo() as NonNullable<ReturnType<typeof photo>>, 'load', loadEvent());
          urlAvailable = false;
          await reconnectRead(reads);
          const lastUrl = urlOfPhoto();

          urlAvailable = true;
          await go(false);
          await go(true);
          await waitFor(() => expect(urlOfPhoto()).not.toBe(lastUrl));
          await fireEvent(photo() as NonNullable<ReturnType<typeof photo>>, 'error', errorEvent());
          await act(async () => {});
          expect(photo()).toBeTruthy();
          expect(photoSkeleton()).toBeNull();
          expect(placeholder()).toBeNull();
        });

        // Guard (D20): without a url there is nothing to keep for a photo that is not the one on screen.
        it('a different photo (another avatarId) without a url shows the skeleton', async () => {
          let newPhoto = false;
          const { reads } = await signedAgainOnEveryRead(
            (profile) => (newPhoto ? { ...profile, avatarId: '00000000-0000-4000-8000-0000000000bb' } : profile),
            () => urlAvailable,
          );
          await showPhotoThenReconnect();
          newPhoto = true;
          urlAvailable = false;
          await reconnectRead(reads);
          expect(photoSkeleton()).toBeTruthy();
          expect(photo()).toBeNull();
          expect(placeholder()).toBeNull();
        });
      });
    });

    describe('the skeleton fades out when the photo has loaded (D22)', () => {
      const fadeCalls = () => withTimingSpy.mock.calls.filter(([toValue]) => toValue === 0);
      // The Reanimated mock makes a whole pulse (`withSequence`) 0, which is also where the fade ends. Give the pulse its own
      // value, so that an opacity of 0 can only come from the fade, and 1 (before the load) only from the wrapper at rest.
      const PULSE = 0.77;
      let pulse: jest.SpyInstance;
      beforeEach(() => {
        pulse = jest.spyOn(Reanimated, 'withSequence').mockReturnValue(PULSE as never);
      });
      afterEach(() => pulse.mockRestore());
      // The opacity of every animated style that has one: the pulses, and the wrapper that fades.
      const opacities = () =>
        useAnimatedStyleSpy.mock.calls.map(([updater]) => updater() as Record<string, unknown>).filter((result) => 'opacity' in result);

      it('reduced motion off: the skeleton fades to 0 over duration.small, opacity only, then it is gone', async () => {
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
        setAppProfileRepository(await profileWithPhoto());
        await renderProfile();
        const shown = await findPhoto();
        await act(async () => {});
        withTimingSpy.mockClear();
        // At rest: the wrapper is at 1 and the pulses at PULSE; nothing is at 0.
        expect(opacities().map((result) => result.opacity)).toContain(1);
        expect(opacities().map((result) => result.opacity)).toContain(PULSE);
        expect(opacities().map((result) => result.opacity)).not.toContain(0);

        // From here only the styles of the components rendered after the load (those still on the screen).
        useAnimatedStyleSpy.mockClear();
        await fireEvent(shown, 'load', loadEvent());
        expect(fadeCalls()).toHaveLength(1);
        expect(fadeCalls()[0][1]).toMatchObject({ duration: lightTheme.duration.small });
        expect(lightTheme.duration.small).toBe(180);
        // Still there while it fades (the photo is under it). What fades is the wrapper around the skeleton: it is driven
        // by opacity alone and never scales (§9.4).
        expect(theSkeleton()).toBeTruthy();
        expect(photo()).toBeTruthy();
        const wrapper = screen.getByTestId('profile-photo-fade', { includeHiddenElements: true });
        expect(style(wrapper).transform).toBeUndefined();
        expect(style(wrapper)).toHaveProperty('opacity');
        // The fade drives the wrapper: it went from 1 to 0, and no animated opacity is still at rest. Each of them is opacity
        // and nothing else (the skeleton's pulse and the wrapper).
        expect(opacities().map((result) => result.opacity)).toContain(0);
        expect(opacities().map((result) => result.opacity)).not.toContain(1);
        expect(opacities().length).toBeGreaterThan(1);
        opacities().forEach((result) => expect(Object.keys(result)).toEqual(['opacity']));

        await act(async () => {
          jest.advanceTimersByTime(lightTheme.duration.small - 1);
        });
        expect(photoSkeleton()).toBeTruthy();
        await act(async () => {
          jest.advanceTimersByTime(1);
        });
        expect(photoSkeleton()).toBeNull();
        expect(photo()).toBeTruthy();
      });

      it('reduced motion on: no fade, the skeleton is gone at once', async () => {
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
        setAppProfileRepository(await profileWithPhoto());
        await renderProfile();
        const shown = await findPhoto();
        await act(async () => {});
        withTimingSpy.mockClear();

        await fireEvent(shown, 'load', loadEvent());
        expect(withTimingSpy).not.toHaveBeenCalled();
        expect(photoSkeleton()).toBeNull();
        expect(photo()).toBeTruthy();
      });

      // The timer that removes the skeleton belongs to the photo it was started for: when the photo changes inside the fade,
      // the next photo's skeleton fades for its own full duration.
      it('a fade cut short by another photo does not remove the next photo\'s skeleton early', async () => {
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
        let newPhoto = false;
        await signedAgainOnEveryRead((profile) => (newPhoto ? { ...profile, avatarId: '00000000-0000-4000-8000-0000000000bb' } : profile));
        await renderProfile();
        const first = await findPhoto();
        await act(async () => {});

        await fireEvent(first, 'load', loadEvent());
        await act(async () => {
          jest.advanceTimersByTime(50);
        });
        newPhoto = true;
        await go(false);
        await go(true);
        // The second photo arrives within the first one's fade (1 ms steps, so only a few ms pass).
        const firstUrl = urlOfPhoto();
        for (let step = 0; step < 40 && urlOfPhoto() === firstUrl; step += 1) {
          await act(async () => {
            jest.advanceTimersByTime(1);
          });
        }
        expect(urlOfPhoto()).not.toBe(firstUrl);
        expect(theSkeleton()).toBeTruthy();

        await fireEvent(photo() as NonNullable<ReturnType<typeof photo>>, 'load', loadEvent());
        // Past the moment the first photo's timer would have fired (180 ms after its load), before the second one's end.
        await act(async () => {
          jest.advanceTimersByTime(lightTheme.duration.small - 40);
        });
        expect(photoSkeleton()).toBeTruthy();
        await act(async () => {
          jest.advanceTimersByTime(40);
        });
        expect(photoSkeleton()).toBeNull();
      });
    });

    it('pulses offline too: with a photo and no url the skeleton starts a pulse (reduced motion off)', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await go(false);
      // The same offline screen for a user without a photo: only the stats skeletons pulse.
      await renderProfile();
      await act(async () => {});
      const statsOnly = withRepeatSpy.mock.calls.length;
      expect(statsOnly).toBeGreaterThan(0);
      await screen.unmount();
      withRepeatSpy.mockClear();

      const base = await profileWithPhoto();
      setAppProfileRepository(
        withMyProfile(base, async () => {
          const mine = await base.myProfile();
          if (!mine) return null;
          const { avatarUrl: _avatarUrl, ...copy } = mine.profile;
          return { profile: copy, fromCache: true };
        }),
      );
      await renderProfile();
      await act(async () => {});
      expect(theSkeleton()).toBeTruthy();
      expect(withRepeatSpy.mock.calls.length).toBeGreaterThan(statsOnly);
      expect(withRepeatSpy).toHaveBeenLastCalledWith(expect.anything(), -1);
    });

    // The skeleton starts to pulse when it mounts, so a photo is shown first, the recorders are cleared, and then a different
    // photo arrives (another avatarId): the skeleton that appears is the only one on the screen that can start a pulse.
    async function skeletonAppears() {
      let newPhoto = false;
      await signedAgainOnEveryRead((profile) => (newPhoto ? { ...profile, avatarId: '00000000-0000-4000-8000-0000000000bb' } : profile));
      await showPhotoThenReconnect(() => {
        newPhoto = true;
        withRepeatSpy.mockClear();
        withTimingSpy.mockClear();
      });
      return theSkeleton();
    }

    it('reduced motion off: it pulses, one cycle per duration.skeletonPulse', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await skeletonAppears();
      expect(withRepeatSpy).toHaveBeenCalledTimes(1);
      expect(withRepeatSpy).toHaveBeenCalledWith(expect.anything(), -1);
      const legs = withTimingSpy.mock.calls.map(([toValue, config]) => ({ toValue, duration: config?.duration ?? 0 }));
      expect(legs.map((leg) => leg.toValue)).toEqual([lightTheme.opacity.skeletonPulseMin, 1]);
      expect(legs.reduce((sum, leg) => sum + leg.duration, 0)).toBe(lightTheme.duration.skeletonPulse);
    });

    it('reduced motion on: it stays still', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const skeleton = await skeletonAppears();
      expect(withRepeatSpy).not.toHaveBeenCalled();
      expect(withTimingSpy).not.toHaveBeenCalled();
      expect(style(skeleton).opacity).toBe(1);
    });
  });

  it('works from the copy on the phone (offline): the same nick', async () => {
    const base = await profileWithPhoto();
    setAppProfileRepository(
      withMyProfile(base, async () => {
        const mine = await base.myProfile();
        return mine && { profile: mine.profile, fromCache: true };
      }),
    );
    await renderProfile();
    expect(await screen.findByText('kacper')).toBeTruthy();
  });

  it('is not tappable: the photo is no button', async () => {
    setAppProfileRepository(await profileWithPhoto());
    await renderProfile();
    await screen.findByTestId('profile-photo', { includeHiddenElements: true });
    const row = screen.getByTestId('profile-row');
    expect(within(row).queryAllByRole('button', { includeHiddenElements: true })).toHaveLength(0);
    // Nothing from the photo up to the screen can take a touch: a Pressable renders a view with responder handlers.
    const touchHandlers = ['onPress', 'onClick', 'onResponderGrant', 'onStartShouldSetResponder'];
    let node: ReturnType<typeof screen.getByTestId> | null = screen.getByTestId('profile-photo', { includeHiddenElements: true });
    while (node && node.props.testID !== 'profile-screen') {
      touchHandlers.forEach((handler) => expect(node?.props[handler]).toBeUndefined());
      node = node.parent;
    }
    expect(node).not.toBeNull();
  });
});

describe('Profile screen — stats (D2, D7, A6)', () => {
  it('shows the five numbers of the past trips, and leaves out the upcoming one', async () => {
    await renderProfile();
    await screen.findByLabelText(/Podróże$/);
    const expected = travelStats(TRIPS, '2026-10-20', AIRPORTS);
    expect(expected).toMatchObject({ trips: 3, countries: 2, days: 10, flights: 5 });
    expect(expected.km).toBeGreaterThan(10_000);

    const value = (key: string) => within(screen.getByTestId(`stat-${key}`));
    expect(value('trips').getByText('3')).toBeTruthy();
    expect(value('countries').getByText('2')).toBeTruthy();
    expect(value('days').getByText('10')).toBeTruthy();
    expect(value('flights').getByText('5')).toBeTruthy();
    expect(value('km').getByText(fmt(expected.km, 'pl'))).toBeTruthy();
  });

  it('formats the distance for the language: a space in Polish, a comma in English', async () => {
    await renderProfile();
    await screen.findByLabelText(/Przelecone km$/);
    const km = travelStats(TRIPS, '2026-10-20', AIRPORTS).km;
    expect(within(screen.getByTestId('stat-km')).getByText(fmt(km, 'pl'))).toBeTruthy();
    expect(fmt(km, 'pl')).toMatch(/^\d{2}\s\d{3}$/);

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(await screen.findByLabelText(`${fmt(km, 'en')} Km flown`)).toBeTruthy();
    expect(fmt(km, 'en')).toMatch(/^\d{2},\d{3}$/);
  });

  it('reads each stat as one element "<value> <label>"', async () => {
    await renderProfile();
    const km = travelStats(TRIPS, '2026-10-20', AIRPORTS).km;
    expect(await screen.findByLabelText('3 Podróże')).toBe(screen.getByTestId('stat-trips'));
    expect(screen.getByLabelText('2 Kraje')).toBe(screen.getByTestId('stat-countries'));
    expect(screen.getByLabelText('10 Dni w podróży')).toBe(screen.getByTestId('stat-days'));
    expect(screen.getByLabelText('5 Loty')).toBe(screen.getByTestId('stat-flights'));
    expect(screen.getByLabelText(`${fmt(km, 'pl')} Przelecone km`)).toBe(screen.getByTestId('stat-km'));
  });

  it('has the card title "Twoje podróże"', async () => {
    await renderProfile();
    expect(await screen.findByRole('header', { name: 'Twoje podróże' })).toBeTruthy();
  });

  it('shows 0 everywhere when there are no past trips', async () => {
    mockList = async () => [FUTURE];
    await renderProfile();
    await screen.findByLabelText('0 Podróże');
    ['trips', 'countries', 'days', 'flights', 'km'].forEach((key) =>
      expect(within(screen.getByTestId(`stat-${key}`)).getByText('0')).toBeTruthy(),
    );
  });

  it('shows 0 everywhere for an empty list', async () => {
    mockList = async () => [];
    await renderProfile();
    await screen.findByLabelText('0 Podróże');
    expect(screen.getAllByText('0')).toHaveLength(5);
  });

  it('while the list loads: five skeleton blocks, hidden from screen readers, and one loading label', async () => {
    mockList = () => new Promise(() => {});
    await renderProfile({ settle: false });
    const blocks = await screen.findAllByTestId('stat-skeleton', { includeHiddenElements: true });
    expect(blocks).toHaveLength(5);
    blocks.forEach((block) => expect(isHiddenFromAccessibility(block)).toBe(true));
    expect(screen.getByLabelText('Wczytywanie statystyk')).toBeBusy();
    expect(screen.queryByText('0')).toBeNull();
    // The header and the profile row do not wait for the trips.
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toBeTruthy();
    expect(await screen.findByText('kacper')).toBeTruthy();
  });

  it('replaces the skeletons with the numbers once the list arrives', async () => {
    await renderProfile();
    await screen.findByLabelText('3 Podróże');
    expect(screen.queryAllByTestId('stat-skeleton', { includeHiddenElements: true })).toHaveLength(0);
  });
});

describe('Profile screen — offline (§12)', () => {
  it('online: no offline banner', async () => {
    await renderProfile();
    await screen.findByLabelText('3 Podróże');
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('offline: the numbers from the copy on the phone, with the banner', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    await renderProfile();
    expect(await screen.findByLabelText('3 Podróże')).toBeTruthy();
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeTruthy();
  });
});

describe('Profile screen — theme and layout', () => {
  it('uses the light background in light mode', async () => {
    await renderProfile();
    expect(screen.getByTestId('profile-screen')).toHaveStyle({ backgroundColor: lightTheme.colors.background });
  });

  it('uses the dark tokens in dark mode: background, title and skeleton', async () => {
    mockScheme = 'dark';
    mockList = () => new Promise(() => {});
    await renderProfile({ settle: false });
    expect(screen.getByTestId('profile-screen')).toHaveStyle({ backgroundColor: darkTheme.colors.background });
    expect(style(screen.getByRole('header', { name: 'Profil' })).color).toBe(darkTheme.colors.text.primary);
    const [skeleton] = await screen.findAllByTestId('stat-skeleton', { includeHiddenElements: true });
    expect(style(skeleton).backgroundColor).toBe(colors.dark.skeleton.base);
  });

  it('standard side padding of 20dp', async () => {
    await renderProfile();
    expect(screen.getByTestId('profile-screen')).toHaveStyle({ paddingHorizontal: lightTheme.spacing[5] });
  });

  it('large Dynamic Type: the stats become one column and the screen scrolls', async () => {
    mockFontScale = 2;
    await renderProfile();
    await screen.findByLabelText('3 Podróże');
    expect(screen.getAllByTestId('stats-row')).toHaveLength(5);
    expect(screen.getByTestId('profile-scroll')).toBeTruthy();
  });
});
