import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { darkTheme } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';

import { DarkThemeScope } from '../useTheme';

function Probe() {
  return <Text testID="probe">{useTheme().brand.primary}</Text>;
}

// Bridge (sunline-redesign step 3): screens still on the legacy theme force dark with the legacy scope, and components
// already on the new theme must follow it. Delete this test together with `src/theme/legacy/` in step 11.
describe('legacy DarkThemeScope bridge', () => {
  it('makes the new useTheme return the dark theme', async () => {
    await render(
      <DarkThemeScope>
        <Probe />
      </DarkThemeScope>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(darkTheme.brand.primary);
  });
});
