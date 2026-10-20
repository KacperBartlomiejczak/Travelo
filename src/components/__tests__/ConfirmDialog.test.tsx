import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { DarkThemeScope } from '@/theme/useTheme';

const TITLE = 'Odrzucić wpisane dane?';
const MESSAGE = 'Podróż nie zostanie zapisana.';

type Overrides = { visible?: boolean; destructive?: boolean };

function ui({ visible = true, destructive }: Overrides = {}, onConfirm: () => void = () => {}, onCancel: () => void = () => {}) {
  return (
    <ConfirmDialog
      visible={visible}
      title={TITLE}
      message={MESSAGE}
      confirmLabel="Odrzuć"
      cancelLabel="Zostań"
      destructive={destructive}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

async function renderDialog(overrides: Overrides = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  await render(ui(overrides, onConfirm, onCancel));
  return { onConfirm, onCancel };
}

const confirmButton = () => screen.getByRole('button', { name: 'Odrzuć' });
const cancelButton = () => screen.getByRole('button', { name: 'Zostań' });
const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);

beforeEach(async () => {
  jest.useFakeTimers();
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ConfirmDialog (design-context §10.17)', () => {
  describe('content', () => {
    it('renders nothing when not visible', async () => {
      await renderDialog({ visible: false });
      expect(screen.queryByText(TITLE)).toBeNull();
      expect(screen.queryByText(MESSAGE)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Odrzuć' })).toBeNull();
    });

    it('shows the title as a header, the message and both actions when visible', async () => {
      await renderDialog();
      expect(screen.getByRole('header', { name: TITLE })).toBeTruthy();
      expect(screen.getByText(MESSAGE)).toBeTruthy();
      expect(confirmButton()).toBeTruthy();
      expect(cancelButton()).toBeTruthy();
    });

    it('uses Heading 3 for the title and Body M for the message', async () => {
      await renderDialog();
      expect(screen.getByText(TITLE)).toHaveStyle({ ...lightTheme.typography.heading3, color: lightTheme.colors.text.primary });
      expect(screen.getByText(MESSAGE)).toHaveStyle({ ...lightTheme.typography.bodyM, color: lightTheme.colors.text.secondary });
    });
  });

  describe('actions', () => {
    it('calls onConfirm, and only onConfirm, when the confirm button is pressed', async () => {
      const { onConfirm, onCancel } = await renderDialog();
      await fireEvent.press(confirmButton());
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel, and only onCancel, when the cancel button is pressed', async () => {
      const { onConfirm, onCancel } = await renderDialog();
      await fireEvent.press(cancelButton());
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('cancels on a scrim tap, never confirms, and the scrim is a labelled button in the scrim colour', async () => {
      const { onConfirm, onCancel } = await renderDialog();
      // With accessibilityViewIsModal on the dialog, a screen reader skips its sibling the scrim (the cancel button is its way out).
      const scrim = screen.getByRole('button', { name: 'Zamknij', includeHiddenElements: true });
      expect(scrim).toHaveStyle({ backgroundColor: lightTheme.colors.overlay.scrim });
      await fireEvent.press(scrim);
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('cancels on the Android back button, never confirms', async () => {
      const { onConfirm, onCancel } = await renderDialog();
      await fireEvent(screen.getByTestId('confirm-dialog-modal'), 'requestClose');
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('is a transparent modal drawn under the status bar', async () => {
      await renderDialog();
      const modal = screen.getByTestId('confirm-dialog-modal');
      expect(modal.props.transparent).toBe(true);
      expect(modal.props.statusBarTranslucent).toBe(true);
    });

    it('stacks the actions full width, 16dp apart, with the confirm action above cancel', async () => {
      await renderDialog();
      const actions = screen.getByTestId('confirm-dialog-actions');
      expect(style(actions)).toMatchObject({ gap: lightTheme.spacing[4] });
      expect(style(actions).flexDirection).toBeUndefined(); // a column: stretched, full width
      expect(style(actions).alignItems).toBeUndefined();
      const labels = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel);
      expect(labels.indexOf('Odrzuć')).toBeLessThan(labels.indexOf('Zostań'));
    });

    it.each([
      ['destructive', true],
      ['primary', false],
    ])('makes the %s confirm button and the cancel button at least 44dp tall', async (_, destructive) => {
      await renderDialog({ destructive });
      expect(style(confirmButton()).minHeight).toBeGreaterThanOrEqual(lightTheme.size.touchTarget);
      expect(style(cancelButton()).minHeight).toBeGreaterThanOrEqual(lightTheme.size.touchTarget);
    });
  });

  describe('destructive', () => {
    it('draws the confirm label in the error colour, still with its text label', async () => {
      await renderDialog({ destructive: true });
      expect(screen.getByText('Odrzuć')).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(confirmButton()).toBeTruthy(); // the label carries the meaning, not the colour
      expect(screen.getByText('Zostań')).toHaveStyle({ color: lightTheme.colors.text.primary });
    });

    it('uses the primary button when it is not destructive', async () => {
      await renderDialog();
      expect(confirmButton()).toHaveStyle({ backgroundColor: lightTheme.colors.action.primary });
      expect(screen.getByText('Odrzuć')).toHaveStyle({ color: lightTheme.colors.action.onPrimary });
      expect(screen.getByText('Odrzuć')).not.toHaveStyle({ color: lightTheme.colors.status.error });
    });
  });

  describe('theme', () => {
    it('lays the dialog out with the token sizes, in light mode', async () => {
      await renderDialog();
      const dialog = screen.getByTestId('confirm-dialog');
      expect(dialog).toHaveStyle({
        width: '100%',
        maxWidth: lightTheme.size.maxContentWidth,
        borderRadius: lightTheme.radius.lg,
        padding: lightTheme.spacing[6],
        backgroundColor: lightTheme.colors.surface.elevated,
        ...lightTheme.elevation.dialog,
      });
      expect(screen.getByTestId('confirm-dialog-container')).toHaveStyle({ paddingHorizontal: lightTheme.spacing[5] });
    });

    it('uses the dark tokens in dark mode: the elevated surface instead of a shadow', async () => {
      await render(ui(), { wrapper: DarkThemeScope });
      const dialog = screen.getByTestId('confirm-dialog');
      expect(dialog).toHaveStyle({ backgroundColor: darkTheme.colors.surface.elevated, borderRadius: darkTheme.radius.lg });
      expect(style(dialog).shadowOpacity).toBeUndefined();
      expect(style(dialog).elevation).toBeUndefined();
      expect(screen.getByText(TITLE)).toHaveStyle({ color: darkTheme.colors.text.primary });
      expect(screen.getByText(MESSAGE)).toHaveStyle({ color: darkTheme.colors.text.secondary });
      expect(screen.getByRole('button', { name: 'Zamknij', includeHiddenElements: true })).toHaveStyle({
        backgroundColor: darkTheme.colors.overlay.scrim,
      });
    });
  });

  describe('accessibility', () => {
    it('marks the dialog as a modal view so a screen reader stays inside it', async () => {
      await renderDialog();
      expect(screen.getByTestId('confirm-dialog').props.accessibilityViewIsModal).toBe(true);
    });

    it('reads the title, then the message, then the actions', async () => {
      await renderDialog();
      const tree = JSON.stringify(screen.toJSON());
      const at = (text: string) => tree.indexOf(JSON.stringify(text));
      expect(at(TITLE)).toBeGreaterThan(-1);
      expect(at(TITLE)).toBeLessThan(at(MESSAGE));
      expect(at(MESSAGE)).toBeLessThan(at('Odrzuć'));
      expect(at('Odrzuć')).toBeLessThan(at('Zostań'));
    });
  });

  describe('motion (§9.1 dialog, §9.4)', () => {
    const container = () => screen.getByTestId('confirm-dialog-container');
    const pass = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
    };

    it('has a dialog duration token of 220 ms', () => {
      expect(lightTheme.duration.dialog).toBe(220);
    });

    it('fades in over the dialog duration', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await renderDialog();
      expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 220, useNativeDriver: false }));
      expect(style(container()).opacity).toBeLessThan(1);
      await pass(lightTheme.duration.dialog + 50);
      expect(container()).toHaveStyle({ opacity: 1 });
    });

    it('is fully visible at once, with no animation, when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const timing = jest.spyOn(Animated, 'timing');
      const view = await render(ui());
      expect(container()).toHaveStyle({ opacity: 1 });
      await pass(lightTheme.duration.dialog + 50);
      expect(container()).toHaveStyle({ opacity: 1 });
      // The setting is read asynchronously, so the first render may have started a fade; it is stopped, and no later one starts.
      timing.mockClear();
      await view.rerender(ui({ visible: false }));
      expect(timing).not.toHaveBeenCalled();
    });

    it('when the system cannot say whether to reduce motion, it shows without animation', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no native module'));
      const timing = jest.spyOn(Animated, 'timing');
      const view = await render(ui());
      expect(container()).toHaveStyle({ opacity: 1 });
      await pass(lightTheme.duration.dialog + 50);
      expect(container()).toHaveStyle({ opacity: 1 });
      timing.mockClear();
      await view.rerender(ui({ visible: false }));
      expect(timing).not.toHaveBeenCalled();
      expect(screen.queryByText(TITLE)).toBeNull();
    });

    it('fades out over the dialog duration after visible turns false, then removes itself', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const view = await render(ui());
      await pass(lightTheme.duration.dialog + 50);
      await view.rerender(ui({ visible: false }));
      expect(screen.getByText(TITLE)).toBeTruthy(); // still there while it fades
      await pass(lightTheme.duration.dialog + 50);
      expect(screen.queryByText(TITLE)).toBeNull();
    });

    it('disappears at once after visible turns false when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const view = await render(ui());
      await view.rerender(ui({ visible: false }));
      expect(screen.queryByText(TITLE)).toBeNull();
    });

    it('can be opened again after it was closed', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const view = await render(ui({ visible: false }));
      await view.rerender(ui());
      expect(screen.getByText(TITLE)).toBeTruthy();
      await pass(lightTheme.duration.dialog + 50);
      await view.rerender(ui({ visible: false }));
      await pass(lightTheme.duration.dialog + 50);
      expect(screen.queryByText(TITLE)).toBeNull();
      await view.rerender(ui());
      expect(screen.getByText(TITLE)).toBeTruthy();
    });
  });
});
