import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { Menu } from 'lucide-react-native';

import { HeroIconButton } from '@/components/HeroIconButton';
import { lightTheme } from '@/theme/theme';

const label = 'Otwórz listę podróży';

describe('HeroIconButton (trips-drawer P5)', () => {
  it('is a labelled button that calls onPress', async () => {
    const onPress = jest.fn();
    await render(<HeroIconButton icon={Menu} label={label} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a 44dp circle in the hero control colour, so it stays readable on a bright photo', async () => {
    await render(<HeroIconButton icon={Menu} label={label} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: label })).toHaveStyle({
      width: lightTheme.size.touchTarget,
      height: lightTheme.size.touchTarget,
      borderRadius: lightTheme.radius.full,
      backgroundColor: lightTheme.colors.hero.control,
    });
  });

  it('turns solid ink while pressed', async () => {
    await render(<HeroIconButton icon={Menu} label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    await fireEvent(button, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
    expect(button).toHaveStyle({ backgroundColor: lightTheme.colors.hero.background });
  });

  it('draws a 24dp icon in the hero text colour, hidden from screen readers', async () => {
    await render(<HeroIconButton icon={Menu} label={label} onPress={jest.fn()} />);
    const icon = screen.getByTestId('hero-icon-button-icon', { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(icon)).toBe(true);
    expect(icon.props.width).toBe(lightTheme.size.iconPrimary);
    expect(icon.props.strokeWidth).toBe(lightTheme.size.iconStroke);
    expect(icon.props.stroke).toBe(lightTheme.colors.hero.text);
  });
});
