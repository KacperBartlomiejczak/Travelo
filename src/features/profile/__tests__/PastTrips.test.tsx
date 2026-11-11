import { fireEvent, render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import i18n from '@/i18n';
import type { TripListItem } from '@/schemas';
import { lightTheme } from '@/theme/theme';
import { radii, tokens } from '@/theme/tokens';

import { PastTrips } from '../PastTrips';

type JsonNode = { type: string; props: Record<string, unknown>; children: (JsonNode | string)[] | null };

function findNodes(node: JsonNode | string | null, type: string, out: JsonNode[] = []): JsonNode[] {
  if (!node || typeof node === 'string') return out;
  if (node.type === type) out.push(node);
  for (const child of node.children ?? []) findNodes(child, type, out);
  return out;
}

const trip = (id: string, name: string, destination: string, travellerCount?: number): TripListItem => ({
  id,
  name,
  coverImageUri: 'preset:bali',
  destination,
  flights: [],
  startDate: '2025-06-01',
  endDate: '2025-06-08',
  ...(travellerCount === undefined ? {} : { travellerCount }),
});

const TRIPS = [trip('11111111-1111-4111-8111-111111111111', 'Summer', 'FCO', 3), trip('22222222-2222-4222-8222-222222222222', 'Lisbon', 'LIS', 1)];

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('PastTrips (profile-upgrade step 3)', () => {
  it('shows the header and one card per trip in the given order', async () => {
    await render(<PastTrips trips={TRIPS} state="ready" onOpen={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Minione podróże' })).toBeTruthy();
    const cards = screen.getAllByTestId(/^past-trip-card-/);
    expect(cards.map((c) => c.props.testID)).toEqual([`past-trip-card-${TRIPS[0]!.id}`, `past-trip-card-${TRIPS[1]!.id}`]);
  });

  it('draws name, the destination city in a pill, and sizes from tokens', async () => {
    await render(<PastTrips trips={[TRIPS[0]!]} state="ready" onOpen={jest.fn()} />);
    expect(screen.getByText('Summer')).toHaveStyle({ color: lightTheme.hero.text });
    expect(screen.getByText('Summer').props.numberOfLines).toBe(2);
    expect(screen.getByText('Rome')).toBeTruthy();
    expect(screen.getByTestId('past-trip-pill')).toHaveStyle({ borderRadius: radii.pill });
    const card = screen.getByTestId(`past-trip-card-${TRIPS[0]!.id}`);
    expect(card).toHaveStyle({ minHeight: tokens.components.card.tripImageHeight, borderRadius: radii.lg });
  });

  it('uses the city of the destination airport, and the IATA code when unknown', async () => {
    await render(<PastTrips trips={[trip('33333333-3333-4333-8333-333333333333', 'A', 'WAW'), trip('44444444-4444-4444-8444-444444444444', 'B', 'ZZZ')]} state="ready" onOpen={jest.fn()} />);
    expect(screen.getByText('Warsaw')).toBeTruthy();
    expect(screen.getByText('ZZZ')).toBeTruthy();
  });

  it.each([
    [2, 'pl', '1 znajomy'],
    [3, 'pl', '2 znajomych'],
    [6, 'pl', '5 znajomych'],
    [2, 'en', '1 friend'],
    [3, 'en', '2 friends'],
  ])('shows travellerCount %i as friends in %s', async (count, lang, text) => {
    await i18n.changeLanguage(lang);
    await render(<PastTrips trips={[trip('11111111-1111-4111-8111-111111111111', 'Summer', 'FCO', count)]} state="ready" onOpen={jest.fn()} />);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('says solo for a single traveller, and shows no friends line without travellerCount', async () => {
    await render(
      <PastTrips
        trips={[trip('11111111-1111-4111-8111-111111111111', 'Solo', 'FCO', 1), trip('22222222-2222-4222-8222-222222222222', 'Old', 'FCO')]}
        state="ready"
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getAllByText('Podróż solo')).toHaveLength(1);
    expect(screen.queryByText(/znajom/)).toBeNull();
    expect(screen.getByLabelText('Old, Rome')).toBeTruthy();
  });

  it('fades the cover from transparent to the full hero.scrim at half height and stays solid below', async () => {
    await render(<PastTrips trips={[TRIPS[0]!]} state="ready" onOpen={jest.fn()} />);
    const stops = findNodes(screen.toJSON() as JsonNode | null, 'RNSVGLinearGradient')[0]?.props.gradient as number[];
    const scrim = processColor(lightTheme.hero.scrim) as number;
    const tokenAlpha = Number(/,\s*([\d.]+)\)$/.exec(lightTheme.hero.scrim)![1]);
    // [offset, colour, offset, colour, offset, colour]: same rgb everywhere, alpha 0, then the token's alpha twice.
    expect([stops[0], stops[2], stops[4]]).toEqual([0, 0.5, 1]);
    for (const i of [1, 3, 5]) expect(stops[i]! & 0xffffff).toBe(scrim & 0xffffff);
    expect((stops[1]! >>> 24) & 0xff).toBe(0);
    expect((stops[3]! >>> 24) & 0xff).toBe(Math.round(tokenAlpha * 255));
    expect((stops[5]! >>> 24) & 0xff).toBe(Math.round(tokenAlpha * 255));
  });

  it('keeps the pill in the layout flow, so a long title cannot sit under it', async () => {
    await render(<PastTrips trips={[TRIPS[0]!]} state="ready" onOpen={jest.fn()} />);
    const pill = screen.getByTestId('past-trip-pill');
    expect(pill).not.toHaveStyle({ position: 'absolute' });
    expect(screen.getByTestId('past-trip-pill-row')).toHaveStyle({ alignItems: 'flex-end' });
    expect(screen.getByTestId('past-trip-pill-row')).toContainElement(pill);
  });

  it('outlines the pill with the button border width token', async () => {
    await render(<PastTrips trips={[TRIPS[0]!]} state="ready" onOpen={jest.fn()} />);
    expect(screen.getByTestId('past-trip-pill')).toHaveStyle({ borderWidth: tokens.components.button.borderWidth });
  });

  it('is one button with label and hint, and opens the trip on press', async () => {
    const onOpen = jest.fn();
    await render(<PastTrips trips={[TRIPS[0]!]} state="ready" onOpen={onOpen} />);
    const button = screen.getByRole('button', { name: 'Summer, Rome, 2 znajomych' });
    expect(button.props.accessibilityHint).toBe('Otwiera podróż');
    await fireEvent.press(button);
    expect(onOpen).toHaveBeenCalledWith(TRIPS[0]!.id);
  });

  it('shows the header and two skeletons as one busy element while loading', async () => {
    await render(<PastTrips trips={[]} state="loading" onOpen={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Minione podróże' })).toBeTruthy();
    const busy = screen.getByLabelText('Wczytywanie minionych podróży');
    expect(busy.props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getAllByTestId('past-trip-skeleton')).toHaveLength(2);
  });

  it('shows the empty text with the header', async () => {
    await render(<PastTrips trips={[]} state="ready" onOpen={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Minione podróże' })).toBeTruthy();
    expect(screen.getByText('Tu pojawią się Twoje zakończone podróże.')).toBeTruthy();
  });

  it('shows the error text without a retry button', async () => {
    await render(<PastTrips trips={[]} state="error" onOpen={jest.fn()} />);
    expect(screen.getByText('Nie udało się wczytać podróży.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
