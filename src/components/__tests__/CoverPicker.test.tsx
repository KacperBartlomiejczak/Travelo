import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { CoverPicker } from '@/components/CoverPicker';
import i18n from '@/i18n';
import { COVER_PRESET_IDS, DEFAULT_COVER } from '@/schemas';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { coverPicker, focusRing } = tokens.components;
const flat = (element: ReturnType<typeof screen.getByRole>) => StyleSheet.flatten(element.props.style);

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const launch = jest.mocked(launchImageLibraryAsync);

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
const PL_NAMES = ['Auckland', 'Bali', 'Pekin', 'Dżakarta', 'Majorka'];
const hidden = { includeHiddenElements: true };

const picked = (uri: string) => ({ canceled: false as const, assets: [{ uri, width: 1600, height: 900 }] });
const tiles = () => screen.getAllByRole('radio');
const scrollTo = () => jest.mocked(ScrollView.prototype.scrollTo);
// A tile's position in the row, as the native layout would report it.
const layOut = (tile: ReturnType<typeof screen.getByRole>, x: number) =>
  fireEvent(tile, 'layout', { nativeEvent: { layout: { x, y: 0, width: 112, height: 63 } } });

beforeEach(async () => {
  launch.mockReset();
  scrollTo().mockClear();
  await i18n.changeLanguage('pl');
});

