import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { focusManager } from '@tanstack/react-query';
import { Dimensions, FlatList, StyleSheet } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import HomeScreen from '@/app/(drawer)/(tabs)/index';
import RootLayout from '@/app/_layout';
import PhotosScreen from '@/app/trips/[tripId]/photos';
import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import i18n from '@/i18n';
import { photoPaths } from '@/lib/trip-photos';
import type { TripPhoto } from '@/schemas';
import { createTripInputFixture } from '@/test/fixtures';
import { setNetwork } from '@/test/mock-network';
import { darkTheme } from '@/theme/legacy/theme';
import { darkTheme as sunlineDarkTheme } from '@/theme/theme';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

// The light scheme proves the viewer is ink anyway (P4).
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => 'light' }));

// A stand-in that shows the style it was given, so the viewer's own bar can be told from the home screen's.
jest.mock('expo-status-bar', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { StatusBar: ({ style }: { style?: string }) => createElement(View, { testID: `status-bar-${style}` }) };
});

// The screens read the photos through the repository; each test decides which one.
let mockRepository: TripRepository;
jest.mock('@/data/app-trip-repository', () => ({ createAppTripRepository: () => mockRepository }));

const NOW = new Date('2026-10-15T12:00:00Z');
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
/** Id of the n-th photo; the photos are taken one day apart, so their order is their number. */
const photoId = (index: number) => `4a1e7c2d-0b3f-4d5a-8e6b-${String(index).padStart(12, '0')}`;
const OFFLINE = { isConnected: false, isInternetReachable: false };

let tripId: string;

/** A trip whose photos 1..count are on the server, and the repository to read them with. */
async function setup(count = 12, patch: Partial<TripRepository> = {}) {
  const base = createInMemoryTripRepository({ now: () => NOW, newId });
  const trip = await base.create(createTripInputFixture());
  tripId = trip.id;
  for (let i = 1; i <= count; i++) await base.addPhoto(trip.id, photoId(i), { uri: `file:///seed/${i}.jpg`, takenAt: `2026-11-${String(i).padStart(2, '0')}T10:00` });
  mockRepository = { ...base, ...patch };
  return base;
}

// renderRouter attaches getPathname & co to the returned promise, not to the awaited result (see the wizard tests).
let app: ReturnType<typeof renderRouter>;
function renderApp(initialUrl = '/') {
  app = renderRouter(
    {
      _layout: RootLayout,
      '(drawer)/_layout': DrawerLayout,
      '(drawer)/(tabs)/_layout': TabsLayout,
      '(drawer)/(tabs)/index': HomeScreen,
      'trips/[tripId]/photos': PhotosScreen,
      'trips/new/index': () => null,
    },
    { initialUrl },
  );
  return app;
}

const viewerUrl = (photo?: string) => `/trips/${tripId}/photos${photo ? `?photoId=${photo}` : ''}`;

/** Home first (as in the app), then the viewer on top of it. */
async function openViewer(photo: string | null = photoId(3)) {
  await renderApp();
  await screen.findByTestId('home-screen');
  await act(async () => router.push({ pathname: '/trips/[tripId]/photos', params: { tripId, ...(photo ? { photoId: photo } : {}) } }));
  await screen.findByTestId('photo-viewer');
}

const viewer = () => within(screen.getByTestId('photo-viewer'));
const sheet = () => within(screen.getByTestId('bottom-sheet'));
const pageWidth = () => Dimensions.get('window').width;
const swipeTo = (index: number, within = 0) =>
  act(async () => {
    fireEvent.scroll(screen.getByTestId('photo-viewer-pager'), { nativeEvent: { contentOffset: { x: index * pageWidth() + within, y: 0 } } });
  });
const urlOf = (index: number) => `https://photos.invalid/${tripId}/${photoId(index)}.jpg`;
/** The pictures of the pages the list has mounted, by the full file's address (the strip shows thumbnails). */
const images = () => viewer().queryAllByTestId('photo-viewer-image');
const shownUris = () => images().map((image) => image.props.source[0].uri as string);
const imageOf = (index: number) => images().find((image) => image.props.source[0].uri === urlOf(index));

