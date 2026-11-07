import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, StyleSheet } from 'react-native';

import i18n from '@/i18n';
import { tokens } from '@/theme/tokens';
import type { PlaceRecommendation } from '@/schemas';

import { PlaceCard } from '../PlaceCard';

const photo = (n: number, authors: { name: string; uri?: string }[] = []) => ({
  uri: `https://places.example/photo-${n}`,
  width: 800,
  height: 600,
  authors,
});

const place = (photos: PlaceRecommendation['photos'] = []): PlaceRecommendation => ({
  placeId: 'p1',
  name: 'Muzeum Narodowe',
  typeLabel: 'Muzeum',
  address: 'al. 3 Maja 1, Kraków',
  types: ['museum'],
  location: { latitude: 50.06, longitude: 19.92 },
  googleMapsUri: 'https://maps.google.com/?cid=1',
  reason: 'Pasuje do Twojej miłości do muzeów.',
  photos,
});

async function show(photos: PlaceRecommendation['photos'] = []) {
  await render(<PlaceCard place={place(photos)} />);
  // The pages are as wide as the photo area, which is known after layout.
  if (photos.length > 0) await fireEvent(screen.getByTestId('place-card-photo-frame'), 'layout', { nativeEvent: { layout: { width: 360, height: 270 } } });
}

