import { LanguagePreferenceSchema, ThemePreferenceSchema } from '@/schemas';

describe('ThemePreferenceSchema', () => {
  it.each(['system', 'light', 'dark'])('accepts %s', (value) => {
    expect(ThemePreferenceSchema.safeParse(value).success).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(ThemePreferenceSchema.safeParse('pl').success).toBe(false);
    expect(ThemePreferenceSchema.safeParse('').success).toBe(false);
    expect(ThemePreferenceSchema.safeParse(undefined).success).toBe(false);
  });
});

describe('LanguagePreferenceSchema', () => {
  it.each(['system', 'pl', 'en'])('accepts %s', (value) => {
    expect(LanguagePreferenceSchema.safeParse(value).success).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(LanguagePreferenceSchema.safeParse('dark').success).toBe(false);
    expect(LanguagePreferenceSchema.safeParse('de').success).toBe(false);
    expect(LanguagePreferenceSchema.safeParse(null).success).toBe(false);
  });
});
