import { render, screen } from '@testing-library/react-native';

import { OfflineBanner } from '@/components/OfflineBanner';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { offlineBanner } = tokens.components;
const hidden = { includeHiddenElements: true };

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('OfflineBanner (D11, design-context §10.4)', () => {
  it('says the app is offline and that changes will be sent later', async () => {
    await render(<OfflineBanner />);
    const banner = screen.getByTestId('offline-banner');
    expect(screen.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeTruthy();
    // Announced politely when it appears; not a button.
    expect(banner.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses the English copy from the design context', async () => {
    await i18n.changeLanguage('en');
    await render(<OfflineBanner />);
    expect(screen.getByText("You're offline. Changes will sync when you're connected.")).toBeTruthy();
  });

  it('is 44dp high at least, padded 16 × 10, in the info colors with a 20dp WifiOff icon and the text (light)', async () => {
    await render(<OfflineBanner />);
    expect(screen.getByTestId('offline-banner')).toHaveStyle({
      minHeight: offlineBanner.minHeight,
      paddingHorizontal: offlineBanner.horizontalPadding,
      paddingVertical: offlineBanner.verticalPadding,
      backgroundColor: lightTheme.semantic.info.background,
    });
    expect([offlineBanner.minHeight, offlineBanner.horizontalPadding, offlineBanner.verticalPadding]).toEqual([44, 16, 10]);
    expect(screen.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toHaveStyle({
      ...tokens.typography.styles.bodySM,
      color: lightTheme.semantic.info.foreground,
    });
    const icon = screen.getByTestId('offline-banner-icon', hidden);
    expect(icon.props.width).toBe(tokens.iconography.size.sm);
    expect(icon.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
    expect(icon.props.stroke).toBe(lightTheme.semantic.info.foreground);
  });

  it('uses the dark info colors in dark mode', async () => {
    await render(<OfflineBanner />, { wrapper: DarkThemeScope });
    expect(screen.getByTestId('offline-banner')).toHaveStyle({ backgroundColor: darkTheme.semantic.info.background });
    expect(screen.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toHaveStyle({ color: darkTheme.semantic.info.foreground });
    expect(screen.getByTestId('offline-banner-icon', hidden).props.stroke).toBe(darkTheme.semantic.info.foreground);
  });
});
