import { DeleteAccountErrorSchema, DeleteAccountInputSchema, DeleteAccountResultSchema } from '@/schemas';

describe('DeleteAccountInputSchema', () => {
  it('accepts a username of 1 to 64 characters', () => {
    expect(DeleteAccountInputSchema.safeParse({ confirmUsername: 'kacper_b' }).success).toBe(true);
    expect(DeleteAccountInputSchema.safeParse({ confirmUsername: 'a'.repeat(64) }).success).toBe(true);
  });

  it('rejects empty, too long, missing and non-string values', () => {
    expect(DeleteAccountInputSchema.safeParse({ confirmUsername: '' }).success).toBe(false);
    expect(DeleteAccountInputSchema.safeParse({ confirmUsername: 'a'.repeat(65) }).success).toBe(false);
    expect(DeleteAccountInputSchema.safeParse({}).success).toBe(false);
    expect(DeleteAccountInputSchema.safeParse({ confirmUsername: 5 }).success).toBe(false);
  });
});

describe('DeleteAccountResultSchema', () => {
  it('accepts only { deleted: true }', () => {
    expect(DeleteAccountResultSchema.safeParse({ deleted: true }).success).toBe(true);
    expect(DeleteAccountResultSchema.safeParse({ deleted: false }).success).toBe(false);
    expect(DeleteAccountResultSchema.safeParse({}).success).toBe(false);
  });
});

describe('DeleteAccountErrorSchema', () => {
  it.each(['invalid_input', 'unauthorized', 'username_mismatch', 'storage_failed', 'auth_failed'])(
    'accepts %s',
    (error) => {
      expect(DeleteAccountErrorSchema.safeParse({ error }).success).toBe(true);
    },
  );

  it('rejects unknown or missing codes', () => {
    expect(DeleteAccountErrorSchema.safeParse({ error: 'boom' }).success).toBe(false);
    expect(DeleteAccountErrorSchema.safeParse({}).success).toBe(false);
  });
});
