// Tests never reach Supabase or the device's SQLite: the app's repository is the in-memory one,
// and the network is "online" unless a test says otherwise (src/test/mock-network.ts).
jest.mock('@/data/app-trip-repository', () => ({
  createAppTripRepository: () => jest.requireActual('@/data/trip-repository').createInMemoryTripRepository(),
}));
jest.mock('expo-network', () => jest.requireActual('@/test/mock-network').expoNetworkMock);

afterEach(() => {
  jest.requireActual('@/test/mock-network').resetNetwork();
});
