import { cleanup, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type EmitterSubscription,
  type HostInstance,
  type KeyboardEvent,
  type MeasureInWindowOnSuccessCallback,
} from 'react-native';

import NewTripLayout from '@/app/trips/new/_layout';
import { WizardScreen } from '@/features/trip-create/WizardScreen';
import i18n from '@/i18n';

// Keyboard events have no native side in Jest: the test captures the listeners and fires them itself.
let keyboardListeners: Record<string, ((event: KeyboardEvent) => void)[]> = {};
let headerHeight = 0;

function Step({ withAction = true }: { withAction?: boolean }) {
  const height = useHeaderHeight();
  useEffect(() => {
    headerHeight = height;
  }, [height]);
  return (
    <WizardScreen step="flights" action={withAction ? { label: 'Dalej', onPress: () => {} } : undefined}>
      <Text>Treść kroku</Text>
    </WizardScreen>
  );
}

async function openStep(withAction = true) {
  await renderRouter(
    { 'trips/new/_layout': NewTripLayout, 'trips/new/index': () => <Step withAction={withAction} /> },
    { initialUrl: '/trips/new' },
  );
  await screen.findByText('Treść kroku');
}

function emitKeyboard(name: string, screenY: number) {
  const event = { endCoordinates: { screenX: 0, screenY, width: 390, height: 300 } } as KeyboardEvent;
  for (const listener of keyboardListeners[name] ?? []) listener(event);
}

// The screen sits under the header: 700 tall, its bottom at headerHeight + 700 in the window.
async function layoutScreen() {
  await fireEvent(screen.getByTestId('wizard-screen'), 'layout', {
    persist: () => {},
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } },
  });
}

function paddingBottom() {
  return StyleSheet.flatten(screen.getByTestId('wizard-screen').props.style).paddingBottom ?? 0;
}

// A native view that only knows where it is in the window: `measureInWindow` is all the wizard asks of it.
function viewInWindow(top: number, height: number): HostInstance {
  const measureInWindow = (callback: MeasureInWindowOnSuccessCallback) => callback(0, top, 390, height);
  return { measureInWindow } as unknown as HostInstance;
}

// The wizard's scroll view starts at window y 100 and is 500 tall: its visible part, above "Dalej", ends at y 600.
// The focused text field is `height` tall and starts at window y `top`.
function focusFieldAt(top: number, height = 48) {
  jest.mocked(ScrollView.prototype.getNativeScrollRef).mockReturnValue(viewInWindow(100, 500));
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(viewInWindow(top, height));
}

function scrollTo() {
  return jest.mocked(ScrollView.prototype.scrollTo);
}

beforeEach(async () => {
  keyboardListeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
    const keyboardListener = listener as (event: KeyboardEvent) => void;
    (keyboardListeners[name] ??= []).push(keyboardListener);
    return {
      remove: () => {
        keyboardListeners[name] = (keyboardListeners[name] ?? []).filter((l) => l !== keyboardListener);
      },
    } as EmitterSubscription;
  });
  scrollTo().mockClear();
  jest.mocked(ScrollView.prototype.getNativeScrollRef).mockReset();
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('WizardScreen and the keyboard (wizard-keyboard)', () => {
  it('keeps the step content and the bottom action inside the part that makes room for the keyboard', async () => {
    await openStep();
    const frame = within(screen.getByTestId('wizard-screen'));
    expect(frame.getByText('Treść kroku')).toBeTruthy();
    expect(frame.getByRole('button', { name: 'Dalej' })).toBeTruthy();
  });

  it('adds bottom padding equal to the part of the screen the keyboard covers, header included, and removes it when the keyboard hides', async () => {
    await openStep();
    expect(headerHeight).toBeGreaterThan(0);
    await layoutScreen();
    expect(paddingBottom()).toBe(0);

    // A 300 tall keyboard: its top is at headerHeight + 400 in the window.
    emitKeyboard('keyboardWillShow', headerHeight + 400);
    await waitFor(() => expect(paddingBottom()).toBe(300));

    emitKeyboard('keyboardWillHide', headerHeight + 700);
    await waitFor(() => expect(paddingBottom()).toBe(0));
  });

  it('makes room for the keyboard on a step without a bottom action too', async () => {
    await openStep(false);
    await layoutScreen();
    emitKeyboard('keyboardWillShow', headerHeight + 400);
    await waitFor(() => expect(paddingBottom()).toBe(300));
  });

  // Q5 / D6: on iOS the padding above already makes room, so the scroll view must not add a second adjustment.
  it('does not let the scroll view adjust for the keyboard itself and keeps taps working while it is open', async () => {
    await openStep();
    const scroll = screen.getByTestId('wizard-scroll');
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBeFalsy();
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  });
});

