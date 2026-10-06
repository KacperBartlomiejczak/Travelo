import { SupabaseConfigSchema } from '@/schemas';

const valid = {
  url: 'https://example.supabase.co',
  key: 'sb_publishable_test',
};

describe('SupabaseConfig', () => {
  it('accepts a project URL with a publishable key', () => {
    expect(SupabaseConfigSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['a missing URL', { ...valid, url: undefined }],
    ['a string that is not a URL', { ...valid, url: 'example.supabase.co' }],
    ['an http URL', { ...valid, url: 'http://example.supabase.co' }],
    ['a missing key', { ...valid, key: undefined }],
    ['an empty key', { ...valid, key: '' }],
    ['a secret key', { ...valid, key: 'sb_secret_abc123' }],
  ])('rejects %s', (_, config) => {
    expect(SupabaseConfigSchema.safeParse(config).success).toBe(false);
  });
});
