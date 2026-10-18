import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { TextInput } from 'react-native';

import { TextField } from '@/components/TextField';
import i18n from '@/i18n';
import { lightTheme } from '@/theme/theme';

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

  it('is 52dp with the input border by default (§10.4, D26)', async () => {
    await render(<TextField label="Imię" value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Imię')).toHaveStyle({
      minHeight: 52,
      borderWidth: 1,
      borderColor: lightTheme.colors.input.border,
      borderRadius: lightTheme.radius.sm,
    });
  });

  it('shows an error under the field with a 2dp error border, and reads it to screen readers', async () => {
    await render(<TextField label="Imię" value="" error="Wpisz imię" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Imię').props.accessibilityHint).toBe('Wpisz imię');
    expect(screen.getByText('Wpisz imię')).toHaveStyle({ color: lightTheme.colors.status.error });
    expect(screen.getByLabelText('Imię')).toHaveStyle({ borderWidth: 2, borderColor: lightTheme.colors.status.error });
  });

  it('shows a 2dp brand border while focused', async () => {
    await render(<TextField label="Imię" value="" onChangeText={() => {}} />);
    await fireEvent(screen.getByLabelText('Imię'), 'focus');
    expect(screen.getByLabelText('Imię')).toHaveStyle({ borderWidth: 2, borderColor: lightTheme.colors.action.primary });
  });

  it('draws no browser outline on top of its own focus border (web)', async () => {
    await render(<TextField label="Imię" value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Imię')).toHaveStyle({ outlineStyle: 'solid', outlineWidth: 0 });
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

  it('is editable by default, and not editable (surface.secondary, §10.4 disabled) when disabled', async () => {
    const { rerender } = await render(<TextField label="Kod" value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Kod').props.editable).not.toBe(false);
    expect(screen.getByLabelText('Kod')).toHaveStyle({ backgroundColor: lightTheme.colors.surface.default });

    await rerender(<TextField label="Kod" value="" onChangeText={() => {}} editable={false} />);
    expect(screen.getByLabelText('Kod').props.editable).toBe(false);
    expect(screen.getByLabelText('Kod')).toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
  });
});
