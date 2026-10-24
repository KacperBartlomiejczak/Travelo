import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { drawsCircleAlert } from '@/test/alert-icon';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

import { FullScreenError } from '../FullScreenError';

let mockScheme: 'light' | 'dark' = 'light';
let mockWindowWidth = 390;
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 844, scale: 2, fontScale: 1 }),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const MESSAGE = 'Nie udało się uruchomić aplikacji.';
const RETRY = 'Spróbuj ponownie';

async function setup(onRetry = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <FullScreenError testID="error-screen" message={MESSAGE} retryLabel={RETRY} onRetry={onRetry} />
    </SafeAreaProvider>,
  );
  return { onRetry };
}

const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);

beforeEach(() => {
  mockScheme = 'light';
  mockWindowWidth = 390;
});

afterEach(() => jest.restoreAllMocks());

describe('FullScreenError (design-context §10.3, sunline-redesign step 8)', () => {
  it('shows a CircleAlert, the message and a retry, and announces the message', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const { onRetry } = await setup();
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    const icon = screen.getByTestId('full-screen-error-icon', { includeHiddenElements: true });
    expect(drawsCircleAlert(icon)).toBe(true);
    expect(screen.queryByTestId('full-screen-error-icon')).toBeNull(); // decorative: hidden from screen readers
    expect(announce).toHaveBeenCalledWith(MESSAGE);

    await fireEvent.press(screen.getByRole('button', { name: RETRY }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses the light theme: canvas, error icon 32dp at stroke 1.75, bodyMD message in text.primary', async () => {
    await setup();
    expect(style(screen.getByTestId('error-screen')).backgroundColor).toBe(lightTheme.background.canvas);
    expect(screen.getByTestId('full-screen-error-icon', { includeHiddenElements: true }).props).toMatchObject({
      width: tokens.iconography.size.xl,
      stroke: lightTheme.semantic.error.foreground,
      strokeWidth: tokens.iconography.strokeWidth,
    });
    expect(style(screen.getByText(MESSAGE))).toMatchObject({ ...tokens.typography.styles.bodyMD, color: lightTheme.text.primary, textAlign: 'center' });
  });

  it('follows the dark theme', async () => {
    mockScheme = 'dark';
    await setup();
    expect(style(screen.getByTestId('error-screen')).backgroundColor).toBe(darkTheme.background.canvas);
    expect(style(screen.getByText(MESSAGE)).color).toBe(darkTheme.text.primary);
    expect(screen.getByTestId('full-screen-error-icon', { includeHiddenElements: true }).props.stroke).toBe(darkTheme.semantic.error.foreground);
  });

  it('keeps the content inside the safe area with the gutter: 20dp from 390dp up, 16dp below (§4.2)', async () => {
    await setup();
    expect(style(screen.getByTestId('error-screen'))).toMatchObject({
      paddingTop: metrics.insets.top + tokens.spacing[4],
      paddingBottom: metrics.insets.bottom + tokens.spacing[4],
      paddingHorizontal: tokens.layout.screenGutter,
    });
  });

  it('uses the compact 16dp gutter below 390dp', async () => {
    mockWindowWidth = 375;
    await setup();
    expect(style(screen.getByTestId('error-screen')).paddingHorizontal).toBe(tokens.layout.screenGutterCompact);
  });
});
