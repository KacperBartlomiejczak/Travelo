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

  it('carries the 20 Nov 2026 version and the ticket-import wording in both languages', () => {
    expect(pl.legal.privacy.updated).toBe('Wersja z 20 listopada 2026 r.');
    expect(pl.legal.terms.updated).toBe('Wersja z 20 listopada 2026 r.');
    expect(en.legal.privacy.updated).toBe('Version of 20 November 2026');
    expect(en.legal.terms.updated).toBe('Version of 20 November 2026');
    expect(pl.legal.privacy.sections.some((s) => s.heading === '2.8 Import biletu lotniczego')).toBe(true);
    expect(en.legal.privacy.sections.some((s) => s.heading === '2.8 Flight ticket import')).toBe(true);
    const sec = (l: typeof pl, h: string) => l.legal.privacy.sections.find((s) => s.heading.startsWith(h))?.paragraphs ?? [];
    expect(sec(pl, '2.7').at(-1)).toMatch(/^Aplikacja nie używa/);
    expect(sec(en, '2.7').at(-1)).toMatch(/^The App does not use/);
    expect(sec(pl, '2.8').some((p) => p.startsWith('Aplikacja nie używa'))).toBe(false);
    expect(sec(en, '2.8').some((p) => p.startsWith('The App does not use'))).toBe(false);
    const terms6 = (l: typeof pl) => l.legal.terms.sections.find((s) => s.heading.startsWith('6.'))?.paragraphs ?? [];
    expect(terms6(pl).some((p) => p.startsWith('6. Import biletu'))).toBe(true);
    expect(terms6(en).some((p) => p.startsWith('6. Ticket import'))).toBe(true);
  });
});
