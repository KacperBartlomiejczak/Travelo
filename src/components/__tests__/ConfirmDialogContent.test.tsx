import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import i18n from '@/i18n';

type Extra = { destructive?: boolean; confirmDisabled?: boolean; busy?: boolean; withChildren?: boolean };

async function renderDialog({ destructive = true, confirmDisabled, busy, withChildren }: Extra = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  await render(
    <ConfirmDialog
      visible
      title="Usunąć konto?"
      message="Tego nie da się cofnąć."
      confirmLabel="Usuń konto"
      cancelLabel="Anuluj"
      destructive={destructive}
      confirmDisabled={confirmDisabled}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {withChildren ? <Text>extra content</Text> : undefined}
    </ConfirmDialog>,
  );
  return { onConfirm, onCancel };
}

const confirmButton = () => screen.getByRole('button', { name: 'Usuń konto' });
const cancelButton = () => screen.getByRole('button', { name: 'Anuluj' });

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('ConfirmDialog — optional content, disabled confirm and busy (profile-settings step 11, D17, D18)', () => {
  it('shows the children between the message and the actions', async () => {
    await renderDialog({ withChildren: true });
    const labels = JSON.stringify(screen.toJSON());
    expect(labels.indexOf('Tego nie da się cofnąć.')).toBeLessThan(labels.indexOf('extra content'));
    expect(labels.indexOf('extra content')).toBeLessThan(labels.indexOf('confirm-dialog-actions'));
  });

  it.each([true, false])('confirmDisabled (destructive: %s) disables the confirm button and it never confirms; cancel still works', async (destructive) => {
    const { onConfirm, onCancel } = await renderDialog({ destructive, confirmDisabled: true });
    expect(confirmButton()).toBeDisabled();
    await fireEvent.press(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(cancelButton());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('without the new props the confirm button is enabled and not busy', async () => {
    const { onConfirm } = await renderDialog();
    expect(confirmButton()).toBeEnabled();
    expect(confirmButton()).not.toBeBusy();
    await fireEvent.press(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('busy (destructive: %s) shows a busy indicator on the confirm button and does not confirm again', async (destructive) => {
    const { onConfirm } = await renderDialog({ destructive, busy: true });
    expect(confirmButton()).toBeBusy();
    expect(screen.getByTestId(destructive ? 'text-button-spinner' : 'primary-button-spinner')).toBeTruthy();
    await fireEvent.press(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('busy: the dialog cannot be closed by cancel, the scrim or the Android back button', async () => {
    const { onConfirm, onCancel } = await renderDialog({ busy: true });
    await fireEvent.press(cancelButton());
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij', includeHiddenElements: true }));
    await fireEvent(screen.getByTestId('confirm-dialog-modal'), 'requestClose');
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(cancelButton()).toBeDisabled();
  });

  it('with children it moves above the keyboard (padding), like the bottom sheet; without children it is unchanged', async () => {
    await renderDialog({ withChildren: true });
    // The padding itself follows the keyboard, which Jest does not have: it is checked on a device (manual step).
    const frame = screen.getByTestId('confirm-dialog-keyboard');
    expect(StyleSheet.flatten(frame.props.style)).toMatchObject({ flex: 1 });
    expect(within(frame).getByTestId('confirm-dialog')).toBeTruthy();
  });

  it('without children there is no keyboard-avoiding wrapper', async () => {
    await renderDialog();
    expect(screen.queryByTestId('confirm-dialog-keyboard')).toBeNull();
  });
});
