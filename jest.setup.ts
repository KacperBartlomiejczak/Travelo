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

afterEach(() => {
  jest.requireActual('@/test/mock-network').resetNetwork();
});