const scrollTo = (x: number) => fireEvent.scroll(screen.getByTestId('place-card-pager'), { nativeEvent: { contentOffset: { x } } });

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('PlaceCard photos', () => {
  it('shows no photo area without photos', async () => {
    await show([]);
    expect(screen.queryByTestId('place-card-pager')).toBeNull();
    expect(screen.getByText('Muzeum Narodowe')).toBeTruthy();
  });

  it('pages through the photos, three of them', async () => {
    await show([photo(1), photo(2), photo(3)]);
    const pager = screen.getByTestId('place-card-pager');
    expect(pager.props.pagingEnabled).toBe(true);
    expect(screen.getAllByTestId('place-card-image')).toHaveLength(3);
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('reserves the photo area before the first layout, so the text does not jump', async () => {
    await render(<PlaceCard place={place([photo(1)])} />);
    expect(screen.getByTestId('place-card-photos')).toBeTruthy();
    expect(screen.queryByTestId('place-card-pager')).toBeNull();
  });

  // Jest computes no layout, so the flush layout is pinned by its style contract (device bug: stretch + negative side margins +
  // aspectRatio made the photo run past the card's right border). The frame is placed by insets over the padding, not by margins.
  it('lays the photo frame over the card padding with insets, and reserves the 4:3 height with a spacer', async () => {
    await render(<PlaceCard place={place([photo(1)])} />);
    const { padding } = tokens.components.card;
    const area = StyleSheet.flatten(screen.getByTestId('place-card-photos').props.style);
    expect(area).toMatchObject({ marginTop: -padding, paddingBottom: (2 * padding) / tokens.components.card.photoAspectRatio });
    expect(area.marginHorizontal).toBeUndefined();
    expect(area.aspectRatio).toBeUndefined();
    const frame = StyleSheet.flatten(screen.getByTestId('place-card-photo-frame').props.style);
    expect(frame).toMatchObject({ position: 'absolute', top: 0, bottom: 0, left: -padding, right: -padding, overflow: 'hidden' });
    expect(StyleSheet.flatten(screen.getByTestId('place-card-photo-spacer').props.style).aspectRatio).toBe(tokens.components.card.photoAspectRatio);
  });

  it('follows the page in the indicator and clamps an offset past the end', async () => {
    await show([photo(1), photo(2), photo(3)]);
    await scrollTo(360);
    expect(screen.getByText('2/3')).toBeTruthy();
    await scrollTo(5000);
    expect(screen.getByText('3/3')).toBeTruthy();
  });

  it('hides the page indicator for one photo', async () => {
    await show([photo(1)]);
    expect(screen.getAllByTestId('place-card-image')).toHaveLength(1);
    expect(screen.queryByText('1/1')).toBeNull();
  });

  it('keeps the photos in memory only', async () => {
    await show([photo(1)]);
    const image = screen.getByTestId('place-card-image');
    expect(image.props.cachePolicy).toBe('memory');
    expect(image.props.source[0].uri).toBe('https://places.example/photo-1');
  });

  it('replaces a photo that fails to load with a placeholder', async () => {
    await show([photo(1)]);
    await fireEvent(screen.getByTestId('place-card-image'), 'error', { nativeEvent: { error: 'expired' } });
    expect(screen.queryByTestId('place-card-image')).toBeNull();
    expect(screen.getByTestId('place-card-placeholder')).toBeTruthy();
  });

  it('labels each photo with its place in the set and the place name', async () => {
    await show([photo(1), photo(2), photo(3)]);
    expect(screen.getByLabelText('Zdjęcie 2 z 3, Muzeum Narodowe')).toBeTruthy();
    await act(() => i18n.changeLanguage('en'));
    expect(screen.getByLabelText('Photo 2 of 3, Muzeum Narodowe')).toBeTruthy();
  });
});

describe('PlaceCard rating', () => {
  const rated = (extra: Partial<PlaceRecommendation>) => render(<PlaceCard place={{ ...place(), ...extra }} />);
  // The row is "type", "·" and the rating part, as separate texts so the rating part can carry its own label.
  const ratingPart = (name: string | RegExp) => screen.getByLabelText(name);

  it('shows type, separator and rating with count in Polish', async () => {
    await rated({ rating: 4.6, ratingCount: 12345 });
    expect(screen.getByText('Muzeum')).toBeTruthy();
    expect(screen.getByText('·', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(/^4,6 \(12\s345\)$/)).toBeTruthy();
    expect(screen.getByTestId('place-card-rating-star', { includeHiddenElements: true })).toBeTruthy();
  });

  it('formats the numbers by the language in English', async () => {
    await i18n.changeLanguage('en');
    await rated({ rating: 4.6, ratingCount: 1234 });
    expect(screen.getByText('4.6 (1,234)')).toBeTruthy();
  });

  it('always shows one fraction digit', async () => {
    await rated({ rating: 4, ratingCount: 2 });
    expect(screen.getByText('4,0 (2)')).toBeTruthy();
  });

  it('shows the rating alone without a count', async () => {
    await rated({ rating: 4.6 });
    expect(screen.getByText('4,6')).toBeTruthy();
    expect(screen.queryByText(/\(/)).toBeNull();
  });

  it('leaves the row as it was without a rating', async () => {
    await rated({ ratingCount: 10 });
    expect(screen.getByText('Muzeum')).toBeTruthy();
    expect(screen.queryByText('·', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('place-card-rating-star', { includeHiddenElements: true })).toBeNull();
  });

  it('shows only the rating without a type, and no separator', async () => {
    await rated({ typeLabel: undefined, rating: 4.6, ratingCount: 3 });
    expect(screen.queryByText('·', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('4,6 (3)')).toBeTruthy();
  });

  it('shows no row at all without a type and a rating', async () => {
    await rated({ typeLabel: undefined });
    expect(screen.queryByTestId('place-card-type-row')).toBeNull();
  });

  it.each([
    [1, 'Ocena 4,6 na 5, 1 opinia'],
    [3, 'Ocena 4,6 na 5, 3 opinie'],
    [5, 'Ocena 4,6 na 5, 5 opinii'],
    [1234, 'Ocena 4,6 na 5, 1234 opinie'],
  ])('reads %i reviews in Polish with the right plural', async (ratingCount, label) => {
    await rated({ rating: 4.6, ratingCount });
    expect(ratingPart(label)).toBeTruthy();
  });

  it.each([
    [1, 'Rated 4.6 out of 5, 1 review'],
    [1234, 'Rated 4.6 out of 5, 1,234 reviews'],
  ])('reads %i reviews in English with the right plural', async (ratingCount, label) => {
    await i18n.changeLanguage('en');
    await rated({ rating: 4.6, ratingCount });
    expect(ratingPart(label)).toBeTruthy();
  });

  it('formats a large count in the Polish label as Intl does', async () => {
    await rated({ rating: 4.6, ratingCount: 12345 });
    expect(ratingPart(/^Ocena 4,6 na 5, 12\s345 opinii$/)).toBeTruthy();
  });

  it('hides the separator from screen readers', async () => {
    await rated({ rating: 4.6, ratingCount: 3 });
    expect(screen.queryByText('·')).toBeNull();
    expect(screen.getByText('·', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });

  it('reads the rating without a count in Polish', async () => {
    await rated({ rating: 4.6 });
    expect(ratingPart('Ocena 4,6 na 5')).toBeTruthy();
  });

  it('reads the rating without a count in English', async () => {
    await i18n.changeLanguage('en');
    await rated({ rating: 4.6 });
    expect(ratingPart('Rated 4.6 out of 5')).toBeTruthy();
  });
});

describe('PlaceCard author caption', () => {
  it('credits the authors in Polish and opens the first one', async () => {
    await show([photo(1, [{ name: 'Ala', uri: 'https://maps.google.com/a' }, { name: 'Ola', uri: 'https://maps.google.com/o' }])]);
    const caption = screen.getByRole('link', { name: 'Otwórz stronę autora zdjęcia, Ala, Ola' });
    expect(screen.getByText('Fot. Ala, Ola')).toBeTruthy();
    await fireEvent.press(caption);
    expect(Linking.openURL).toHaveBeenCalledWith('https://maps.google.com/a');
  });

  it('credits the authors in English', async () => {
    await i18n.changeLanguage('en');
    await show([photo(1, [{ name: 'Ala', uri: 'https://maps.google.com/a' }])]);
    expect(screen.getByText('Photo: Ala')).toBeTruthy();
  });

  it('shows an author without a link as plain text', async () => {
    await show([photo(1, [{ name: 'Ala' }])]);
    expect(screen.getByText('Fot. Ala')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('survives a link that cannot be opened', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('no app'));
    await show([photo(1, [{ name: 'Ala', uri: 'https://maps.google.com/a' }])]);
    await fireEvent.press(screen.getByRole('link'));
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('shows no caption without authors', async () => {
    await show([photo(1, [])]);
    expect(screen.queryByText(/^Fot\./)).toBeNull();
  });
});
