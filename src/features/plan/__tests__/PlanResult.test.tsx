import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, StyleSheet } from 'react-native';

import { PlanResult } from '@/features/plan/PlanResult';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import i18n from '@/i18n';
import type { PlanPersonView } from '@/lib/plan-people-view';
import type { PlaceDetails, PlanPersonRef, TripPlan } from '@/schemas';
import { tokens } from '@/theme/tokens';

// require (not import) so jest.spyOn can replace useWindowDimensions on the module object
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RN = require('react-native') as typeof import('react-native');

// The stock Reanimated mock keeps no builder state, so record what the components ask for.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated/mock');
  class Keyframe {
    durationV?: number;
    delayV?: number;
    definitions: unknown;
    constructor(definitions: unknown) {
      this.definitions = definitions;
    }
    duration(ms: number) {
      this.durationV = ms;
      return this;
    }
    delay(ms: number) {
      this.delayV = ms;
      return this;
    }
  }
  return { ...actual, Keyframe, FadeIn: { duration: (ms: number) => ({ durationV: ms }) } };
});
jest.mock('@/hooks/useReduceMotion');
const mockReduceMotion = jest.mocked(useReduceMotion);

const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const plan: TripPlan = {
  tripId: TRIP_ID,
  model: 'gemini',
  createdAt: '2026-11-14T10:00:00+01:00',
  days: [
    {
      date: '2026-11-20',
      cityIata: 'BCN',
      items: [
        { placeId: 'b', slot: 'evening', reason: 'Tapas night', forPeople: ['owner', MEMBER] },
        { placeId: 'a', slot: 'morning', reason: 'Great views', forPeople: ['owner'] },
        { placeId: 'gone', slot: 'evening', reason: 'Lost one', forPeople: ['owner'] },
      ],
    },
    { date: '2026-11-21', cityIata: 'GRO', items: [{ placeId: 'a', slot: 'afternoon', reason: 'Again', forPeople: ['owner'] }] },
    { date: '2026-11-22', cityIata: 'GRO', items: [] },
  ],
};
const places: Record<string, PlaceDetails> = {
  a: { placeId: 'a', name: 'Park Guell', address: 'Carrer d’Olot', googleMapsUri: 'https://maps.google.com/?cid=1' },
  b: { placeId: 'b', name: 'Bar Pinotxo', address: null, googleMapsUri: 'https://maps.google.com/?cid=2' },
};
const manyItems: TripPlan = {
  ...plan,
  days: [{ ...plan.days[1], items: Array.from({ length: 8 }, () => plan.days[1].items[0]) }],
};
const cityName = (iata: string) => ({ BCN: 'Barcelona', GRO: 'Girona' })[iata] ?? iata;
const people: Record<string, PlanPersonView> = {
  owner: { key: 'owner', name: 'Kasia', photoUri: 'https://example.com/me.jpg' },
  [MEMBER]: { key: MEMBER, name: 'Ola' },
};
const resolvePeople = (refs: readonly PlanPersonRef[]) => refs.flatMap((r) => (people[r] ? [people[r]] : []));

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  mockReduceMotion.mockReturnValue(false);
});
afterEach(() => jest.restoreAllMocks());

const setup = async (canRegenerate = true, today = '2026-01-01', p: TripPlan = plan) => {
  const onRegenerate = jest.fn();
  await render(
    <PlanResult
      plan={p}
      places={places}
      cityName={cityName}
      travellerCount={3}
      resolvePeople={resolvePeople}
      today={today}
      onRegenerate={onRegenerate}
      canRegenerate={canRegenerate}
    />,
  );
  return { onRegenerate };
};

