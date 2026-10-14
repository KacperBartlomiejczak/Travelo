import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Animated, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Snackbar } from '@/components/Snackbar';
import { darkTheme, lightTheme } from '@/theme/theme';
import { DarkThemeScope } from '@/theme/useTheme';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function ui(message: string | null, onHide: () => void = () => {}) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <Snackbar message={message} onHide={onHide} />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Snackbar (design-context §10.16, trip-edit-menu D11, D14)', () => {
  it('shows the message on the inverse ink surface in light mode', async () => {
    await render(ui('Podróż usunięta.'));
    expect(screen.getByText('Podróż usunięta.')).toHaveStyle({ color: lightTheme.colors.snackbar.text });
    expect(screen.getByTestId('snackbar')).toHaveStyle({
      backgroundColor: lightTheme.colors.snackbar.background,
      borderRadius: lightTheme.radius.md,
      padding: lightTheme.spacing[4],
    });
  });

  it('uses the inverse colours in dark mode', async () => {
    await render(ui('Podróż usunięta.'), { wrapper: DarkThemeScope });
    expect(screen.getByText('Podróż usunięta.')).toHaveStyle({ color: darkTheme.colors.snackbar.text });
    expect(screen.getByTestId('snackbar')).toHaveStyle({ backgroundColor: darkTheme.colors.snackbar.background });
  });

  it('is at least 48dp high and at most 360dp wide, 16dp above the safe area at the bottom', async () => {
    await render(ui('Podróż usunięta.'));
    expect(screen.getByTestId('snackbar')).toHaveStyle({ minHeight: 48, maxWidth: 360 });
    expect(screen.getByTestId('snackbar-container')).toHaveStyle({
      position: 'absolute',
      bottom: metrics.insets.bottom + lightTheme.spacing[4],
      left: lightTheme.spacing[4],
      right: lightTheme.spacing[4],
    });
  });

  it('sits above what is pinned at the bottom when given a bottomOffset (§10.16, trip-edit-menu D21)', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Snackbar message="Podróż usunięta." onHide={() => {}} bottomOffset={64} />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('snackbar-container')).toHaveStyle({ bottom: metrics.insets.bottom + lightTheme.spacing[4] + 64 });
  });

  it('renders nothing without a message', async () => {
    await render(ui(null));
    expect(screen.queryByTestId('snackbar')).toBeNull();
  });

  it('is an alert and announces the message', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    announce.mockClear(); // RN's Jest setup already mocks it, so calls from earlier tests would still be counted.
    await render(ui('Podróż usunięta.'));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Podróż usunięta.');
    // TalkBack would read a live region and the announcement twice.
    expect(screen.getByTestId('snackbar').props.accessibilityLiveRegion).toBeUndefined();
  });

  it('calls onHide after 3500 ms, and not before', async () => {
    const onHide = jest.fn();
    await render(ui('Podróż usunięta.', onHide));
    await act(async () => {
      jest.advanceTimersByTime(3499);
    });
    expect(onHide).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  describe('with an owner that clears the message in onHide', () => {
    // The owner holds `message` in state, like the home screen does.
    function Owner() {
      const [message, setMessage] = useState<string | null>(null);
      return (
        <SafeAreaProvider initialMetrics={metrics}>
          <Pressable accessibilityRole="button" accessibilityLabel="show" onPress={() => setMessage('Podróż usunięta.')} />
          <Pressable accessibilityRole="button" accessibilityLabel="show other" onPress={() => setMessage('Inna wiadomość.')} />
          <Snackbar message={message} onHide={() => setMessage(null)} />
        </SafeAreaProvider>
      );
    }

    async function show(name: 'show' | 'show other') {
      await fireEvent.press(screen.getByRole('button', { name }));
    }

    async function pass(ms: number) {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
    }

    it('is gone after 3500 ms and the fade-out', async () => {
      await render(<Owner />);
      await show('show');
      expect(screen.getByText('Podróż usunięta.')).toBeTruthy();
      await pass(3500);
      expect(screen.getByText('Podróż usunięta.')).toBeTruthy(); // keeps its text while it fades out
      await pass(lightTheme.duration.small + 50);
      expect(screen.queryByText('Podróż usunięta.')).toBeNull();
    });

    it('is gone at once after 3500 ms when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
      await render(<Owner />);
      await show('show');
      await pass(3500);
      expect(screen.queryByText('Podróż usunięta.')).toBeNull();
    });

    it('shows the same text again after it was hidden: announced again, with a new timer', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
      announce.mockClear();
      await render(<Owner />);
      await show('show');
      await pass(3500);
      await pass(lightTheme.duration.small + 50);
      expect(screen.queryByText('Podróż usunięta.')).toBeNull();
      await show('show');
      expect(screen.getByText('Podróż usunięta.')).toBeTruthy();
      expect(announce).toHaveBeenCalledTimes(2);
      await pass(3499);
      expect(screen.getByText('Podróż usunięta.')).toBeTruthy();
      await pass(1);
      await pass(lightTheme.duration.small + 50);
      expect(screen.queryByText('Podróż usunięta.')).toBeNull();
    });

    it('shows a different message after it was hidden', async () => {
      await render(<Owner />);
      await show('show');
      await pass(3500);
      await pass(lightTheme.duration.small + 50);
      await show('show other');
      expect(screen.getByText('Inna wiadomość.')).toBeTruthy();
    });
  });

  it('restarts the timer when a new message arrives', async () => {
    const onHide = jest.fn();
    const view = await render(ui('Pierwsza.', onHide));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await view.rerender(ui('Druga.', onHide));
    expect(screen.getByText('Druga.')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onHide).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('clears the timer when it unmounts', async () => {
    const onHide = jest.fn();
    const view = await render(ui('Podróż usunięta.', onHide));
    await view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onHide).not.toHaveBeenCalled();
  });

  it('fades out once the message is gone, then removes itself', async () => {
    const view = await render(ui('Podróż usunięta.'));
    await view.rerender(ui(null));
    expect(screen.getByText('Podróż usunięta.')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(lightTheme.duration.small + 50);
    });
    expect(screen.queryByText('Podróż usunięta.')).toBeNull();
  });

  it('appears at full opacity at once when the system asks to reduce motion (§9.4)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
    await render(ui('Podróż usunięta.'));
    expect(screen.getByTestId('snackbar-container')).toHaveStyle({ opacity: 1 });
  });

  it('fades in over 180 ms when motion is allowed (§9.1 small transition, D14)', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(ui('Podróż usunięta.'));
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 180 }));
    await act(async () => {
      jest.advanceTimersByTime(lightTheme.duration.small + 50);
    });
    expect(screen.getByTestId('snackbar-container')).toHaveStyle({ opacity: 1 });
  });
});
