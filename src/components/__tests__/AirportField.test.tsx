import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { AirportField } from '@/components/AirportField';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { input, listRow, focusRing } = tokens.components;
const { styles } = tokens.typography;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('AirportField', () => {
  it('shows the chosen airport as "city · code"', async () => {
    await render(<AirportField label="Skąd" iata="WAW" onSelect={() => {}} />);
    expect(screen.getByLabelText('Skąd').props.value).toBe('Warsaw · WAW');
  });

  it('lists matching airports while typing and selects one', async () => {
    const onSelect = jest.fn();
    await render(<AirportField label="Dokąd" iata="" onSelect={onSelect} />);
    await fireEvent.changeText(screen.getByLabelText('Dokąd'), 'barc');
    await fireEvent.press(screen.getByRole('button', { name: /Barcelona · BCN/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ iata: 'BCN', timezone: 'Europe/Madrid' }));
  });

  it('hides the list after choosing', async () => {
    await render(<AirportField label="Dokąd" iata="" onSelect={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText('Dokąd'), 'barc');
    await fireEvent.press(screen.getByRole('button', { name: /Barcelona · BCN/ }));
    expect(screen.queryByRole('button', { name: /Barcelona · BCN/ })).toBeNull();
  });

  it('clears the choice when the user starts typing again', async () => {
    const onSelect = jest.fn();
    await render(<AirportField label="Skąd" iata="WAW" onSelect={onSelect} />);
    await fireEvent.changeText(screen.getByLabelText('Skąd'), 'kra');
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('says when nothing matches', async () => {
    await render(<AirportField label="Skąd" iata="" onSelect={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText('Skąd'), 'qqqqq');
    expect(screen.getByText('Nie znaleziono lotniska')).toBeTruthy();
  });

  it('shows an error', async () => {
    await render(<AirportField label="Skąd" iata="" error="Wybierz lotnisko" onSelect={() => {}} />);
    expect(screen.getByText('Wybierz lotnisko')).toBeTruthy();
    expect(screen.getByLabelText('Skąd').props.accessibilityHint).toBe('Wybierz lotnisko');
  });

  // Sunline Editorial §8.4 (input) and §8.8 (list row).
  describe('look', () => {
    it('draws the input like a text input: 52dp, surface.primary, 1dp border.default, bodyLG, focus border.focus', async () => {
      await render(<AirportField label="Skąd" iata="" onSelect={() => {}} />);
      const field = screen.getByLabelText('Skąd');
      expect(field).toHaveStyle({
        minHeight: input.height,
        backgroundColor: lightTheme.surface.primary,
        borderWidth: input.borderWidth,
        borderColor: lightTheme.border.default,
        borderRadius: input.radius,
        ...styles.bodyLG,
        color: lightTheme.text.primary,
      });
      expect(field.props.placeholderTextColor).toBe(lightTheme.text.tertiary);
      expect(field.props.cursorColor).toBe(lightTheme.brand.primary);
      await fireEvent(field, 'focus');
      expect(field).toHaveStyle({ borderWidth: input.focusBorderWidth, borderColor: lightTheme.border.focus });
    });

    it('draws an error border in semantic.error.foreground', async () => {
      await render(<AirportField label="Skąd" iata="" error="Wybierz lotnisko" onSelect={() => {}} />);
      expect(screen.getByLabelText('Skąd')).toHaveStyle({ borderColor: lightTheme.semantic.error.foreground });
    });

    it('draws the result list as list rows: 56dp minimum, 16/12 padding, labelLG title over caption, border.subtle dividers', async () => {
      await render(<AirportField label="Dokąd" iata="" onSelect={() => {}} />);
      await fireEvent.changeText(screen.getByLabelText('Dokąd'), 'london');
      const rows = screen.getAllByRole('button');
      expect(rows.length).toBeGreaterThan(1);
      expect(rows[0]).toHaveStyle({
        minHeight: listRow.minHeight,
        paddingHorizontal: listRow.horizontalPadding,
        paddingVertical: listRow.verticalPadding,
        backgroundColor: lightTheme.surface.primary,
      });
      expect(screen.getByTestId('airport-field-list')).toHaveStyle({
        borderColor: lightTheme.border.default,
        borderRadius: input.radius,
        backgroundColor: lightTheme.surface.primary,
      });
      expect(screen.getAllByText(/London · /)[0]).toHaveStyle({ ...styles.labelLG, color: lightTheme.text.primary });
      expect(within(rows[0]).getAllByText(/./)[1]).toHaveStyle({ ...styles.caption, color: lightTheme.text.secondary });
      // D18b: dividers start at the text column (inset by the row's horizontal padding), not full width.
      const dividers = screen.getAllByTestId('airport-option-divider');
      expect(dividers).toHaveLength(rows.length - 1);
      expect(within(rows[0]).queryByTestId('airport-option-divider')).toBeNull();
      expect(within(rows[1]).getByTestId('airport-option-divider')).toHaveStyle({
        position: 'absolute',
        top: 0,
        left: listRow.horizontalPadding,
        right: 0,
        height: input.borderWidth,
        backgroundColor: lightTheme.border.subtle,
      });
      expect(rows[1]).not.toHaveStyle({ borderTopWidth: 1 });
    });

    it('shows a row pressed as background.sunken and focused as a 2dp inset border.focus', async () => {
      await render(<AirportField label="Dokąd" iata="" onSelect={() => {}} />);
      await fireEvent.changeText(screen.getByLabelText('Dokąd'), 'barc');
      const row = screen.getAllByRole('button')[0];
      await fireEvent(row, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      expect(row).toHaveStyle({ backgroundColor: lightTheme.background.sunken });
      await fireEvent(row, 'responderRelease', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      await fireEvent(row, 'focus');
      expect(row).toHaveStyle({ borderWidth: focusRing.width, borderColor: lightTheme.border.focus });
      // D18a: the 2dp inset border is paid for by the padding, so the text does not move.
      expect(row).toHaveStyle({
        paddingHorizontal: listRow.horizontalPadding - focusRing.width,
        paddingVertical: listRow.verticalPadding - focusRing.width,
      });
      await fireEvent(row, 'blur');
      expect(row).not.toHaveStyle({ borderColor: lightTheme.border.focus });
    });

    it('says when nothing matches in secondary text, and uses the dark colors in dark mode', async () => {
      await render(<AirportField label="Skąd" iata="" onSelect={() => {}} />, { wrapper: DarkThemeScope });
      await fireEvent.changeText(screen.getByLabelText('Skąd'), 'qqqqq');
      expect(screen.getByText('Nie znaleziono lotniska')).toHaveStyle({ ...styles.bodyMD, color: darkTheme.text.secondary });
      expect(screen.getByLabelText('Skąd')).toHaveStyle({ backgroundColor: darkTheme.surface.primary });
    });
  });
});
