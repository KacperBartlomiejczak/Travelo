import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { TextField } from '@/components/TextField';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { input } = tokens.components;
const { styles } = tokens.typography;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('TextField', () => {
  it('labels the input and reports typing', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Nr lotu" value="" onChangeText={onChangeText} />);
    expect(screen.getByText('Nr lotu')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nr lotu'), 'EK180');
    expect(onChangeText).toHaveBeenCalledWith('EK180');
  });

  it('marks optional fields', async () => {
    await render(<TextField label="Nr lotu" optional value="" onChangeText={() => {}} />);
    expect(screen.getByText('(opcjonalnie)')).toBeTruthy();
  });

  // Sunline Editorial §8.4.
  it('is 52dp, 16dp radius, surface.primary with a 1dp border.default by default, value in bodyLG', async () => {
    await render(<TextField label="Imię" value="" onChangeText={() => {}} />);
    const field = screen.getByLabelText('Imię');
    expect(field).toHaveStyle({
      minHeight: input.height,
      borderWidth: input.borderWidth,
      borderColor: lightTheme.border.default,
      borderRadius: input.radius,
      backgroundColor: lightTheme.surface.primary,
      paddingHorizontal: input.horizontalPadding,
      ...styles.bodyLG,
      color: lightTheme.text.primary,
    });
    expect(field.props.placeholderTextColor).toBe(lightTheme.text.tertiary);
    expect(field.props.cursorColor).toBe(lightTheme.brand.primary);
  });

  it('shows an error under the field with a 2dp error border, an icon, and reads it to screen readers', async () => {
    await render(<TextField label="Imię" value="" error="Wpisz imię" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Imię').props.accessibilityHint).toBe('Wpisz imię');
    expect(screen.getByText('Wpisz imię')).toHaveStyle({ color: lightTheme.semantic.error.foreground });
    expect(screen.getByTestId('field-error-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Imię')).toHaveStyle({
      borderWidth: input.focusBorderWidth,
      borderColor: lightTheme.semantic.error.foreground,
    });
  });

  it('shows a 2dp border.focus border while focused, without changing the text position', async () => {
    await render(<TextField label="Imię" value="" onChangeText={() => {}} />);
    await fireEvent(screen.getByLabelText('Imię'), 'focus');
    expect(screen.getByLabelText('Imię')).toHaveStyle({
      borderWidth: input.focusBorderWidth,
      borderColor: lightTheme.border.focus,
      paddingHorizontal: input.horizontalPadding - (input.focusBorderWidth - input.borderWidth),
    });
    await fireEvent(screen.getByLabelText('Imię'), 'blur');
    expect(screen.getByLabelText('Imię')).toHaveStyle({ borderWidth: input.borderWidth, borderColor: lightTheme.border.default });
  });

  it('uses the dark colors in dark mode', async () => {
    await render(<TextField label="Imię" value="" onChangeText={() => {}} />, { wrapper: DarkThemeScope });
    await fireEvent(screen.getByLabelText('Imię'), 'focus');
    expect(screen.getByLabelText('Imię')).toHaveStyle({
      backgroundColor: darkTheme.surface.primary,
      borderColor: darkTheme.border.focus,
      color: darkTheme.text.primary,
    });
    expect(screen.getByLabelText('Imię').props.cursorColor).toBe(darkTheme.brand.primary);
  });

  it('draws no browser outline on top of its own focus border (web)', async () => {
    await render(<TextField label="Imię" value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Imię')).toHaveStyle({ outlineStyle: 'solid', outlineWidth: 0 });
  });
});

describe('TextField hint (auth-onboarding step 8)', () => {
  it('shows a hint under the field and reads it to screen readers', async () => {
    await render(<TextField label="Nick" hint="3–20 znaków" value="" onChangeText={() => {}} />);
    expect(screen.getByText('3–20 znaków')).toBeTruthy();
    expect(screen.getByText('3–20 znaków')).toHaveStyle({ ...styles.caption, color: lightTheme.text.secondary });
    expect(screen.getByLabelText('Nick').props.accessibilityHint).toBe('3–20 znaków');
  });

  it('hides the hint while the error shows, and the error is what is read', async () => {
    await render(<TextField label="Nick" hint="3–20 znaków" error="Wpisz nick." value="" onChangeText={() => {}} />);
    expect(screen.queryByText('3–20 znaków')).toBeNull();
    expect(screen.getByText('Wpisz nick.')).toBeTruthy();
    expect(screen.getByLabelText('Nick').props.accessibilityHint).toBe('Wpisz nick.');
  });

  it('shows no hint by default', async () => {
    await render(<TextField label="Nick" value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Nick').props.accessibilityHint).toBeUndefined();
  });
});

describe('TextField input behaviour (auth-onboarding step 7)', () => {
  it('passes the keyboard hints, autofill hints and focus request on to the input', async () => {
    await render(
      <TextField
        label="Kod"
        value=""
        onChangeText={() => {}}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        returnKeyType="send"
      />,
    );
    const input = screen.getByLabelText('Kod');
    expect(input.props.keyboardType).toBe('number-pad');
    expect(input.props.autoComplete).toBe('one-time-code');
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.autoFocus).toBe(true);
    expect(input.props.returnKeyType).toBe('send');
  });

  it('reports the keyboard submit', async () => {
    const onSubmitEditing = jest.fn();
    await render(<TextField label="E-mail" value="" onChangeText={() => {}} onSubmitEditing={onSubmitEditing} />);
    await fireEvent(screen.getByLabelText('E-mail'), 'submitEditing');
    expect(onSubmitEditing).toHaveBeenCalledTimes(1);
  });

  it('gives the input to a ref, so a screen can focus it', async () => {
    const ref = createRef<TextInput>();
    await render(<TextField label="Kod" value="" onChangeText={() => {}} inputRef={ref} />);
    // In Jest the ref is the mocked TextInput instance, not the host node, so it is not compared to the queried element.
    expect(ref.current).not.toBeNull();
    expect(ref.current?.focus).toEqual(expect.any(Function));
  });

  it('is editable by default, and not editable with the disabled tokens (no opacity) when disabled (§8.4)', async () => {
    const { rerender } = await render(<TextField label="Kod" value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Kod').props.editable).not.toBe(false);
    expect(screen.getByLabelText('Kod')).toHaveStyle({ backgroundColor: lightTheme.surface.primary, color: lightTheme.text.primary });

    await rerender(<TextField label="Kod" value="" onChangeText={() => {}} editable={false} />);
    const disabled = screen.getByLabelText('Kod');
    expect(disabled.props.editable).toBe(false);
    expect(disabled).toHaveStyle({
      backgroundColor: lightTheme.disabled.background,
      color: lightTheme.disabled.foreground,
      borderColor: lightTheme.border.default,
    });
    expect(StyleSheet.flatten(disabled.props.style).opacity).toBeUndefined();
  });
});
