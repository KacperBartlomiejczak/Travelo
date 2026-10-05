import type { TFunction } from 'i18next';
import { Alert, Platform } from 'react-native';

/** "Discard entered data?" with the system dialog (D22); calls `onDiscard` only if confirmed. */
export function confirmDiscard(t: TFunction, onDiscard: () => void): void {
  const title = t('newTrip.discard.title');
  const message = t('newTrip.discard.message');
  if (Platform.OS === 'web') {
    // Alert.alert does nothing on react-native-web.
    if (globalThis.confirm(`${title}\n${message}`)) onDiscard();
    return;
  }
  Alert.alert(title, message, [
    { text: t('newTrip.discard.cancel'), style: 'cancel' },
    { text: t('newTrip.discard.confirm'), style: 'destructive', onPress: onDiscard },
  ]);
}
