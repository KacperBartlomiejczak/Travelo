import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

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

const { listRow, focusRing } = tokens.components;
const EDIT = 'Nazwa i zdjęcie';
const BUDGET = 'Zmień budżet';
const DELETE = 'Usuń podróż';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('TripMenuSheet (trip-edit-menu D3, D15, design-context §8.8 list rows)', () => {
  it('is a sheet titled "Podróż" with three rows: name and photo, budget, delete', async () => {
    await setup(false);
    expect(screen.getByRole('header', { name: 'Podróż' })).toBeTruthy();
    const rows = screen.getAllByRole('button').map((row) => row.props.accessibilityLabel);
    expect(rows).toEqual(expect.arrayContaining([EDIT, BUDGET, DELETE]));
    expect(screen.queryByText(/zdjęcia podróży/i)).toBeNull();
  });

  it('makes every row a §8.8 list row: at least 56dp high, 16dp side and 12dp vertical padding, 20dp icon and Body MD label', async () => {
    await setup(false);
    for (const name of [EDIT, BUDGET, DELETE]) {
      const row = screen.getByRole('button', { name });
      expect(row).toHaveStyle({ minHeight: listRow.minHeight, paddingHorizontal: listRow.horizontalPadding, paddingVertical: listRow.verticalPadding });
      expect(within(row).getByText(name)).toHaveStyle(tokens.typography.styles.bodyMD);
      expect(within(row).getByTestId('trip-menu-icon', { includeHiddenElements: true }).props).toMatchObject({
        width: tokens.iconography.size.sm,
        strokeWidth: tokens.iconography.strokeWidth,
      });
    }
    expect([listRow.minHeight, listRow.horizontalPadding, listRow.verticalPadding]).toEqual([56, 16, 12]);
  });

  it('shows the label and icon of a normal row in text.primary / icon.primary, in both themes', async () => {
    await setup(false);
    const row = screen.getByRole('button', { name: BUDGET });
    expect(within(row).getByText(BUDGET)).toHaveStyle({ color: lightTheme.text.primary });
    expect(within(row).getByTestId('trip-menu-icon', { includeHiddenElements: true }).props.stroke).toBe(lightTheme.icon.primary);
  });

  it('uses the dark colours on a dark device', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TripMenuSheet offline={false} onEditDetails={jest.fn()} onChangeBudget={jest.fn()} onDelete={jest.fn()} onClose={jest.fn()} />
      </SafeAreaProvider>,
      { wrapper: DarkThemeScope },
    );
    const row = screen.getByRole('button', { name: BUDGET });
    expect(within(row).getByText(BUDGET)).toHaveStyle({ color: darkTheme.text.primary });
    expect(within(screen.getByRole('button', { name: DELETE })).getByText(DELETE)).toHaveStyle({ color: darkTheme.semantic.error.foreground });
  });

  it('presses to the sunken background and, when focused, shows a 2dp border.focus inset paid for by the padding (§8.8)', async () => {
    await setup(false);
    const row = screen.getByRole('button', { name: BUDGET });
    expect(StyleSheet.flatten(row.props.style).borderWidth).toBeUndefined();
    await fireEvent(row, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
    expect(row).toHaveStyle({ backgroundColor: lightTheme.background.sunken });
    await fireEvent(row, 'responderTerminate', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
    await fireEvent(row, 'focus');
    expect(row).toHaveStyle({
      borderWidth: focusRing.width,
      borderColor: lightTheme.border.focus,
      paddingHorizontal: listRow.horizontalPadding - focusRing.width,
      paddingVertical: listRow.verticalPadding - focusRing.width,
    });
    await fireEvent(row, 'blur');
    expect(StyleSheet.flatten(row.props.style).borderWidth).toBeUndefined();
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
    expect(within(row).getByText(DELETE)).toHaveStyle({ color: lightTheme.semantic.error.foreground });
    expect(within(row).getByTestId('trip-menu-icon', { includeHiddenElements: true }).props.stroke).toBe(lightTheme.semantic.error.foreground);
  });

  it('separates the delete row with a full-width 1dp border.subtle divider (a group, §8.8)', async () => {
    await setup(false);
    expect(screen.getByTestId('trip-menu-divider')).toHaveStyle({ height: 1, backgroundColor: lightTheme.border.subtle });
  });

  it('online: rows are enabled, no hint', async () => {
    await setup(false);
    for (const name of [EDIT, BUDGET, DELETE]) {
      expect(screen.getByRole('button', { name }).props.accessibilityState?.disabled).toBeFalsy();
    }
    expect(screen.queryByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toBeNull();
  });

  it('offline: name and delete are disabled in the disabled foreground, budget stays enabled, the hint is shown', async () => {
    const { onEditDetails, onDelete, onChangeBudget } = await setup(true);
    for (const name of [EDIT, DELETE]) {
      const row = screen.getByRole('button', { name });
      expect(row).toBeDisabled();
      expect(within(row).getByText(name)).toHaveStyle({ color: lightTheme.disabled.foreground });
      expect(within(row).getByTestId('trip-menu-icon', { includeHiddenElements: true }).props.stroke).toBe(lightTheme.disabled.foreground);
      expect(StyleSheet.flatten(row.props.style).opacity).toBeUndefined();
    }
    expect(screen.getByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toHaveStyle({
      ...tokens.typography.styles.bodySM,
      color: lightTheme.text.secondary,
    });
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
