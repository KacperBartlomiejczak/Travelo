import { RevenueCatConfigSchema } from '../revenuecat-config';

describe('RevenueCatConfigSchema', () => {
  it.each(['test_abc123', 'appl_AbC123', 'goog_AbC123'])('accepts the public SDK key %s', (apiKey) => {
    expect(RevenueCatConfigSchema.safeParse({ apiKey }).success).toBe(true);
  });

  it.each(['sb_publishable_x', 'sk_secret123', 'appl_', 'appl_a-b', '', 'test'])('rejects %j', (apiKey) => {
    expect(RevenueCatConfigSchema.safeParse({ apiKey }).success).toBe(false);
  });

  it('rejects a missing key', () => {
    expect(RevenueCatConfigSchema.safeParse({}).success).toBe(false);
  });
});
