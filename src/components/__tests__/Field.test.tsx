import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Field, inputBorder, inputBoxStyle } from '@/components/Field';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { input } = tokens.components;
const { styles } = tokens.typography;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

/** Where a text sits in the rendered tree: a smaller number is higher on the screen. */
const position = (text: string) => JSON.stringify(screen.toJSON()).indexOf(text);

describe('Field', () => {
  it('puts the hint and the error under the control by default', async () => {
    await render(
      <Field label="Imię" hint="Podpowiedź">
        <View testID="control" accessibilityLabel="STEROWANIE" />
      </Field>,
    );
    expect(position('Imię')).toBeLessThan(position('STEROWANIE'));
    expect(position('STEROWANIE')).toBeLessThan(position('Podpowiedź'));

    await screen.rerender(
      <Field label="Imię" hint="Podpowiedź" error="Błąd">
        <View testID="control" accessibilityLabel="STEROWANIE" />
      </Field>,
    );
    expect(position('STEROWANIE')).toBeLessThan(position('Błąd'));
  });

  describe('with messagesFirst', () => {
    it('puts the hint between the label and the control', async () => {
      await render(
        <Field label="Zainteresowania" hint="Wybierz co najmniej jedno." messagesFirst>
          <View testID="control" accessibilityLabel="STEROWANIE" />
        </Field>,
      );
      expect(position('Zainteresowania')).toBeLessThan(position('Wybierz co najmniej jedno.'));
      expect(position('Wybierz co najmniej jedno.')).toBeLessThan(position('STEROWANIE'));
    });

    it('puts the error between the label and the control, with its icon, as a live region, and hides the hint', async () => {
      await render(
        <Field label="Zainteresowania" hint="Podpowiedź" error="Wybierz co najmniej jedno." messagesFirst>
          <View testID="control" accessibilityLabel="STEROWANIE" />
        </Field>,
      );
      expect(position('Zainteresowania')).toBeLessThan(position('Wybierz co najmniej jedno.'));
      expect(position('Wybierz co najmniej jedno.')).toBeLessThan(position('STEROWANIE'));
      expect(screen.queryByText('Podpowiedź')).toBeNull();
      expect(screen.getByText('Wybierz co najmniej jedno.').props.accessibilityLiveRegion).toBe('polite');
      expect(screen.getByTestId('field-error-icon', { includeHiddenElements: true })).toBeTruthy();
    });

    it('shows nothing extra without a hint or an error', async () => {
      await render(
        <Field label="Zainteresowania" messagesFirst>
          <View testID="control" accessibilityLabel="STEROWANIE" />
        </Field>,
      );
      expect(screen.getByLabelText('STEROWANIE')).toBeTruthy();
      expect(screen.queryByTestId('field-error-icon', { includeHiddenElements: true })).toBeNull();
    });
  });

  // Sunline Editorial §8.4: external label, helper and error lines.
  describe('Sunline Editorial look (§8.4)', () => {
    it('draws the label as labelMD in text.primary, with the optional mark in text.secondary', async () => {
      await render(
        <Field label="Imię" optional>
          <View />
        </Field>,
      );
      expect(screen.getByText('Imię', { exact: false })).toHaveStyle({ ...styles.labelMD, color: lightTheme.text.primary });
      expect(screen.getByText('(opcjonalnie)', { exact: false })).toHaveStyle({ color: lightTheme.text.secondary });
    });

    it('draws the hint as caption in text.secondary', async () => {
      await render(
        <Field label="Imię" hint="Podpowiedź">
          <View />
        </Field>,
      );
      expect(screen.getByText('Podpowiedź')).toHaveStyle({ ...styles.caption, color: lightTheme.text.secondary });
    });

    it('draws the error as a 16dp CircleAlert and caption text, both in semantic.error.foreground', async () => {
      await render(
        <Field label="Imię" error="Wpisz imię">
          <View />
        </Field>,
      );
      expect(screen.getByText('Wpisz imię')).toHaveStyle({ ...styles.caption, color: lightTheme.semantic.error.foreground });
      const icon = screen.getByTestId('field-error-icon', { includeHiddenElements: true });
      expect(icon.props.width).toBe(tokens.iconography.size.xs);
      expect(icon.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
      expect(icon.props.stroke).toBe(lightTheme.semantic.error.foreground);
    });

    it('keeps the label gap 8 above the control and the helper gap 6 below it', async () => {
      await render(
        <Field label="Imię" hint="Podpowiedź">
          <View testID="control" />
        </Field>,
      );
      expect(screen.getByText('Imię')).toHaveStyle({ marginBottom: input.labelGap });
      expect(screen.getByTestId('field-messages')).toHaveStyle({ marginTop: input.helperGap });
    });

    it('uses the dark colors in dark mode', async () => {
      await render(
        <Field label="Imię" error="Wpisz imię">
          <View />
        </Field>,
        { wrapper: DarkThemeScope },
      );
      expect(screen.getByText('Imię')).toHaveStyle({ color: darkTheme.text.primary });
      expect(screen.getByText('Wpisz imię')).toHaveStyle({ color: darkTheme.semantic.error.foreground });
    });
  });
});

describe('inputBorder / inputBoxStyle (§8.4)', () => {
  const idle = { focused: false, error: false };

  it('is 1dp border.default by default', () => {
    expect(inputBorder(lightTheme, idle)).toEqual({ borderWidth: 1, borderColor: lightTheme.border.default });
  });

  it('is 2dp border.focus when focused', () => {
    expect(inputBorder(lightTheme, { ...idle, focused: true })).toEqual({ borderWidth: 2, borderColor: lightTheme.border.focus });
  });

  it('is 2dp semantic.error.foreground on error, also while focused', () => {
    const error = { borderWidth: 2, borderColor: lightTheme.semantic.error.foreground };
    expect(inputBorder(lightTheme, { ...idle, error: true })).toEqual(error);
    expect(inputBorder(lightTheme, { focused: true, error: true })).toEqual(error);
  });

  it('keeps border.default when disabled and focused, but an error stays visible: 2dp error border (D16)', () => {
    const defaults = { borderWidth: 1, borderColor: lightTheme.border.default };
    expect(inputBorder(lightTheme, { ...idle, disabled: true })).toEqual(defaults);
    expect(inputBorder(lightTheme, { ...idle, focused: true, disabled: true })).toEqual(defaults);
    expect(inputBorder(lightTheme, { ...idle, error: true, disabled: true })).toEqual({
      borderWidth: 2,
      borderColor: lightTheme.semantic.error.foreground,
    });
  });

  it('builds the box: 52dp, 16dp radius, surface.primary, padding compensated for the thicker border', () => {
    expect(inputBoxStyle(lightTheme, idle)).toMatchObject({
      minHeight: input.height,
      borderRadius: input.radius,
      backgroundColor: lightTheme.surface.primary,
      paddingHorizontal: input.horizontalPadding,
    });
    expect(inputBoxStyle(darkTheme, { ...idle, focused: true }).paddingHorizontal).toBe(
      input.horizontalPadding - (input.focusBorderWidth - input.borderWidth),
    );
  });

  it('uses the disabled tokens when disabled', () => {
    expect(inputBoxStyle(lightTheme, { ...idle, disabled: true }).backgroundColor).toBe(lightTheme.disabled.background);
  });
});
