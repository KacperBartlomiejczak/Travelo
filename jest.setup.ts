// Tests never reach Supabase or the device's SQLite: the app's repository is the in-memory one,
// and the network is "online" unless a test says otherwise (src/test/mock-network.ts).
jest.mock('@/data/app-trip-repository', () => ({
  createAppTripRepository: () => jest.requireActual('@/data/trip-repository').createInMemoryTripRepository(),
}));
// Sign-in (auth-onboarding step 5): the app is signed in with a profile unless a test says otherwise, so route tests land on / as before.
// A test picks another state with useFakeAppSession() / setAppProfileRepository() before it renders (src/test/fake-session-source.ts, fake-profile-repository.ts).
jest.mock('@/data/app-session-source', () => ({
  appSessionSource: jest.requireActual('@/test/fake-session-source').delegatingSessionSource,
}));
jest.mock('@/data/app-profile-repository', () => ({
  createAppProfileRepository: () => jest.requireActual('@/test/fake-profile-repository').delegatingProfileRepository,
}));
// The sign-in screens (auth-onboarding step 6) import the app's auth, which builds the Supabase client and opens the system
// browser: tests never reach either. A test that needs a sign-in to succeed or fail mocks `@/data/app-auth` itself.
jest.mock('@/data/app-auth', () => ({
  appAuth: {
    signInWithProvider: jest.fn(async () => 'cancelled'),
    sendEmailCode: jest.fn(async () => {}),
    verifyEmailCode: jest.fn(async () => {}),
  },
}));
// The profile setup (theme-split-and-profile-prefill step 6) pre-fills from the Google / Discord sign-in through the app's Supabase client and the
// device's file system: tests never reach either. By default there is no suggestion (an e-mail user); a test that wants one sets `read` / `downloadAvatar` itself.
jest.mock('@/data/app-provider-profile', () => ({
  appProviderProfile: {
    read: jest.fn(async () => ({ suggestedUsername: null, avatarUrl: null })),
    downloadAvatar: jest.fn(async () => {
      throw new Error('No photo to download in this test');
    }),
  },
}));
// Route tests wait for the gate to leave its loading view after rendering (src/test/settle-gate.ts).
jest.mock('expo-router/testing-library', () => {
  const testingLibrary = jest.requireActual('expo-router/testing-library');
  jest.requireActual('@/test/settle-gate').settleGateAfterRender(testingLibrary);
  return testingLibrary;
});
jest.mock('expo-network', () => jest.requireActual('@/test/mock-network').expoNetworkMock);

// The side panel (expo-router/drawer, trips-drawer) runs on gesture-handler and Reanimated, which have no native
// side in Jest: their own test mocks stand in. Gestures and animations themselves are checked on a device.
import 'react-native-gesture-handler/jestSetup';
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

// Trip photos (trip-photos): the image manipulator and the file system have no native side in Jest. These are minimal
// stand-ins of the API the photo code uses (`ImageManipulator.manipulate(uri | image).resize().renderAsync()`, then
// `.saveAsync()` and `.release()` on the context and the image, and `new File(uri).bytes()`); tests override them per
// test with `mockResolvedValue` / `mockReturnValue`.
// What the real modules do to a file (re-encoding, dropping EXIF) is checked on a device.
jest.mock('expo-image-manipulator', () => {
  const createContext = () => {
    const context = {
      release: jest.fn(),
      resize: jest.fn(),
      renderAsync: jest.fn(async () => ({
        width: 1024,
        height: 768,
        release: jest.fn(),
        saveAsync: jest.fn(async () => ({ uri: 'file:///mock/manipulated.jpg', width: 1024, height: 768 })),
      })),
    };
    context.resize.mockReturnValue(context);
    return context;
  };
  return {
    ImageManipulator: { manipulate: jest.fn(createContext) },
    SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  };
});
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
  }
  Object.assign(File.prototype, { bytes: jest.fn(async () => new Uint8Array([1, 2, 3])) });
  return { File };
});

// The splash animation (splash-animation step 4) plays in a native Lottie view, which has no native side in Jest. This stand-in is a
// host View that passes every prop through, so a test reads `autoPlay`, `loop`, `progress`, `colorFilters` and triggers
// `onAnimationFinish`. `play` is on the prototype, so a test can spy on it. How the real animation looks is checked on a device.
jest.mock('lottie-react-native', () => {
  const { Component, createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  class MockLottieView extends Component<Record<string, unknown>> {
    play() {}
    reset() {}
    pause() {}
    resume() {}
    render() {
      return createElement(View, { testID: 'splash-lottie', ...this.props });
    }
  }
  return { __esModule: true, default: MockLottieView };
});

afterEach(async () => {
  // A test that signed out with a fake session closed the user epoch for good; open it for the next test.
  const epoch = jest.requireActual('@/data/local-store');
  if (!epoch.isEpochCurrent(epoch.currentUserEpoch())) await jest.requireActual('@/test/user-epoch').reopenUserEpoch();
  jest.requireActual('@/test/mock-network').resetNetwork();
  jest.requireActual('@/test/fake-session-source').resetFakeAppSession();
  jest.requireActual('@/test/settle-gate').resetGateAllowance();
  jest.requireActual('@/test/fake-profile-repository').resetAppProfileRepository();
});
