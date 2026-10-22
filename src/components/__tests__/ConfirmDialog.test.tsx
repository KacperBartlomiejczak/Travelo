import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { dialog } = tokens.components;

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

    it('uses headingSM for the title and bodyMD for the message', async () => {
      await renderDialog();
      expect(screen.getByText(TITLE)).toHaveStyle({ ...tokens.typography.styles.headingSM, color: lightTheme.text.primary });
      expect(screen.getByText(MESSAGE)).toHaveStyle({ ...tokens.typography.styles.bodyMD, color: lightTheme.text.secondary });
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

    it('cancels on a scrim tap, never confirms, and the scrim is a labelled button, black at the 0.48 backdrop opacity (§8.18, A6)', async () => {
      const { onConfirm, onCancel } = await renderDialog();
      // With accessibilityViewIsModal on the dialog, a screen reader skips its sibling the scrim (the cancel button is its way out).
      const scrim = screen.getByRole('button', { name: 'Zamknij', includeHiddenElements: true });
      expect(style(scrim)).toMatchObject({ backgroundColor: tokens.primitives.pure.black, opacity: dialog.backdropOpacity });
      expect(dialog.backdropOpacity).toBe(0.48);
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
      expect(style(actions)).toMatchObject({ gap: tokens.spacing[4] });
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
      expect(style(confirmButton()).minHeight).toBeGreaterThanOrEqual(tokens.layout.touchTarget);
      expect(style(cancelButton()).minHeight).toBeGreaterThanOrEqual(tokens.layout.touchTarget);
    });
  });

  describe('destructive', () => {
    it('draws the confirm label in the error colour, still with its text label', async () => {
      await renderDialog({ destructive: true });
      expect(screen.getByText('Odrzuć')).toHaveStyle({ color: lightTheme.semantic.error.foreground });
      expect(confirmButton()).toBeTruthy(); // the label carries the meaning, not the colour
      expect(screen.getByText('Zostań')).toHaveStyle({ color: lightTheme.text.primary });
    });

    it('uses the primary button when it is not destructive', async () => {
      await renderDialog();
      expect(confirmButton()).toHaveStyle({ backgroundColor: lightTheme.brand.primary });
      expect(screen.getByText('Odrzuć')).toHaveStyle({ color: lightTheme.brand.onBrand });
      expect(screen.getByText('Odrzuć')).not.toHaveStyle({ color: lightTheme.semantic.error.foreground });
    });
  });

  describe('theme', () => {
    it('lays the dialog out with the §8.18 sizes, in light mode: 360dp wide at most, 20dp padding, 24dp corners, level 3', async () => {
      await renderDialog();
      const element = screen.getByTestId('confirm-dialog');
      expect(element).toHaveStyle({
        width: '100%',
        maxWidth: dialog.maxWidth,
        borderRadius: dialog.radius,
        padding: dialog.padding,
        backgroundColor: lightTheme.surface.overlay,
        ...lightTheme.elevation.level3,
      });
      expect([dialog.maxWidth, dialog.radius, dialog.padding]).toEqual([360, 24, 20]);
      expect(screen.getByTestId('confirm-dialog-container')).toHaveStyle({ paddingHorizontal: dialog.horizontalMargin });
    });

    it('uses the dark tokens in dark mode: the overlay surface and a level 3 border instead of a shadow', async () => {
      await render(ui(), { wrapper: DarkThemeScope });
      const element = screen.getByTestId('confirm-dialog');
      expect(element).toHaveStyle({ backgroundColor: darkTheme.surface.overlay, borderRadius: dialog.radius, ...darkTheme.elevation.level3 });
      expect(style(element).shadowOpacity).toBe(0);
      expect(style(element).elevation).toBe(0);
      expect(style(element).borderWidth).toBe(1);
      expect(screen.getByText(TITLE)).toHaveStyle({ color: darkTheme.text.primary });
      expect(screen.getByText(MESSAGE)).toHaveStyle({ color: darkTheme.text.secondary });
      expect(style(screen.getByRole('button', { name: 'Zamknij', includeHiddenElements: true }))).toMatchObject({
        backgroundColor: tokens.primitives.pure.black,
        opacity: dialog.backdropOpacity,
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

    it('fades over the standard duration token, 180 ms (no dialog-specific token in the Sunline motion scale)', () => {
      expect(tokens.motion.duration.standard).toBe(180);
    });

    it('fades in over the dialog duration', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await renderDialog();
      expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: tokens.motion.duration.standard, useNativeDriver: false }));
      expect(style(container()).opacity).toBeLessThan(1);
      await pass(tokens.motion.duration.standard + 50);
      expect(container()).toHaveStyle({ opacity: 1 });
    });

    it('is fully visible at once, with no animation, when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const timing = jest.spyOn(Animated, 'timing');
      const view = await render(ui());
      expect(container()).toHaveStyle({ opacity: 1 });
      await pass(tokens.motion.duration.standard + 50);
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
      await pass(tokens.motion.duration.standard + 50);
      expect(container()).toHaveStyle({ opacity: 1 });
      timing.mockClear();
      await view.rerender(ui({ visible: false }));
      expect(timing).not.toHaveBeenCalled();
      expect(screen.queryByText(TITLE)).toBeNull();
    });

    it('fades out over the dialog duration after visible turns false, then removes itself', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const view = await render(ui());
      await pass(tokens.motion.duration.standard + 50);
      await view.rerender(ui({ visible: false }));
      expect(screen.getByText(TITLE)).toBeTruthy(); // still there while it fades
      await pass(tokens.motion.duration.standard + 50);
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
      await pass(tokens.motion.duration.standard + 50);
      await view.rerender(ui({ visible: false }));
      await pass(tokens.motion.duration.standard + 50);
      expect(screen.queryByText(TITLE)).toBeNull();
      await view.rerender(ui());
      expect(screen.getByText(TITLE)).toBeTruthy();
    });
  });
});
