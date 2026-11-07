import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import i18n from '@/i18n';
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
  if (photos.length > 0) await fireEvent(screen.getByTestId('place-card-photos'), 'layout', { nativeEvent: { layout: { width: 360, height: 270 } } });
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