describe('PlanResult', () => {
  it('renders no empty text for an item without a reason', async () => {
    const noReason: TripPlan = { ...plan, days: [{ ...plan.days[1], items: [{ ...plan.days[1].items[0], reason: '' }] }] };
    await setup(true, '2026-01-01', noReason);
    expect(screen.getByText('Park Guell')).toBeOnTheScreen();
    expect(screen.queryAllByText('')).toHaveLength(0);
  });

  it('hides a reason that mentions a person id (D31) but keeps the place and a normal reason', async () => {
    const reason = 'Hard Rock Cafe offers live music for P1.';
    const legacy: TripPlan = {
      ...plan,
      days: [{ ...plan.days[0], items: [{ ...plan.days[0].items[1], reason }, plan.days[0].items[0]] }],
    };
    await setup(true, '2026-01-01', legacy);
    expect(screen.queryByText(reason)).not.toBeOnTheScreen();
    expect(screen.getByText('Park Guell')).toBeOnTheScreen();
    expect(screen.getByText('Tapas night')).toBeOnTheScreen();
  });

  it('shows the AI provenance label and hint', async () => {
    await setup();
    expect(screen.getByText('Wygenerowane przez AI')).toBeOnTheScreen();
    expect(screen.getByText('Sprawdź godziny otwarcia i ceny przed wyjściem.')).toBeOnTheScreen();
  });

  it('shows a chip per day and defaults to day 1 when today is outside the plan', async () => {
    await setup();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getAllByRole('tab')[0]).toBeSelected();
    expect(screen.getByText('Dzień 1 · pt. 20 lis')).toBeOnTheScreen();
  });

  it('defaults to today when it is one of the plan days', async () => {
    await setup(true, '2026-11-21');
    expect(screen.getAllByRole('tab')[1]).toBeSelected();
    expect(screen.getByText('Dzień 2 · sob. 21 lis')).toBeOnTheScreen();
    expect(screen.getByText('Girona')).toBeOnTheScreen();
  });

  it('shows the city as a header and the traveller count', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Barcelona' })).toBeOnTheScreen();
    expect(screen.getByText('3 podróżnych')).toBeOnTheScreen();
  });

  it('switches the day when a chip is tapped', async () => {
    await setup();
    expect(screen.queryByText('Again')).toBeNull();
    await fireEvent.press(screen.getAllByRole('tab')[1]);
    expect(screen.getByText('Again')).toBeOnTheScreen();
    expect(screen.queryByText('Great views')).toBeNull();
    expect(screen.getByText('Girona')).toBeOnTheScreen();
  });

  it('orders by slot and labels only the first item of each slot', async () => {
    await setup();
    expect(screen.getAllByText('Rano')).toHaveLength(1);
    expect(screen.getAllByText('Wieczór')).toHaveLength(1);
    const shown = screen.getAllByText(/Park Guell|Bar Pinotxo|Miejsce niedostępne/).map((n) => n.props.children);
    expect(shown).toEqual(['Park Guell', 'Bar Pinotxo', 'Miejsce niedostępne']);
  });

  it('shows the people of each card as an avatar group', async () => {
    await setup();
    expect(screen.getByLabelText('Uczestnicy: Kasia, Ola')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Uczestnicy: Kasia')).toHaveLength(2);
  });

  it('shows a text for a day without places', async () => {
    await setup(true, '2026-11-22');
    expect(screen.getByText('Brak miejsc na ten dzień.')).toBeOnTheScreen();
  });

  it('falls back for a missing place and gives it no maps link', async () => {
    await setup();
    expect(screen.getByText('Miejsce niedostępne')).toBeOnTheScreen();
    expect(screen.getByText('Lost one')).toBeOnTheScreen();
    // a + b have links, gone does not
    expect(screen.getAllByRole('link', { name: /Otwórz w Mapach Google/ })).toHaveLength(2);
  });

  it('hides the address when it is null', async () => {
    await setup();
    expect(screen.getAllByText('Carrer d’Olot')).toHaveLength(1);
    expect(screen.queryByText('null')).toBeNull();
  });

  it('opens the place in Google Maps', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup();
    await fireEvent.press(screen.getByRole('link', { name: /Otwórz w Mapach Google, Park Guell/ }));
    expect(open).toHaveBeenCalledWith('https://maps.google.com/?cid=1');
  });

  it('calls back on regenerate when allowed', async () => {
    const { onRegenerate } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Ułóż ponownie' }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('hides regenerate when not allowed', async () => {
    await setup(false);
    expect(screen.queryByRole('button', { name: 'Ułóż ponownie' })).toBeNull();
  });

  it('does not let a rejected openURL escape', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no maps'));
    await setup();
    await fireEvent.press(screen.getAllByRole('link', { name: /Otwórz w Mapach Google/ })[0]);
    await Promise.resolve();
    expect(open).toHaveBeenCalled(); // an unhandled rejection would fail the run
  });

  describe('entry animation (§7.5)', () => {
    const { cardEnterDuration, cardStagger, maxStaggeredCards } = tokens.motion.microinteraction.planGenerated;
    const entering = (i: number) => screen.getByTestId(`plan-result-item-${i}`).props.entering;

    it('rises 8 dp over 220 ms with a 45 ms stagger, capped at the 6th card', async () => {
      await setup(true, '2026-01-01', manyItems);
      for (let i = 0; i < 8; i++) {
        const e = entering(i);
        expect(e.durationV).toBe(cardEnterDuration);
        expect(e.delayV).toBe(Math.min(i, maxStaggeredCards - 1) * cardStagger);
        expect(e.definitions[0]).toEqual(
          expect.objectContaining({ opacity: 0, transform: [{ translateY: tokens.spacing[2] }] }),
        );
        expect(e.definitions[100]).toEqual(expect.objectContaining({ opacity: 1, transform: [{ translateY: 0 }] }));
      }
      expect(entering(7).delayV).toBe(entering(5).delayV);
    });

    it('crossfades all cards together over 80 ms without translation under reduced motion', async () => {
      mockReduceMotion.mockReturnValue(true);
      await setup();
      for (let i = 0; i < 3; i++) {
        expect(entering(i).durationV).toBe(tokens.motion.duration.reduced);
        expect(entering(i).delayV).toBeUndefined();
        expect(entering(i).definitions).toBeUndefined();
      }
    });
  });

  describe('layout at large font scales', () => {
    const withFontScale = (fontScale: number) =>
      jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });

    it.each([1, 1.3])('sizes the part-of-day column from slotColumnWidth at font scale %s', async (scale) => {
      withFontScale(scale);
      await setup();
      const column = StyleSheet.flatten(screen.getByText('Rano').parent?.props.style);
      expect(column.width).toBe(tokens.components.timeline.slotColumnWidth * scale);
    });

    it('lets the Maps link text shrink so it wraps inside the card', async () => {
      await setup();
      const link = screen.getAllByRole('link', { name: /Otwórz w Mapach Google/ })[0];
      expect(StyleSheet.flatten(link.props.style).maxWidth).toBe('100%');
      expect(StyleSheet.flatten(screen.getAllByText('Otwórz w Mapach Google')[0].props.style).flexShrink).toBe(1);
    });
  });

  describe('day change', () => {
    const twoDays: TripPlan = { ...plan, days: [plan.days[1], { ...plan.days[1], date: '2026-11-22' }] };

    it('mounts the cards of the new day again so they enter again', async () => {
      await setup(true, '2026-01-01', twoDays);
      const before = screen.getByTestId('plan-result-item-0');
      await fireEvent.press(screen.getAllByRole('tab')[1]);
      const after = screen.getByTestId('plan-result-item-0');
      expect(after).not.toBe(before);
      expect(after.props.entering.durationV).toBe(tokens.motion.microinteraction.planGenerated.cardEnterDuration);
    });

    it('still crossfades the new day under reduced motion', async () => {
      mockReduceMotion.mockReturnValue(true);
      await setup(true, '2026-01-01', twoDays);
      await fireEvent.press(screen.getAllByRole('tab')[1]);
      expect(screen.getByTestId('plan-result-item-0').props.entering.durationV).toBe(tokens.motion.duration.reduced);
    });
  });

  it('speaks English', async () => {
    await i18n.changeLanguage('en');
    await setup();
    expect(screen.getByText('Generated by AI')).toBeOnTheScreen();
    expect(screen.getByText('Day 1 · Fri Nov 20')).toBeOnTheScreen();
    expect(screen.getByText('3 travellers')).toBeOnTheScreen();
    expect(screen.getByText('Morning')).toBeOnTheScreen();
    expect(screen.getByText('Place unavailable')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Generate again' })).toBeOnTheScreen();
  });
});
