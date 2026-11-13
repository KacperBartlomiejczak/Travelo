import { fireEvent, render, screen } from '@testing-library/react-native';
import { FadeIn, FadeOut, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';

import { PlanWizard } from '@/features/plan/PlanWizard';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import i18n from '@/i18n';
import { findAirport } from '@/lib/airport-search';
import { tokens } from '@/theme/tokens';

jest.mock('@/hooks/useReduceMotion');
const mockReduceMotion = jest.mocked(useReduceMotion);

const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const destination = findAirport('BCN')!;
const { emphasis, reduced } = tokens.motion.duration;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  mockReduceMotion.mockReturnValue(false);
});
afterEach(() => jest.restoreAllMocks());

async function setup() {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  await render(<PlanWizard tripId={TRIP_ID} destination={destination} onSubmit={onSubmit} onCancel={onCancel} />);
  return { onSubmit, onCancel };
}
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const next = () => press('Dalej');

async function addCity(query: string, option: RegExp) {
  await fireEvent.changeText(screen.getByLabelText('Dodaj miasto'), query);
  await fireEvent.press(screen.getByRole('button', { name: option }));
}

describe('PlanWizard', () => {
  it('asks the scope question first, with the destination city', async () => {
    await setup();
    expect(screen.getByText(`Tylko ${destination.city}?`)).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: `Tylko ${destination.city}` })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Też inne miasta' })).toBeOnTheScreen();
  });

  it('city only skips the radius card and submits scope city_only', async () => {
    const { onSubmit } = await setup();
    await fireEvent.press(screen.getByRole('radio', { name: `Tylko ${destination.city}` }));
    await next(); // -> own cities
    expect(screen.queryByText(/Jak daleko/)).toBeNull();
    await next(); // -> preferences
    await press('Ułóż plan');
    expect(onSubmit).toHaveBeenCalledWith({
      tripId: TRIP_ID,
      scope: { kind: 'city_only' },
      extraCities: [],
      preferences: [],
      locale: 'pl',
    });
  });

  it('other cities shows the radius card and submits the chosen radius', async () => {
    const { onSubmit } = await setup();
    await fireEvent.press(screen.getByRole('radio', { name: 'Też inne miasta' }));
    await next();
    expect(screen.getByText(`Jak daleko od ${destination.city}?`)).toBeOnTheScreen();
    for (const km of [50, 100, 200, 300]) expect(screen.getByRole('radio', { name: `${km} km` })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: '200 km' }));
    await next();
    await next();
    await press('Ułóż plan');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: 'nearby', radiusKm: 200 } }));
  });

  it('back goes to the previous card and cancel on the first card calls onCancel', async () => {
    const { onCancel } = await setup();
    await fireEvent.press(screen.getByRole('radio', { name: 'Też inne miasta' }));
    await next();
    await press('Wstecz');
    expect(screen.getByText(`Tylko ${destination.city}?`)).toBeOnTheScreen();
    await press('Anuluj');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('adds own cities as IATA codes, rejects the destination and duplicates, caps at two, and removes', async () => {
    const { onSubmit } = await setup();
    await next(); // scope default: city only -> own cities
    await addCity('barcelona', /Barcelona · BCN/);
    expect(screen.getByText('To miasto jest już w planie')).toBeOnTheScreen();
    await addCity('madrid', /Madrid · MAD/);
    await addCity('madrid', /Madrid · MAD/);
    expect(screen.getByText('To miasto jest już w planie')).toBeOnTheScreen();
    await addCity('lisbon', /Lisbon · LIS/);
    expect(screen.queryByLabelText('Dodaj miasto')).toBeNull(); // limit reached
    expect(screen.getAllByRole('button', { name: /Usuń miasto/ })).toHaveLength(2);
    await press('Usuń miasto, Lisbon');
    expect(screen.getAllByRole('button', { name: /Usuń miasto/ })).toHaveLength(1);
    await next();
    await press('Ułóż plan');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ extraCities: ['MAD'] }));
  });

  it('relaxed and intense pace exclude each other; other preferences combine', async () => {
    const { onSubmit } = await setup();
    await next();
    await next();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Spokojne tempo' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Intensywnie' }));
    expect(screen.getByRole('checkbox', { name: 'Spokojne tempo' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Intensywnie' })).toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Dużo jedzenia' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Bez muzeów' }));
    await press('Ułóż plan');
    expect(onSubmit.mock.calls[0][0].preferences.slice().sort()).toEqual(['more_food', 'no_museums', 'pace_intense']);
  });

  it('works in English and sends the English locale', async () => {
    await i18n.changeLanguage('en');
    const { onSubmit } = await setup();
    expect(screen.getByText(`Only ${destination.city}?`)).toBeOnTheScreen();
    await press('Next');
    await press('Next');
    await press('Build the plan');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
  });

  describe('motion', () => {
    it('slides forward with the emphasis duration and does not fade', async () => {
      const inDuration = jest.spyOn(SlideInRight, 'duration');
      const outDuration = jest.spyOn(SlideOutLeft, 'duration');
      const fadeDuration = jest.spyOn(FadeIn, 'duration');
      await setup();
      await next();
      expect(inDuration).toHaveBeenCalledWith(emphasis);
      expect(outDuration).toHaveBeenCalledWith(emphasis);
      expect(fadeDuration).not.toHaveBeenCalled();
    });

    it('slides back the other way', async () => {
      const inDuration = jest.spyOn(SlideInLeft, 'duration');
      const outDuration = jest.spyOn(SlideOutRight, 'duration');
      await setup();
      await next();
      await press('Wstecz');
      expect(inDuration).toHaveBeenCalledWith(emphasis);
      expect(outDuration).toHaveBeenCalledWith(emphasis);
    });

    it('with reduced motion only fades, with the reduced duration', async () => {
      mockReduceMotion.mockReturnValue(true);
      const slide = jest.spyOn(SlideInRight, 'duration');
      const fadeIn = jest.spyOn(FadeIn, 'duration');
      const fadeOut = jest.spyOn(FadeOut, 'duration');
      await setup();
      await next();
      expect(slide).not.toHaveBeenCalled();
      expect(fadeIn).toHaveBeenCalledWith(reduced);
      expect(fadeOut).toHaveBeenCalledWith(reduced);
    });
  });
});
