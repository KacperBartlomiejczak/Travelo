import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { darkTheme, lightTheme } from '@/theme/theme';

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

describe('EmptyScreen (pill-nav-and-dialog D3, A8)', () => {
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
    const clearance = metrics.insets.bottom + lightTheme.spacing[4] + lightTheme.size.navPill;
    expect(style(screen.getByTestId('empty-screen')).paddingBottom).toBeGreaterThanOrEqual(clearance + lightTheme.spacing[4]);
  });

  it('keeps the content below the status bar', async () => {
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).paddingTop).toBeGreaterThanOrEqual(metrics.insets.top);
  });

  it('uses the light theme tokens', async () => {
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).backgroundColor).toBe(lightTheme.colors.background);
    expect(style(screen.getByText('Wydatki'))).toMatchObject({
      color: lightTheme.colors.text.primary,
      fontSize: lightTheme.typography.heading1.fontSize,
    });
    expect(style(screen.getByText('Ten ekran pojawi się wkrótce.'))).toMatchObject({
      color: lightTheme.colors.text.secondary,
      fontSize: lightTheme.typography.bodyM.fontSize,
    });
  });

  it('uses the dark theme tokens', async () => {
    mockScheme = 'dark';
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).backgroundColor).toBe(darkTheme.colors.background);
    expect(style(screen.getByText('Wydatki')).color).toBe(darkTheme.colors.text.primary);
    expect(style(screen.getByText('Ten ekran pojawi się wkrótce.')).color).toBe(darkTheme.colors.text.secondary);
  });

  it('pads the sides with 20dp, and with 16dp below the compact breakpoint', async () => {
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).paddingHorizontal).toBe(lightTheme.spacing[5]);
    expect(lightTheme.spacing[5]).toBe(20);
    await screen.unmount();
    mockWindowWidth = lightTheme.breakpoints.compact - 1;
    await render(ui());
    expect(style(screen.getByTestId('empty-screen')).paddingHorizontal).toBe(lightTheme.spacing[4]);
    expect(lightTheme.spacing[4]).toBe(16);
  });

  it('centres the content up to the maximum content width', async () => {
    await render(ui());
    expect(style(screen.getByTestId('empty-screen-content'))).toMatchObject({
      maxWidth: lightTheme.size.maxContentWidth,
      alignSelf: 'center',
    });
  });
});
