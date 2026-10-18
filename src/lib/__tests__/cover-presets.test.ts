import { COVER_PRESET_IDS, DEFAULT_COVER } from '@/schemas';
import en from '@/i18n/locales/en.json';
import pl from '@/i18n/locales/pl.json';

import { COVER_PRESETS, presetIdOf, resolveCoverSource } from '../cover-presets';

// Jest turns every image into the number 1, so each file is stood in by a distinct object.
jest.mock('../../../assets/covers/auckland.jpg', () => ({ uri: 'bundled/auckland.jpg' }));
jest.mock('../../../assets/covers/auckland_thumb.jpg', () => ({ uri: 'bundled/auckland_thumb.jpg' }));
jest.mock('../../../assets/covers/bali.jpg', () => ({ uri: 'bundled/bali.jpg' }));
jest.mock('../../../assets/covers/bali_thumb.jpg', () => ({ uri: 'bundled/bali_thumb.jpg' }));
jest.mock('../../../assets/covers/beijing.jpg', () => ({ uri: 'bundled/beijing.jpg' }));
jest.mock('../../../assets/covers/beijing_thumb.jpg', () => ({ uri: 'bundled/beijing_thumb.jpg' }));
jest.mock('../../../assets/covers/jakarta.jpg', () => ({ uri: 'bundled/jakarta.jpg' }));
jest.mock('../../../assets/covers/jakarta_thumb.jpg', () => ({ uri: 'bundled/jakarta_thumb.jpg' }));
jest.mock('../../../assets/covers/majorka.jpg', () => ({ uri: 'bundled/majorka.jpg' }));
jest.mock('../../../assets/covers/majorka_thumb.jpg', () => ({ uri: 'bundled/majorka_thumb.jpg' }));

const UUID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const URLS = { url: 'https://x.supabase.co/full?token=a', thumbnailUrl: 'https://x.supabase.co/thumb?token=a' };

describe('COVER_PRESETS', () => {
  it('has a full file, a thumbnail and a name in both languages for every preset id', () => {
    for (const id of COVER_PRESET_IDS) {
      const preset = COVER_PRESETS[id];
      expect(preset.full).toEqual({ uri: `bundled/${id}.jpg` });
      expect(preset.thumbnail).toEqual({ uri: `bundled/${id}_thumb.jpg` });
      const key = preset.nameKey.replace(/^coverPicker\.presets\./, '');
      expect(preset.nameKey).toBe(`coverPicker.presets.${id}`);
      expect((pl.coverPicker.presets as Record<string, string>)[key]).toBeTruthy();
      expect((en.coverPicker.presets as Record<string, string>)[key]).toBeTruthy();
    }
  });

  it('names the presets as Kacper approved (Q2)', () => {
    expect(pl.coverPicker.presets).toEqual({
      auckland: 'Auckland',
      bali: 'Bali',
      beijing: 'Pekin',
      jakarta: 'Dżakarta',
      majorka: 'Majorka',
    });
    expect(en.coverPicker.presets).toEqual({
      auckland: 'Auckland',
      bali: 'Bali',
      beijing: 'Beijing',
      jakarta: 'Jakarta',
      majorka: 'Mallorca',
    });
  });
});

describe('presetIdOf', () => {
  it('reads the id of a preset cover and nothing else', () => {
    expect(presetIdOf('preset:bali')).toBe('bali');
    expect(presetIdOf(`photo:${UUID}`)).toBeNull();
    expect(presetIdOf('file:///cache/a.jpg')).toBeNull();
    expect(presetIdOf('preset:nowhere')).toBeNull();
    expect(presetIdOf('garbage')).toBeNull();
  });
});

describe('resolveCoverSource', () => {
  it('shows a preset from the bundled file, or its thumbnail', () => {
    expect(resolveCoverSource('preset:bali', undefined, 'full')).toEqual({ source: { uri: 'bundled/bali.jpg' }, isDefault: false });
    expect(resolveCoverSource('preset:bali', undefined, 'thumbnail')).toEqual({ source: { uri: 'bundled/bali_thumb.jpg' }, isDefault: false });
  });

  it('marks the default preset, so a failing default is not retried', () => {
    expect(resolveCoverSource(DEFAULT_COVER, undefined, 'full').isDefault).toBe(true);
  });

  it('shows a gallery cover from its signed URL with a cache key made of its id and the variant', () => {
    expect(resolveCoverSource(`photo:${UUID}`, URLS, 'full')).toEqual({
      source: { uri: URLS.url, cacheKey: `cover:${UUID}:full` },
      isDefault: false,
    });
    expect(resolveCoverSource(`photo:${UUID}`, URLS, 'thumbnail')).toEqual({
      source: { uri: URLS.thumbnailUrl, cacheKey: `cover:${UUID}:thumbnail` },
      isDefault: false,
    });
  });

  it('shows the default preset for a gallery cover whose URLs are not known', () => {
    expect(resolveCoverSource(`photo:${UUID}`, undefined, 'full')).toEqual({ source: { uri: 'bundled/auckland.jpg' }, isDefault: true });
  });

  it('shows a photo picked on this phone from its file', () => {
    expect(resolveCoverSource('file:///cache/cover.jpg', undefined, 'thumbnail')).toEqual({
      source: { uri: 'file:///cache/cover.jpg' },
      isDefault: false,
    });
  });

  it('falls back to the default preset for a value from before this feature', () => {
    for (const legacy of ['content://media/1', 'https://example.com/a.jpg', '', 'preset:nowhere', `photo:${UUID.toUpperCase()}`]) {
      expect(resolveCoverSource(legacy, undefined, 'full')).toEqual({ source: { uri: 'bundled/auckland.jpg' }, isDefault: true });
    }
  });
});
