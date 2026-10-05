import { render, screen } from '@testing-library/react-native';

import { LayoverLabel } from '@/components/LayoverLabel';
import i18n from '@/i18n';
import { lightTheme } from '@/theme/theme';

describe('LayoverLabel', () => {
  it('shows the layover duration and airport in amber (§10.11, D27)', async () => {
    await i18n.changeLanguage('pl');
    await render(<LayoverLabel minutes={540} airportIata="DXB" />);
    expect(screen.getByText('9 godz. przesiadki w DXB')).toHaveStyle({ color: lightTheme.colors.status.warning });
  });

  it('reads "2h 10m layover in DXB" in English', async () => {
    await i18n.changeLanguage('en');
    await render(<LayoverLabel minutes={130} airportIata="DXB" />);
    expect(screen.getByText('2h 10m layover in DXB')).toBeTruthy();
  });
});
