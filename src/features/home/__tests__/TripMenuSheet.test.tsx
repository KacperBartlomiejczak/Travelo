import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/i18n';
import { lightTheme } from '@/theme/legacy/theme';

import { TripMenuSheet } from '../TripMenuSheet';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

async function setup(offline: boolean) {
  const handlers = { onEditDetails: jest.fn(), onChangeBudget: jest.fn(), onDelete: jest.fn(), onClose: jest.fn() };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TripMenuSheet offline={offline} {...handlers} />
    </SafeAreaProvider>,
  );
  return handlers;
}

const EDIT = 'Nazwa i zdjęcie';
const BUDGET = 'Zmień budżet';
const DELETE = 'Usuń podróż';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('TripMenuSheet (trip-edit-menu D3, D15, design-context §10.8)', () => {
  it('is a sheet titled "Podróż" with three rows: name and photo, budget, delete', async () => {
    await setup(false);
    expect(screen.getByRole('header', { name: 'Podróż' })).toBeTruthy();
    const rows = screen.getAllByRole('button').map((row) => row.props.accessibilityLabel);
    expect(rows).toEqual(expect.arrayContaining([EDIT, BUDGET, DELETE]));
    expect(screen.queryByText(/zdjęcia podróży/i)).toBeNull();
  });

  it('makes every row at least 64dp high with 16dp side padding', async () => {
    await setup(false);
    for (const name of [EDIT, BUDGET, DELETE]) {
      expect(screen.getByRole('button', { name })).toHaveStyle({
        minHeight: lightTheme.spacing[16],
        paddingHorizontal: lightTheme.spacing[4],
      });
    }
    expect(lightTheme.spacing[16]).toBe(64);
  });

  it('calls the matching handler for each row', async () => {
    const { onEditDetails, onChangeBudget, onDelete } = await setup(false);
    await fireEvent.press(screen.getByRole('button', { name: EDIT }));
    await fireEvent.press(screen.getByRole('button', { name: BUDGET }));
    await fireEvent.press(screen.getByRole('button', { name: DELETE }));
    expect(onEditDetails).toHaveBeenCalledTimes(1);
    expect(onChangeBudget).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows the delete row in the error colour, icon and label (D15)', async () => {
    await setup(false);
    const row = screen.getByRole('button', { name: DELETE });
    expect(within(row).getByText(DELETE)).toHaveStyle({ color: lightTheme.colors.status.error });
    expect(within(row).getByTestId('trip-menu-icon', { includeHiddenElements: true }).props.stroke).toBe(lightTheme.colors.status.error);
  });

  it('separates the delete row with a 1dp divider', async () => {
    await setup(false);
    expect(screen.getByTestId('trip-menu-divider')).toHaveStyle({ height: 1, backgroundColor: lightTheme.colors.divider });
  });

  it('online: rows are enabled, no hint', async () => {
    await setup(false);
    for (const name of [EDIT, BUDGET, DELETE]) {
      expect(screen.getByRole('button', { name }).props.accessibilityState?.disabled).toBeFalsy();
    }
    expect(screen.queryByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toBeNull();
  });

  it('offline: name and delete are disabled and greyed out, budget stays enabled, the hint is shown', async () => {
    const { onEditDetails, onDelete, onChangeBudget } = await setup(true);
    for (const name of [EDIT, DELETE]) {
      const row = screen.getByRole('button', { name });
      expect(row).toBeDisabled();
      expect(within(row).getByText(name)).toHaveStyle({ color: lightTheme.colors.text.tertiary });
      expect(within(row).getByTestId('trip-menu-icon', { includeHiddenElements: true }).props.stroke).toBe(lightTheme.colors.text.tertiary);
    }
    expect(screen.getByRole('button', { name: BUDGET })).toBeEnabled();
    expect(screen.getByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: EDIT }));
    await fireEvent.press(screen.getByRole('button', { name: DELETE }));
    expect(onEditDetails).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: BUDGET }));
    expect(onChangeBudget).toHaveBeenCalledTimes(1);
  });

  it('closes from the backdrop', async () => {
    const { onClose } = await setup(false);
    await fireEvent.press(within(screen.getByTestId('bottom-sheet-modal')).getByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await setup(true);
    expect(screen.getByRole('header', { name: 'Trip' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Name and photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change budget' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete trip' })).toBeDisabled();
    expect(screen.getByText('You need internet to rename or delete the trip.')).toBeTruthy();
  });
});
