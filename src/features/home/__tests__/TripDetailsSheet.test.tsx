import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { TRIP_NAME_MAX_LENGTH, type TripSummary } from '@/schemas';
import { setNetwork } from '@/test/mock-network';

import { TripDetailsSheet } from '../TripDetailsSheet';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const COVER = 'file:///covers/bangkok.jpg';

function trip(patch: Partial<TripSummary> = {}): TripSummary {
  return {
    id: TRIP_ID,
    ownerId: 'local-user',
    name: 'Warsaw → Bangkok',
    coverImageUri: COVER,
    destination: 'BKK',
    startDate: '2026-11-03',
    endDate: '2026-11-15',
    baseCurrency: 'THB',
    budgetPerPerson: { amountMinor: 300000, currency: 'THB' },
    createdAt: '2026-10-04T12:00:00.000Z',
    budgetUpdatedAt: '2026-10-04T12:00:00.000Z',
    travellerCount: 3,
    ...patch,
  };
}

type Input = Parameters<TripRepository['updateDetails']>[1];
type Update = jest.Mock<Promise<void>, [string, Input]>;

// A mock `updateDetails` that answers with `impl`.
const update = (impl: () => Promise<void> = async () => {}): Update => jest.fn((_tripId: string, _input: Input) => impl());

async function setup(patch: Partial<TripSummary> = {}, updateDetails: Update = update()) {
  const onClose = jest.fn();
  const repository: TripRepository = { ...createInMemoryTripRepository(), updateDetails };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppProviders tripRepository={repository}>
        <TripDetailsSheet trip={trip(patch)} onClose={onClose} />
      </AppProviders>
    </SafeAreaProvider>,
  );
  return { onClose, updateDetails };
}

const NAME = 'Nazwa podróży';
const save = () => screen.getByRole('button', { name: 'Zapisz' });

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TripDetailsSheet (trip-edit-menu A2, A3, D5, D12)', () => {
  it('is a sheet titled "Nazwa i zdjęcie", prefilled with the trip\'s name and cover', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Nazwa i zdjęcie' })).toBeTruthy();
    expect(screen.getByLabelText(NAME).props.value).toBe('Warsaw → Bangkok');
    expect(screen.getByLabelText('Wybrane zdjęcie okładki')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
  });

  it('shows the picker without a photo when the trip has no cover', async () => {
    await setup({ coverImageUri: undefined });
    expect(screen.queryByLabelText('Wybrane zdjęcie okładki')).toBeNull();
    expect(screen.getByRole('button', { name: 'Wybierz z galerii' })).toBeTruthy();
  });

  it('saves the trimmed name with the cover, then closes', async () => {
    const { onClose, updateDetails } = await setup();
    await fireEvent.changeText(screen.getByLabelText(NAME), '  Bangkok z Kasią  ');
    await fireEvent.press(save());
    expect(updateDetails).toHaveBeenCalledTimes(1);
    expect(updateDetails).toHaveBeenCalledWith(TRIP_ID, { name: 'Bangkok z Kasią', coverImageUri: COVER });
    await screen.findByLabelText(NAME);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says so and saves nothing when the name is empty', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { onClose, updateDetails } = await setup();
    await fireEvent.changeText(screen.getByLabelText(NAME), '   ');
    await fireEvent.press(save());
    expect(screen.getByText('Podaj nazwę podróży')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Popraw zaznaczone pola');
    expect(updateDetails).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops typing at the name limit', async () => {
    await setup();
    expect(screen.getByLabelText(NAME).props.maxLength).toBe(TRIP_NAME_MAX_LENGTH);
    expect(TRIP_NAME_MAX_LENGTH).toBe(60);
  });

  it('says the name is too long and saves nothing when it gets past the limit', async () => {
    const { updateDetails } = await setup();
    await fireEvent.changeText(screen.getByLabelText(NAME), 'a'.repeat(TRIP_NAME_MAX_LENGTH + 1));
    await fireEvent.press(save());
    expect(screen.getByText('Nazwa może mieć do 60 znaków')).toBeTruthy();
    expect(updateDetails).not.toHaveBeenCalled();
  });

  it('follows the name after the first save attempt: the message goes away once the name is valid', async () => {
    await setup();
    await fireEvent.changeText(screen.getByLabelText(NAME), '');
    await fireEvent.press(save());
    expect(screen.getByText('Podaj nazwę podróży')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(NAME), 'Bangkok');
    expect(screen.queryByText('Podaj nazwę podróży')).toBeNull();
  });

  it('removes the cover: saving sends no coverImageUri', async () => {
    const { updateDetails } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Usuń zdjęcie' }));
    expect(screen.queryByLabelText('Wybrane zdjęcie okładki')).toBeNull();
    await fireEvent.press(save());
    expect(updateDetails).toHaveBeenCalledTimes(1);
    expect(updateDetails.mock.calls[0][0]).toBe(TRIP_ID);
    expect(updateDetails.mock.calls[0][1]).toEqual({ name: 'Warsaw → Bangkok' });
    expect(updateDetails.mock.calls[0][1]).not.toHaveProperty('coverImageUri');
  });

  it('shows the button loading while saving, and does not save twice', async () => {
    let finish: () => void = () => {};
    const { updateDetails } = await setup(
      {},
      update(() => new Promise<void>((resolve) => (finish = resolve))),
    );
    await fireEvent.press(save());
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeBusy();
    await fireEvent.press(save());
    expect(updateDetails).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it('keeps the sheet open with an inline error and the typed values when saving fails', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { onClose, updateDetails } = await setup({}, update(() => Promise.reject(new Error('boom'))));
    await fireEvent.changeText(screen.getByLabelText(NAME), 'Nowa nazwa');
    await fireEvent.press(save());
    expect(await screen.findByText('Nie udało się zapisać. Spróbuj ponownie.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Nie udało się zapisać. Spróbuj ponownie.');
    expect(updateDetails).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(NAME).props.value).toBe('Nowa nazwa');
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
  });

  it('offline while open: saving is disabled with the offline hint, nothing is sent (D5)', async () => {
    const { updateDetails } = await setup();
    expect(screen.queryByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toBeNull();
    await act(async () => setNetwork({ isConnected: false, isInternetReachable: false }));
    expect(screen.getByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toBeTruthy();
    expect(save()).toBeDisabled();
    await fireEvent.press(save());
    expect(updateDetails).not.toHaveBeenCalled();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await setup();
    expect(screen.getByRole('header', { name: 'Name and photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});
