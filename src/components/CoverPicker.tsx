import { launchImageLibraryAsync } from 'expo-image-picker';
import { Check, ImagePlus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';

import { COVER_PRESETS, presetIdOf } from '@/lib/cover-presets';
import { COVER_PRESET_IDS, CoverChoiceSchema, type CoverChoice, type CoverUrls } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { CoverImage } from './CoverImage';
import { Field } from './Field';

type Props = {
  /** The chosen cover. Never empty: the wizard starts on `DEFAULT_COVER` (trip-covers D4). */
  value: string;
  onChange: (cover: CoverChoice) => void;
  /** Signed URLs of the trip's own gallery cover (`value` is `photo:…`); the picker shows that cover from them. */
  urls?: CoverUrls;
};

// Crop and preview shape of a cover photo (Android crops to it; iOS always crops square).
const ASPECT: [number, number] = [16, 9];
const RATIO = ASPECT[0] / ASPECT[1];
const { coverPicker, focusRing } = tokens.components;

// A cover is always chosen (trip-covers D1, P1): a large preview of the selected one, under it a row of tiles — a photo
// picked from the gallery first, then the bundled presets — and "Z galerii" as the last tile. The row is a radio group.
export function CoverPicker({ value, onChange, urls }: Props) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  // A gallery photo stays in the row after a preset is chosen over it, so the organizer can go back to it.
  const [remembered, setRemembered] = useState<string | null>(() => (presetIdOf(value) ? null : value));
  // A value that is not a valid cover (from before this feature) gets no tile of its own.
  const parsedCustom = CoverChoiceSchema.safeParse(presetIdOf(value) ? remembered : value);
  const custom = parsedCustom.success ? parsedCustom.data : null;
  // The row scrolls sideways, so a selected tile can be off screen when the picker opens: it is brought into view once,
  // without animation (nothing moves, so reduce motion needs no case). Later choices are taps on tiles already in view.
  const row = useRef<ScrollView>(null);
  const opened = useRef(false);

  function showSelected(event: LayoutChangeEvent) {
    if (opened.current) return;
    opened.current = true;
    row.current?.scrollTo({ x: event.nativeEvent.layout.x, animated: false });
  }

  async function pick() {
    setFailed(false);
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: ASPECT, quality: 0.8 });
      if (result.canceled) return;
      // The picker's uri is a boundary: only a file on the phone is a cover that can be sent later.
      const picked = CoverChoiceSchema.safeParse(result.assets[0].uri);
      if (!picked.success) {
        setFailed(true);
        return;
      }
      setRemembered(picked.data);
      onChange(picked.data);
      // The picked photo is the first tile, and the row may be scrolled to "Z galerii" at the far end.
      opened.current = true;
      row.current?.scrollTo({ x: 0, animated: false });
    } catch {
      setFailed(true);
    }
  }

  return (
    <Field label={t('coverPicker.label')} error={failed ? t('coverPicker.error') : undefined}>
      <View style={{ gap: tokens.spacing[2] }}>
        <CoverImage
          testID="cover-preview"
          cover={value}
          urls={urls}
          variant="full"
          // One radius for the whole picker: radii.sm, the same for the preview and the tiles.
          style={{ width: '100%', aspectRatio: RATIO, borderRadius: tokens.radii.sm }}
        />
        <View accessibilityRole="radiogroup" accessibilityLabel={t('coverPicker.label')}>
          <ScrollView ref={row} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.spacing[2] }}>
            {custom && (
              <CoverTile cover={custom} urls={urls} label={t('coverPicker.yourPhoto')} checked={custom === value} onLayout={showSelected} onPress={() => onChange(custom)} />
            )}
            {COVER_PRESET_IDS.map((id) => (
              <CoverTile
                key={id}
                cover={`preset:${id}`}
                label={t(COVER_PRESETS[id].nameKey)}
                checked={value === `preset:${id}`}
                onLayout={showSelected}
                onPress={() => onChange(`preset:${id}`)}
              />
            ))}
            <GalleryTile label={t('coverPicker.gallery')} onPress={pick} />
          </ScrollView>
        </View>
      </View>
    </Field>
  );
}

// Every tile has the same 2dp border, transparent unless selected, so choosing one does not move the others.
const tile = {
  width: coverPicker.tileWidth,
  minHeight: coverPicker.tileWidth / RATIO,
  borderWidth: focusRing.width,
  borderRadius: tokens.radii.sm,
  overflow: 'hidden' as const,
};

function focusOutline(theme: ReturnType<typeof useTheme>) {
  return {
    outlineStyle: 'solid' as const,
    outlineWidth: focusRing.width,
    outlineColor: theme.border.focus,
    outlineOffset: focusRing.offset,
  };
}

type TileProps = {
  cover: string;
  urls?: CoverUrls;
  label: string;
  checked: boolean;
  onPress: () => void;
  /** Reported only while the tile is the selected one. */
  onLayout: (event: LayoutChangeEvent) => void;
};

// One radio of the group: the selected tile has a brand border and a check mark, never colour alone (§15).
function CoverTile({ cover, urls, label, checked, onPress, onLayout }: TileProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      onLayout={checked ? onLayout : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        tile,
        {
          borderColor: checked ? (pressed ? theme.brand.pressed : theme.brand.primary) : pressed ? theme.border.default : 'transparent',
        },
        focused && focusOutline(theme),
      ]}
    >
      <CoverImage testID="cover-tile-image" cover={cover} urls={urls} variant="thumbnail" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
      {checked && (
        <View
          style={{
            position: 'absolute',
            top: tokens.spacing[1],
            right: tokens.spacing[1],
            padding: tokens.spacing[1],
            borderRadius: tokens.radii.pill,
            backgroundColor: theme.brand.primary,
          }}
        >
          <Check
            testID="cover-tile-check"
            size={tokens.iconography.size.xs}
            strokeWidth={tokens.iconography.strokeWidth}
            color={theme.brand.onBrand}
            aria-hidden
          />
        </View>
      )}
    </Pressable>
  );
}

// The last tile: opens the phone's gallery.
function GalleryTile({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        tile,
        {
          alignItems: 'center',
          justifyContent: 'center',
          gap: tokens.spacing[1],
          paddingHorizontal: tokens.spacing[1],
          borderColor: theme.border.default,
          backgroundColor: pressed ? theme.background.sunken : theme.surface.primary,
        },
        focused && focusOutline(theme),
      ]}
    >
      <ImagePlus
        testID="cover-gallery-icon"
        size={tokens.iconography.size.sm}
        strokeWidth={tokens.iconography.strokeWidth}
        color={theme.icon.primary}
        aria-hidden
      />
      <Text style={[tokens.typography.styles.caption, { color: theme.text.primary, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
}
