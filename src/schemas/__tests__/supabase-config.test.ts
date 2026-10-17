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

  describe('local Supabase over http (D36)', () => {
    it.each([
      'http://127.0.0.1:54321',
      'http://localhost:54321',
      'http://10.0.2.2:54321',
      'http://localhost',
    ])('accepts %s', (url) => {
      expect(SupabaseConfigSchema.safeParse({ ...valid, url }).success).toBe(true);
    });

    it.each([
      'http://10.0.2.3:54321',
      'http://192.168.1.10:54321',
      'http://localhost.evil.com',
      'http://127.0.0.1.nip.io',
      'ftp://127.0.0.1',
      'http://user@evil.com',
      'http://localhost@evil.com',
    ])('rejects %s', (url) => {
      expect(SupabaseConfigSchema.safeParse({ ...valid, url }).success).toBe(false);
    });

    it('reports a rejected local-looking URL on the url path', () => {
      const result = SupabaseConfigSchema.safeParse({ ...valid, url: 'http://10.0.2.3:54321' });
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toEqual([['url']]);
    });
  });
});
