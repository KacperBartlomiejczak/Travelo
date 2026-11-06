import { LegalDocSchema, LegalDocumentSchema } from '../legal';
import en from '@/i18n/locales/en.json';
import pl from '@/i18n/locales/pl.json';

function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [prefix, ...value.flatMap((item, i) => keyPaths(item, `${prefix}[${i}]`))];
  if (typeof value === 'object' && value !== null) return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

describe('legal schemas', () => {
  it('accepts privacy and terms only', () => {
    expect(LegalDocSchema.safeParse('privacy').success).toBe(true);
    expect(LegalDocSchema.safeParse('terms').success).toBe(true);
    expect(LegalDocSchema.safeParse('foo').success).toBe(false);
  });

  it('rejects a document without sections', () => {
    expect(LegalDocumentSchema.safeParse({ title: 'x', updated: 'y', sections: [] }).success).toBe(false);
    expect(LegalDocumentSchema.safeParse({ title: 'x' }).success).toBe(false);
  });

  it.each(['privacy', 'terms'] as const)('%s parses in both languages with the same number of sections', (doc) => {
    const parsedPl = LegalDocumentSchema.parse(pl.legal[doc]);
    const parsedEn = LegalDocumentSchema.parse(en.legal[doc]);
    expect(parsedPl.sections).toHaveLength(parsedEn.sections.length);
    parsedPl.sections.forEach((s, i) => expect(s.paragraphs).toHaveLength(parsedEn.sections[i].paragraphs.length));
  });

  it('every legal key path exists in both dictionaries', () => {
    expect(keyPaths(pl.legal)).toEqual(keyPaths(en.legal));
  });
});