// Q5 / D6: on iOS `WizardScreen` scrolls the focused field above "Dalej" itself, once the padding is applied.
describe('WizardScreen scrolls the focused field into view (wizard-keyboard, iOS)', () => {
  it('scrolls only after the keyboard is shown, so that the field plus a 16 gap ends at the bottom of the visible part', async () => {
    await openStep();
    focusFieldAt(650); // bottom 698, plus the gap 714: 114 below the visible part, which ends at 600

    emitKeyboard('keyboardWillShow', headerHeight + 400);
    expect(scrollTo()).not.toHaveBeenCalled();

    emitKeyboard('keyboardDidShow', headerHeight + 400);
    expect(scrollTo()).toHaveBeenCalledTimes(1);
    expect(scrollTo()).toHaveBeenLastCalledWith({ y: 650 + 48 + 16 - 600, animated: true });
  });

  it('adds the distance the form is already scrolled', async () => {
    await openStep();
    await fireEvent.scroll(screen.getByTestId('wizard-scroll'), { nativeEvent: { contentOffset: { x: 0, y: 200 } } });
    focusFieldAt(650); // still 114 below the visible part, on top of the 200 already scrolled

    emitKeyboard('keyboardDidShow', headerHeight + 400);
    expect(scrollTo()).toHaveBeenLastCalledWith({ y: 200 + 114, animated: true });
  });

  it('does not scroll a field that is already fully visible', async () => {
    await openStep();
    focusFieldAt(400); // bottom 448, plus the gap 464: well inside the visible part

    emitKeyboard('keyboardDidShow', headerHeight + 400);
    expect(scrollTo()).not.toHaveBeenCalled();
  });

  it('scrolls a field only when the field plus its gap does not fit', async () => {
    await openStep();
    focusFieldAt(536); // bottom 584, plus the gap exactly 600: fits
    emitKeyboard('keyboardDidShow', headerHeight + 400);
    expect(scrollTo()).not.toHaveBeenCalled();

    focusFieldAt(537); // one more and the gap sticks out by 1
    emitKeyboard('keyboardDidShow', headerHeight + 400);
    expect(scrollTo()).toHaveBeenLastCalledWith({ y: 1, animated: true });
  });

  it('does nothing, and does not fail, when no text field is focused', async () => {
    await openStep();
    jest.mocked(ScrollView.prototype.getNativeScrollRef).mockReturnValue(viewInWindow(100, 500));
    expect(TextInput.State.currentlyFocusedInput()).toBeNull();

    expect(() => emitKeyboard('keyboardDidShow', headerHeight + 400)).not.toThrow();
    expect(scrollTo()).not.toHaveBeenCalled();
  });

  it('stops reacting to the keyboard once the screen is gone', async () => {
    await openStep();
    expect(keyboardListeners.keyboardDidShow).toHaveLength(1);

    await cleanup();
    expect(keyboardListeners.keyboardDidShow ?? []).toHaveLength(0);
  });

  describe('on Android', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    });

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    });

    it('stays as it is: no scrolling after the keyboard is shown, and no scroll listener on the scroll view', async () => {
      await openStep();
      focusFieldAt(650);

      emitKeyboard('keyboardDidShow', headerHeight + 400);
      expect(scrollTo()).not.toHaveBeenCalled();
      expect(screen.getByTestId('wizard-scroll').props.onScroll).toBeUndefined();
    });
  });
});
