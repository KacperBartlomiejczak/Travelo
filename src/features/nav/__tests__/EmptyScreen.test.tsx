import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

import { EmptyScreen } from '../EmptyScreen';

let mockScheme: 'light' | 'dark' = 'light';
let mockWindowWidth = 390;
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 812, scale: 2, fontScale: 1 }),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function ui() {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <EmptyScreen title="Wydatki" message="Ten ekran pojawi się wkrótce." />
    </SafeAreaProvider>
  );
}

const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);

beforeEach(() => {
  mockScheme = 'light';
  mockWindowWidth = 390;
});

const { styles } = tokens.typography;

describe('EmptyScreen (pill-nav-and-dialog D3, A8, design-context §8.20)', () => {
  it('shows the title and the sentence, nothing else', async () => {
    await render(ui());
    expect(screen.getByText('Wydatki')).toBeTruthy();
    expect(screen.getByText('Ten ekran pojawi się wkrótce.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('exposes the title as a header', async () => {
    await render(ui());
    expect(screen.getByRole('header', { name: 'Wydatki' })).toBeTruthy();
  });

  it('leaves room under the content for the pill: at least its clearance plus spacing[4]', async () => {
    await render(ui());
    const clearance = metrics.insets.bottom + tokens.spacing[3] + tokens.components.tabs.height; // the pill floats 12dp above the inset (§8.14, D23)
    expect(style(screen.getByTestId('empty-screen')).paddingBottom).toBeGreaterThanOrEqual(clearance + tokens.spacing[4]);
  });

  it('keeps the content below the status bar', async () => {
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).paddingTop).toBeGreaterThanOrEqual(metrics.insets.top);
  });

  it('uses the light theme tokens: canvas, headingLG title in text.primary, bodyMD sentence in text.secondary', async () => {
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).backgroundColor).toBe(lightTheme.background.canvas);
    expect(style(screen.getByText('Wydatki'))).toMatchObject({ ...styles.headingLG, color: lightTheme.text.primary });
    expect(style(screen.getByText('Ten ekran pojawi się wkrótce.'))).toMatchObject({
      ...styles.bodyMD,
      color: lightTheme.text.secondary,
      marginTop: tokens.spacing[2],
    });
  });

  it('uses the dark theme tokens', async () => {
    mockScheme = 'dark';
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).backgroundColor).toBe(darkTheme.background.canvas);
    expect(style(screen.getByText('Wydatki')).color).toBe(darkTheme.text.primary);
    expect(style(screen.getByText('Ten ekran pojawi się wkrótce.')).color).toBe(darkTheme.text.secondary);
  });

  it('pads the sides with the 20dp screen gutter, and with the 16dp compact gutter below 390dp (§4.2)', async () => {
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).paddingHorizontal).toBe(tokens.layout.screenGutter);
    expect(tokens.layout.screenGutter).toBe(20);
    await screen.unmount();
    mockWindowWidth = tokens.layout.compactBreakpoint - 1;
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).paddingHorizontal).toBe(tokens.layout.screenGutterCompact);
    expect(tokens.layout.screenGutterCompact).toBe(16);
  });

  it('centres the content up to the maximum content width', async () => {
    await render(ui());
    expect(style(screen.getByTestId('empty-screen-content'))).toMatchObject({
      maxWidth: tokens.layout.maxContentWidth,
      alignSelf: 'center',
    });
  });
});
