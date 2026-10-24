import { fireEvent, render, screen } from '@testing-library/react-native';

import { DateTimeField } from '@/components/DateTimeField.web';
import i18n from '@/i18n';
import { lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

const { input } = tokens.components;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('DateTimeField (web)', () => {
  it('uses the browser date-time input and reports its value', async () => {
    const onChange = jest.fn();
    await render(<DateTimeField label="Wylot" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Wylot');
    expect(input.props.type).toBe('datetime-local');
    await fireEvent(input, 'change', { target: { value: '2026-11-02T10:15' } });
    expect(onChange).toHaveBeenCalledWith('2026-11-02T10:15');
  });

  it('shows the stored value and an error', async () => {
    await render(<DateTimeField label="Wylot" value="2026-11-02T10:15" error="Wybierz datę" onChange={() => {}} />);
    expect(screen.getByLabelText('Wylot').props.value).toBe('2026-11-02T10:15');
    expect(screen.getByText('Wybierz datę')).toBeTruthy();
  });

  // Sunline Editorial §8.4: the browser input is drawn like the native text input.
  it('is 52dp with a 1dp border.default, surface.primary and bodyLG text; 2dp border.focus while focused', async () => {
    await render(<DateTimeField label="Wylot" value="" onChange={() => {}} />);
    const field = screen.getByLabelText('Wylot');
    expect(field.props.style).toMatchObject({
      minHeight: input.height,
      borderRadius: input.radius,
      border: `${input.borderWidth}px solid ${lightTheme.border.default}`,
      backgroundColor: lightTheme.surface.primary,
      color: lightTheme.text.primary,
      fontFamily: tokens.typography.styles.bodyLG.fontFamily,
      fontSize: tokens.typography.styles.bodyLG.fontSize,
    });
    await fireEvent(field, 'focus');
    expect(screen.getByLabelText('Wylot').props.style.border).toBe(`${input.focusBorderWidth}px solid ${lightTheme.border.focus}`);
  });

  it('draws a 2dp semantic.error.foreground border on error', async () => {
    await render(<DateTimeField label="Wylot" value="" error="Wybierz datę" onChange={() => {}} />);
    expect(screen.getByLabelText('Wylot').props.style.border).toBe(
      `${input.focusBorderWidth}px solid ${lightTheme.semantic.error.foreground}`,
    );
  });
});
