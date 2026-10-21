import { type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Keyboard, Platform, StyleSheet, Text, View, type EmitterSubscription, type KeyboardEvent } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import i18n from '@/i18n';
import { lightTheme } from '@/theme/legacy/theme';

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

  // D14: the scrim fills the whole modal and lies under the sheet, so it also dims the area behind the rounded top corners.
  describe('scrim layout (theme-split-and-profile-prefill D14)', () => {
    type Element = ReturnType<typeof screen.getByTestId>;
    // Index of the direct child of the keyboard-avoiding frame that holds `element`.
    const slot = (element: Element) => {
      const frame = screen.getByTestId('bottom-sheet-keyboard');
      let node: Element | null = element;
      while (node && node.parent !== frame) node = node.parent;
      return frame.children.indexOf(node as Element);
    };

    it('fills the whole modal, behind the sheet, in the scrim colour (not a flex block above the sheet)', async () => {
      await renderSheet();
      const style = StyleSheet.flatten(screen.getByRole('button', { name: 'Zamknij' }).props.style);
      expect(style).toMatchObject({ ...StyleSheet.flatten(StyleSheet.absoluteFill), backgroundColor: lightTheme.colors.overlay.scrim });
      expect(style.flex).toBeUndefined();
    });

    it('is rendered before the sheet, so it is under it', async () => {
      await renderSheet();
      const scrim = slot(screen.getByRole('button', { name: 'Zamknij' }));
      const sheet = slot(screen.getByTestId('bottom-sheet'));
      expect(scrim).toBeGreaterThanOrEqual(0);
      expect(sheet).toBeGreaterThan(scrim);
    });

    it('puts the sheet at the bottom of the modal', async () => {
      await renderSheet();
      expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet-keyboard').props.style)).toMatchObject({ flex: 1, justifyContent: 'flex-end' });
    });

    it('does not close when something inside the sheet is pressed', async () => {
      const onClose = jest.fn();
      const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
      await render(
        <SafeAreaProvider initialMetrics={metrics}>
          <BottomSheet visible title="Tytuł" onClose={onClose}>
            <Text onPress={() => {}}>row</Text>
          </BottomSheet>
        </SafeAreaProvider>,
      );
      await fireEvent.press(screen.getByText('row'));
      await fireEvent.press(screen.getByRole('header', { name: 'Tytuł' }));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('slides in, and appears without movement when the system asks to reduce motion (§9.4)', async () => {
    await renderSheet();
    expect(screen.getByTestId('bottom-sheet-modal').props.animationType).toBe('slide');
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderSheet();
    expect(screen.getByTestId('bottom-sheet-modal').props.animationType).toBe('none');
  });

  it('when the system cannot say whether to reduce motion, it shows without animation', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no native module'));
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

// trip-edit-menu D18: the sheet follows a finger dragged down from its header (handle and title) and closes past 60dp.
// Jest has no responder system, so the helper below plays its part for one finger, the way RN's ResponderEventPlugin does:
// on touch start it asks the touched element's ancestors, capture phase from the root down and then bubble phase from the
// touched element up, whether one of them wants to become the responder; the first that does gets the grant. While
// there is a responder, moves and the release go to it. Only without a responder are the move handlers (capture, then
// bubble) asked. Handlers are read from the elements again at every step, because the real system also uses the props of
// the current render.
describe('BottomSheet swipe down (trip-edit-menu D18)', () => {
  type Element = ReturnType<typeof screen.getByTestId>;
  type Handler = (event: unknown) => unknown;

  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
  const TITLE = 'Ile chcecie wydać na osobę?';

  const translateY = () => {
    const transform = StyleSheet.flatten(screen.getByTestId('bottom-sheet').props.style).transform as { translateY: number }[];
    return transform[0].translateY;
  };

  // RN's <Modal> gives its host view `onStartShouldSetResponder={() => true}` (Libraries/Modal/Modal.js), "so that no
  // responder events bubble out of the modal". Jest's Modal has no such handler, so this View stands in for it: it
  // claims every touch that nothing below it claims first.
  const sheetWith = (visible: boolean, onClose: () => void, content: ReactNode = <Text>content</Text>, dismissible?: boolean) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <View testID="modal-host" onStartShouldSetResponder={() => true}>
        <BottomSheet visible={visible} title={TITLE} onClose={onClose} dismissible={dismissible}>
          {content}
        </BottomSheet>
      </View>
    </SafeAreaProvider>
  );
  async function open(onClose = jest.fn()) {
    await render(sheetWith(true, onClose));
    return onClose;
  }

  // The host elements from the root down to `touched`.
  function chainTo(touched: Element): Element[] {
    const chain: Element[] = [];
    for (let node: Element | null = touched; node; node = node.parent) if (typeof node.type === 'string') chain.unshift(node);
    return chain;
  }

  function finger(getTouched: () => Element, startX = 100, startY = 300) {
    let responder: Element | null = null;
    let time = 0;
    let bank = {
      startPageX: startX,
      startPageY: startY,
      startTimeStamp: 0,
      currentPageX: startX,
      currentPageY: startY,
      currentTimeStamp: 0,
      previousPageX: startX,
      previousPageY: startY,
      previousTimeStamp: 0,
    };
    const event = () => ({
      nativeEvent: { touches: [{ pageX: bank.currentPageX, pageY: bank.currentPageY }] },
      touchHistory: {
        numberActiveTouches: 1,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: bank.currentTimeStamp,
        touchBank: [{ touchActive: true, ...bank }],
      },
    });
    // The first element that answers `true`: capture handlers from the root down, then bubble handlers from the target up.
    const negotiate = (capture: string, bubble: string): Element | null => {
      const chain = chainTo(getTouched());
      for (const node of chain) if ((node.props[capture] as Handler | undefined)?.(event()) === true) return node;
      for (const node of [...chain].reverse()) if ((node.props[bubble] as Handler | undefined)?.(event()) === true) return node;
      return null;
    };
    const grant = (node: Element | null) => {
      responder = node;
      (node?.props.onResponderGrant as Handler | undefined)?.(event());
    };
    return {
      async down() {
        await act(async () => grant(negotiate('onStartShouldSetResponderCapture', 'onStartShouldSetResponder')));
      },
      async moveBy(dx: number, dy: number) {
        time += 16;
        bank = {
          ...bank,
          previousPageX: bank.currentPageX,
          previousPageY: bank.currentPageY,
          previousTimeStamp: bank.currentTimeStamp,
          currentPageX: bank.currentPageX + dx,
          currentPageY: bank.currentPageY + dy,
          currentTimeStamp: time,
        };
        await act(async () => {
          if (responder) (responder.props.onResponderMove as Handler)(event());
          else grant(negotiate('onMoveShouldSetResponderCapture', 'onMoveShouldSetResponder'));
        });
      },
      async up() {
        await act(async () => {
          (responder?.props.onResponderRelease as Handler | undefined)?.(event());
          responder = null;
        });
      },
      get responder() {
        return responder;
      },
    };
  }

  const header = () => screen.getByTestId('bottom-sheet-header');
  const handle = () => screen.getByTestId('bottom-sheet-handle', { includeHiddenElements: true });
  const title = () => screen.getByRole('header', { name: TITLE });
  const drag = async (touched: () => Element, distance: number) => {
    const f = finger(touched);
    await f.down();
    await f.moveBy(0, distance);
    return f;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    // RN's Jest setup makes this a jest.fn, and `restoreAllMocks` does not undo the `true` an earlier test sets on it.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('has the handle and the title in one drag area that is a native view of its own, so Android hits all of it', async () => {
    await open();
    expect(within(header()).getByRole('header', { name: TITLE })).toBeTruthy();
    expect(within(header()).getByTestId('bottom-sheet-handle', { includeHiddenElements: true })).toBeTruthy();
    // A View with no background or border is flattened away (ViewShadowNode.cpp), and then on Android only the 36 × 4
    // handle is hit.
    expect(header().props.collapsable).toBe(false);
    expect(screen.getByTestId('bottom-sheet')).not.toBe(header());
  });

  // The cause found on the Android emulator: the Modal's host view claims every touch at its start, so it is the
  // responder when the finger moves, and the responder system then only asks the ancestors of that responder whether
  // they want the move. A header that only offers to take the gesture once it has moved is never asked.
  it.each([
    ['handle', handle],
    ['title', title],
  ])('takes the touch at its start when it begins on the %s, before the Modal can', async (_, touched) => {
    await open();
    const f = finger(touched);
    await f.down();
    expect(f.responder).toBe(header());
  });

  it('follows a finger dragged down from the handle', async () => {
    await open();
    expect(translateY()).toBe(0);
    const f = await drag(handle, 40);
    expect(translateY()).toBe(40);
    await f.moveBy(0, 25);
    expect(translateY()).toBe(65);
  });

  it('follows a finger dragged down from the title', async () => {
    await open();
    await drag(title, 40);
    expect(translateY()).toBe(40);
  });

  it('never goes above its resting place when the finger comes back up past the start', async () => {
    await open();
    const f = await drag(title, 30);
    await f.moveBy(0, -90);
    expect(translateY()).toBe(0);
  });

  it('closes once, when released after more than 60dp', async () => {
    const onClose = await open();
    const f = await drag(title, 61);
    expect(onClose).not.toHaveBeenCalled();
    await f.up();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when released after a drag from the handle past 60dp', async () => {
    const onClose = await open();
    const f = await drag(handle, 80);
    await f.up();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open and goes back to its place over 180 ms when released before 60dp', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onClose = await open();
    const f = await drag(title, 50);
    expect(translateY()).toBe(50);
    await f.up();
    expect(onClose).not.toHaveBeenCalled();
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 180 }));
    expect(translateY()).toBe(50); // animating, not jumping
    await act(async () => {
      jest.advanceTimersByTime(lightTheme.duration.small + 50);
    });
    expect(translateY()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still follows the finger with reduce motion, but goes back at once', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const onClose = await open();
    const f = await drag(title, 50);
    expect(translateY()).toBe(50);
    await f.up();
    expect(translateY()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('goes back to its place when the system takes the gesture away', async () => {
    const onClose = await open();
    await drag(title, 50);
    await act(async () => {
      const terminate = header().props.onResponderTerminate as Handler;
      terminate({ nativeEvent: { touches: [] }, touchHistory: { numberActiveTouches: 0, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: 0, touchBank: [] } });
    });
    await act(async () => {
      jest.advanceTimersByTime(lightTheme.duration.small + 50);
    });
    expect(translateY()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a sideways move, an upward move and a mostly sideways one, and does not close on them', async () => {
    const onClose = await open();
    for (const [dx, dy] of [
      [60, 12],
      [0, -80],
      [150, 70],
    ]) {
      const f = finger(title);
      await f.down();
      await f.moveBy(dx, dy);
      expect(translateY()).toBe(0);
      await f.up();
    }
    expect(translateY()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('treats a tap or a little finger jitter on the title or the handle as a tap, not a close', async () => {
    const onClose = await open();
    for (const touched of [title, handle]) {
      const f = finger(touched);
      await f.down();
      await f.moveBy(0, 3);
      await f.up();
    }
    await act(async () => {
      jest.advanceTimersByTime(lightTheme.duration.small + 50);
    });
    expect(translateY()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the gesture and closes through the latest onClose when the parent re-renders during the drag', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const view = await render(sheetWith(true, first));
    const f = finger(title);
    await f.down();
    await f.moveBy(0, 30);
    await view.rerender(sheetWith(true, second)); // callers pass a new inline lambda on every render
    expect(translateY()).toBe(30);
    await f.moveBy(0, 40);
    expect(translateY()).toBe(70);
    await f.up();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('opens at its resting place again after it was swiped closed', async () => {
    const view = await render(sheetWith(true, () => {}));
    const f = await drag(title, 90);
    await f.up();
    await view.rerender(sheetWith(false, () => {}));
    await view.rerender(sheetWith(true, () => {}));
    expect(translateY()).toBe(0);
  });

  it('leaves the content below the header working', async () => {
    const onPress = jest.fn();
    await render(sheetWith(true, () => {}, <Text onPress={onPress}>row</Text>));
    expect(within(header()).queryByText('row')).toBeNull(); // the drag area is only the header
    await fireEvent.press(screen.getByText('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // pr10-review step 7b: a sheet that must not be dismissed (a delete is in flight) ignores every way of closing it.
  describe('when not dismissible', () => {
    const openLocked = async () => {
      const onClose = jest.fn();
      await render(sheetWith(true, onClose, <Text>content</Text>, false));
      return onClose;
    };

    it('ignores a backdrop tap', async () => {
      const onClose = await openLocked();
      await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('ignores the system back button', async () => {
      const onClose = await openLocked();
      await fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('follows the finger past 60dp but springs back when released, without closing', async () => {
      const onClose = await openLocked();
      const f = await drag(title, 80);
      expect(translateY()).toBe(80);
      await f.up();
      expect(onClose).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(lightTheme.duration.small + 50);
      });
      expect(translateY()).toBe(0);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('springs back at once with reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const onClose = await openLocked();
      const f = await drag(title, 80);
      await f.up();
      expect(translateY()).toBe(0);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes by swipe, backdrop and back button again once it becomes dismissible during its life', async () => {
      const onClose = jest.fn();
      const view = await render(sheetWith(true, onClose, <Text>content</Text>, false));
      await view.rerender(sheetWith(true, onClose, <Text>content</Text>, true));
      const f = await drag(title, 80);
      await f.up();
      expect(onClose).toHaveBeenCalledTimes(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
      expect(onClose).toHaveBeenCalledTimes(2);
      await fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
      expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('is locked again when it becomes non-dismissible during its life', async () => {
      const onClose = jest.fn();
      const view = await render(sheetWith(true, onClose));
      await view.rerender(sheetWith(true, onClose, <Text>content</Text>, false));
      const f = await drag(title, 80);
      await f.up();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
