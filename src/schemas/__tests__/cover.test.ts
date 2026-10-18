import { COVER_PRESET_IDS, CoverChoiceSchema, CoverPresetIdSchema, CoverSchema, CoverUrlsSchema, DEFAULT_COVER } from '@/schemas';

const UUID = '3f2b8c1e-5a4d-4e7f-9b6a-1c2d3e4f5a6b';
const PHOTO_COVER = `photo:${UUID}`;
const URL = `https://abc.supabase.co/storage/v1/object/sign/trip-photos/trip/${UUID}.jpg?token=abc`;
const THUMBNAIL_URL = `https://abc.supabase.co/storage/v1/object/sign/trip-photos/trip/${UUID}_thumb.jpg?token=abc`;

const INVALID_COVERS = [
  'preset:paris',
  'preset:',
  'preset:Auckland',
  'preset:auckland ',
  `photo:${UUID.toUpperCase()}`,
  'photo:3f2b8c1e-5a4d-4e7f-9b6a',
  `photo:${UUID}x`,
  'photo:',
  '',
  'https://example.com/a.jpg',
  'content://media/external/images/1',
  'file:///data/user/0/x.jpg',
];

describe('CoverPresetId', () => {
  it('lists the five bundled presets', () => {
    expect([...COVER_PRESET_IDS]).toEqual(['auckland', 'bali', 'beijing', 'jakarta', 'majorka']);
  });

  it.each(COVER_PRESET_IDS)('accepts %p', (id) => {
    expect(CoverPresetIdSchema.safeParse(id).success).toBe(true);
  });

  it('rejects an unknown id', () => {
    expect(CoverPresetIdSchema.safeParse('paris').success).toBe(false);
  });
});

describe('Cover', () => {
  it.each(COVER_PRESET_IDS)('accepts preset:%s', (id) => {
    expect(CoverSchema.parse(`preset:${id}`)).toBe(`preset:${id}`);
  });

  it('accepts photo:<lowercase uuid>', () => {
    expect(CoverSchema.parse(PHOTO_COVER)).toBe(PHOTO_COVER);
  });

  it.each(INVALID_COVERS)('rejects %p', (value) => {
    expect(CoverSchema.safeParse(value).success).toBe(false);
  });

  it.each([undefined, null, 5, {}])('rejects the non-string %p', (value) => {
    expect(CoverSchema.safeParse(value).success).toBe(false);
  });
});

describe('DEFAULT_COVER', () => {
  it('is a preset that parses as a Cover', () => {
    expect(CoverSchema.safeParse(DEFAULT_COVER).success).toBe(true);
    expect(DEFAULT_COVER.startsWith('preset:')).toBe(true);
  });
});

describe('CoverChoice', () => {
  it.each(COVER_PRESET_IDS)('accepts preset:%s', (id) => {
    expect(CoverChoiceSchema.safeParse(`preset:${id}`).success).toBe(true);
  });

  it('accepts a stored gallery cover', () => {
    expect(CoverChoiceSchema.safeParse(PHOTO_COVER).success).toBe(true);
  });

  it('accepts a picked gallery photo', () => {
    expect(CoverChoiceSchema.parse('file:///data/user/0/x.jpg')).toBe('file:///data/user/0/x.jpg');
  });

  it('accepts a picked photo whose path contains a space (the picker typings do not promise URL-encoding)', () => {
    expect(CoverChoiceSchema.safeParse('file:///Users/Jan Kowalski/cache/x.jpg').success).toBe(true);
  });

  it.each(['file://   ', 'file://\t', 'file://x\n', 'file://x\r\n', 'file://\nx', 'file://x\ny', 'file:// x.jpg', 'file://x.jpg '])(
    'rejects the picked photo %p with only whitespace, line breaks or edge whitespace',
    (value) => {
      expect(CoverChoiceSchema.safeParse(value).success).toBe(false);
    },
  );

  it.each(['file://', 'content://media/external/images/1', 'https://example.com/a.jpg', '', 'preset:paris', `photo:${UUID.toUpperCase()}`])(
    'rejects %p',
    (value) => {
      expect(CoverChoiceSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('CoverUrls', () => {
  const urls = { url: URL, thumbnailUrl: THUMBNAIL_URL };

  it('accepts https URLs', () => {
    expect(CoverUrlsSchema.parse(urls)).toEqual(urls);
  });

  it('accepts local http URLs', () => {
    const local = { url: 'http://127.0.0.1:54321/a.jpg', thumbnailUrl: 'http://127.0.0.1:54321/a_thumb.jpg' };
    expect(CoverUrlsSchema.safeParse(local).success).toBe(true);
  });

  it.each(['file:///data/user/0/x.jpg', 'javascript:alert(1)', 'data:image/jpeg;base64,AAAA'])('rejects %p as url', (bad) => {
    expect(CoverUrlsSchema.safeParse({ ...urls, url: bad }).success).toBe(false);
    expect(CoverUrlsSchema.safeParse({ ...urls, thumbnailUrl: bad }).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(CoverUrlsSchema.safeParse({ url: URL }).success).toBe(false);
    expect(CoverUrlsSchema.safeParse({ thumbnailUrl: THUMBNAIL_URL }).success).toBe(false);
  });
});