beforeEach(async () => {
  n = 0;
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Photo viewer — opening (trip-photos D6, P4)', () => {
  it('opens on the tapped photo from the strip, and the counter reads "3 z 12"', async () => {
    await setup();
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Zdjęcie 3 z 12' }));
    expect(await screen.findByTestId('photo-viewer')).toBeTruthy();
    expect(viewer().getByText('3 z 12')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-pager').props.initialScrollIndex).toBe(2);
    expect(shownUris()).toContain(urlOf(3));
    expect(app.getPathname()).toBe(`/trips/${tripId}/photos`);
    expect(app.getSearchParams()).toEqual({ tripId, photoId: photoId(3) });
  });

  it('keeps the home screen mounted underneath, because the uploads live in its strip', async () => {
    await setup();
    await openViewer();
    // Not the focused screen, so hidden from accessibility, but still in the tree.
    expect(screen.getByTestId('home-screen', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('photo-strip', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows each photo whole (contain), cached under its storage path, in a full-width paging list (A2, A6)', async () => {
    await setup();
    await openViewer();
    const image = imageOf(3)!;
    expect(image.props.contentFit).toBe('contain');
    expect(image.props.source).toEqual([{ uri: urlOf(3), cacheKey: photoPaths({ id: photoId(3), tripId }).file }]);
    const pager = screen.getByTestId('photo-viewer-pager');
    expect(pager.props.horizontal).toBe(true);
    expect(pager.props.pagingEnabled).toBe(true);
    expect(pager.props.showsHorizontalScrollIndicator).toBe(false);
    // Every page is as wide as the window, so the list can jump to the tapped photo without measuring.
    expect(pager.props.getItemLayout(null, 4)).toEqual({ length: pageWidth(), offset: 4 * pageWidth(), index: 4 });
  });

  it('opens on the first photo when the id is unknown or missing', async () => {
    await setup();
    await openViewer(photoId(99));
    expect(viewer().getByText('1 z 12')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-pager').props.initialScrollIndex).toBe(0);
  });

  it('opens on the first photo when there is no id', async () => {
    await setup();
    await openViewer(null);
    expect(viewer().getByText('1 z 12')).toBeTruthy();
  });

  it('can be opened by a link on its own: there it closes to the home screen', async () => {
    await setup();
    await renderApp(viewerUrl(photoId(2)));
    expect(await screen.findByTestId('photo-viewer')).toBeTruthy();
    expect(await viewer().findByText('2 z 12')).toBeTruthy();
    await fireEvent.press(viewer().getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
  });

  it('is always ink with a light status bar, on a light device too', async () => {
    await setup();
    await openViewer();
    expect(screen.getByTestId('photo-viewer')).toHaveStyle({ flex: 1, backgroundColor: darkTheme.colors.hero.background });
    expect(viewer().getByTestId('status-bar-light')).toBeTruthy();
  });
});

describe('Photo viewer — swiping and the counter', () => {
  it('changes the counter when the page changes, and back', async () => {
    await setup();
    await openViewer();
    expect(viewer().getByText('3 z 12')).toBeTruthy();
    await swipeTo(3);
    expect(viewer().getByText('4 z 12')).toBeTruthy();
    expect(viewer().queryByText('3 z 12')).toBeNull();
    await swipeTo(1);
    expect(viewer().getByText('2 z 12')).toBeTruthy();
  });

  it('changes at the middle of a swipe, not before', async () => {
    await setup();
    await openViewer();
    await swipeTo(2, pageWidth() * 0.4);
    expect(viewer().getByText('3 z 12')).toBeTruthy();
    await swipeTo(2, pageWidth() * 0.6);
    expect(viewer().getByText('4 z 12')).toBeTruthy();
  });

  it('reads the counter as a photo of the trip and announces it when it changes', async () => {
    await setup();
    await openViewer();
    const counter = viewer().getByText('3 z 12');
    expect(counter.props.accessibilityLabel).toBe('Zdjęcie 3 z 12');
    expect(counter.props.accessibilityLiveRegion).toBe('polite');
    await swipeTo(0);
    expect(viewer().getByText('1 z 12').props.accessibilityLabel).toBe('Zdjęcie 1 z 12');
  });

  it('draws the counter in Caption, in the hero secondary text colour', async () => {
    await setup();
    await openViewer();
    expect(viewer().getByText('3 z 12')).toHaveStyle({ ...darkTheme.typography.caption, color: darkTheme.colors.hero.textSecondary });
  });
});

describe('Photo viewer — closing', () => {
  async function openFromStrip() {
    await setup();
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Zdjęcie 3 z 12' }));
    await screen.findByTestId('photo-viewer');
  }

  it('"Zamknij" returns to the home screen', async () => {
    await openFromStrip();
    await fireEvent.press(viewer().getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(screen.queryByTestId('photo-viewer')).toBeNull());
    expect(app.getPathname()).toBe('/');
    expect(screen.getByTestId('home-screen')).toBeTruthy();
  });

  it('the system back button returns to the home screen', async () => {
    await openFromStrip();
    // The native stack takes the back button itself; in Jest the same pop is router.back() (as in the wizard tests).
    await act(async () => router.back());
    await waitFor(() => expect(screen.queryByTestId('photo-viewer')).toBeNull());
    expect(app.getPathname()).toBe('/');
  });

  it('has the two round buttons over the photo: "Zamknij" and "Usuń zdjęcie", 44dp each', async () => {
    await setup();
    await openViewer();
    for (const name of ['Zamknij', 'Usuń zdjęcie']) {
      const button = viewer().getByRole('button', { name });
      expect(button).toHaveStyle({ width: darkTheme.size.touchTarget, height: darkTheme.size.touchTarget, backgroundColor: sunlineDarkTheme.hero.controlBackground });
    }
  });
});

describe('Photo viewer — deleting a photo (P5)', () => {
  const openDelete = async () => {
    await fireEvent.press(viewer().getByRole('button', { name: 'Usuń zdjęcie' }));
    return screen.findByTestId('bottom-sheet');
  };
  const confirm = () => fireEvent.press(sheet().getByRole('button', { name: 'Usuń zdjęcie' }));
  const photosOnServer = async () => (await mockRepository.photos(tripId)).map((photo) => photo.id);

  it('asks first: the sheet, and nothing is deleted until the user confirms', async () => {
    await setup();
    await openViewer();
    await openDelete();
    expect(sheet().getByRole('header', { name: 'Usunąć to zdjęcie?' })).toBeTruthy();
    expect(await photosOnServer()).toHaveLength(12);
    await fireEvent.press(sheet().getByRole('button', { name: 'Anuluj' }));
    await waitFor(() => expect(screen.queryByTestId('bottom-sheet')).toBeNull());
    expect(viewer().getByText('3 z 12')).toBeTruthy();
    expect(await photosOnServer()).toHaveLength(12);
  });

  it('after a delete the next photo shows in its place, and the sheet is gone', async () => {
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    await setup();
    await openViewer(photoId(3));
    await openDelete();
    await confirm();
    expect(await viewer().findByText('3 z 11')).toBeTruthy();
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    expect(await photosOnServer()).not.toContain(photoId(3));
    expect(shownUris()).toContain(urlOf(4));
    expect(shownUris()).not.toContain(urlOf(3));
    // The list keeps its place: the next photo has moved under it, so nothing needs scrolling.
    expect(scrollToIndex).not.toHaveBeenCalled();
    expect(app.getPathname()).toBe(`/trips/${tripId}/photos`);
  });

  it('deleting the last photo of the list shows the previous one', async () => {
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    await setup();
    await openViewer(photoId(12));
    expect(viewer().getByText('12 z 12')).toBeTruthy();
    await openDelete();
    await confirm();
    expect(await viewer().findByText('11 z 11')).toBeTruthy();
    expect(shownUris()).toContain(urlOf(11));
    expect(shownUris()).not.toContain(urlOf(12));
    // The list leaves the removed page behind: it is scrolled back to the last photo, not left on empty space.
    expect(screen.getByTestId('photo-viewer-pager').props.data).toHaveLength(11);
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 10, animated: false });
  });

  it('deleting the only photo closes the viewer', async () => {
    await setup(1);
    await openViewer(photoId(1));
    expect(viewer().getByText('1 z 1')).toBeTruthy();
    await openDelete();
    await confirm();
    await waitFor(() => expect(screen.queryByTestId('photo-viewer')).toBeNull());
    expect(app.getPathname()).toBe('/');
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('a photo you swiped to is the one that is deleted', async () => {
    await setup();
    await openViewer(photoId(3));
    await swipeTo(5);
    await openDelete();
    await confirm();
    expect(await viewer().findByText('6 z 11')).toBeTruthy();
    const left = await photosOnServer();
    expect(left).not.toContain(photoId(6));
    expect(left).toContain(photoId(3));
  });

  it('a failed delete shows the error inline, keeps the sheet open, and the photo stays', async () => {
    const deletePhoto = jest.fn<Promise<void>, [TripPhoto]>().mockRejectedValueOnce(new Error('photo-not-deletable'));
    await setup(12, { deletePhoto });
    await openViewer();
    await openDelete();
    await confirm();
    expect(await sheet().findByText('Nie udało się usunąć zdjęcia. Spróbuj ponownie.')).toBeTruthy();
    expect(viewer().getByText('3 z 12')).toBeTruthy();
    expect(await photosOnServer()).toHaveLength(12);
    expect(sheet().getByRole('button', { name: 'Usuń zdjęcie' })).toBeEnabled();
  });

  it('while the delete runs, the sheet cannot be dismissed', async () => {
    let finish: () => void = () => {};
    const deletePhoto = jest.fn((_photo: TripPhoto) => new Promise<void>((resolve) => (finish = resolve)));
    await setup(12, { deletePhoto });
    await openViewer();
    await openDelete();
    await confirm();
    await waitFor(() => expect(sheet().getByRole('button', { name: 'Anuluj' })).toBeDisabled());
    await fireEvent.press(within(screen.getByTestId('bottom-sheet-keyboard')).getByRole('button', { name: 'Zamknij' }));
    await fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
    expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    await act(async () => finish());
  });

  it('offline, "Usuń zdjęcie" is disabled and opens nothing; closing still works', async () => {
    await setup();
    setNetwork(OFFLINE);
    await openViewer();
    const button = viewer().getByRole('button', { name: 'Usuń zdjęcie' });
    expect(button).toBeDisabled();
    expect(button).toHaveStyle({ backgroundColor: sunlineDarkTheme.disabled.background });
    expect(StyleSheet.flatten(button.props.style).opacity).toBeUndefined();
    await fireEvent.press(button);
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    expect(viewer().getByRole('button', { name: 'Zamknij' })).toBeEnabled();
  });

  it('goes back online: delete works again', async () => {
    await setup();
    setNetwork(OFFLINE);
    await openViewer();
    expect(viewer().getByRole('button', { name: 'Usuń zdjęcie' })).toBeDisabled();
    await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
    expect(viewer().getByRole('button', { name: 'Usuń zdjęcie' })).toBeEnabled();
  });
});

// friend-invite A3: a friend linked by code only looks at the photos. The trip is theirs only through the organizer, so
// "owner" is decided by comparing the trip's owner with the own profile.
describe('Photo viewer — linked member, no delete (friend-invite A3)', () => {
  const ORGANIZER_ID = '5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';

  /** The same trip and photos, but owned by someone else: the repository tells the app so through `current()`. */
  async function setupShared(count = 12) {
    const base = await setup(count);
    mockRepository = {
      ...base,
      current: async () => {
        const current = await base.current();
        if (!current) return current;
        const trip = { ...current.overview.trip, ownerId: ORGANIZER_ID };
        return { ...current, overview: { ...current.overview, trip } };
      },
    };
  }

  it('has "Zamknij" and the counter but no "Usuń zdjęcie"', async () => {
    await setupShared();
    await openViewer();
    expect(viewer().getByRole('button', { name: 'Zamknij' })).toBeEnabled();
    expect(viewer().getByText('3 z 12')).toBeTruthy();
    expect(viewer().queryByRole('button', { name: 'Usuń zdjęcie' })).toBeNull();
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('still swipes between the photos', async () => {
    await setupShared();
    await openViewer();
    await swipeTo(3);
    expect(viewer().getByText('4 z 12')).toBeTruthy();
    expect(viewer().queryByRole('button', { name: 'Usuń zdjęcie' })).toBeNull();
  });

  it('says nothing about deleting offline: no hint, nothing to switch off', async () => {
    await setupShared();
    setNetwork(OFFLINE);
    await openViewer();
    expect(viewer().getByText('3 z 12')).toBeTruthy();
    expect(viewer().queryByText('Bez internetu nie dodasz ani nie usuniesz zdjęć.')).toBeNull();
    expect(viewer().queryByRole('button', { name: 'Usuń zdjęcie' })).toBeNull();
  });

  it('shows no delete while the trip is not known yet, so a member never sees it flash', async () => {
    await setupShared();
    mockRepository = { ...mockRepository, current: () => new Promise(() => {}) };
    await renderApp(viewerUrl(photoId(2)));
    expect(await viewer().findByText('2 z 12')).toBeTruthy();
    expect(viewer().queryByRole('button', { name: 'Usuń zdjęcie' })).toBeNull();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await setupShared();
    await openViewer();
    expect(viewer().getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(viewer().queryByRole('button', { name: 'Delete photo' })).toBeNull();
  });
});

describe('Photo viewer — states', () => {
  it('shows the photos the phone has while offline, and a photo that cannot load says so', async () => {
    await setup();
    setNetwork(OFFLINE);
    await openViewer();
    expect(viewer().getByText('3 z 12')).toBeTruthy();
    expect(viewer().queryByText('Nie udało się wczytać zdjęcia.')).toBeNull();
    // The picture of a photo that was never opened is not on the phone: its page says so, the others are not affected.
    await act(async () => {
      fireEvent(imageOf(3)!, 'error', { nativeEvent: { error: 'offline' } });
    });
    expect(viewer().getByText('Nie udało się wczytać zdjęcia.')).toBeTruthy();
    expect(viewer().getAllByText('Nie udało się wczytać zdjęcia.')).toHaveLength(1);
  });

  it('a page whose image fails shows the message instead of the picture, and the viewer keeps working', async () => {
    await setup();
    await openViewer();
    await act(async () => {
      fireEvent(imageOf(3)!, 'error', { nativeEvent: { error: 'expired' } });
    });
    expect(viewer().getByText('Nie udało się wczytać zdjęcia.')).toBeTruthy();
    expect(imageOf(3)).toBeUndefined();
    await swipeTo(3);
    expect(viewer().getByText('4 z 12')).toBeTruthy();
    expect(imageOf(4)).toBeTruthy();
    expect(viewer().getByRole('button', { name: 'Zamknij' })).toBeEnabled();
  });

  it('while the photos load: ink, "Zamknij", and a busy element named like the strip; no delete, no counter', async () => {
    await setup();
    mockRepository = { ...mockRepository, photos: () => new Promise(() => {}) };
    await renderApp(viewerUrl(photoId(2)));
    const loading = await screen.findByTestId('photo-viewer-loading');
    expect(loading).toBeBusy();
    expect(loading.props.accessibilityLabel).toBe('Zdjęcia z podróży');
    expect(screen.getByTestId('photo-viewer')).toHaveStyle({ backgroundColor: darkTheme.colors.hero.background });
    expect(viewer().getByRole('button', { name: 'Zamknij' })).toBeEnabled();
    expect(viewer().queryByRole('button', { name: 'Usuń zdjęcie' })).toBeNull();
    expect(screen.queryByTestId('photo-viewer-pager')).toBeNull();
  });

  it('when the photos cannot be read: the message and "Spróbuj ponownie", which reads them again', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      const base = await setup();
      let fail = true;
      const photos = jest.fn((id: string) => (fail ? Promise.reject(new Error('photos failed')) : base.photos(id)));
      mockRepository = { ...base, photos };
      await renderApp(viewerUrl(photoId(2)));
      await act(async () => {
        await jest.runAllTimersAsync();
      });
      expect(await viewer().findByText('Nie udało się wczytać zdjęć.')).toBeTruthy();
      expect(viewer().getByRole('button', { name: 'Zamknij' })).toBeEnabled();
      fail = false;
      await fireEvent.press(viewer().getByRole('button', { name: 'Spróbuj ponownie' }));
      expect(await viewer().findByText('2 z 12')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a trip with no photos has nothing to show: the viewer closes', async () => {
    await setup(0);
    await renderApp(viewerUrl(photoId(1)));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
  });

  it('does not close while the photos are still loading', async () => {
    await setup(0);
    mockRepository = { ...mockRepository, photos: () => new Promise(() => {}) };
    await renderApp(viewerUrl(photoId(1)));
    await screen.findByTestId('photo-viewer-loading');
    expect(app.getPathname()).toBe(`/trips/${tripId}/photos`);
  });
});

describe('Photo viewer — counter pill (trip-photos D32)', () => {
  it('backs the counter with a rounded pill in the hero control colour, like the round buttons', async () => {
    await setup();
    await openViewer();
    const pill = viewer().getByTestId('photo-viewer-counter');
    expect(pill).toHaveStyle({
      backgroundColor: darkTheme.colors.hero.control,
      borderRadius: darkTheme.radius.full,
      paddingHorizontal: darkTheme.spacing[3],
      paddingVertical: darkTheme.spacing[1],
    });
    expect(within(pill).getByText('3 z 12')).toBeTruthy();
  });

  it('keeps the counter centred between the two buttons', async () => {
    await setup();
    await openViewer();
    const slot = viewer().getByTestId('photo-viewer-counter').parent!;
    expect(slot).toHaveStyle({ flex: 1, alignItems: 'center' });
  });
});

describe('Photo viewer — offline hint (trip-photos D33, D8)', () => {
  const HINT = 'Bez internetu nie dodasz ani nie usuniesz zdjęć.';

  it('is absent online', async () => {
    await setup();
    await openViewer();
    expect(viewer().queryByText(HINT)).toBeNull();
  });

  it('sits in the same pill as the counter: hero control backing, fully rounded, wrapping its text (D35)', async () => {
    await setup();
    setNetwork(OFFLINE);
    await openViewer();
    const pill = viewer().getByTestId('photo-viewer-offline-hint');
    expect(pill).toHaveStyle({
      backgroundColor: darkTheme.colors.hero.control,
      borderRadius: darkTheme.radius.full,
      paddingHorizontal: darkTheme.spacing[3],
      paddingVertical: darkTheme.spacing[1],
    });
    expect(within(pill).getByText(HINT)).toHaveStyle({ textAlign: 'center' });
    // Centred, not a bar across the screen: the slot centres it and the pill is not stretched.
    const slot = StyleSheet.flatten(pill.parent!.props.style);
    expect(slot.alignItems).toBe('center');
    expect(slot.pointerEvents ?? pill.parent!.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(pill.props.style).alignSelf).toBeUndefined();
  });

  it('shows offline at the bottom, in Body S and the hero text colour, above the bottom safe area', async () => {
    await setup();
    setNetwork(OFFLINE);
    await openViewer();
    const hint = viewer().getByText(HINT);
    expect(hint).toHaveStyle({ ...darkTheme.typography.bodyS, color: darkTheme.colors.hero.text });
    const place = StyleSheet.flatten(hint.parent!.parent!.props.style); // text, pill (D35), then the positioned slot
    expect(place.position).toBe('absolute');
    expect(place.bottom).toBeGreaterThanOrEqual(darkTheme.spacing[4]);
  });

  it('goes away when the connection is back, and comes back when it is lost', async () => {
    await setup();
    setNetwork(OFFLINE);
    await openViewer();
    expect(viewer().getByText(HINT)).toBeTruthy();
    await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
    expect(viewer().queryByText(HINT)).toBeNull();
    await act(async () => setNetwork(OFFLINE));
    expect(viewer().getByText(HINT)).toBeTruthy();
  });

  it('shows while the photos load, too', async () => {
    await setup();
    setNetwork(OFFLINE);
    mockRepository = { ...mockRepository, photos: () => new Promise(() => {}) };
    await renderApp(viewerUrl(photoId(2)));
    await screen.findByTestId('photo-viewer-loading');
    expect(viewer().getByText(HINT)).toBeTruthy();
  });
});

describe('Photo viewer — stays on the photo in view when the list changes (trip-photos D34)', () => {
  /** An upload finishing in the strip makes the query read again; here the app coming to the foreground does the same. */
  const readAgain = () =>
    act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
  afterEach(() => focusManager.setFocused(undefined));

  it('a photo that sorts before the one in view moves the counter, not the picture', async () => {
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    const base = await setup();
    await openViewer(photoId(3));
    expect(viewer().getByText('3 z 12')).toBeTruthy();
    await base.addPhoto(tripId, photoId(50), { uri: 'file:///seed/50.jpg', takenAt: '2026-10-30T10:00' });
    await readAgain();
    expect(await viewer().findByText('4 z 13')).toBeTruthy();
    expect(shownUris()).toContain(urlOf(3));
    // The list is moved to the photo's new place at once, without a swipe animation.
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 3, animated: false });
  });

  it('a photo that sorts after the one in view changes only the total, and nothing scrolls', async () => {
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    const base = await setup();
    await openViewer(photoId(3));
    await base.addPhoto(tripId, photoId(50), { uri: 'file:///seed/50.jpg', takenAt: '2026-12-01T10:00' });
    await readAgain();
    expect(await viewer().findByText('3 z 13')).toBeTruthy();
    expect(shownUris()).toContain(urlOf(3));
    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it('follows the photo you swiped to, not the one the viewer opened on', async () => {
    const base = await setup();
    await openViewer(photoId(3));
    await swipeTo(5);
    expect(viewer().getByText('6 z 12')).toBeTruthy();
    await base.addPhoto(tripId, photoId(50), { uri: 'file:///seed/50.jpg', takenAt: '2026-10-30T10:00' });
    await readAgain();
    expect(await viewer().findByText('7 z 13')).toBeTruthy();
  });

  it('after a delete the viewer still follows the photo it moved to', async () => {
    const base = await setup();
    await openViewer(photoId(3));
    await fireEvent.press(viewer().getByRole('button', { name: 'Usuń zdjęcie' }));
    await fireEvent.press(within(await screen.findByTestId('bottom-sheet')).getByRole('button', { name: 'Usuń zdjęcie' }));
    expect(await viewer().findByText('3 z 11')).toBeTruthy();
    // The photo now in view is the old number 4; a photo sorting before it must move the counter.
    await base.addPhoto(tripId, photoId(50), { uri: 'file:///seed/50.jpg', takenAt: '2026-10-30T10:00' });
    await readAgain();
    expect(await viewer().findByText('4 z 12')).toBeTruthy();
    expect(shownUris()).toContain(urlOf(4));
  });
});

describe('Photo viewer — English', () => {
  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await setup();
    await openViewer();
    expect(viewer().getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(viewer().getByRole('button', { name: 'Delete photo' })).toBeTruthy();
    expect(viewer().getByText('3 of 12').props.accessibilityLabel).toBe('Photo 3 of 12');
    await fireEvent.press(viewer().getByRole('button', { name: 'Delete photo' }));
    expect(await screen.findByRole('header', { name: 'Delete this photo?' })).toBeTruthy();
    await act(async () => {
      fireEvent(imageOf(3)!, 'error', { nativeEvent: { error: 'x' } });
    });
    expect(viewer().getByText("Couldn't load the photo.")).toBeTruthy();
  });
});
