import {
  CoverChoiceSchema,
  CoverPresetIdSchema,
  DEFAULT_COVER,
  type CoverChoice,
  type CoverPresetId,
  type CoverUrls,
} from '@/schemas';

/** A bundled image (what `require` of an image gives) or a file/URL, with the key the disk cache stores it under. */
export type CoverSource = number | { uri: string; cacheKey?: string };

export type CoverVariant = 'full' | 'thumbnail';

type CoverPreset = { full: number; thumbnail: number; nameKey: string };

// The preset photos bundled in the app (trip-covers D6): `assets/covers/` holds a full file and a thumbnail per id
// (C1). A `Record` over the ids, so a new id in the schema fails the typecheck until its files and name are added here.
export const COVER_PRESETS: Record<CoverPresetId, CoverPreset> = {
  auckland: {
    full: require('../../assets/covers/auckland.jpg'),
    thumbnail: require('../../assets/covers/auckland_thumb.jpg'),
    nameKey: 'coverPicker.presets.auckland',
  },
  bali: {
    full: require('../../assets/covers/bali.jpg'),
    thumbnail: require('../../assets/covers/bali_thumb.jpg'),
    nameKey: 'coverPicker.presets.bali',
  },
  beijing: {
    full: require('../../assets/covers/beijing.jpg'),
    thumbnail: require('../../assets/covers/beijing_thumb.jpg'),
    nameKey: 'coverPicker.presets.beijing',
  },
  jakarta: {
    full: require('../../assets/covers/jakarta.jpg'),
    thumbnail: require('../../assets/covers/jakarta_thumb.jpg'),
    nameKey: 'coverPicker.presets.jakarta',
  },
  majorka: {
    full: require('../../assets/covers/majorka.jpg'),
    thumbnail: require('../../assets/covers/majorka_thumb.jpg'),
    nameKey: 'coverPicker.presets.majorka',
  },
};

const PRESET_PREFIX = 'preset:';
const PHOTO_PREFIX = 'photo:';

/** The id of a `preset:<id>` cover; null for any other value. */
export function presetIdOf(cover: string): CoverPresetId | null {
  if (!cover.startsWith(PRESET_PREFIX)) return null;
  const id = CoverPresetIdSchema.safeParse(cover.slice(PRESET_PREFIX.length));
  return id.success ? id.data : null;
}

// DEFAULT_COVER is a preset by definition (trip-covers D7); parsing here makes a mistake there fail at once.
const DEFAULT_PRESET_ID = CoverPresetIdSchema.parse(DEFAULT_COVER.slice(PRESET_PREFIX.length));

function defaultPreset(variant: CoverVariant): { source: CoverSource; isDefault: true } {
  return { source: COVER_PRESETS[DEFAULT_PRESET_ID][variant], isDefault: true };
}

/**
 * What to draw for a cover (trip-covers C3). A value that is not a valid cover (e.g. a device URI from before this
 * feature) and a gallery cover whose URLs are not known both show the default preset. `isDefault` says the result is
 * that default, so a failing default is not retried.
 */
export function resolveCoverSource(
  cover: string,
  urls: CoverUrls | undefined,
  variant: CoverVariant,
): { source: CoverSource; isDefault: boolean } {
  const parsed = CoverChoiceSchema.safeParse(cover);
  if (!parsed.success) return defaultPreset(variant);
  const choice: CoverChoice = parsed.data;

  const presetId = presetIdOf(choice);
  if (presetId) return { source: COVER_PRESETS[presetId][variant], isDefault: choice === DEFAULT_COVER };

  if (choice.startsWith(PHOTO_PREFIX)) {
    if (!urls) return defaultPreset(variant);
    // The key is the cover's own id, not the signed URL: the URL changes every time it is signed (trip-photos D8).
    return {
      source: { uri: variant === 'full' ? urls.url : urls.thumbnailUrl, cacheKey: `cover:${choice.slice(PHOTO_PREFIX.length)}:${variant}` },
      isDefault: false,
    };
  }

  return { source: { uri: choice }, isDefault: false };
}