describe('CoverPicker (trip-covers P1)', () => {
  it('is a required field: the label is not marked optional', async () => {
    await render(<CoverPicker value={DEFAULT_COVER} onChange={() => {}} />);
    expect(screen.getByText('Zdjęcie okładki')).toBeTruthy();
    expect(screen.queryByText(/opcjonalnie/)).toBeNull();
  });

  it('is a radio group with one tile per preset, in order, then a gallery button', async () => {
    await render(<CoverPicker value={DEFAULT_COVER} onChange={() => {}} />);
    // Like the other radio groups: not itself an accessibility element, so it is found by its label.
    const group = screen.getByLabelText('Zdjęcie okładki');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(within(group).getAllByRole('radio').map((tile) => tile.props.accessibilityLabel)).toEqual(PL_NAMES);
    expect(COVER_PRESET_IDS).toHaveLength(PL_NAMES.length);
    expect(within(group).getByRole('button', { name: 'Z galerii' })).toBeTruthy();
  });

  it('marks the selected preset as checked, and only that one', async () => {
    await render(<CoverPicker value="preset:bali" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Bali', checked: true })).toBeTruthy();
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Auckland', checked: false })).toBeTruthy();
  });

  it('marks the selection with a check badge too, not by the border colour alone', async () => {
    await render(<CoverPicker value="preset:bali" onChange={() => {}} />);
    const selected = screen.getByRole('radio', { name: 'Bali' });
    expect(within(selected).getByTestId('cover-tile-check', hidden)).toBeTruthy();
    expect(selected).toHaveStyle({ borderColor: lightTheme.brand.primary, borderWidth: focusRing.width });
    expect(within(selected).getByTestId('cover-tile-check', hidden).props.stroke).toBe(lightTheme.brand.onBrand);
    const other = screen.getByRole('radio', { name: 'Auckland' });
    expect(within(other).queryByTestId('cover-tile-check', hidden)).toBeNull();
    expect(other).toHaveStyle({ borderWidth: focusRing.width, borderColor: 'transparent' });
    expect(screen.getAllByTestId('cover-tile-check', hidden)).toHaveLength(1);
  });

  it('gives the tiles the cover tile size from the theme, 16:9, and a touch target of at least 44dp', async () => {
    await render(<CoverPicker value={DEFAULT_COVER} onChange={() => {}} />);
    expect(coverPicker.tileWidth).toBe(112);
    for (const tile of [...tiles(), screen.getByRole('button', { name: 'Z galerii' })]) {
      expect(tile).toHaveStyle({ width: coverPicker.tileWidth });
      const style = Object.assign({}, ...[tile.props.style].flat(2)) as { minHeight: number };
      expect(style.minHeight).toBeGreaterThanOrEqual(tokens.layout.touchTarget);
    }
  });

  it('shows a large preview of the selected cover and a thumbnail on every tile', async () => {
    await render(<CoverPicker value="preset:bali" onChange={() => {}} />);
    expect(screen.getByTestId('cover-preview', hidden).props.source).toEqual([{ uri: 'bundled/bali.jpg' }]);
    expect(screen.getByTestId('cover-preview', hidden)).toHaveStyle({ aspectRatio: 16 / 9 });
    const tile = screen.getByRole('radio', { name: 'Pekin' });
    expect(within(tile).getByTestId('cover-tile-image', hidden).props.source).toEqual([{ uri: 'bundled/beijing_thumb.jpg' }]);
  });

  it('tells the parent which preset was tapped', async () => {
    const onChange = jest.fn();
    await render(<CoverPicker value={DEFAULT_COVER} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Dżakarta' }));
    expect(onChange).toHaveBeenCalledWith('preset:jakarta');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('opens the gallery for images, cropped to 16:9, and hands over the picked photo', async () => {
    launch.mockResolvedValue(picked('file:///cache/cover.jpg'));
    const onChange = jest.fn();
    await render(<CoverPicker value={DEFAULT_COVER} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Z galerii' }));
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 }),
    );
    expect(onChange).toHaveBeenCalledWith('file:///cache/cover.jpg');
  });

  it('puts the picked photo first and selected', async () => {
    const { rerender } = await render(<CoverPicker value={DEFAULT_COVER} onChange={() => {}} />);
    expect(tiles()).toHaveLength(5);
    await rerender(<CoverPicker value="file:///cache/cover.jpg" onChange={() => {}} />);
    expect(tiles()).toHaveLength(6);
    expect(tiles()[0]).toHaveProp('accessibilityLabel', 'Twoje zdjęcie');
    expect(tiles()[0]).toBeChecked();
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
    expect(within(tiles()[0]).getByTestId('cover-tile-image', hidden).props.source).toEqual([{ uri: 'file:///cache/cover.jpg' }]);
    expect(screen.getByTestId('cover-preview', hidden).props.source).toEqual([{ uri: 'file:///cache/cover.jpg' }]);
  });

  it('keeps the picked photo as a tile when a preset is chosen after it', async () => {
    launch.mockResolvedValue(picked('file:///cache/cover.jpg'));
    function Harness() {
      const [value, setValue] = useState<string>(DEFAULT_COVER);
      return <CoverPicker value={value} onChange={setValue} />;
    }
    await render(<Harness />);
    await fireEvent.press(screen.getByRole('button', { name: 'Z galerii' }));
    expect(await screen.findByRole('radio', { name: 'Twoje zdjęcie', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Bali' }));
    expect(screen.getByRole('radio', { name: 'Bali', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Twoje zdjęcie', checked: false })).toBeTruthy();
    expect(tiles()[0]).toHaveProp('accessibilityLabel', 'Twoje zdjęcie');
    await fireEvent.press(screen.getByRole('radio', { name: 'Twoje zdjęcie' }));
    expect(screen.getByRole('radio', { name: 'Twoje zdjęcie', checked: true })).toBeTruthy();
  });

  it("shows a trip's gallery cover as the first tile, selected, from its URLs", async () => {
    await render(<CoverPicker value={`photo:${UUID}`} urls={URLS} onChange={() => {}} />);
    expect(tiles()).toHaveLength(6);
    expect(tiles()[0]).toHaveProp('accessibilityLabel', 'Twoje zdjęcie');
    expect(tiles()[0]).toBeChecked();
    expect(within(tiles()[0]).getByTestId('cover-tile-image', hidden).props.source).toEqual([
      { uri: URLS.thumbnailUrl, cacheKey: `cover:${UUID}:thumbnail` },
    ]);
    expect(screen.getByTestId('cover-preview', hidden).props.source).toEqual([{ uri: URLS.url, cacheKey: `cover:${UUID}:full` }]);
  });

  it('changes nothing when the gallery is closed without a photo', async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });
    const onChange = jest.fn();
    await render(<CoverPicker value="preset:bali" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Z galerii' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(tiles()).toHaveLength(5);
    expect(screen.queryByText('Nie udało się otworzyć galerii. Spróbuj ponownie.')).toBeNull();
  });

  it('explains when the gallery cannot be opened and keeps the cover', async () => {
    launch.mockRejectedValue(new Error('no access'));
    const onChange = jest.fn();
    await render(<CoverPicker value="preset:bali" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Z galerii' }));
    expect(await screen.findByText('Nie udało się otworzyć galerii. Spróbuj ponownie.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Bali', checked: true })).toBeTruthy();
  });

  it('treats a photo that is not a file on the phone as a gallery error', async () => {
    launch.mockResolvedValue(picked('blob:http://localhost/1'));
    const onChange = jest.fn();
    await render(<CoverPicker value="preset:bali" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Z galerii' }));
    expect(await screen.findByText('Nie udało się otworzyć galerii. Spróbuj ponownie.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cannot remove the cover', async () => {
    await render(<CoverPicker value="file:///cache/cover.jpg" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Usuń zdjęcie' })).toBeNull();
    expect(screen.queryByText('Usuń zdjęcie')).toBeNull();
  });

  it('uses one corner radius for the preview and the tiles: radii.sm', async () => {
    await render(<CoverPicker value="preset:bali" onChange={() => {}} />);
    expect(screen.getByTestId('cover-preview', hidden)).toHaveStyle({ borderRadius: tokens.radii.sm });
    for (const tile of [...tiles(), screen.getByRole('button', { name: 'Z galerii' })]) {
      expect(tile).toHaveStyle({ borderRadius: tokens.radii.sm });
    }
  });

  describe('Sunline Editorial look (§8.0, §8.6)', () => {
    it('shows the gallery tile on the primary surface with a default border and a 20dp icon, label in caption', async () => {
      await render(<CoverPicker value={DEFAULT_COVER} onChange={() => {}} />);
      const gallery = screen.getByRole('button', { name: 'Z galerii' });
      expect(gallery).toHaveStyle({ borderColor: lightTheme.border.default, backgroundColor: lightTheme.surface.primary, borderWidth: focusRing.width });
      expect(screen.getByText('Z galerii')).toHaveStyle({ ...tokens.typography.styles.caption, color: lightTheme.text.primary });
      const icon = within(gallery).getByTestId('cover-gallery-icon', hidden);
      expect(icon.props.width).toBe(tokens.iconography.size.sm);
      expect(icon.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
      expect(icon.props.stroke).toBe(lightTheme.icon.primary);
    });

    it('presses the gallery tile to the sunken background, and a selected tile to the pressed brand color', async () => {
      await render(<CoverPicker value="preset:bali" onChange={() => {}} />);
      const gallery = screen.getByRole('button', { name: 'Z galerii' });
      await fireEvent(gallery, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      expect(flat(gallery).backgroundColor).toBe(lightTheme.background.sunken);
      const selected = screen.getByRole('radio', { name: 'Bali' });
      await fireEvent(selected, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      expect(flat(selected).borderColor).toBe(lightTheme.brand.pressed);
      const other = screen.getByRole('radio', { name: 'Auckland' });
      await fireEvent(other, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      expect(flat(other).borderColor).toBe(lightTheme.border.default);
    });

    it('shows the 2dp focus ring in border.focus with a 2dp gap on a focused tile', async () => {
      await render(<CoverPicker value="preset:bali" onChange={() => {}} />);
      const tile = screen.getByRole('radio', { name: 'Auckland' });
      await fireEvent(tile, 'focus');
      expect(tile).toHaveStyle({ outlineWidth: focusRing.width, outlineColor: lightTheme.border.focus, outlineOffset: focusRing.offset });
      const gallery = screen.getByRole('button', { name: 'Z galerii' });
      await fireEvent(gallery, 'focus');
      expect(gallery).toHaveStyle({ outlineWidth: focusRing.width, outlineColor: lightTheme.border.focus, outlineOffset: focusRing.offset });
      await fireEvent(gallery, 'blur');
      expect(gallery).not.toHaveStyle({ outlineWidth: focusRing.width });
    });

    it('uses the dark colors in dark mode', async () => {
      await render(<CoverPicker value="preset:bali" onChange={() => {}} />, { wrapper: DarkThemeScope });
      expect(screen.getByRole('radio', { name: 'Bali' })).toHaveStyle({ borderColor: darkTheme.brand.primary });
      expect(screen.getByRole('button', { name: 'Z galerii' })).toHaveStyle({
        borderColor: darkTheme.border.default,
        backgroundColor: darkTheme.surface.primary,
      });
    });
  });

  describe('row position', () => {
    it('opens scrolled to the selected tile, without animation, when it would be off screen', async () => {
      await render(<CoverPicker value="preset:majorka" onChange={() => {}} />);
      expect(scrollTo()).not.toHaveBeenCalled(); // nothing is laid out yet
      await layOut(screen.getByRole('radio', { name: 'Majorka' }), 480);
      expect(scrollTo()).toHaveBeenCalledTimes(1);
      expect(scrollTo()).toHaveBeenLastCalledWith({ x: 480, animated: false });
    });

    it('opens at the start when the first tile is selected', async () => {
      await render(<CoverPicker value={DEFAULT_COVER} onChange={() => {}} />);
      await layOut(screen.getByRole('radio', { name: 'Auckland' }), 0);
      expect(scrollTo()).toHaveBeenLastCalledWith({ x: 0, animated: false });
    });

    it('does not move the row again when another tile is tapped', async () => {
      function Harness() {
        const [value, setValue] = useState<string>('preset:majorka');
        return <CoverPicker value={value} onChange={setValue} />;
      }
      await render(<Harness />);
      await layOut(screen.getByRole('radio', { name: 'Majorka' }), 480);
      await fireEvent.press(screen.getByRole('radio', { name: 'Bali' }));
      await layOut(screen.getByRole('radio', { name: 'Bali' }), 120);
      expect(scrollTo()).toHaveBeenCalledTimes(1);
    });

    it('goes back to the start when a photo is picked, because its tile is the first one', async () => {
      launch.mockResolvedValue(picked('file:///cache/cover.jpg'));
      await render(<CoverPicker value="preset:majorka" onChange={() => {}} />);
      await layOut(screen.getByRole('radio', { name: 'Majorka' }), 480);
      scrollTo().mockClear();
      await fireEvent.press(screen.getByRole('button', { name: 'Z galerii' }));
      await screen.findByRole('button', { name: 'Z galerii' });
      expect(scrollTo()).toHaveBeenCalledTimes(1);
      expect(scrollTo()).toHaveBeenLastCalledWith({ x: 0, animated: false });
    });
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await render(<CoverPicker value="file:///cache/cover.jpg" onChange={() => {}} />);
    expect(screen.getByText('Cover photo')).toBeTruthy();
    expect(screen.queryByText(/optional/)).toBeNull();
    expect(screen.getByLabelText('Cover photo').props.accessibilityRole).toBe('radiogroup');
    expect(tiles().map((tile) => tile.props.accessibilityLabel)).toEqual([
      'Your photo',
      'Auckland',
      'Bali',
      'Beijing',
      'Jakarta',
      'Mallorca',
    ]);
    expect(screen.getByRole('button', { name: 'From gallery' })).toBeTruthy();
  });
});
