import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { LayoverLabel } from '@/components/LayoverLabel';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

describe('LayoverLabel', () => {
  it('shows the layover duration and airport in the neutral info color, not warning (§8.12)', async () => {
    await i18n.changeLanguage('pl');
    await render(<LayoverLabel minutes={540} airportIata="DXB" />);
    expect(screen.getByText('9 godz. przesiadki w DXB')).toHaveStyle({
      ...tokens.typography.styles.labelMD,
      color: lightTheme.semantic.info.foreground,
    });
    expect(screen.getByText('9 godz. przesiadki w DXB')).not.toHaveStyle({ color: lightTheme.semantic.warning.foreground });
  });

  it('draws a 16dp Clock icon in the same color, hidden from screen readers, so the meaning is not color alone', async () => {
    await i18n.changeLanguage('pl');
    await render(<LayoverLabel minutes={540} airportIata="DXB" />);
    const icon = screen.getByTestId('layover-icon', { includeHiddenElements: true });
    expect(icon.props.width).toBe(tokens.iconography.size.xs);
    expect(icon.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
    expect(icon.props.stroke).toBe(lightTheme.semantic.info.foreground);
  });

  it('uses the dark info color in dark mode', async () => {
    await i18n.changeLanguage('pl');
    await render(<LayoverLabel minutes={540} airportIata="DXB" />, { wrapper: DarkThemeScope });
    expect(screen.getByText('9 godz. przesiadki w DXB')).toHaveStyle({ color: darkTheme.semantic.info.foreground });
  });

  it('reads "2h 10m layover in DXB" in English', async () => {
    await i18n.changeLanguage('en');
    await render(<LayoverLabel minutes={130} airportIata="DXB" />);
    expect(screen.getByText('2h 10m layover in DXB')).toBeTruthy();
  });

  it('has no left inset by default, so it lines up with the text lines around it (friend-invite D8)', async () => {
    await i18n.changeLanguage('pl');
    await render(<LayoverLabel minutes={540} airportIata="DXB" />);
    const container = screen.getByText('9 godz. przesiadki w DXB').parent;
    expect(StyleSheet.flatten(container?.props.style).paddingLeft ?? 0).toBe(0);
  });

  it('keeps the 16 dp inset between wizard segment cards when asked (D27)', async () => {
    await i18n.changeLanguage('pl');
    await render(<LayoverLabel minutes={540} airportIata="DXB" inset />);
    expect(screen.getByText('9 godz. przesiadki w DXB').parent).toHaveStyle({ paddingLeft: tokens.spacing[4] });
  });
});
