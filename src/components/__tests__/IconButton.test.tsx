import { fireEvent, render, screen } from '@testing-library/react-native';
import { Minus } from 'lucide-react-native';

import { IconButton } from '@/components/IconButton';
import { lightTheme } from '@/theme/legacy/theme';

const label = 'Zmniejsz';

describe('IconButton (§10.2)', () => {
  it('is a labelled 44dp button at full opacity that calls onPress', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon={Minus} label={label} onPress={onPress} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeEnabled();
    expect(button).toHaveStyle({ width: lightTheme.size.touchTarget, height: lightTheme.size.touchTarget, opacity: 1 });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // Characterization: written before the opacity moved into the theme (trip-photos D25), and it must pass before and after.
  it('disabled: dimmed to 0.4 (§10.2), marked disabled for screen readers and not pressable', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon={Minus} label={label} disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(button).toHaveStyle({ opacity: 0.4 });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
