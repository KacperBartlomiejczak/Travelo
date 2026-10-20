import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the system asks to reduce motion (design-context §9.4): `null` until it has answered, then `true` / `false`, and
 * it follows the setting while the app runs. If the system cannot answer (the call can reject), play it safe: `true`, no
 * decorative motion. A change event after such a failure still counts.
 */
export function useReduceMotion(): boolean | null {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    // A change event is newer than the first answer: once one has arrived, the late answer (or failure) must not overwrite it.
    let changed = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && !changed && setReduceMotion(enabled))
      .catch(() => active && !changed && setReduceMotion(true));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      changed = true;
      setReduceMotion(enabled);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
