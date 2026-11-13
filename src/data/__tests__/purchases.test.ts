import Purchases from 'react-native-purchases';

const KEY = 'test_abc123';

function load(apiKey?: string) {
  if (apiKey === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  else process.env.EXPO_PUBLIC_REVENUECAT_API_KEY = apiKey;
  let mod!: typeof import('@/data/purchases');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/data/purchases');
  });
  return mod;
}

describe('configurePurchases', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('configures the SDK once with the key, even when called twice', () => {
    const { configurePurchases } = load(KEY);
    configurePurchases();
    configurePurchases();
    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: KEY });
  });

  it('names the missing variable', () => {
    const { configurePurchases } = load(undefined);
    expect(() => configurePurchases()).toThrow('EXPO_PUBLIC_REVENUECAT_API_KEY');
    expect(Purchases.configure).not.toHaveBeenCalled();
  });

  it('refuses an invalid key without echoing its value', () => {
    const { configurePurchases } = load('sb_publishable_x');
    expect(() => configurePurchases()).toThrow('EXPO_PUBLIC_REVENUECAT_API_KEY');
    expect(() => configurePurchases()).toThrow(expect.not.stringContaining('sb_publishable_x'));
    expect(Purchases.configure).not.toHaveBeenCalled();
  });
});
