import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { TRIP_NAME_MAX_LENGTH, type TripSummary } from '@/schemas';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

import { TripDetailsSheet } from '../TripDetailsSheet';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const COVER_ID = '5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
const COVER = `photo:${COVER_ID}` as const;

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
    expect(screen.getByRole('radio', { name: 'Twoje zdjęcie', checked: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
  });

  it("starts on the trip's own preset cover", async () => {
    await setup({ coverImageUri: 'preset:bali' });
    expect(screen.getByRole('radio', { name: 'Bali', checked: true })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Twoje zdjęcie' })).toBeNull();
  });

  it('shows the trip\'s gallery cover as the first tile and the preview, from its signed URLs (trip-covers step 5)', async () => {
    const coverUrls = { url: 'https://example.com/signed/cover.jpg?token=a', thumbnailUrl: 'https://example.com/signed/cover_thumb.jpg?token=a' };
    await setup({ coverUrls });
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAccessibleName('Twoje zdjęcie');
    expect(radios[0]).toBeChecked();
    const hidden = { includeHiddenElements: true };
    expect(within(radios[0]).getByTestId('cover-tile-image', hidden).props.source).toEqual([{ uri: coverUrls.thumbnailUrl, cacheKey: `cover:${COVER_ID}:thumbnail` }]);
    expect(screen.getByTestId('cover-preview', hidden).props.source).toEqual([{ uri: coverUrls.url, cacheKey: `cover:${COVER_ID}:full` }]);
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

  it('cannot remove the cover: choosing another preset saves that one', async () => {
    const { updateDetails } = await setup();
    expect(screen.queryByRole('button', { name: 'Usuń zdjęcie' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Pekin' }));
    expect(screen.getByRole('radio', { name: 'Pekin', checked: true })).toBeTruthy();
    await fireEvent.press(save());
    expect(updateDetails).toHaveBeenCalledTimes(1);
    expect(updateDetails).toHaveBeenCalledWith(TRIP_ID, { name: 'Warsaw → Bangkok', coverImageUri: 'preset:beijing' });
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
    // Error copy in the error foreground, Body SM (§8.0 error).
    expect(await screen.findByText('Nie udało się zapisać. Spróbuj ponownie.')).toHaveStyle({
      ...tokens.typography.styles.bodySM,
      color: lightTheme.semantic.error.foreground,
    });
    expect(announce).toHaveBeenCalledWith('Nie udało się zapisać. Spróbuj ponownie.');
    expect(updateDetails).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(NAME).props.value).toBe('Nowa nazwa');
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
  });

  it('shows the same error and keeps the sheet open when the cover is no longer the stored one (cover-not-current)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { onClose, updateDetails } = await setup({}, update(() => Promise.reject(new Error('cover-not-current'))));
    await fireEvent.press(save());
    expect(await screen.findByText('Nie udało się zapisać. Spróbuj ponownie.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Nie udało się zapisać. Spróbuj ponownie.');
    expect(updateDetails).toHaveBeenCalledWith(TRIP_ID, { name: 'Warsaw → Bangkok', coverImageUri: COVER });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
  });

  it('offline while open: saving is disabled with the offline hint, nothing is sent (D5)', async () => {
    const { updateDetails } = await setup();
    expect(screen.queryByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toBeNull();
    await act(async () => setNetwork({ isConnected: false, isInternetReachable: false }));
    expect(screen.getByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toHaveStyle({
      ...tokens.typography.styles.bodySM,
      color: lightTheme.text.secondary,
    });
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
