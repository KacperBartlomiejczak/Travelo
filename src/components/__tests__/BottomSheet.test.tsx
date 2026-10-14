import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Keyboard, Platform, StyleSheet, Text, type EmitterSubscription, type KeyboardEvent } from 'react-native';
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

// wizard-keyboard D5: the sheet sits right above the keyboard, on both platforms. Keyboard events have no native side
// in Jest: the test captures the listeners and fires them itself.
describe('BottomSheet and the keyboard (wizard-keyboard D5)', () => {
  const SCREEN_HEIGHT = 844;
  const KEYBOARD_HEIGHT = 300;
  let keyboardListeners: Record<string, ((event: KeyboardEvent) => void)[]> = {};

  beforeEach(() => {
    keyboardListeners = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
      const keyboardListener = listener as (event: KeyboardEvent) => void;
      (keyboardListeners[name] ??= []).push(keyboardListener);
      return { remove: () => {} } as EmitterSubscription;
    });
  });

  async function emitKeyboard(name: string, height: number) {
    const event = { endCoordinates: { screenX: 0, screenY: SCREEN_HEIGHT - height, width: 390, height } } as KeyboardEvent;
    await act(async () => {
      for (const listener of keyboardListeners[name] ?? []) listener(event);
    });
  }

  // The modal is translucent: the part that makes room for the keyboard fills the window from its top edge, like the
  // keyboard's own coordinates, so the sheet needs no vertical offset.
  async function layoutWindow() {
    await fireEvent(screen.getByTestId('bottom-sheet-keyboard'), 'layout', {
      persist: () => {},
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: SCREEN_HEIGHT } },
    });
  }

  function paddingBottom() {
    return StyleSheet.flatten(screen.getByTestId('bottom-sheet-keyboard').props.style).paddingBottom ?? 0;
  }

  function expectWholeSheetInside() {
    const frame = within(screen.getByTestId('bottom-sheet-keyboard'));
    expect(frame.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeTruthy();
    expect(frame.getByText('content')).toBeTruthy();
    expect(frame.getByTestId('bottom-sheet')).toBeTruthy();
  }

  it('on Android, lifts the whole sheet by the keyboard height and puts it back when the keyboard hides', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await renderSheet();
    await layoutWindow();
    expect(paddingBottom()).toBe(0);
    expectWholeSheetInside();

    await emitKeyboard('keyboardDidShow', KEYBOARD_HEIGHT);
    await waitFor(() => expect(paddingBottom()).toBe(KEYBOARD_HEIGHT));

    await emitKeyboard('keyboardDidHide', 0);
    await waitFor(() => expect(paddingBottom()).toBe(0));
  });

  it('on iOS, lifts the whole sheet by the keyboard height and puts it back when the keyboard hides', async () => {
    expect(Platform.OS).toBe('ios');
    await renderSheet();
    await layoutWindow();
    expect(paddingBottom()).toBe(0);
    expectWholeSheetInside();

    await emitKeyboard('keyboardWillShow', KEYBOARD_HEIGHT);
    await waitFor(() => expect(paddingBottom()).toBe(KEYBOARD_HEIGHT));

    await emitKeyboard('keyboardWillHide', 0);
    await waitFor(() => expect(paddingBottom()).toBe(0));
  });
});
