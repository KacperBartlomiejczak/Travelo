import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import i18n from '@/i18n';
import { lightTheme } from '@/theme/theme';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

afterEach(() => jest.restoreAllMocks());

function renderSheet(visible = true) {
  const onClose = jest.fn();
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BottomSheet visible={visible} title="Ile chcecie wydać na osobę?" onClose={onClose}>
        <Text>content</Text>
      </BottomSheet>
    </SafeAreaProvider>,
  ).then(() => onClose);
}

describe('BottomSheet (design-context §10.12)', () => {
  it('shows its title as a header and its content when visible', async () => {
    await renderSheet();
    expect(screen.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('renders nothing when hidden', async () => {
    await renderSheet(false);
    expect(screen.queryByText('content')).toBeNull();
  });

  it('has the 36 × 4 handle and 24dp top corners, on the elevated surface', async () => {
    await renderSheet();
    expect(screen.getByTestId('bottom-sheet-handle', { includeHiddenElements: true })).toHaveStyle({
      width: 36,
      height: 4,
      borderRadius: lightTheme.radius.full,
    });
    expect(screen.getByTestId('bottom-sheet')).toHaveStyle({
      borderTopLeftRadius: lightTheme.radius.xl,
      borderTopRightRadius: lightTheme.radius.xl,
      maxHeight: '90%',
      backgroundColor: lightTheme.colors.surface.elevated,
    });
  });

  it('closes on a backdrop tap, dimmed with the scrim token', async () => {
    const onClose = await renderSheet();
    const backdrop = screen.getByRole('button', { name: 'Zamknij' });
    expect(backdrop).toHaveStyle({ backgroundColor: lightTheme.colors.overlay.scrim });
    await fireEvent.press(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('slides in, and appears without movement when the system asks to reduce motion (§9.4)', async () => {
    await renderSheet();
    expect(screen.getByTestId('bottom-sheet-modal').props.animationType).toBe('slide');
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderSheet();
    expect(screen.getByTestId('bottom-sheet-modal').props.animationType).toBe('none');
  });

  it('closes on the system back button', async () => {
    const onClose = await renderSheet();
    await fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
