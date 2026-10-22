import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/i18n';
import { tokens } from '@/theme/tokens';

import { HeroMenuButton } from '../HeroMenuButton';
import { TripMenuButton } from '../TripMenuButton';

let mockWindowWidth = 400;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 812, scale: 2, fontScale: 1 }),
}));

const metrics = { frame: { x: 0, y: 0, width: 400, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const { layout } = tokens;

const inProvider = (ui: React.ReactElement) => <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>;
// The pinned layer is the button's parent.
const layer = (name: string) => StyleSheet.flatten(screen.getByRole('button', { name }).parent?.props.style);

beforeEach(() => {
  mockWindowWidth = 400;
});

describe.each([
  ['HeroMenuButton', HeroMenuButton, 'trips.openList', 'left'],
  ['TripMenuButton', TripMenuButton, 'tripMenu.open', 'right'],
] as const)('%s', (_name, Button, key, side) => {
  const label = i18n.t(key);

  it('is a labelled button that calls onPress', async () => {
    const onPress = jest.fn();
    await render(inProvider(<Button onPress={onPress} />));
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is pinned under the status bar with the screen gutter on its side', async () => {
    await render(inProvider(<Button onPress={jest.fn()} />));
    expect(layer(label)).toMatchObject({ position: 'absolute', top: 47 + tokens.spacing[2], [side]: layout.screenGutter });
  });

  it('uses the compact gutter on a narrow screen', async () => {
    mockWindowWidth = layout.compactBreakpoint - 1;
    await render(inProvider(<Button onPress={jest.fn()} />));
    expect(layer(label)).toMatchObject({ [side]: layout.screenGutterCompact });
  });
});
