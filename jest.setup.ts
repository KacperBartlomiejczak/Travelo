// Tests never reach Supabase or the device's SQLite: the app's repository is the in-memory one,
// and the network is "online" unless a test says otherwise (src/test/mock-network.ts).
jest.mock('@/data/app-trip-repository', () => ({
  createAppTripRepository: () => jest.requireActual('@/data/trip-repository').createInMemoryTripRepository(),
}));
jest.mock('expo-network', () => jest.requireActual('@/test/mock-network').expoNetworkMock);

// The side panel (expo-router/drawer, trips-drawer) runs on gesture-handler and Reanimated, which have no native
// side in Jest: their own test mocks stand in. Gestures and animations themselves are checked on a device.
import 'react-native-gesture-handler/jestSetup';
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

// Trip photos (trip-photos): the image manipulator and the file system have no native side in Jest. These are minimal
// stand-ins of the API the photo code uses (`ImageManipulator.manipulate(uri).resize().renderAsync()` then
// `.saveAsync()`, and `new File(uri).bytes()`); tests override them per test with `mockResolvedValue` / `mockReturnValue`.
// What the real modules do to a file (re-encoding, dropping EXIF) is checked on a device.
jest.mock('expo-image-manipulator', () => {
  const createContext = () => {
    const context = {
      resize: jest.fn(),
      renderAsync: jest.fn(async () => ({
        width: 1024,
        height: 768,
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

afterEach(() => {
  jest.requireActual('@/test/mock-network').resetNetwork();
});
