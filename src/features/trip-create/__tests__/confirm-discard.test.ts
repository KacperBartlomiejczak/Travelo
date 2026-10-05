import { Alert, Platform } from 'react-native';

import { confirmDiscard } from '@/features/trip-create/confirm-discard';
import i18n from '@/i18n';

const t = i18n.getFixedT('pl');

afterEach(() => {
  jest.restoreAllMocks();
});

describe('confirmDiscard', () => {
  it('asks with the system alert and discards only on "Odrzuć" (D22)', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onDiscard = jest.fn();
    confirmDiscard(t, onDiscard);

    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Odrzucić wpisane dane?');
    expect(message).toBe('Podróż nie zostanie zapisana.');
    expect(buttons?.map((button) => [button.text, button.style])).toEqual([
      ['Zostań', 'cancel'],
      ['Odrzuć', 'destructive'],
    ]);

    buttons?.[0].onPress?.();
    expect(onDiscard).not.toHaveBeenCalled();
    buttons?.[1].onPress?.();
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('uses the browser confirm on web', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const confirm = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    Object.defineProperty(globalThis, 'confirm', { value: confirm, configurable: true });
    const onDiscard = jest.fn();

    try {
      confirmDiscard(t, onDiscard);
      expect(onDiscard).not.toHaveBeenCalled();
      confirmDiscard(t, onDiscard);
      expect(onDiscard).toHaveBeenCalledTimes(1);
      expect(confirm).toHaveBeenCalledWith('Odrzucić wpisane dane?\nPodróż nie zostanie zapisana.');
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
      Reflect.deleteProperty(globalThis, 'confirm');
    }
  });
});
