import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { CoverImage } from '@/components/CoverImage';
import { lightTheme } from '@/theme/legacy/theme';

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
const hidden = { includeHiddenElements: true };

// expo-image normalises `source` to a list.
const source = () => screen.getByTestId('cover', hidden).props.source;

afterEach(() => {
  jest.restoreAllMocks();
});

describe('CoverImage (trip-covers C3)', () => {
  it('shows a preset from its bundled file, or its thumbnail', async () => {
    const { rerender } = await render(<CoverImage testID="cover" cover="preset:bali" variant="full" />);
    expect(source()).toEqual([{ uri: 'bundled/bali.jpg' }]);
    await rerender(<CoverImage testID="cover" cover="preset:bali" variant="thumbnail" />);
    expect(source()).toEqual([{ uri: 'bundled/bali_thumb.jpg' }]);
  });

  it('shows a gallery cover from its URL, with a stable cache key so the disk cache serves it offline', async () => {
    const { rerender } = await render(<CoverImage testID="cover" cover={`photo:${UUID}`} urls={URLS} variant="full" />);
    expect(source()).toEqual([{ uri: URLS.url, cacheKey: `cover:${UUID}:full` }]);
    // A newly signed URL for the same file keeps the key.
    const resigned = { url: 'https://x.supabase.co/full?token=b', thumbnailUrl: 'https://x.supabase.co/thumb?token=b' };
    await rerender(<CoverImage testID="cover" cover={`photo:${UUID}`} urls={resigned} variant="full" />);
    expect(source()).toEqual([{ uri: resigned.url, cacheKey: `cover:${UUID}:full` }]);
    await rerender(<CoverImage testID="cover" cover={`photo:${UUID}`} urls={URLS} variant="thumbnail" />);
    expect(source()).toEqual([{ uri: URLS.thumbnailUrl, cacheKey: `cover:${UUID}:thumbnail` }]);
  });

  it('shows the default preset for a gallery cover without URLs', async () => {
    await render(<CoverImage testID="cover" cover={`photo:${UUID}`} variant="thumbnail" />);
    expect(source()).toEqual([{ uri: 'bundled/auckland_thumb.jpg' }]);
  });

  it('shows a photo picked on this phone from its file', async () => {
    await render(<CoverImage testID="cover" cover="file:///cache/cover.jpg" variant="full" />);
    expect(source()).toEqual([{ uri: 'file:///cache/cover.jpg' }]);
  });

  it('shows the default preset for a value from before this feature', async () => {
    await render(<CoverImage testID="cover" cover="content://media/42" variant="full" />);
    expect(source()).toEqual([{ uri: 'bundled/auckland.jpg' }]);
  });

  it('switches to the default preset when the image fails, once', async () => {
    await render(<CoverImage testID="cover" cover="file:///gone.jpg" variant="thumbnail" />);
    const image = () => screen.getByTestId('cover', hidden);
    await act(async () => image().props.onError({ nativeEvent: { error: 'missing' } }));
    expect(source()).toEqual([{ uri: 'bundled/auckland_thumb.jpg' }]);
    // The default failing too is not retried: the source stays put.
    await act(async () => image().props.onError({ nativeEvent: { error: 'missing' } }));
    expect(source()).toEqual([{ uri: 'bundled/auckland_thumb.jpg' }]);
  });

  it('tries the new cover again after the cover prop changes', async () => {
    const { rerender } = await render(<CoverImage testID="cover" cover="file:///gone.jpg" variant="full" />);
    await act(async () => screen.getByTestId('cover', hidden).props.onError({ nativeEvent: { error: 'missing' } }));
    expect(source()).toEqual([{ uri: 'bundled/auckland.jpg' }]);
    await rerender(<CoverImage testID="cover" cover="preset:bali" variant="full" />);
    expect(source()).toEqual([{ uri: 'bundled/bali.jpg' }]);
  });

  it('is hidden from screen readers unless the parent gives it a label', async () => {
    const { rerender } = await render(<CoverImage testID="cover" cover="preset:bali" variant="full" />);
    expect(screen.queryByTestId('cover')).toBeNull();
    expect(screen.getByTestId('cover', hidden).props['aria-hidden']).toBe(true);
    await rerender(<CoverImage testID="cover" cover="preset:bali" variant="full" accessibilityLabel="Bali" />);
    expect(screen.getByLabelText('Bali')).toBeTruthy();
  });

  it('has a placeholder surface behind the image that the parent can restyle', async () => {
    const { rerender } = await render(<CoverImage testID="cover" cover="preset:bali" variant="full" />);
    expect(screen.getByTestId('cover', hidden)).toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
    await rerender(<CoverImage testID="cover" cover="preset:bali" variant="full" style={{ backgroundColor: lightTheme.colors.hero.background }} />);
    expect(screen.getByTestId('cover', hidden)).toHaveStyle({ backgroundColor: lightTheme.colors.hero.background });
  });

  it('fades in over a short duration token', async () => {
    await render(<CoverImage testID="cover" cover="preset:bali" variant="full" />);
    expect(screen.getByTestId('cover', hidden).props.transition).toEqual({ duration: lightTheme.duration.small });
  });

  it('shows at once when the system asks to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<CoverImage testID="cover" cover="preset:bali" variant="full" />);
    await act(async () => {});
    expect(screen.getByTestId('cover', hidden).props.transition).toEqual({ duration: 0 });
  });

  it('when the system cannot say whether to reduce motion, it shows without animation', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no native module'));
    await render(<CoverImage testID="cover" cover="preset:bali" variant="full" />);
    await act(async () => {});
    expect(screen.getByTestId('cover', hidden).props.transition).toEqual({ duration: 0 });
  });
});
