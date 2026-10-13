import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect } from 'react';
import { Keyboard, StyleSheet, Text, type EmitterSubscription, type KeyboardEvent } from 'react-native';

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

beforeEach(async () => {
  keyboardListeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
    (keyboardListeners[name] ??= []).push(listener as (event: KeyboardEvent) => void);
    return { remove: () => {} } as EmitterSubscription;
  });
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

  it('lets the content scroll the focused field above the keyboard and keeps taps working while it is open', async () => {
    await openStep();
    const scroll = screen.getByTestId('wizard-scroll');
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  });
});
