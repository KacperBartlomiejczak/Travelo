import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { PlanResult } from '@/features/plan/PlanResult';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import i18n from '@/i18n';
import type { PlaceDetails, TripPlan } from '@/schemas';
import { tokens } from '@/theme/tokens';

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
const plan: TripPlan = {
  tripId: TRIP_ID,
  model: 'gemini',
  createdAt: '2026-11-14T10:00:00+01:00',
  days: [
    {
      date: '2026-11-20',
      cityIata: 'BCN',
      items: [
        { placeId: 'a', slot: 'morning', reason: 'Great views', forPeople: ['owner'] },
        { placeId: 'b', slot: 'evening', reason: 'Tapas night', forPeople: ['owner'] },
        { placeId: 'gone', slot: 'evening', reason: 'Lost one', forPeople: ['owner'] },
      ],
    },
    { date: '2026-11-21', cityIata: 'GRO', items: [{ placeId: 'a', slot: 'afternoon', reason: 'Again', forPeople: ['owner'] }] },
  ],
};
const places: Record<string, PlaceDetails> = {
  a: { placeId: 'a', name: 'Park Guell', address: 'Carrer d’Olot', googleMapsUri: 'https://maps.google.com/?cid=1' },
  b: { placeId: 'b', name: 'Bar Pinotxo', address: null, googleMapsUri: 'https://maps.google.com/?cid=2' },
};
const manyDays: TripPlan = {
  ...plan,
  days: Array.from({ length: 8 }, (_, i) => ({ ...plan.days[1], date: `2026-11-${String(20 + i)}` })),
};
const cityName = (iata: string) => ({ BCN: 'Barcelona', GRO: 'Girona' })[iata] ?? iata;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  mockReduceMotion.mockReturnValue(false);
});
afterEach(() => jest.restoreAllMocks());

const setup = async (canRegenerate = true) => {
  const onRegenerate = jest.fn();
  await render(
    <PlanResult plan={plan} places={places} cityName={cityName} onRegenerate={onRegenerate} canRegenerate={canRegenerate} />,
  );
  return { onRegenerate };
};

describe('PlanResult', () => {
  it('shows the AI provenance label', async () => {
    await setup();
    expect(screen.getByText('Wygenerowane przez AI')).toBeOnTheScreen();
  });

  it('shows a header per day with number, date and city', async () => {
    await setup();
    expect(screen.getByText('Dzień 1 · 20 lis · Barcelona')).toBeOnTheScreen();
    expect(screen.getByText('Dzień 2 · 21 lis · Girona')).toBeOnTheScreen();
  });

  it('groups items by slot with slot labels', async () => {
    await setup();
    expect(screen.getAllByText('Rano')).toHaveLength(1);
    expect(screen.getAllByText('Popołudnie')).toHaveLength(1);
    expect(screen.getAllByText('Wieczór')).toHaveLength(1);
    expect(screen.getAllByText('Park Guell')).toHaveLength(2);
    expect(screen.getByText('Great views')).toBeOnTheScreen();
  });

  it('falls back for a missing place and gives it no maps link', async () => {
    await setup();
    expect(screen.getByText('Miejsce niedostępne')).toBeOnTheScreen();
    expect(screen.getByText('Lost one')).toBeOnTheScreen();
    // a (twice) + b have links, gone does not
    expect(screen.getAllByRole('link', { name: /Otwórz w Mapach Google/ })).toHaveLength(3);
  });

  it('hides the address when it is null', async () => {
    await setup();
    expect(screen.getAllByText('Carrer d’Olot')).toHaveLength(2);
    expect(screen.queryByText('null')).toBeNull();
  });

  it('opens the place in Google Maps', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup();
    await fireEvent.press(screen.getAllByRole('link', { name: /Otwórz w Mapach Google/ })[0]);
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
    const entering = (i: number) => screen.getByTestId(`plan-result-day-${i}`).props.entering;

    it('rises 8 dp over 220 ms with a 45 ms stagger, capped at the 6th block', async () => {
      await render(
        <PlanResult plan={manyDays} places={places} cityName={cityName} onRegenerate={jest.fn()} canRegenerate />,
      );
      for (let i = 0; i < manyDays.days.length; i++) {
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

    it('crossfades all blocks together over 80 ms without translation under reduced motion', async () => {
      mockReduceMotion.mockReturnValue(true);
      await setup();
      for (let i = 0; i < 2; i++) {
        expect(entering(i).durationV).toBe(tokens.motion.duration.reduced);
        expect(entering(i).delayV).toBeUndefined();
        expect(entering(i).definitions).toBeUndefined();
      }
    });
  });

  it('speaks English', async () => {
    await i18n.changeLanguage('en');
    await setup();
    expect(screen.getByText('Generated by AI')).toBeOnTheScreen();
    expect(screen.getByText('Day 1 · Nov 20 · Barcelona')).toBeOnTheScreen();
    expect(screen.getByText('Morning')).toBeOnTheScreen();
    expect(screen.getByText('Place unavailable')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Generate again' })).toBeOnTheScreen();
  });
});
