import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';

import { PlanWizard } from '@/features/plan/PlanWizard';
import i18n from '@/i18n';
import { findAirport } from '@/lib/airport-search';

const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const destination = findAirport('BCN')!;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});
afterEach(() => jest.restoreAllMocks());

async function setup() {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  await render(<PlanWizard tripId={TRIP_ID} destination={destination} onSubmit={onSubmit} onCancel={onCancel} />);
  return { onSubmit, onCancel };
}
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const nearby = () => fireEvent.press(screen.getByRole('radio', { name: 'Też inne miasta' }));

async function addCity(query: string, option: RegExp) {
  await fireEvent.changeText(screen.getByLabelText('Dodaj miasto'), query);
  await fireEvent.press(screen.getByRole('button', { name: option }));
}

describe('PlanWizard', () => {
  it('shows every section at once, without steps or Next/Back buttons', async () => {
    await setup();
    expect(screen.getByText('Gdzie zwiedzamy?')).toBeOnTheScreen();
    expect(screen.getByLabelText('Dodaj miasto')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Spokojne tempo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ułóż plan' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Anuluj' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dalej' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Wstecz' })).toBeNull();
    expect(screen.queryByText(/Krok .* z /)).toBeNull();
  });

  it('is vertically centered, and the section titles are centered', async () => {
    await setup();
    const style = StyleSheet.flatten(screen.getByTestId('plan-wizard').props.contentContainerStyle);
    expect(style).toEqual(expect.objectContaining({ flexGrow: 1, justifyContent: 'center' }));
    expect(StyleSheet.flatten(screen.getByText('Gdzie zwiedzamy?').props.style).textAlign).toBe('center');
  });

  it('shows the radius only after "Też inne miasta", instantly, with 100 km checked', async () => {
    await setup();
    expect(screen.queryByText('W jakim promieniu szukać?')).toBeNull();
    await nearby();
    expect(screen.getByText('W jakim promieniu szukać?')).toBeOnTheScreen();
    for (const km of [50, 100, 200, 300]) expect(screen.getByRole('radio', { name: `${km} km` })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '100 km', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: `Tylko ${destination.city}` }));
    expect(screen.queryByText('W jakim promieniu szukać?')).toBeNull();
  });

  it('submits city_only with a city and preferences', async () => {
    const { onSubmit } = await setup();
    await addCity('madrid', /Madrid · MAD/);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Dużo jedzenia' }));
    await press('Ułóż plan');
    expect(onSubmit).toHaveBeenCalledWith({
      tripId: TRIP_ID,
      scope: { kind: 'city_only' },
      extraCities: ['MAD'],
      preferences: ['more_food'],
      locale: 'pl',
    });
  });

  it('submits nearby with the chosen radius', async () => {
    const { onSubmit } = await setup();
    await nearby();
    await fireEvent.press(screen.getByRole('radio', { name: '200 km' }));
    await press('Ułóż plan');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: 'nearby', radiusKm: 200 } }));
  });

  it('defaults the radius to 100 km', async () => {
    const { onSubmit } = await setup();
    await nearby();
    await press('Ułóż plan');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: 'nearby', radiusKm: 100 } }));
  });

  it('switching back to city only after choosing a radius submits city_only', async () => {
    const { onSubmit } = await setup();
    await nearby();
    await fireEvent.press(screen.getByRole('radio', { name: '200 km' }));
    await fireEvent.press(screen.getByRole('radio', { name: `Tylko ${destination.city}` }));
    await press('Ułóż plan');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: 'city_only' } }));
  });

  it('"Anuluj" calls onCancel', async () => {
    const { onCancel } = await setup();
    await press('Anuluj');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clears the "already in the plan" error when the user types again', async () => {
    await setup();
    await addCity('Barcelona', /Barcelona · BCN/);
    expect(screen.getByText('To miasto jest już w planie')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Dodaj miasto'), 'Lis');
    expect(screen.queryByText('To miasto jest już w planie')).toBeNull();
  });

  it('adds own cities as IATA codes, rejects the destination and duplicates, caps at two, and removes', async () => {
    const { onSubmit } = await setup();
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
    await press('Ułóż plan');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ extraCities: ['MAD'] }));
  });

  it('relaxed and intense pace exclude each other; other preferences combine', async () => {
    const { onSubmit } = await setup();
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
    expect(screen.getByText('Where do we explore?')).toBeOnTheScreen();
    await press('Build the plan');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
  });

  describe('system back', () => {
    function captureBack() {
      const remove = jest.fn();
      let handler: ((event: never) => boolean | null | undefined) | undefined;
      jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, h) => {
        handler = h;
        return { remove };
      });
      return { remove, press: () => handler?.(undefined as never) };
    }

    it('calls onCancel and returns true', async () => {
      const back = captureBack();
      const { onCancel } = await setup();
      expect(await act(() => back.press())).toBe(true);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('removes the listener when the wizard closes', async () => {
      const back = captureBack();
      const { unmount } = await render(
        <PlanWizard tripId={TRIP_ID} destination={destination} onSubmit={jest.fn()} onCancel={jest.fn()} />,
      );
      await unmount();
      expect(back.remove).toHaveBeenCalled();
    });

    it('does not listen while the screen is not focused', async () => {
      const add = jest.spyOn(BackHandler, 'addEventListener');
      await render(<PlanWizard tripId={TRIP_ID} destination={destination} onSubmit={jest.fn()} onCancel={jest.fn()} backActive={false} />);
      expect(add).not.toHaveBeenCalled();
    });
  });
});
