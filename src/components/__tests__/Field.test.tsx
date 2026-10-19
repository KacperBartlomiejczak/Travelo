import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import i18n from '@/i18n';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

/** Where a text sits in the rendered tree: a smaller number is higher on the screen. */
const position = (text: string) => JSON.stringify(screen.toJSON()).indexOf(text);

describe('Field', () => {
  it('puts the hint and the error under the control by default', async () => {
    await render(
      <Field label="Imię" hint="Podpowiedź">
        <View testID="control" accessibilityLabel="STEROWANIE" />
      </Field>,
    );
    expect(position('Imię')).toBeLessThan(position('STEROWANIE'));
    expect(position('STEROWANIE')).toBeLessThan(position('Podpowiedź'));

    await screen.rerender(
      <Field label="Imię" hint="Podpowiedź" error="Błąd">
        <View testID="control" accessibilityLabel="STEROWANIE" />
      </Field>,
    );
    expect(position('STEROWANIE')).toBeLessThan(position('Błąd'));
  });

  describe('with messagesFirst', () => {
    it('puts the hint between the label and the control', async () => {
      await render(
        <Field label="Zainteresowania" hint="Wybierz co najmniej jedno." messagesFirst>
          <View testID="control" accessibilityLabel="STEROWANIE" />
        </Field>,
      );
      expect(position('Zainteresowania')).toBeLessThan(position('Wybierz co najmniej jedno.'));
      expect(position('Wybierz co najmniej jedno.')).toBeLessThan(position('STEROWANIE'));
    });

    it('puts the error between the label and the control, with its icon, as a live region, and hides the hint', async () => {
      await render(
        <Field label="Zainteresowania" hint="Podpowiedź" error="Wybierz co najmniej jedno." messagesFirst>
          <View testID="control" accessibilityLabel="STEROWANIE" />
        </Field>,
      );
      expect(position('Zainteresowania')).toBeLessThan(position('Wybierz co najmniej jedno.'));
      expect(position('Wybierz co najmniej jedno.')).toBeLessThan(position('STEROWANIE'));
      expect(screen.queryByText('Podpowiedź')).toBeNull();
      expect(screen.getByText('Wybierz co najmniej jedno.').props.accessibilityLiveRegion).toBe('polite');
      expect(screen.getByTestId('field-error-icon', { includeHiddenElements: true })).toBeTruthy();
    });

    it('shows nothing extra without a hint or an error', async () => {
      await render(
        <Field label="Zainteresowania" messagesFirst>
          <View testID="control" accessibilityLabel="STEROWANIE" />
        </Field>,
      );
      expect(screen.getByLabelText('STEROWANIE')).toBeTruthy();
      expect(screen.queryByTestId('field-error-icon', { includeHiddenElements: true })).toBeNull();
    });
  });
});
