import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import type { TripSummary } from '@/schemas';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/legacy/theme';
import { lightTheme as sunlineLightTheme } from '@/theme/theme';

import { DeleteTripSheet } from '../DeleteTripSheet';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';

function trip(patch: Partial<TripSummary> = {}): TripSummary {
  return {
    id: TRIP_ID,
    ownerId: 'local-user',
    name: 'Warsaw → Bangkok',
    coverImageUri: 'preset:auckland',
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

type Remove = jest.Mock<Promise<void>, [string]>;
const remove = (impl: () => Promise<void> = async () => {}): Remove => jest.fn((_tripId: string) => impl());

async function setup(deleteTrip: Remove = remove()) {
  const onClose = jest.fn();
  const onDeleted = jest.fn();
  const repository: TripRepository = { ...createInMemoryTripRepository(), delete: deleteTrip };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppProviders tripRepository={repository}>
        <DeleteTripSheet trip={trip()} onClose={onClose} onDeleted={onDeleted} />
      </AppProviders>
    </SafeAreaProvider>,
  );
  return { onClose, onDeleted, deleteTrip };
}

const confirm = () => screen.getByRole('button', { name: 'Usuń podróż' });
const cancel = () => screen.getByRole('button', { name: 'Anuluj' });
const OFFLINE_HINT = 'Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DeleteTripSheet (trip-edit-menu D7, D8, D10, D19)', () => {
  it('asks with the trip\'s name in the title and says what goes away', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Usunąć podróż „Warsaw → Bangkok”?' })).toBeTruthy();
    expect(screen.getByText('Znikną loty, uczestnicy, budżet i zdjęcia. Tego nie da się cofnąć.')).toBeTruthy();
  });

  it('puts the destructive "Usuń podróż" above "Anuluj", full width and 16dp apart, never adjacent (D19)', async () => {
    await setup();
    expect(screen.getByText('Usuń podróż')).toHaveStyle({ color: sunlineLightTheme.semantic.error.foreground });
    // One column, "Usuń podróż" first; the gap between the two is spacing[4].
    const actions = screen.getByTestId('delete-trip-actions');
    expect(actions).toHaveStyle({ gap: lightTheme.spacing[4] });
    expect(within(actions).getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual(['Usuń podróż', 'Anuluj']);
    // Stretched across the sheet: no centring or row direction on the container that would shrink them.
    expect(StyleSheet.flatten(actions.props.style).alignItems).toBeUndefined();
    expect(StyleSheet.flatten(actions.props.style).flexDirection).toBeUndefined();
  });

  it('"Anuluj" closes the sheet and deletes nothing', async () => {
    const { onClose, onDeleted, deleteTrip } = await setup();
    await fireEvent.press(cancel());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deleteTrip).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('"Usuń podróż" deletes the trip, then reports it', async () => {
    const { onClose, onDeleted, deleteTrip } = await setup();
    await fireEvent.press(confirm());
    expect(deleteTrip).toHaveBeenCalledTimes(1);
    expect(deleteTrip).toHaveBeenCalledWith(TRIP_ID);
    await act(async () => {});
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('while deleting, both buttons are disabled and a second press does not delete twice', async () => {
    let finish: () => void = () => {};
    const { deleteTrip, onDeleted } = await setup(remove(() => new Promise<void>((resolve) => (finish = resolve))));
    await fireEvent.press(confirm());
    // The mutation reports "pending" a tick after the press.
    await waitFor(() => expect(confirm()).toBeDisabled());
    expect(cancel()).toBeDisabled();
    await fireEvent.press(confirm());
    expect(deleteTrip).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet open with an inline error when deleting fails, and lets the user try again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const deleteTrip = remove();
    deleteTrip.mockRejectedValueOnce(new Error('trip-not-deletable'));
    const { onClose, onDeleted } = await setup(deleteTrip);
    await fireEvent.press(confirm());
    expect(await screen.findByText('Nie udało się usunąć podróży. Spróbuj ponownie.')).toBeTruthy();
    // Announced once, by the call; a live region on the text would read it a second time (as in Snackbar).
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Nie udało się usunąć podróży. Spróbuj ponownie.');
    expect(screen.getByText('Nie udało się usunąć podróży. Spróbuj ponownie.').props.accessibilityLiveRegion).toBeUndefined();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(confirm()).toBeEnabled();
    expect(cancel()).toBeEnabled();
    await fireEvent.press(confirm());
    await act(async () => {});
    expect(deleteTrip).toHaveBeenCalledTimes(2);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('while deleting, a backdrop tap and the back button do not dismiss the sheet', async () => {
    let finish: () => void = () => {};
    const { onClose } = await setup(remove(() => new Promise<void>((resolve) => (finish = resolve))));
    await fireEvent.press(confirm());
    await waitFor(() => expect(confirm()).toBeDisabled());
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
    await fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
  });

  it('after deleting fails, the error stays visible and a backdrop tap closes the sheet again', async () => {
    const deleteTrip = remove();
    deleteTrip.mockRejectedValueOnce(new Error('trip-not-deletable'));
    const { onClose } = await setup(deleteTrip);
    await fireEvent.press(confirm());
    expect(await screen.findByText('Nie udało się usunąć podróży. Spróbuj ponownie.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offline while open: delete is disabled with the offline hint, nothing is sent (D8)', async () => {
    const { deleteTrip } = await setup();
    expect(screen.queryByText(OFFLINE_HINT)).toBeNull();
    await act(async () => setNetwork({ isConnected: false, isInternetReachable: false }));
    expect(screen.getByText(OFFLINE_HINT)).toBeTruthy();
    expect(confirm()).toBeDisabled();
    await fireEvent.press(confirm());
    expect(deleteTrip).not.toHaveBeenCalled();
    // Cancelling stays possible.
    expect(cancel()).toBeEnabled();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await setup();
    expect(screen.getByRole('header', { name: 'Delete trip “Warsaw → Bangkok”?' })).toBeTruthy();
    expect(screen.getByText("Flights, members, budget and photos will be gone. This can't be undone.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete trip' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });
});
